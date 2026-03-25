import { z } from "zod";

export const workflowKindSchema = z.enum([
  "handoff_follow_up",
  "approval_expiration",
]);

export const workflowStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "canceled",
]);

export const handoffFollowUpInputSchema = z.object({
  handoffId: z.string().min(1),
  handoffWindowHours: z.number().int().positive(),
});

export const approvalExpirationInputSchema = z.object({
  approvalId: z.string().min(1),
  timeoutMinutes: z.number().int().positive(),
});

export type WorkflowKind = z.infer<typeof workflowKindSchema>;
export type WorkflowStatus = z.infer<typeof workflowStatusSchema>;
export type HandoffFollowUpInput = z.infer<typeof handoffFollowUpInputSchema>;
export type ApprovalExpirationInput = z.infer<typeof approvalExpirationInputSchema>;

export function handoffFollowUpDedupeKey(handoffId: string): string {
  return `handoff_follow_up:${handoffId}`;
}

export function approvalExpirationDedupeKey(approvalId: string): string {
  return `approval_expiration:${approvalId}`;
}

export function scheduleHandoffFollowUp(
  now: Date,
  handoffWindowHours: number,
): Date {
  return new Date(now.getTime() + handoffWindowHours * 60 * 60 * 1000);
}

export function scheduleApprovalExpiration(
  now: Date,
  timeoutMinutes: number,
): Date {
  return new Date(now.getTime() + timeoutMinutes * 60 * 1000);
}

export function isWorkflowTerminal(status: WorkflowStatus): boolean {
  return status === "completed" || status === "failed" || status === "canceled";
}
