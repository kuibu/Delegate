import { getWorkflowEngineConfig } from "@delegate/workflows";

export const workflowRunnerConfig = {
  port: parseInt(process.env.WORKFLOW_RUNNER_PORT?.trim() || "4020", 10),
  pollMs: parseInt(process.env.WORKFLOW_RUNNER_POLL_MS?.trim() || "5000", 10),
  approvalTimeoutMinutes: parseInt(
    process.env.WORKFLOW_APPROVAL_TIMEOUT_MINUTES?.trim() || "30",
    10,
  ),
  batchSize: parseInt(process.env.WORKFLOW_RUNNER_BATCH_SIZE?.trim() || "10", 10),
  engine: getWorkflowEngineConfig(process.env),
} as const;
