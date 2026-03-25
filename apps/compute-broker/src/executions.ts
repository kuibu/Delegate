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
import {
  buildPlaywrightBrowseCommand,
  parsePlaywrightBrowseArtifactPayload,
} from "./browser";
import { recordBrowserNavigation } from "./browser-sessions";
import { computeBrokerConfig } from "./config";
import { ensureComputeSessionLease } from "./leases";
import {
  persistExecutionArtifacts,
  persistJsonArtifact,
  persistScreenshotArtifact,
} from "./artifacts";
import { computeLifecycleHooks } from "./lifecycle-hooks";
import { loadRepresentativeMcpBinding, resolveMcpToolName } from "./mcp-bindings";
import { callRemoteMcpTool } from "./mcp";
import { extractHostname, isHostnameAllowed, normalizeNetworkAllowlist } from "./network-allowlist";
import { normalizeContainerPath } from "./path-utils";
import { prisma } from "./prisma";
import { evaluateExecutionRequest, loadSessionPolicyContext } from "./policy";
import { runRunnerExecution } from "./runner";
import {
  mapCapabilityFromDb,
  mapCapabilityToDb,
  mapRunnerTypeFromDb,
  mapPolicyDecisionToDb,
  serializeApprovalRequest,
  serializeArtifact,
  serializeExecution,
  serializeSession,
} from "./serializers";
import { SessionError } from "./session-error";

