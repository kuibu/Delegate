import { posix as pathPosix } from "node:path";

import {
  executeToolResponseSchema,
  listApprovalsResponseSchema,
  listArtifactsResponseSchema,
  resolveApprovalRequestSchema,
  resolveApprovalResponseSchema,
  type CapabilityKind,
  type ToolExecutionRequest,
} from "@delegate/compute-protocol";

import { createApprovalRequestForExecution } from "./approvals";
import {
  applyExecutionBilling,
  estimateCreditUsage,
  summarizeBudgetAvailability,
  type ExecutionBillingSummary,
} from "./billing";
import { computeBrokerConfig } from "./config";
import { persistExecutionArtifacts } from "./artifacts";
import { normalizeContainerPath } from "./path-utils";
import { prisma } from "./prisma";
import { evaluateExecutionRequest, loadSessionPolicyContext } from "./policy";
import { runDockerExecution } from "./runner";
import {
  mapCapabilityFromDb,
  mapPolicyDecisionToDb,
  serializeApprovalRequest,
  serializeArtifact,
  serializeExecution,
  serializeSession,
} from "./serializers";
import { SessionError } from "./sessions";

type PolicyExecutionContext = Awaited<ReturnType<typeof loadSessionPolicyContext>>;
type NormalizedExecutionInput = {
  capability: CapabilityKind;
  command: string | undefined;
  content: string | undefined;
  path: string | undefined;
  domain: string | undefined;
  url: string | undefined;
  workingDirectory: string | undefined;
  estimatedCostCents: number | undefined;
  hasPaidEntitlement: boolean;
};

type ExecutionPlan = {
  capability: CapabilityKind;
  requestedCommand: string | undefined;
  requestedPath: string | undefined;
  workingDirectory: string | undefined;
  runnerImage: string;
  command: string;
  networkMode: PolicyExecutionContext["profile"]["networkMode"];
  filesystemMode: PolicyExecutionContext["profile"]["filesystemMode"];
};

export async function executeTool(sessionId: string, rawInput: unknown) {
  const { input, context, decision } = await evaluateExecutionRequest(sessionId, rawInput);
  const normalized = normalizeExecutionInput(input);
  const estimatedCredits = estimateCreditUsage({
    capability: normalized.capability,
    ...(typeof normalized.estimatedCostCents === "number"
      ? { estimatedCostCents: normalized.estimatedCostCents }
      : {}),
  });
  const budgetAvailability = summarizeBudgetAvailability(context.session);
  const effectiveDecision = resolveEffectiveDecision({
    context,
    input: normalized,
    decision,
    estimatedCredits,
    totalAvailableCredits: budgetAvailability.totalAvailableCredits,
  });

  await prisma.eventAudit.create({
    data: {
      representativeId: context.session.representativeId,
      contactId: context.session.contactId ?? null,
      conversationId: context.session.conversationId ?? null,
      type: "TOOL_EXECUTION_REQUESTED",
      payload: {
        sessionId,
        capability: normalized.capability,
        command: normalized.command ?? null,
        path: normalized.path ?? null,
        url: normalized.url ?? null,
        workingDirectory: normalized.workingDirectory ?? null,
        decision: effectiveDecision.decision,
        estimatedCredits,
      },
    },
  });

  if (effectiveDecision.decision === "deny") {
    return blockExecution({
      session: context.session,
      capability: normalized.capability,
      requestedCommand: getPersistedCommand(normalized),
      requestedPath: normalized.path,
      workingDirectory: normalized.workingDirectory,
      policyDecision: "deny",
      reason: effectiveDecision.reason,
      billing: {
        estimatedCredits,
        conversationBudgetRemainingCredits: budgetAvailability.conversationCredits,
        ownerBalanceCredits: budgetAvailability.ownerBalanceCredits,
        sponsorPoolCredit: budgetAvailability.sponsorPoolCredit,
      },
    });
  }

  if (effectiveDecision.decision === "ask") {
    const execution = await prisma.toolExecution.create({
      data: {
        sessionId,
        capability: normalized.capability.toUpperCase() as
          | "EXEC"
          | "READ"
          | "WRITE"
          | "PROCESS"
          | "BROWSER",
        status: "BLOCKED",
        requestedCommand: getPersistedCommand(normalized) ?? null,
        requestedPath: normalized.path ?? null,
        workingDirectory: normalized.workingDirectory ?? null,
        policyDecision: mapPolicyDecisionToDb("ask"),
      },
    });

    const approval = await createApprovalRequestForExecution({
      representativeId: context.session.representativeId,
      contactId: context.session.contactId ?? null,
      conversationId: context.session.conversationId ?? null,
      sessionId,
      executionId: execution.id,
      reason: effectiveDecision.reason,
      requestedActionSummary: summarizeAction(normalized),
      riskSummary: buildRiskSummary(effectiveDecision.reason),
    });

    const session = await touchSessionIdle(sessionId);

    await prisma.eventAudit.create({
      data: {
        representativeId: context.session.representativeId,
        contactId: context.session.contactId ?? null,
        conversationId: context.session.conversationId ?? null,
        type: "TOOL_EXECUTION_BLOCKED",
        payload: {
          sessionId,
          executionId: execution.id,
          decision: "ask",
          reason: effectiveDecision.reason,
          approvalRequestId: approval.id,
        },
      },
    });

    return executeToolResponseSchema.parse({
      outcome: "pending_approval",
      session: serializeSession(session),
      execution: serializeExecution({
        ...execution,
        approvalRequestId: approval.id,
      }),
      approvalRequest: serializeApprovalRequest(approval),
      artifacts: [],
      billing: {
        estimatedCredits,
        conversationBudgetRemainingCredits: budgetAvailability.conversationCredits,
        ownerBalanceCredits: budgetAvailability.ownerBalanceCredits,
        sponsorPoolCredit: budgetAvailability.sponsorPoolCredit,
      },
    });
  }

  return runAllowedExecution({
    context,
    input: normalized,
    estimatedCredits,
  });
}

