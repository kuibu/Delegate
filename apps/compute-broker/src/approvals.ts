import { prisma } from "./prisma";

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

  return approval;
}
