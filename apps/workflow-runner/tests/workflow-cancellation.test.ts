import {
  WorkflowEngine,
  WorkflowEnginePhase,
  WorkflowKind,
  WorkflowStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const prismaMock = {
    workflowRun: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };

  return {
    mockPrisma: prismaMock,
  };
});

vi.mock("../src/prisma", () => ({
  prisma: mockPrisma,
}));

import { processWorkflowRunById } from "../src/runner";

describe("workflow cancellation idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.workflowRun.update.mockResolvedValue({ id: "workflow-canceled" });
    mockPrisma.workflowRun.updateMany.mockResolvedValue({ count: 0 });
  });

  it("no-ops late activity execution after the workflow is already canceled", async () => {
    mockPrisma.workflowRun.findUnique.mockResolvedValue({
      id: "workflow-canceled",
      kind: WorkflowKind.APPROVAL_EXPIRATION,
      engine: WorkflowEngine.TEMPORAL,
      status: WorkflowStatus.CANCELED,
      enginePhase: WorkflowEnginePhase.CANCEL_REQUESTED,
      input: {
        approvalId: "approval-1",
        timeoutMinutes: 30,
      },
      approvalRequest: {
        id: "approval-1",
        status: "PENDING",
      },
      handoffRequest: null,
    });

    await processWorkflowRunById("workflow-canceled");

    expect(mockPrisma.workflowRun.update).toHaveBeenCalledWith({
      where: { id: "workflow-canceled" },
      data: expect.objectContaining({
        enginePhase: WorkflowEnginePhase.CANCELED,
        nextWakeAt: null,
        lastEngineError: null,
      }),
    });
    expect(mockPrisma.workflowRun.updateMany).not.toHaveBeenCalled();
  });
});