type PolicyExecutionContext = Awaited<ReturnType<typeof loadSessionPolicyContext>>;
type LeasedSessionRecord = {
  id: string;
  representativeId: string;
  contactId: string | null;
  conversationId: string | null;
  runnerType: string;
  runnerLeaseId: string | null;
  containerId: string | null;
  startedAt: Date | null;
};
type NormalizedExecutionInput = {
  capability: CapabilityKind;
  command: string | undefined;
  content: string | undefined;
  path: string | undefined;
  domain: string | undefined;
  url: string | undefined;
  bindingId: string | undefined;
  bindingSlug: string | undefined;
  toolName: string | undefined;
  toolArguments: Record<string, unknown> | undefined;
  approvalRequired: boolean;
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

type BrowserCaptureSummary = {
  transportKind: "playwright" | "openai_computer" | "claude_computer_use";
  profilePath?: string;
  title?: string;
  finalUrl?: string;
  textSnippet?: string;
  screenshotArtifactId?: string;
  jsonArtifactId?: string;
};

type RuntimeExecutionResult = {
  exitCode: number;
  wallMs: number;
  bytesRead: number;
  artifacts: Awaited<ReturnType<typeof persistExecutionArtifacts>>;
  failureSummary?: string | undefined;
  browserCapture?: BrowserCaptureSummary | undefined;
  transport: "docker" | "mcp";
  remoteUrl?: string | undefined;
};

export async function executeTool(sessionId: string, rawInput: unknown) {
  const { input, context, decision, mcpBinding } = await evaluateExecutionRequest(sessionId, rawInput);
  const normalized = normalizeExecutionInput(input, mcpBinding);
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

  await computeLifecycleHooks.emit({
    kind: "tool_preflight",
    scope: {
      representativeId: context.session.representativeId,
      representativeSlug: context.session.representative.slug,
      contactId: context.session.contactId ?? null,
      conversationId: context.session.conversationId ?? null,
    },
    sessionId,
    capability: normalized.capability,
    decision: effectiveDecision.decision,
    reason: effectiveDecision.reason,
    ...(normalized.command ? { requestedCommand: normalized.command } : {}),
    ...(normalized.path ? { requestedPath: normalized.path } : {}),
    ...(normalized.workingDirectory ? { workingDirectory: normalized.workingDirectory } : {}),
    estimatedCredits,
    ...(normalized.capability === "mcp"
      ? {
          transport: "mcp",
          ...(normalized.bindingId ? { bindingId: normalized.bindingId } : {}),
          ...(normalized.url ? { remoteUrl: normalized.url } : {}),
        }
      : {}),
  });

  if (effectiveDecision.decision === "deny") {
    const requestPayload = buildExecutionRequestPayload(normalized);
    return blockExecution({
      session: context.session,
      capability: normalized.capability,
      requestedCommand: getPersistedCommand(normalized),
      requestedPath: normalized.path,
      workingDirectory: normalized.workingDirectory,
      policyDecision: "deny",
      reason: effectiveDecision.reason,
      ...(requestPayload ? { requestPayload } : {}),
      mcpBindingId: normalized.bindingId,
      billing: {
        estimatedCredits,
        conversationBudgetRemainingCredits: budgetAvailability.conversationCredits,
        ownerBalanceCredits: budgetAvailability.ownerBalanceCredits,
        sponsorPoolCredit: budgetAvailability.sponsorPoolCredit,
      },
    });
  }

  if (effectiveDecision.decision === "ask") {
    const requestPayload = buildExecutionRequestPayload(normalized);
    const execution = await prisma.toolExecution.create({
      data: {
        sessionId,
        capability: mapCapabilityToDb(normalized.capability),
        status: "BLOCKED",
        requestedCommand: getPersistedCommand(normalized) ?? null,
        requestedPath: normalized.path ?? null,
        ...(requestPayload ? { requestPayload } : {}),
        workingDirectory: normalized.workingDirectory ?? null,
        mcpBindingId: normalized.bindingId ?? null,
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

        await tx.workflowRun.updateMany({
          where: {
            approvalRequestId: approval.id,
            status: "QUEUED",
          },
          data: {
            status: "CANCELED",
            completedAt: resolvedAt,
            output: {
              outcome: "canceled_after_manual_rejection",
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
    prisma.workflowRun.updateMany({
      where: {
        approvalRequestId: approval.id,
        status: "QUEUED",
      },
      data: {
        status: "CANCELED",
        completedAt: resolvedAt,
        output: {
          outcome: "canceled_after_manual_approval",
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
  const leasedSession = await ensureComputeSessionLease({
    session: params.context.session,
    networkMode: params.context.profile.networkMode,
    filesystemMode: params.context.profile.filesystemMode,
  });
  const executionDescriptor = describeExecution(params.context, params.input);
  const requestPayload = buildExecutionRequestPayload(params.input);
  const execution = params.existingExecutionId
    ? await prisma.toolExecution.update({
        where: { id: params.existingExecutionId },
        data: {
          status: "RUNNING",
          capability: mapCapabilityToDb(executionDescriptor.capability),
          requestedCommand: executionDescriptor.requestedCommand ?? null,
          requestedPath: executionDescriptor.requestedPath ?? null,
          ...(requestPayload ? { requestPayload } : {}),
          workingDirectory: executionDescriptor.workingDirectory ?? null,
          mcpBindingId: params.input.bindingId ?? null,
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
          capability: mapCapabilityToDb(executionDescriptor.capability),
          status: "RUNNING",
          requestedCommand: executionDescriptor.requestedCommand ?? null,
          requestedPath: executionDescriptor.requestedPath ?? null,
          ...(requestPayload ? { requestPayload } : {}),
          workingDirectory: executionDescriptor.workingDirectory ?? null,
          mcpBindingId: params.input.bindingId ?? null,
          policyDecision: mapPolicyDecisionToDb("allow"),
          startedAt,
        },
      });

  await prisma.computeSession.update({
    where: { id: leasedSession.id },
    data: {
      status: "RUNNING",
      startedAt: leasedSession.startedAt ?? startedAt,
      leaseLastUsedAt: startedAt,
      lastHeartbeatAt: startedAt,
      failureReason: null,
    },
  });

  const runtimeResult =
    params.input.capability === "mcp"
        ? await runMcpExecution({
          context: params.context,
          leasedSession,
          executionId: execution.id,
          input: params.input,
        })
      : await runContainerExecution({
          context: params.context,
          leasedSession,
          executionId: execution.id,
          input: params.input,
        });

  const finishedAt = new Date();
  const totalArtifactBytes = runtimeResult.artifacts.reduce(
    (sum, artifact) => sum + artifact.sizeBytes,
    0,
  );
  const updatedExecution = await prisma.toolExecution.update({
    where: { id: execution.id },
    data: {
      status: runtimeResult.exitCode === 0 ? "SUCCEEDED" : "FAILED",
      finishedAt,
      exitCode: runtimeResult.exitCode,
      wallMs: runtimeResult.wallMs,
      cpuMs: null,
      bytesRead: runtimeResult.bytesRead,
      bytesWritten: totalArtifactBytes,
    },
  });

  const updatedSession = await prisma.computeSession.update({
    where: { id: leasedSession.id },
    data: {
      status: "IDLE",
      leaseLastUsedAt: finishedAt,
      lastHeartbeatAt: finishedAt,
      failureReason:
        runtimeResult.exitCode === 0 ? null : truncate(runtimeResult.failureSummary ?? "", 240),
    },
  });

  if (executionDescriptor.capability === "browser") {
    await recordBrowserNavigation({
      representativeId: params.context.session.representativeId,
      representativeSlug: params.context.session.representative.slug,
      contactId: params.context.session.contactId ?? null,
      conversationId: params.context.session.conversationId ?? null,
      computeSessionId: leasedSession.id,
      toolExecutionId: execution.id,
      transportKind: runtimeResult.browserCapture?.transportKind ?? "playwright",
      requestedUrl: params.input.url ?? executionDescriptor.requestedCommand ?? "https://invalid.local/",
      finalUrl: runtimeResult.browserCapture?.finalUrl,
      pageTitle: runtimeResult.browserCapture?.title,
      textSnippet: runtimeResult.browserCapture?.textSnippet,
      screenshotArtifactId: runtimeResult.browserCapture?.screenshotArtifactId,
      jsonArtifactId: runtimeResult.browserCapture?.jsonArtifactId,
      errorMessage: runtimeResult.exitCode === 0 ? null : runtimeResult.failureSummary,
      profilePath: runtimeResult.browserCapture?.profilePath ?? null,
      status: runtimeResult.exitCode === 0 ? "succeeded" : "failed",
    });
  }

  const computeCostCents = Math.max(1, Math.ceil(runtimeResult.wallMs / 1000));
  const storageCostCents = totalArtifactBytes > 0 ? Math.max(1, Math.ceil(totalArtifactBytes / 65536)) : 0;
  const computeCredits = estimateCreditUsage({
    capability: executionDescriptor.capability,
    estimatedCostCents: computeCostCents,
  });
  const storageCredits = totalArtifactBytes > 0 ? Math.ceil(totalArtifactBytes / 65536) : 0;
  const billing = await applyExecutionBilling({
    representativeId: params.context.session.representativeId,
    contactId: params.context.session.contactId ?? null,
    conversationId: params.context.session.conversationId ?? null,
    sessionId: leasedSession.id,
    toolExecutionId: execution.id,
    ownerId: params.context.session.representative.owner.id,
    computeCredits,
    storageCredits,
    computeCostCents,
    storageCostCents,
    capability: executionDescriptor.capability,
    wallMs: runtimeResult.wallMs,
    artifactBytes: totalArtifactBytes,
    finishedAt,
  });

  await computeLifecycleHooks.emit({
    kind: "tool_completed",
    scope: {
      representativeId: params.context.session.representativeId,
      representativeSlug: params.context.session.representative.slug,
      contactId: params.context.session.contactId ?? null,
      conversationId: params.context.session.conversationId ?? null,
    },
    sessionId: params.context.session.id,
    executionId: execution.id,
    capability: executionDescriptor.capability,
    exitCode: runtimeResult.exitCode,
    wallMs: runtimeResult.wallMs,
    artifactCount: runtimeResult.artifacts.length,
    actualCredits: billing.actualCredits,
    ...(runtimeResult.transport
      ? {
          transport: runtimeResult.transport,
          ...(params.input.bindingId ? { bindingId: params.input.bindingId } : {}),
          ...(runtimeResult.remoteUrl ? { remoteUrl: runtimeResult.remoteUrl } : {}),
        }
      : {}),
  });

  await prisma.eventAudit.create({
    data: {
      representativeId: params.context.session.representativeId,
      contactId: params.context.session.contactId ?? null,
      conversationId: params.context.session.conversationId ?? null,
      type: "BILLING_LEDGER_RECORDED",
      payload: {
        sessionId: leasedSession.id,
        executionId: execution.id,
        kinds:
          executionDescriptor.capability === "browser"
            ? ["COMPUTE_MINUTES", "BROWSER_MINUTES", "STORAGE_BYTES"]
            : ["COMPUTE_MINUTES", "STORAGE_BYTES"],
        actualCredits: billing.actualCredits,
      },
    },
  });

  return executeToolResponseSchema.parse({
    outcome: runtimeResult.exitCode === 0 ? "completed" : "failed",
    session: serializeSession(updatedSession),
    execution: serializeExecution(updatedExecution),
    artifacts: runtimeResult.artifacts.map((artifact) => serializeArtifact(artifact)),
    billing: {
      estimatedCredits: params.estimatedCredits,
      ...billing,
    },
  });
}

function describeExecution(
  context: PolicyExecutionContext,
  input: NormalizedExecutionInput,
) {
  if (input.capability === "mcp") {
    return {
      capability: "mcp" as const,
      requestedCommand: input.toolName,
      requestedPath: input.bindingSlug ?? input.bindingId,
      workingDirectory: undefined,
    };
  }

  const plan = buildExecutionPlan(context, input);
  return {
    capability: plan.capability,
    requestedCommand: plan.requestedCommand,
    requestedPath: plan.requestedPath,
    workingDirectory: plan.workingDirectory,
  };
}

async function runContainerExecution(params: {
  context: PolicyExecutionContext;
  leasedSession: LeasedSessionRecord;
  executionId: string;
  input: NormalizedExecutionInput;
}): Promise<RuntimeExecutionResult> {
  const executionPlan = buildExecutionPlan(params.context, params.input);
  const runnerResult = await runRunnerExecution({
    runnerType: mapRunnerTypeFromDb(params.leasedSession.runnerType),
    lease: {
      runnerType: mapRunnerTypeFromDb(params.leasedSession.runnerType),
      leaseId: params.leasedSession.runnerLeaseId ?? params.leasedSession.id,
      containerId: params.leasedSession.containerId,
      containerName: params.leasedSession.containerId,
      sessionRoot: "/delegate-session",
    },
    command: executionPlan.command,
    maxCommandSeconds:
      executionPlan.capability === "browser"
        ? Math.max(params.context.profile.maxCommandSeconds, computeBrokerConfig.browserMaxCommandSeconds)
        : params.context.profile.maxCommandSeconds,
    filesystemMode: executionPlan.filesystemMode,
    workingDirectory: executionPlan.workingDirectory,
    sessionId: params.context.session.id,
    executionId: params.executionId,
  });

  const artifactResult =
    executionPlan.capability === "browser"
      ? await persistBrowserExecutionArtifacts({
          representativeId: params.context.session.representativeId,
          representativeSlug: params.context.session.representative.slug,
          contactId: params.context.session.contactId ?? null,
          conversationId: params.context.session.conversationId ?? null,
          sessionId: params.context.session.id,
          executionId: params.executionId,
          retentionDays: params.context.profile.artifactRetentionDays,
          stdout: runnerResult.stdout,
          stderr: runnerResult.stderr,
        })
      : {
          artifacts: await persistExecutionArtifacts({
            representativeId: params.context.session.representativeId,
            representativeSlug: params.context.session.representative.slug,
            contactId: params.context.session.contactId ?? null,
            conversationId: params.context.session.conversationId ?? null,
            sessionId: params.context.session.id,
            executionId: params.executionId,
            retentionDays: params.context.profile.artifactRetentionDays,
            stdout: runnerResult.stdout,
            stderr: runnerResult.stderr,
          }),
          browserCapture: undefined,
        };

  return {
    exitCode: runnerResult.exitCode,
    wallMs: runnerResult.wallMs,
    bytesRead: Buffer.byteLength(runnerResult.stdout, "utf8"),
    artifacts: artifactResult.artifacts,
    failureSummary: runnerResult.stderr || runnerResult.stdout,
    browserCapture: artifactResult.browserCapture,
    transport: "docker" as const,
    remoteUrl: undefined,
  };
}

async function persistBrowserExecutionArtifacts(params: {
  representativeId: string;
  representativeSlug: string;
  contactId?: string | null | undefined;
  conversationId?: string | null | undefined;
  sessionId: string;
  executionId: string;
  retentionDays: number;
  stdout: string;
  stderr: string;
}) {
  const parsed = parsePlaywrightBrowseArtifactPayload(params.stdout);
  if (!parsed) {
    return {
      artifacts: await persistExecutionArtifacts(params),
      browserCapture: undefined,
    };
  }

  const artifacts = [];
  const summary = [parsed.title, parsed.finalUrl].filter(Boolean).join(" · ").slice(0, 240);

  const jsonArtifact = await persistJsonArtifact({
      representativeId: params.representativeId,
      representativeSlug: params.representativeSlug,
      contactId: params.contactId,
      conversationId: params.conversationId,
      sessionId: params.sessionId,
      executionId: params.executionId,
      retentionDays: params.retentionDays,
      value: {
        title: parsed.title,
        finalUrl: parsed.finalUrl,
        textSnippet: parsed.textSnippet,
        contentSnippet: parsed.contentSnippet,
        links: parsed.links,
      },
      summary,
    });
  artifacts.push(jsonArtifact);

  const screenshotArtifact = await persistScreenshotArtifact({
      representativeId: params.representativeId,
      representativeSlug: params.representativeSlug,
      contactId: params.contactId,
      conversationId: params.conversationId,
      sessionId: params.sessionId,
      executionId: params.executionId,
      retentionDays: params.retentionDays,
      body: Buffer.from(parsed.screenshotBase64, "base64"),
      mimeType: parsed.screenshotMimeType,
      summary,
    });
  artifacts.push(screenshotArtifact);

  if (params.stderr.length > 0) {
    const stderrArtifacts = await persistExecutionArtifacts({
      ...params,
      stdout: "",
      stderr: params.stderr,
    });
    artifacts.push(...stderrArtifacts);
  }

  return {
    artifacts,
    browserCapture: {
      transportKind: parsed.transportKind,
      profilePath: parsed.profilePath,
      title: parsed.title,
      finalUrl: parsed.finalUrl,
      textSnippet: parsed.textSnippet,
      screenshotArtifactId: screenshotArtifact.id,
      jsonArtifactId: jsonArtifact.id,
    },
  };
}

async function runMcpExecution(params: {
  context: PolicyExecutionContext;
  leasedSession: LeasedSessionRecord;
  executionId: string;
  input: NormalizedExecutionInput;
}): Promise<RuntimeExecutionResult> {
  const binding = await loadRepresentativeMcpBinding({
    representativeId: params.context.session.representativeId,
    bindingId: params.input.bindingId,
    bindingSlug: params.input.bindingSlug,
  });
  const resolved = resolveMcpToolName({
    binding,
    requestedToolName: params.input.toolName,
  });
  const startedAt = Date.now();
  const toolResult = await callRemoteMcpTool({
    binding,
    requestedToolName: resolved.toolName,
    toolArguments: params.input.toolArguments,
  });
  const payload = {
    binding: {
      id: binding.id,
      slug: binding.slug,
      displayName: binding.displayName,
      serverUrl: binding.serverUrl,
      toolName: toolResult.toolName,
      allowedToolNames: toolResult.allowedToolNames,
      availableToolNames: toolResult.availableToolNames,
    },
    arguments: params.input.toolArguments ?? {},
    result: toolResult.result,
  };
  const artifact = await persistJsonArtifact({
    representativeId: params.context.session.representativeId,
    representativeSlug: params.context.session.representative.slug,
    contactId: params.context.session.contactId ?? null,
    conversationId: params.context.session.conversationId ?? null,
    sessionId: params.leasedSession.id,
    executionId: params.executionId,
    retentionDays: params.context.profile.artifactRetentionDays,
    value: payload,
    summary: toolResult.summary,
  });

  return {
    exitCode: 0,
    wallMs: Date.now() - startedAt,
    bytesRead: Buffer.byteLength(JSON.stringify(payload), "utf8"),
    artifacts: [artifact],
    failureSummary: undefined,
    browserCapture: undefined,
    transport: "mcp" as const,
    remoteUrl: binding.serverUrl,
  };
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
    leaseStatus: string;
    runnerType: string;
    runnerLeaseId: string | null;
    baseImage: string;
    containerId: string | null;
    createdAt: Date;
    updatedAt: Date;
    leaseAcquiredAt: Date | null;
    leaseLastUsedAt: Date | null;
    leaseReleasedAt: Date | null;
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
  requestPayload?: string | undefined;
  mcpBindingId?: string | undefined;
  billing?: ExecutionBillingSummary;
}) {
  const execution = await prisma.toolExecution.create({
    data: {
      sessionId: params.session.id,
      capability: mapCapabilityToDb(params.capability),
      status: "BLOCKED",
      requestedCommand: params.requestedCommand ?? null,
      requestedPath: params.requestedPath ?? null,
      ...(params.requestPayload ? { requestPayload: params.requestPayload } : {}),
      workingDirectory: params.workingDirectory ?? null,
      mcpBindingId: params.mcpBindingId ?? null,
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

  if (params.input.capability === "browser" && params.context.profile.networkMode === "allowlist") {
    return {
      decision: "deny" as const,
      reason: "browser_allowlist_not_supported_yet",
    };
  }

  if (params.input.capability === "mcp" && params.context.profile.networkMode === "no_network") {
    return {
      decision: "deny" as const,
      reason: "mcp_requires_network",
    };
  }

  if (params.input.capability === "mcp" && params.context.profile.networkMode === "allowlist") {
    const allowlist = normalizeNetworkAllowlist(params.context.profile.networkAllowlist);
    if (!allowlist.length) {
      return {
        decision: "deny" as const,
        reason: "network_allowlist_empty",
      };
    }

    const hostname = params.input.url ? extractHostname(params.input.url) : null;
    if (!hostname || !isHostnameAllowed(hostname, allowlist)) {
      return {
        decision: "deny" as const,
        reason: "domain_not_in_network_allowlist",
      };
    }
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

  if (
    params.input.capability === "mcp" &&
    params.input.approvalRequired &&
    params.decision.decision === "allow"
  ) {
    return {
      decision: "ask" as const,
      reason: "mcp_binding_requires_approval",
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

function normalizeExecutionInput(
  input: ToolExecutionRequest,
  mcpBinding?: {
    id: string;
    slug: string;
    serverUrl: string;
    approvalRequired: boolean;
  } | null,
): NormalizedExecutionInput {
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
        bindingId: undefined,
        bindingSlug: undefined,
        toolName: undefined,
        toolArguments: undefined,
        approvalRequired: false,
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
        bindingId: undefined,
        bindingSlug: undefined,
        toolName: undefined,
        toolArguments: undefined,
        approvalRequired: false,
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
        bindingId: undefined,
        bindingSlug: undefined,
        toolName: undefined,
        toolArguments: undefined,
        approvalRequired: false,
        workingDirectory: undefined,
        estimatedCostCents: input.estimatedCostCents,
        hasPaidEntitlement: input.hasPaidEntitlement,
      };
    }
    case "mcp": {
      if (!mcpBinding && !input.bindingId && !input.bindingSlug) {
        throw new SessionError(400, "mcp_binding_reference_required");
      }

      const bindingId = mcpBinding?.id ?? input.bindingId;
      const bindingSlug = mcpBinding?.slug ?? input.bindingSlug;
      const serverUrl = mcpBinding?.serverUrl;
      const toolName = input.toolName ?? input.command;

      if (!bindingId && !bindingSlug) {
        throw new SessionError(400, "mcp_binding_reference_required");
      }

      return {
        capability: "mcp",
        command: toolName,
        content: undefined,
        path: bindingSlug,
        domain: input.domain,
        url: serverUrl,
        bindingId,
        bindingSlug,
        toolName,
        toolArguments: input.toolArguments,
        approvalRequired: mcpBinding?.approvalRequired ?? true,
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
        bindingId: undefined,
        bindingSlug: undefined,
        toolName: undefined,
        toolArguments: undefined,
        approvalRequired: false,
        workingDirectory: input.workingDirectory,
        estimatedCostCents: input.estimatedCostCents,
        hasPaidEntitlement: input.hasPaidEntitlement,
      };
    }
  }
}

function reconstructExecutionInput(execution: {
  capability: string;
  mcpBindingId: string | null;
  requestedCommand: string | null;
  requestedPath: string | null;
  requestPayload: unknown;
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

  if (capability === "mcp") {
    const payload =
      typeof execution.requestPayload === "string"
        ? safeParseExecutionPayload(execution.requestPayload)
        : execution.requestPayload && typeof execution.requestPayload === "object"
          ? (execution.requestPayload as Record<string, unknown>)
          : null;
    const bindingId =
      typeof payload?.bindingId === "string" ? payload.bindingId : execution.mcpBindingId ?? undefined;
    const bindingSlug = typeof payload?.bindingSlug === "string" ? payload.bindingSlug : undefined;
    const toolName =
      typeof payload?.toolName === "string" ? payload.toolName : execution.requestedCommand ?? undefined;
    const toolArguments =
      payload?.toolArguments && typeof payload.toolArguments === "object"
        ? (payload.toolArguments as Record<string, unknown>)
        : undefined;

    return normalizeExecutionInput({
      capability,
      bindingId,
      bindingSlug,
      toolName,
      toolArguments,
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

function safeParseExecutionPayload(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
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
        command: buildPlaywrightBrowseCommand({
          url: input.url!,
          playwrightVersion: computeBrokerConfig.browserPlaywrightVersion,
        }),
        networkMode: context.profile.networkMode,
        filesystemMode: "ephemeral_full",
      };
    case "mcp":
      throw new SessionError(500, "mcp_execution_plan_not_supported");
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
    case "mcp":
      return input.toolName;
    case "read":
      return input.path;
    case "process":
    case "exec":
    default:
      return input.command;
  }
}

function buildExecutionRequestPayload(input: NormalizedExecutionInput) {
  if (input.capability !== "mcp") {
    return undefined;
  }

  return JSON.stringify({
    ...(input.bindingId ? { bindingId: input.bindingId } : {}),
    ...(input.bindingSlug ? { bindingSlug: input.bindingSlug } : {}),
    ...(input.toolName ? { toolName: input.toolName } : {}),
    toolArguments: input.toolArguments ?? {},
  });
}

function buildRiskSummary(reason: string): string {
  switch (reason) {
    case "human_approval_required":
      return "This request matched a rule that requires explicit owner approval.";
    case "mcp_binding_requires_approval":
      return "This MCP binding is configured to require owner approval before any remote tool call.";
    case "cost_above_rule_limit":
    case "auto_approve_budget_exceeded":
      return "The estimated execution cost is above the current auto-approval ceiling.";
    case "paid_plan_required":
      return "This request requires a paid entitlement before execution.";
    case "complex_shell_command":
      return "The command uses shell control operators and must be reviewed before execution.";
    case "browser_requires_network":
      return "Browser automation requires a network-enabled policy profile.";
    case "mcp_requires_network":
      return "Remote MCP tools require a network-enabled policy profile.";
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
      return `Browse "${truncate(input.url ?? "", 120)}" in the isolated Playwright lane.`;
    case "mcp":
      return `Call MCP tool "${truncate(input.toolName ?? "", 120)}" via "${truncate(input.bindingSlug ?? input.bindingId ?? "", 120)}".`;
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