export async function resolveApproval(approvalId: string, rawInput: unknown) {
  const input = resolveApprovalRequestSchema.parse(rawInput);

  const approval = await prisma.approvalRequest.findUnique({
    where: { id: approvalId },
  });

  if (!approval) {
    throw new SessionError(404, "approval_request_not_found");
  }

  if (approval.status !== "PENDING") {
    throw new SessionError(409, "approval_request_already_resolved");
  }

  const blockedExecution =
    approval.toolExecutionId
      ? await prisma.toolExecution.findUnique({
          where: { id: approval.toolExecutionId },
        })
      : null;

  if (approval.toolExecutionId && !blockedExecution) {
    throw new SessionError(409, "approval_request_execution_missing");
  }

  if (input.resolution === "rejected") {
    const resolvedAt = new Date();
    const { updatedApproval, updatedExecution, updatedSession } = await prisma.$transaction(
      async (tx) => {
        const nextApproval = await tx.approvalRequest.update({
          where: { id: approval.id },
          data: {
            status: "REJECTED",
            resolvedAt,
            resolvedBy: input.resolvedBy ?? "owner-dashboard",
          },
        });

        const nextExecution =
          blockedExecution
            ? await tx.toolExecution.update({
                where: { id: blockedExecution.id },
                data: {
                  status: "CANCELED",
                  finishedAt: resolvedAt,
                },
              })
            : null;

        const nextSession =
          approval.sessionId
            ? await tx.computeSession.update({
                where: { id: approval.sessionId },
                data: {
                  status: "IDLE",
                  lastHeartbeatAt: resolvedAt,
                },
              })
            : null;

        await tx.eventAudit.create({
          data: {
            representativeId: approval.representativeId,
            contactId: approval.contactId ?? null,
            conversationId: approval.conversationId ?? null,
            type: "APPROVAL_RESOLVED",
            payload: {
              approvalRequestId: approval.id,
              resolution: "rejected",
              toolExecutionId: approval.toolExecutionId ?? null,
            },
          },
        });

        return {
          updatedApproval: nextApproval,
          updatedExecution: nextExecution,
          updatedSession: nextSession,
        };
      },
    );

    return resolveApprovalResponseSchema.parse({
      outcome: "rejected",
      approvalRequest: serializeApprovalRequest(updatedApproval),
      session: updatedSession ? serializeSession(updatedSession) : null,
      execution: updatedExecution ? serializeExecution(updatedExecution) : null,
      artifacts: [],
    });
  }

  const context = approval.sessionId ? await loadSessionPolicyContext(approval.sessionId) : null;

  const resolvedAt = new Date();
  const updatedApproval = await prisma.approvalRequest.update({
    where: { id: approval.id },
    data: {
      status: "APPROVED",
      resolvedAt,
      resolvedBy: input.resolvedBy ?? "owner-dashboard",
    },
  });

  await prisma.$transaction([
    prisma.eventAudit.create({
      data: {
        representativeId: approval.representativeId,
        contactId: approval.contactId ?? null,
        conversationId: approval.conversationId ?? null,
        type: "APPROVAL_RESOLVED",
        payload: {
          approvalRequestId: approval.id,
          resolution: "approved",
          toolExecutionId: approval.toolExecutionId ?? null,
        },
      },
    }),
    ...(approval.contactId
      ? [
          prisma.contact.update({
            where: { id: approval.contactId },
            data: {
              lastApprovalGrantedAt: resolvedAt,
            },
          }),
        ]
      : []),
  ]);

  if (!blockedExecution || !context) {
    return resolveApprovalResponseSchema.parse({
      outcome: "approved",
      approvalRequest: serializeApprovalRequest(updatedApproval),
      artifacts: [],
    });
  }

  const normalized = reconstructExecutionInput(blockedExecution);
  const result = await runAllowedExecution({
    context,
    input: normalized,
    existingExecutionId: blockedExecution.id,
  });

  return resolveApprovalResponseSchema.parse({
    outcome: "approved_and_executed",
    approvalRequest: serializeApprovalRequest(updatedApproval),
    session: result.session,
    execution: result.execution,
    artifacts: result.artifacts,
    billing: result.billing,
  });
}

