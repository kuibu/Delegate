import { describe, expect, it } from "vitest";

import {
  approvalExpirationDedupeKey,
  handoffFollowUpDedupeKey,
  isWorkflowTerminal,
  scheduleApprovalExpiration,
  scheduleHandoffFollowUp,
} from "../src/index";

describe("workflow helpers", () => {
  it("builds stable dedupe keys", () => {
    expect(handoffFollowUpDedupeKey("handoff_123")).toBe("handoff_follow_up:handoff_123");
    expect(approvalExpirationDedupeKey("approval_123")).toBe("approval_expiration:approval_123");
  });

  it("schedules handoff follow-up in hours", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");

    expect(scheduleHandoffFollowUp(now, 24).toISOString()).toBe("2026-03-26T10:00:00.000Z");
  });

  it("schedules approval expiration in minutes", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");

    expect(scheduleApprovalExpiration(now, 45).toISOString()).toBe("2026-03-25T10:45:00.000Z");
  });

  it("knows which workflow statuses are terminal", () => {
    expect(isWorkflowTerminal("queued")).toBe(false);
    expect(isWorkflowTerminal("running")).toBe(false);
    expect(isWorkflowTerminal("completed")).toBe(true);
    expect(isWorkflowTerminal("failed")).toBe(true);
    expect(isWorkflowTerminal("canceled")).toBe(true);
  });
});
