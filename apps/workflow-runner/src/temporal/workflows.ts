import { proxyActivities } from "@temporalio/workflow";

type TemporalWorkflowActivities = {
  executeWorkflowRunActivity(workflowRunId: string): Promise<void>;
};

const { executeWorkflowRunActivity } = proxyActivities<TemporalWorkflowActivities>({
  startToCloseTimeout: "1 minute",
  retry: {
    maximumAttempts: 3,
  },
});

export async function runDelegateWorkflowRun(workflowRunId: string): Promise<void> {
  await executeWorkflowRunActivity(workflowRunId);
}