export async function listSessionArtifacts(sessionId: string) {
  const session = await prisma.computeSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new SessionError(404, "compute_session_not_found");
  }

  const artifacts = await prisma.artifact.findMany({
    where: { sessionId },
    orderBy: [{ createdAt: "desc" }],
  });

  return listArtifactsResponseSchema.parse({
    session: serializeSession(session),
    artifacts: artifacts.map((artifact) => serializeArtifact(artifact)),
  });
}

export async function listSessionApprovals(sessionId: string) {
  const session = await prisma.computeSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new SessionError(404, "compute_session_not_found");
  }

  const approvals = await prisma.approvalRequest.findMany({
    where: { sessionId },
    orderBy: [{ requestedAt: "desc" }],
  });

  return listApprovalsResponseSchema.parse({
    session: serializeSession(session),
    approvals: approvals.map((approval) => serializeApprovalRequest(approval)),
  });
}

async function runAllowedExecution(params: {
  context: PolicyExecutionContext;
  input: NormalizedExecutionInput;
  estimatedCredits?: number;
  existingExecutionId?: string;
}) {
  const startedAt = new Date();
  const executionPlan = buildExecutionPlan(params.context, params.input);
  const execution = params.existingExecutionId
    ? await prisma.toolExecution.update({
        where: { id: params.existingExecutionId },
        data: {
          status: "RUNNING",
          capability: executionPlan.capability.toUpperCase() as
            | "EXEC"
            | "READ"
            | "WRITE"
            | "PROCESS"
            | "BROWSER",
          requestedCommand: executionPlan.requestedCommand ?? null,
          requestedPath: executionPlan.requestedPath ?? null,
          workingDirectory: executionPlan.workingDirectory ?? null,
          policyDecision: mapPolicyDecisionToDb("allow"),
          startedAt,
          finishedAt: null,
          exitCode: null,
          cpuMs: null,
          wallMs: null,
          bytesRead: null,
          bytesWritten: null,
        },
      })
    : await prisma.toolExecution.create({
        data: {
          sessionId: params.context.session.id,
          capability: executionPlan.capability.toUpperCase() as
            | "EXEC"
            | "READ"
            | "WRITE"
            | "PROCESS"
            | "BROWSER",
          status: "RUNNING",
          requestedCommand: executionPlan.requestedCommand ?? null,
          requestedPath: executionPlan.requestedPath ?? null,
          workingDirectory: executionPlan.workingDirectory ?? null,
          policyDecision: mapPolicyDecisionToDb("allow"),
          startedAt,
        },
      });

  await prisma.computeSession.update({
    where: { id: params.context.session.id },
    data: {
      status: "RUNNING",
      startedAt: params.context.session.startedAt ?? startedAt,
      lastHeartbeatAt: startedAt,
      failureReason: null,
    },
  });

  const runnerResult = await runDockerExecution({
    image: executionPlan.runnerImage,
    command: executionPlan.command,
    hostWorkspaceRoot: computeBrokerConfig.hostWorkspaceRoot,
    maxCommandSeconds: params.context.profile.maxCommandSeconds,
    networkMode: executionPlan.networkMode,
    filesystemMode: executionPlan.filesystemMode,
    workingDirectory: executionPlan.workingDirectory,
    sessionId: params.context.session.id,
    executionId: execution.id,
  });

  const finishedAt = new Date();
  const artifacts = await persistExecutionArtifacts({
    representativeId: params.context.session.representativeId,
    representativeSlug: params.context.session.representative.slug,
    contactId: params.context.session.contactId ?? null,
    conversationId: params.context.session.conversationId ?? null,
    sessionId: params.context.session.id,
    executionId: execution.id,
    retentionDays: params.context.profile.artifactRetentionDays,
    stdout: runnerResult.stdout,
    stderr: runnerResult.stderr,
  });

  const totalArtifactBytes = artifacts.reduce((sum, artifact) => sum + artifact.sizeBytes, 0);
  const updatedExecution = await prisma.toolExecution.update({
    where: { id: execution.id },
    data: {
      status: runnerResult.exitCode === 0 ? "SUCCEEDED" : "FAILED",
      finishedAt,
      exitCode: runnerResult.exitCode,
      wallMs: runnerResult.wallMs,
      cpuMs: null,
      bytesRead: Buffer.byteLength(runnerResult.stdout, "utf8"),
      bytesWritten: totalArtifactBytes,
    },
  });

  const updatedSession = await prisma.computeSession.update({
    where: { id: params.context.session.id },
    data: {
      status: "IDLE",
      lastHeartbeatAt: finishedAt,
      failureReason: runnerResult.exitCode === 0 ? null : truncate(runnerResult.stderr, 240),
    },
  });

  const computeCostCents = Math.max(1, Math.ceil(runnerResult.wallMs / 1000));
  const storageCostCents = totalArtifactBytes > 0 ? Math.max(1, Math.ceil(totalArtifactBytes / 65536)) : 0;
  const computeCredits = estimateCreditUsage({
    capability: executionPlan.capability,
    estimatedCostCents: computeCostCents,
  });
  const storageCredits = totalArtifactBytes > 0 ? Math.ceil(totalArtifactBytes / 65536) : 0;
  const billing = await applyExecutionBilling({
    representativeId: params.context.session.representativeId,
    contactId: params.context.session.contactId ?? null,
    conversationId: params.context.session.conversationId ?? null,
    sessionId: params.context.session.id,
    toolExecutionId: execution.id,
    ownerId: params.context.session.representative.owner.id,
    computeCredits,
    storageCredits,
    computeCostCents,
    storageCostCents,
    finishedAt,
  });

  await prisma.$transaction([
    prisma.eventAudit.create({
      data: {
        representativeId: params.context.session.representativeId,
        contactId: params.context.session.contactId ?? null,
        conversationId: params.context.session.conversationId ?? null,
        type: "TOOL_EXECUTION_COMPLETED",
        payload: {
          sessionId: params.context.session.id,
          executionId: execution.id,
          capability: executionPlan.capability,
          exitCode: runnerResult.exitCode,
          wallMs: runnerResult.wallMs,
          artifactCount: artifacts.length,
        },
      },
    }),
    prisma.eventAudit.create({
      data: {
        representativeId: params.context.session.representativeId,
        contactId: params.context.session.contactId ?? null,
        conversationId: params.context.session.conversationId ?? null,
        type: "BILLING_LEDGER_RECORDED",
        payload: {
          sessionId: params.context.session.id,
          executionId: execution.id,
          kinds: ["COMPUTE_MINUTES", "STORAGE_BYTES"],
          actualCredits: billing.actualCredits,
        },
      },
    }),
  ]);

  return executeToolResponseSchema.parse({
    outcome: runnerResult.exitCode === 0 ? "completed" : "failed",
    session: serializeSession(updatedSession),
    execution: serializeExecution(updatedExecution),
    artifacts: artifacts.map((artifact) => serializeArtifact(artifact)),
    billing: {
      estimatedCredits: params.estimatedCredits,
      ...billing,
    },
  });
}

