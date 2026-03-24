import {
  executeToolResponseSchema,
  listApprovalsResponseSchema,
  listArtifactsResponseSchema,
  resolveApprovalRequestSchema,
  resolveApprovalResponseSchema,
} from "@delegate/compute-protocol";

import { createApprovalRequestForExecution } from "./approvals";
import { persistExecutionArtifacts } from "./artifacts";
import { prisma } from "./prisma";
import { evaluateExecutionRequest, loadSessionPolicyContext } from "./policy";
import { runDockerExecution } from "./runner";
import {
  mapPolicyDecisionToDb,
  serializeApprovalRequest,
  serializeArtifact,
  serializeExecution,
  serializeSession,
} from "./serializers";
import { SessionError } from "./sessions";

type PolicyExecutionContext = Awaited<ReturnType<typeof loadSessionPolicyContext>>;
type AllowedExecInput = {
  capability: "exec";
  command: string;
  path?: string | undefined;
  domain?: string | undefined;
  workingDirectory?: string | undefined;
  estimatedCostCents?: number | undefined;
  hasPaidEntitlement?: boolean | undefined;
};

export async function executeTool(sessionId: string, rawInput: unknown) {
  const { input, context, decision } = await evaluateExecutionRequest(sessionId, rawInput);
  const effectiveDecision =
    input.capability === "exec" && input.command && !isSimpleExecCommand(input.command)
      ? {
          decision: "ask" as const,
          reason: "complex_shell_command",
          matchedRuleId: undefined,
        }
      : decision;

  if (input.capability !== "exec") {
    return blockExecution({
      session: context.session,
      capability: input.capability,
      requestedCommand: input.command,
      requestedPath: input.path,
      workingDirectory: input.workingDirectory,
      policyDecision: "deny",
      reason: "phase_b_exec_only",
    });
  }

  if (!input.command) {
    throw new SessionError(400, "command_required_for_exec");
  }

  await prisma.eventAudit.create({
    data: {
      representativeId: context.session.representativeId,
      contactId: context.session.contactId ?? null,
      conversationId: context.session.conversationId ?? null,
      type: "TOOL_EXECUTION_REQUESTED",
      payload: {
        sessionId,
        capability: input.capability,
        command: input.command,
        path: input.path ?? null,
        workingDirectory: input.workingDirectory ?? null,
        decision: effectiveDecision.decision,
      },
    },
  });

  if (effectiveDecision.decision === "deny") {
    return blockExecution({
      session: context.session,
      capability: input.capability,
      requestedCommand: input.command,
      requestedPath: input.path,
      workingDirectory: input.workingDirectory,
      policyDecision: "deny",
      reason: effectiveDecision.reason,
    });
  }

  if (effectiveDecision.decision === "ask") {
    const execution = await prisma.toolExecution.create({
      data: {
        sessionId,
        capability: input.capability.toUpperCase() as "EXEC",
        status: "BLOCKED",
        requestedCommand: input.command,
        requestedPath: input.path ?? null,
        workingDirectory: input.workingDirectory ?? null,
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
      requestedActionSummary: summarizeAction(input.command, input.workingDirectory),
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
    });
  }

  const result = await runAllowedExecExecution({
    context,
    input: {
      ...input,
      capability: "exec",
      command: input.command,
    },
  });

  return executeToolResponseSchema.parse({
    outcome: result.outcome,
    session: result.session,
    execution: result.execution,
    artifacts: result.artifacts,
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

  const context =
    approval.sessionId && blockedExecution?.capability === "EXEC" && blockedExecution.requestedCommand
      ? await loadSessionPolicyContext(approval.sessionId)
      : null;

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

  if (!blockedExecution || !context || blockedExecution.capability !== "EXEC") {
    return resolveApprovalResponseSchema.parse({
      outcome: "approved",
      approvalRequest: serializeApprovalRequest(updatedApproval),
      artifacts: [],
    });
  }

  if (!blockedExecution.requestedCommand) {
    throw new SessionError(409, "approved_execution_missing_command");
  }

  const result = await runAllowedExecExecution({
    context,
    input: {
      capability: "exec",
      command: blockedExecution.requestedCommand,
      hasPaidEntitlement: true,
      ...(blockedExecution.requestedPath ? { path: blockedExecution.requestedPath } : {}),
      ...(blockedExecution.workingDirectory
        ? { workingDirectory: blockedExecution.workingDirectory }
        : {}),
    },
    existingExecutionId: blockedExecution.id,
  });

  return resolveApprovalResponseSchema.parse({
    outcome: "approved_and_executed",
    approvalRequest: serializeApprovalRequest(updatedApproval),
    session: result.session,
    execution: result.execution,
    artifacts: result.artifacts,
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

async function runAllowedExecExecution(params: {
  context: PolicyExecutionContext;
  input: AllowedExecInput;
  existingExecutionId?: string;
}) {
  const startedAt = new Date();
  const execution = params.existingExecutionId
    ? await prisma.toolExecution.update({
        where: { id: params.existingExecutionId },
        data: {
          status: "RUNNING",
          requestedCommand: params.input.command,
          requestedPath: params.input.path ?? null,
          workingDirectory: params.input.workingDirectory ?? null,
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
          capability: "EXEC",
          status: "RUNNING",
          requestedCommand: params.input.command,
          requestedPath: params.input.path ?? null,
          workingDirectory: params.input.workingDirectory ?? null,
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
    image: params.context.session.baseImage,
    command: params.input.command,
    hostWorkspaceRoot: process.env.COMPUTE_HOST_WORKSPACE_ROOT ?? "/Users/a/repos/Delegate",
    maxCommandSeconds: params.context.profile.maxCommandSeconds,
    networkMode: params.context.profile.networkMode,
    filesystemMode: params.context.profile.filesystemMode,
    workingDirectory: params.input.workingDirectory,
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

  await prisma.$transaction([
    prisma.ledgerEntry.create({
      data: {
        representativeId: params.context.session.representativeId,
        contactId: params.context.session.contactId ?? null,
        conversationId: params.context.session.conversationId ?? null,
        sessionId: params.context.session.id,
        toolExecutionId: execution.id,
        kind: "COMPUTE_MINUTES",
        quantity: runnerResult.wallMs / 60000,
        unit: "minute",
        costCents: Math.max(1, Math.ceil(runnerResult.wallMs / 1000)),
      },
    }),
    prisma.ledgerEntry.create({
      data: {
        representativeId: params.context.session.representativeId,
        contactId: params.context.session.contactId ?? null,
        conversationId: params.context.session.conversationId ?? null,
        sessionId: params.context.session.id,
        toolExecutionId: execution.id,
        kind: "STORAGE_BYTES",
        quantity: totalArtifactBytes,
        unit: "byte",
        costCents: 0,
      },
    }),
    prisma.eventAudit.create({
      data: {
        representativeId: params.context.session.representativeId,
        contactId: params.context.session.contactId ?? null,
        conversationId: params.context.session.conversationId ?? null,
        type: "TOOL_EXECUTION_COMPLETED",
        payload: {
          sessionId: params.context.session.id,
          executionId: execution.id,
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
        },
      },
    }),
    ...(params.context.session.conversationId
      ? [
          prisma.conversation.update({
            where: { id: params.context.session.conversationId },
            data: {
              lastComputeAt: finishedAt,
            },
          }),
        ]
      : []),
  ]);

  return {
    outcome: runnerResult.exitCode === 0 ? "completed" : "failed",
    session: serializeSession(updatedSession),
    execution: serializeExecution(updatedExecution),
    artifacts: artifacts.map((artifact) => serializeArtifact(artifact)),
  } as const;
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
  capability: "exec" | "read" | "write" | "process" | "browser";
  requestedCommand?: string | undefined;
  requestedPath?: string | undefined;
  workingDirectory?: string | undefined;
  policyDecision: "deny" | "ask";
  reason: string;
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
  });
}

function buildRiskSummary(reason: string): string {
  switch (reason) {
    case "human_approval_required":
      return "This command matched a rule that requires explicit owner approval.";
    case "cost_above_rule_limit":
      return "The estimated execution cost is above the auto-approval ceiling.";
    case "paid_plan_required":
      return "This command requires a paid entitlement before execution.";
    case "complex_shell_command":
      return "The command uses shell control operators and must be reviewed before execution.";
    default:
      return `Policy requested review before execution (${reason}).`;
  }
}

function summarizeAction(command: string, workingDirectory?: string) {
  return `Run "${truncate(command, 120)}"${workingDirectory ? ` in ${workingDirectory}` : ""}.`;
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function isSimpleExecCommand(value: string) {
  return !/[;&|><`$()\\\n\r]/.test(value);
}
