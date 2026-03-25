import { approvalExpirationDedupeKey, scheduleApprovalExpiration } from "@delegate/workflows";
import { prisma } from "./prisma";

const approvalTimeoutMinutes = parseInt(
  process.env.WORKFLOW_APPROVAL_TIMEOUT_MINUTES?.trim() || "30",
  10,
);

export async function createApprovalRequestForExecution(params: {
  representativeId: string;
  contactId?: string | null;
  conversationId?: string | null;
  sessionId: string;
  executionId: string;
  reason: string;
  requestedActionSummary: string;
  riskSummary: string;
}) {
  const approval = await prisma.approvalRequest.create({
    data: {
      representativeId: params.representativeId,
      contactId: params.contactId ?? null,
      conversationId: params.conversationId ?? null,
      sessionId: params.sessionId,
      toolExecutionId: params.executionId,
      status: "PENDING",
      reason: params.reason,
      requestedActionSummary: params.requestedActionSummary,
      riskSummary: params.riskSummary,
    },
  });

  await prisma.toolExecution.update({
    where: { id: params.executionId },
    data: {
      approvalRequestId: approval.id,
    },
  });

  await prisma.eventAudit.create({
    data: {
      representativeId: params.representativeId,
      contactId: params.contactId ?? null,
      conversationId: params.conversationId ?? null,
      type: "APPROVAL_REQUESTED",
      payload: {
        approvalRequestId: approval.id,
        executionId: params.executionId,
        reason: params.reason,
      },
    },
  });

  const dedupeKey = approvalExpirationDedupeKey(approval.id);
  const existingWorkflow = await prisma.workflowRun.findUnique({
    where: {
      dedupeKey,
    },
    select: {
      id: true,
    },
  });

  if (!existingWorkflow) {
    const scheduledAt = scheduleApprovalExpiration(
      new Date(),
      approvalTimeoutMinutes,
    );
    const workflow = await prisma.workflowRun.create({
      data: {
        representativeId: params.representativeId,
        contactId: params.contactId ?? null,
        conversationId: params.conversationId ?? null,
        approvalRequestId: approval.id,
        kind: "APPROVAL_EXPIRATION",
        status: "QUEUED",
        dedupeKey,
        scheduledAt,
        input: {
          approvalId: approval.id,
          timeoutMinutes: approvalTimeoutMinutes,
        },
      },
    });

    await prisma.eventAudit.create({
      data: {
        representativeId: params.representativeId,
        contactId: params.contactId ?? null,
        conversationId: params.conversationId ?? null,
        type: "WORKFLOW_ENQUEUED",
        payload: {
          workflowRunId: workflow.id,
          workflowKind: "approval_expiration",
          approvalRequestId: approval.id,
          scheduledAt: scheduledAt.toISOString(),
        },
      },
    });
  }

  return approval;
}
