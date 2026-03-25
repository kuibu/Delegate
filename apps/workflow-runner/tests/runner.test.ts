import { ApprovalStatus, HandoffStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  deriveApprovalExpirationOutcome,
  deriveHandoffFollowUpOutcome,
} from "../src/runner";

describe("workflow-runner decisions", () => {
  it("expires only pending approvals", () => {
    expect(deriveApprovalExpirationOutcome(ApprovalStatus.PENDING)).toBe("expire");
    expect(deriveApprovalExpirationOutcome(ApprovalStatus.APPROVED)).toBe("skip");
    expect(deriveApprovalExpirationOutcome(ApprovalStatus.REJECTED)).toBe("skip");
    expect(deriveApprovalExpirationOutcome(ApprovalStatus.EXPIRED)).toBe("skip");
  });

  it("keeps follow-up only for open owner inbox work", () => {
    expect(deriveHandoffFollowUpOutcome(HandoffStatus.OPEN)).toBe("follow_up");
    expect(deriveHandoffFollowUpOutcome(HandoffStatus.REVIEWING)).toBe("follow_up");
    expect(deriveHandoffFollowUpOutcome(HandoffStatus.ACCEPTED)).toBe("skip");
    expect(deriveHandoffFollowUpOutcome(HandoffStatus.CLOSED)).toBe("skip");
  });
});
