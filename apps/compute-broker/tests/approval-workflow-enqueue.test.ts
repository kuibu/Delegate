import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const prismaMock = {
    approvalRequest: {
      create: vi.fn(),
    },
    toolExecution: {
      update: vi.fn(),
    },
    eventAudit: {
      create: vi.fn(),
    },
    workflowRun: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  prismaMock.$transaction.mockImplementation(async (callback: unknown) => {
    return (callback as (client: typeof prismaMock) => unknown)(prismaMock);
  });

  return {
    mockPrisma: prismaMock,
  };
});

vi.mock("../src/prisma", () => ({
  prisma: mockPrisma,
}));

describe("approval workflow enqueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.WORKFLOW_APPROVAL_TIMEOUT_MINUTES = "30";
    mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
      return (callback as (client: typeof mockPrisma) => unknown)(mockPrisma);
    });
    mockPrisma.approvalRequest.create.mockResolvedValue({
      id: "approval-1",
      status: "PENDING",
    });
    mockPrisma.toolExecution.update.mockResolvedValue({ id: "execution-1" });
    mockPrisma.eventAudit.create.mockResolvedValue({ id: "event-1" });
    mockPrisma.workflowRun.findUnique.mockResolvedValue(null);
    mockPrisma.workflowRun.create.mockResolvedValue({ id: "workflow-1" });
  });

  afterEach(() => {
    delete process.env.WORKFLOW_ENGINE;
    delete process.env.WORKFLOW_TEMPORAL_ADDRESS;
    delete process.env.WORKFLOW_TEMPORAL_NAMESPACE;
    delete process.env.WORKFLOW_TEMPORAL_TASK_QUEUE;
    delete process.env.WORKFLOW_APPROVAL_TIMEOUT_MINUTES;
  });

  it("writes WorkflowRun and START outbox intent in Temporal mode", async () => {
    process.env.WORKFLOW_ENGINE = "temporal";
    process.env.WORKFLOW_TEMPORAL_ADDRESS = "127.0.0.1:7233";
    process.env.WORKFLOW_TEMPORAL_NAMESPACE = "delegate";
    process.env.WORKFLOW_TEMPORAL_TASK_QUEUE = "delegate-public-runtime";

    const { createApprovalRequestForExecution } = await import("../src/approvals");

    await createApprovalRequestForExecution(buildApprovalParams());

    expect(mockPrisma.workflowRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        approvalRequestId: "approval-1",
        kind: "APPROVAL_EXPIRATION",
        engine: "TEMPORAL",
        status: "QUEUED",
        enginePhase: "DISPATCH_PENDING",
        nextWakeAt: expect.any(Date),
        dedupeKey: "approval_expiration:approval-1",
        queueName: "delegate-public-runtime",
        externalWorkflowId: "delegate:rep-1:approval_expiration:approval-1",
        commandOutbox: {
          create: expect.objectContaining({
            commandType: "START",
            payload: expect.objectContaining({
              source: "approval_expiration_enqueue",
              scheduledAt: expect.any(String),
            }),
          }),
        },
      }),
    });
  });

  it("keeps local_runner enqueue free of Temporal outbox intent", async () => {
    process.env.WORKFLOW_ENGINE = "local_runner";

    const { createApprovalRequestForExecution } = await import("../src/approvals");

    await createApprovalRequestForExecution(buildApprovalParams());

    const workflowData = mockPrisma.workflowRun.create.mock.calls[0]?.[0]?.data;
    expect(workflowData).toEqual(expect.objectContaining({
      engine: "LOCAL_RUNNER",
      status: "QUEUED",
      dedupeKey: "approval_expiration:approval-1",
    }));
    expect(workflowData).not.toHaveProperty("commandOutbox");
    expect(workflowData).not.toHaveProperty("enginePhase");
  });

  it("does not create duplicate workflow rows when the dedupe key already exists", async () => {
    process.env.WORKFLOW_ENGINE = "temporal";
    process.env.WORKFLOW_TEMPORAL_ADDRESS = "127.0.0.1:7233";
    process.env.WORKFLOW_TEMPORAL_NAMESPACE = "delegate";
    process.env.WORKFLOW_TEMPORAL_TASK_QUEUE = "delegate-public-runtime";
    mockPrisma.workflowRun.findUnique.mockResolvedValue({ id: "workflow-existing" });

    const { createApprovalRequestForExecution } = await import("../src/approvals");

    await createApprovalRequestForExecution(buildApprovalParams());

    expect(mockPrisma.workflowRun.create).not.toHaveBeenCalled();
  });
});

function buildApprovalParams() {
  return {
    representativeId: "rep-1",
    contactId: "contact-1",
    conversationId: "conversation-1",
    sessionId: "session-1",
    executionId: "execution-1",
    subagentId: "subagent-1",
    reason: "policy_requires_approval",
    requestedActionSummary: "Run a sensitive command",
    riskSummary: "Touches a protected resource",
  };
}