async function touchSessionIdle(sessionId: string) {
  return prisma.computeSession.update({
    where: { id: sessionId },
    data: {
      status: "IDLE",
      lastHeartbeatAt: new Date(),
    },
  });
}

async function blockExecution(params: {
  session: {
    id: string;
    representativeId: string;
    contactId: string | null;
    conversationId: string | null;
    requestedBy: string;
    status: string;
    runnerType: string;
    baseImage: string;
    containerId: string | null;
    createdAt: Date;
    updatedAt: Date;
    startedAt: Date | null;
    lastHeartbeatAt: Date | null;
    expiresAt: Date | null;
    endedAt: Date | null;
    failureReason: string | null;
    policyProfileId: string | null;
  };
  capability: CapabilityKind;
  requestedCommand: string | undefined;
  requestedPath: string | undefined;
  workingDirectory: string | undefined;
  policyDecision: "deny" | "ask";
  reason: string;
  billing?: ExecutionBillingSummary;
}) {
  const execution = await prisma.toolExecution.create({
    data: {
      sessionId: params.session.id,
      capability: params.capability.toUpperCase() as "EXEC" | "READ" | "WRITE" | "PROCESS" | "BROWSER",
      status: "BLOCKED",
      requestedCommand: params.requestedCommand ?? null,
      requestedPath: params.requestedPath ?? null,
      workingDirectory: params.workingDirectory ?? null,
      policyDecision: mapPolicyDecisionToDb(params.policyDecision),
    },
  });

  const session = await touchSessionIdle(params.session.id);

  await prisma.eventAudit.create({
    data: {
      representativeId: params.session.representativeId,
      contactId: params.session.contactId ?? null,
      conversationId: params.session.conversationId ?? null,
      type: "TOOL_EXECUTION_BLOCKED",
      payload: {
        sessionId: params.session.id,
        executionId: execution.id,
        decision: params.policyDecision,
        reason: params.reason,
      },
    },
  });

  return executeToolResponseSchema.parse({
    outcome: "blocked",
    session: serializeSession(session),
    execution: serializeExecution(execution),
    artifacts: [],
    billing: params.billing,
  });
}

