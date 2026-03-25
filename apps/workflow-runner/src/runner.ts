import {
  ApprovalStatus,
  HandoffStatus,
  Prisma,
  WorkflowEngine,
  WorkflowKind,
  WorkflowStatus,
} from "@prisma/client";
import {
  approvalExpirationInputSchema,
  handoffFollowUpInputSchema,
} from "@delegate/workflows";

import { prisma } from "./prisma";

type WorkflowRunRecord = Awaited<ReturnType<typeof loadWorkflowRun>>;

export type WorkflowTickSummary = {
  processed: number;
  completed: number;
  dispatched: number;
  failed: number;
};

export type TemporalWorkflowDispatcher = {
  startWorkflowExecution(params: {
    workflowRunId: string;
    workflowKind: WorkflowKind;
    workflowId: string;
    taskQueue: string;
  }): Promise<void>;
};

export async function runWorkflowTick(options?: {
  limit?: number;
  engine?: WorkflowEngine;
  temporalDispatcher?: TemporalWorkflowDispatcher;
}): Promise<WorkflowTickSummary> {
  const now = new Date();
  const engine = options?.engine ?? WorkflowEngine.LOCAL_RUNNER;
  const dueRuns = await prisma.workflowRun.findMany({
    where: {
      engine,
      status: WorkflowStatus.QUEUED,
      scheduledAt: {
        lte: now,
      },
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    take: options?.limit ?? 10,
    select: {
      id: true,
    },
  });

  let processed = 0;
  let completed = 0;
  let dispatched = 0;
  let failed = 0;

  for (const run of dueRuns) {
    const claimed = await prisma.workflowRun.updateMany({
      where: {
        id: run.id,
        engine,
        status: WorkflowStatus.QUEUED,
      },
      data: {
        status: WorkflowStatus.RUNNING,
        startedAt: now,
        attemptCount: {
          increment: 1,
        },
      },
    });

    if (!claimed.count) {
      continue;
    }

    processed += 1;

    let workflow: WorkflowRunRecord = null;

    try {
      workflow = await loadWorkflowRun(run.id);
      if (!workflow) {
        continue;
      }

      if (engine === WorkflowEngine.TEMPORAL) {
        if (!options?.temporalDispatcher) {
          throw new Error("temporal_dispatcher_missing");
        }
        await options.temporalDispatcher.startWorkflowExecution({
          workflowRunId: workflow.id,
          workflowKind: workflow.kind,
          workflowId: workflow.externalWorkflowId ?? workflow.id,
          taskQueue: workflow.queueName ?? "delegate-public-runtime",
        });
        dispatched += 1;
      } else {
        await processWorkflowRunById(workflow.id);
        completed += 1;
      }
    } catch (error) {
      failed += 1;
      const failureMessage =
        error instanceof Error ? error.message : "workflow_failed";
      await markWorkflowRunFailed(run.id, failureMessage);
      if (workflow) {
        await prisma.eventAudit.create({
          data: {
            representativeId: workflow.representativeId,
            contactId: workflow.contactId,
            conversationId: workflow.conversationId,
            type: "WORKFLOW_FAILED",
            payload: {
              workflowRunId: workflow.id,
              workflowKind: workflow.kind === WorkflowKind.HANDOFF_FOLLOW_UP
                ? "handoff_follow_up"
                : "approval_expiration",
              ...(workflow.subagentId ? { subagentId: workflow.subagentId } : {}),
              error: failureMessage,
            },
          },
        });
      }
    }
  }

  return {
    processed,
    completed,
    dispatched,
    failed,
  };
}

export async function processWorkflowRunById(workflowRunId: string) {
  const workflow = await loadWorkflowRun(workflowRunId);
  if (!workflow) {
    return;
  }

  switch (workflow.kind) {
    case WorkflowKind.APPROVAL_EXPIRATION:
      await processApprovalExpiration(workflow);
      break;
    case WorkflowKind.HANDOFF_FOLLOW_UP:
      await processHandoffFollowUp(workflow);
      break;
  }
}

export async function markWorkflowRunFailed(workflowRunId: string, failureMessage: string) {
  await prisma.workflowRun.update({
    where: { id: workflowRunId },
    data: {
      status: WorkflowStatus.FAILED,
      failedAt: new Date(),
      lastError: failureMessage,
    },
  });
}

async function processApprovalExpiration(workflow: NonNullable<WorkflowRunRecord>) {
  const input = approvalExpirationInputSchema.parse(workflow.input);
  const now = new Date();

  const approval = workflow.approvalRequest;
  if (!approval) {
    await completeWorkflowRun(workflow.id, {
      outcome: "skipped_missing_approval",
      approvalId: input.approvalId,
    });
    return;
  }

  if (approval.status !== ApprovalStatus.PENDING) {
    await completeWorkflowRun(workflow.id, {
      outcome: "skipped_already_resolved",
      approvalId: approval.id,
      approvalStatus: approval.status.toLowerCase(),
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.approvalRequest.update({
      where: { id: approval.id },
      data: {
        status: ApprovalStatus.EXPIRED,
        resolvedAt: now,
        resolvedBy: "workflow-runner",
      },
    });

    if (approval.toolExecutionId) {
      await tx.toolExecution.updateMany({
        where: {
          approvalRequestId: approval.id,
          status: "BLOCKED",
        },
        data: {
          status: "CANCELED",
          finishedAt: now,
        },
      });
    }

    await tx.eventAudit.create({
      data: {
        representativeId: workflow.representativeId,
        contactId: workflow.contactId,
        conversationId: workflow.conversationId,
        type: "APPROVAL_RESOLVED",
        payload: {
          workflowRunId: workflow.id,
          workflowKind: "approval_expiration",
          approvalRequestId: approval.id,
          ...(workflow.subagentId ? { subagentId: workflow.subagentId } : {}),
          resolution: "expired",
          resolvedBy: "workflow-runner",
        },
      },
    });
  });

  await completeWorkflowRun(workflow.id, {
    outcome: "approval_expired",
    approvalId: approval.id,
    timeoutMinutes: input.timeoutMinutes,
  });
}

async function processHandoffFollowUp(workflow: NonNullable<WorkflowRunRecord>) {
  const input = handoffFollowUpInputSchema.parse(workflow.input);

  const handoff = workflow.handoffRequest;
  if (!handoff) {
    await completeWorkflowRun(workflow.id, {
      outcome: "skipped_missing_handoff",
      handoffId: input.handoffId,
    });
    return;
  }

  if (handoff.status !== HandoffStatus.OPEN && handoff.status !== HandoffStatus.REVIEWING) {
    await completeWorkflowRun(workflow.id, {
      outcome: "skipped_handoff_resolved",
      handoffId: handoff.id,
      handoffStatus: handoff.status.toLowerCase(),
    });
    return;
  }

  await prisma.eventAudit.create({
    data: {
      representativeId: workflow.representativeId,
      contactId: workflow.contactId,
      conversationId: workflow.conversationId,
      type: "WORKFLOW_COMPLETED",
      payload: {
        workflowRunId: workflow.id,
        workflowKind: "handoff_follow_up",
        handoffId: handoff.id,
        ...(workflow.subagentId ? { subagentId: workflow.subagentId } : {}),
        status: handoff.status.toLowerCase(),
        action: "owner_follow_up_due",
      },
    },
  });

  await completeWorkflowRun(workflow.id, {
    outcome: "handoff_follow_up_due",
    handoffId: handoff.id,
    handoffStatus: handoff.status.toLowerCase(),
    handoffWindowHours: input.handoffWindowHours,
  });
}

async function completeWorkflowRun(workflowRunId: string, output: Record<string, unknown>) {
  await prisma.workflowRun.update({
    where: { id: workflowRunId },
    data: {
      status: WorkflowStatus.COMPLETED,
      completedAt: new Date(),
      output: output as Prisma.InputJsonValue,
    },
  });
}

async function loadWorkflowRun(workflowRunId: string) {
  return prisma.workflowRun.findUnique({
    where: { id: workflowRunId },
    include: {
      approvalRequest: true,
      handoffRequest: true,
    },
  });
}

export async function cancelWorkflowRunsForApproval(approvalId: string) {
  return prisma.workflowRun.updateMany({
    where: {
      approvalRequestId: approvalId,
      status: WorkflowStatus.QUEUED,
    },
    data: {
      status: WorkflowStatus.CANCELED,
      completedAt: new Date(),
      output: {
        outcome: "canceled_after_manual_resolution",
      },
    },
  });
}

export async function cancelWorkflowRunsForHandoff(handoffId: string) {
  return prisma.workflowRun.updateMany({
    where: {
      handoffRequestId: handoffId,
      status: WorkflowStatus.QUEUED,
    },
    data: {
      status: WorkflowStatus.CANCELED,
      completedAt: new Date(),
      output: {
        outcome: "canceled_after_handoff_resolution",
      },
    },
  });
}

export function deriveApprovalExpirationOutcome(status: ApprovalStatus) {
  return status === ApprovalStatus.PENDING ? "expire" : "skip";
}

export function deriveHandoffFollowUpOutcome(status: HandoffStatus) {
  return status === HandoffStatus.OPEN || status === HandoffStatus.REVIEWING
    ? "follow_up"
    : "skip";
}