function resolveEffectiveDecision(params: {
  context: PolicyExecutionContext;
  input: NormalizedExecutionInput;
  decision: {
    decision: "allow" | "ask" | "deny";
    reason: string;
    matchedRuleId?: string;
  };
  estimatedCredits: number;
  totalAvailableCredits: number;
}) {
  if (
    (params.input.capability === "exec" || params.input.capability === "process") &&
    params.input.command &&
    !isSimpleExecCommand(params.input.command)
  ) {
    return {
      decision: "ask" as const,
      reason: "complex_shell_command",
    };
  }

  if (params.input.capability === "browser" && params.context.profile.networkMode === "no_network") {
    return {
      decision: "deny" as const,
      reason: "browser_requires_network",
    };
  }

  if (
    params.input.capability === "write" &&
    params.context.profile.filesystemMode === "read_only_workspace"
  ) {
    return {
      decision: "deny" as const,
      reason: "filesystem_read_only",
    };
  }

  if (
    params.context.session.representative.computeAutoApproveBudgetCents > 0 &&
    typeof params.input.estimatedCostCents === "number" &&
    params.input.estimatedCostCents > params.context.session.representative.computeAutoApproveBudgetCents &&
    params.decision.decision === "allow"
  ) {
    return {
      decision: "ask" as const,
      reason: "auto_approve_budget_exceeded",
    };
  }

  if (params.estimatedCredits > params.totalAvailableCredits) {
    return {
      decision: "deny" as const,
      reason: "insufficient_compute_budget",
    };
  }

  return params.decision;
}

function normalizeExecutionInput(input: ToolExecutionRequest): NormalizedExecutionInput {
  switch (input.capability) {
    case "read": {
      if (!input.path) {
        throw new SessionError(400, "path_required_for_read");
      }
      return {
        capability: "read",
        command: undefined,
        content: undefined,
        path: input.path,
        domain: undefined,
        url: undefined,
        workingDirectory: input.workingDirectory,
        estimatedCostCents: input.estimatedCostCents,
        hasPaidEntitlement: input.hasPaidEntitlement,
      };
    }
    case "write": {
      const content = input.content ?? input.command;
      if (!input.path) {
        throw new SessionError(400, "path_required_for_write");
      }
      if (!content) {
        throw new SessionError(400, "content_required_for_write");
      }
      return {
        capability: "write",
        command: undefined,
        path: input.path,
        content,
        domain: undefined,
        url: undefined,
        workingDirectory: input.workingDirectory,
        estimatedCostCents: input.estimatedCostCents,
        hasPaidEntitlement: input.hasPaidEntitlement,
      };
    }
    case "browser": {
      const url = input.url ?? input.command;
      if (!url) {
        throw new SessionError(400, "url_required_for_browser");
      }
      const parsed = new URL(url);
      return {
        capability: "browser",
        command: undefined,
        content: undefined,
        path: undefined,
        url: parsed.toString(),
        domain: input.domain ?? parsed.hostname,
        workingDirectory: undefined,
        estimatedCostCents: input.estimatedCostCents,
        hasPaidEntitlement: input.hasPaidEntitlement,
      };
    }
    case "process":
    case "exec":
    default: {
      if (!input.command) {
        throw new SessionError(400, "command_required_for_exec");
      }
      return {
        capability: input.capability,
        command: input.command,
        content: undefined,
        path: input.path,
        domain: input.domain,
        url: undefined,
        workingDirectory: input.workingDirectory,
        estimatedCostCents: input.estimatedCostCents,
        hasPaidEntitlement: input.hasPaidEntitlement,
      };
    }
  }
}

function reconstructExecutionInput(execution: {
  capability: string;
  requestedCommand: string | null;
  requestedPath: string | null;
  workingDirectory: string | null;
}) {
  const capability = mapCapabilityFromDb(execution.capability);

  if (capability === "read") {
    if (!execution.requestedPath) {
      throw new SessionError(409, "approved_read_missing_path");
    }
    return normalizeExecutionInput({
      capability,
      path: execution.requestedPath,
      hasPaidEntitlement: true,
    });
  }

  if (capability === "write") {
    if (!execution.requestedPath || !execution.requestedCommand) {
      throw new SessionError(409, "approved_write_missing_payload");
    }
    return normalizeExecutionInput({
      capability,
      path: execution.requestedPath,
      content: execution.requestedCommand,
      workingDirectory: execution.workingDirectory ?? undefined,
      hasPaidEntitlement: true,
    });
  }

  if (capability === "browser") {
    if (!execution.requestedCommand) {
      throw new SessionError(409, "approved_browser_missing_url");
    }
    return normalizeExecutionInput({
      capability,
      command: undefined,
      content: undefined,
      path: undefined,
      url: execution.requestedCommand,
      domain: undefined,
      workingDirectory: undefined,
      estimatedCostCents: undefined,
      hasPaidEntitlement: true,
    });
  }

  if (!execution.requestedCommand) {
    throw new SessionError(409, "approved_execution_missing_command");
  }

  return normalizeExecutionInput({
    capability,
    command: execution.requestedCommand,
    content: undefined,
    ...(execution.requestedPath ? { path: execution.requestedPath } : {}),
    domain: undefined,
    url: undefined,
    ...(execution.workingDirectory ? { workingDirectory: execution.workingDirectory } : {}),
    estimatedCostCents: undefined,
    hasPaidEntitlement: true,
  });
}

function buildExecutionPlan(
  context: PolicyExecutionContext,
  input: NormalizedExecutionInput,
): ExecutionPlan {
  switch (input.capability) {
    case "read":
      return {
        capability: "read",
        requestedCommand: input.path,
        requestedPath: input.path,
        workingDirectory: input.workingDirectory,
        runnerImage: context.session.baseImage,
        command: buildReadCommand(input.path!),
        networkMode: context.profile.networkMode,
        filesystemMode: context.profile.filesystemMode,
      };
    case "write":
      return {
        capability: "write",
        requestedCommand: input.content,
        requestedPath: input.path,
        workingDirectory: input.workingDirectory,
        runnerImage: context.session.baseImage,
        command: buildWriteCommand(input.path!, input.content!),
        networkMode: context.profile.networkMode,
        filesystemMode: context.profile.filesystemMode,
      };
    case "browser":
      return {
        capability: "browser",
        requestedCommand: input.url,
        requestedPath: undefined,
        workingDirectory: undefined,
        runnerImage: computeBrokerConfig.browserImage,
        command: buildBrowserFetchCommand(input.url!),
        networkMode:
          context.profile.networkMode === "no_network" ? "full" : context.profile.networkMode,
        filesystemMode: "ephemeral_full",
      };
    case "process":
      return {
        capability: "process",
        requestedCommand: input.command,
        requestedPath: input.path,
        workingDirectory: input.workingDirectory,
        runnerImage: context.session.baseImage,
        command: input.command!,
        networkMode: context.profile.networkMode,
        filesystemMode: context.profile.filesystemMode,
      };
    case "exec":
    default:
      return {
        capability: "exec",
        requestedCommand: input.command,
        requestedPath: input.path,
        workingDirectory: input.workingDirectory,
        runnerImage: context.session.baseImage,
        command: input.command!,
        networkMode: context.profile.networkMode,
        filesystemMode: context.profile.filesystemMode,
      };
  }
}

function getPersistedCommand(input: NormalizedExecutionInput) {
  switch (input.capability) {
    case "write":
      return input.content;
    case "browser":
      return input.url;
    case "read":
      return input.path;
    case "process":
    case "exec":
    default:
      return input.command;
  }
}

function buildRiskSummary(reason: string): string {
  switch (reason) {
    case "human_approval_required":
      return "This request matched a rule that requires explicit owner approval.";
    case "cost_above_rule_limit":
    case "auto_approve_budget_exceeded":
      return "The estimated execution cost is above the current auto-approval ceiling.";
    case "paid_plan_required":
      return "This request requires a paid entitlement before execution.";
    case "complex_shell_command":
      return "The command uses shell control operators and must be reviewed before execution.";
    case "browser_requires_network":
      return "Browser fetch requires a network-enabled policy profile.";
    case "filesystem_read_only":
      return "This representative is currently running with a read-only filesystem policy.";
    case "insufficient_compute_budget":
      return "The available compute credits are below the estimated charge for this run.";
    default:
      return `Policy requested review before execution (${reason}).`;
  }
}

function summarizeAction(input: NormalizedExecutionInput) {
  switch (input.capability) {
    case "read":
      return `Read "${truncate(input.path ?? "", 120)}".`;
    case "write":
      return `Write to "${truncate(input.path ?? "", 120)}".`;
    case "browser":
      return `Fetch "${truncate(input.url ?? "", 120)}" in the isolated browser lane.`;
    case "process":
      return `Run process "${truncate(input.command ?? "", 120)}"${input.workingDirectory ? ` in ${input.workingDirectory}` : ""}.`;
    case "exec":
    default:
      return `Run "${truncate(input.command ?? "", 120)}"${input.workingDirectory ? ` in ${input.workingDirectory}` : ""}.`;
  }
}

function buildReadCommand(rawPath: string) {
  const target = shellQuote(normalizeContainerPath(rawPath));
  return [
    `target=${target}`,
    'if [ -d "$target" ]; then',
    '  ls -la "$target";',
    'elif [ -f "$target" ]; then',
    '  sed -n "1,200p" "$target";',
    "else",
    '  echo "Path not found: $target" >&2;',
    "  exit 2;",
    "fi",
  ].join("\n");
}

function buildWriteCommand(rawPath: string, content: string) {
  const target = normalizeContainerPath(rawPath);
  const delimiter = resolveHeredocDelimiter(content);
  return [
    `mkdir -p ${shellQuote(pathPosix.dirname(target))}`,
    `cat <<'${delimiter}' > ${shellQuote(target)}`,
    content,
    delimiter,
  ].join("\n");
}

function buildBrowserFetchCommand(url: string) {
  const serializedUrl = JSON.stringify(url);
  const script = [
    `const url=${serializedUrl};`,
    "fetch(url)",
    "  .then(async (response) => {",
    "    const text = await response.text();",
    "    process.stdout.write(text.slice(0, 20000));",
    "  })",
    "  .catch((error) => {",
    "    console.error(error.stack || error.message);",
    "    process.exit(1);",
    "  });",
  ].join("\n");
  return `NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt node -e ${shellQuote(script)}`;
}

function resolveHeredocDelimiter(content: string) {
  let delimiter = "DELEGATE_CONTENT";
  while (content.includes(delimiter)) {
    delimiter = `${delimiter}_${Math.random().toString(16).slice(2, 8)}`;
  }
  return delimiter;
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function isSimpleExecCommand(value: string) {
  return !/[;&|><`$()\\\n\r]/.test(value);
}
