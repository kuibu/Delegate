import { Client, Connection } from "@temporalio/client";
import { NativeConnection, Worker } from "@temporalio/worker";
import type { WorkflowEngineConfig } from "@delegate/workflows";
import { fileURLToPath } from "node:url";

import type { TemporalWorkflowDispatcher } from "./runner";
import { executeWorkflowRunActivity } from "./temporal/activities";

export type TemporalBridgeState = {
  status: "starting" | "running" | "failed";
  error?: string;
};

export type TemporalBridge = TemporalWorkflowDispatcher & {
  getState(): TemporalBridgeState;
};

export async function createTemporalBridge(
  config: WorkflowEngineConfig,
): Promise<TemporalBridge> {
  if (!config.temporalReady || !config.temporalAddress || !config.temporalNamespace || !config.temporalTaskQueue) {
    throw new Error("temporal_not_ready");
  }

  const state: TemporalBridgeState = {
    status: "starting",
  };

  const clientConnection = await Connection.connect({
    address: config.temporalAddress,
  });
  const client = new Client({
    connection: clientConnection,
    namespace: config.temporalNamespace,
  });
  const workerConnection = await NativeConnection.connect({
    address: config.temporalAddress,
  });

  const worker = await Worker.create({
    connection: workerConnection,
    namespace: config.temporalNamespace,
    taskQueue: config.temporalTaskQueue,
    workflowsPath: fileURLToPath(new URL("./temporal/workflows.ts", import.meta.url)),
    activities: {
      executeWorkflowRunActivity,
    },
  });

  state.status = "running";
  void worker.run().catch((error: unknown) => {
    state.status = "failed";
    state.error = error instanceof Error ? error.message : "temporal_worker_failed";
  });

  return {
    getState() {
      return { ...state };
    },
    async startWorkflowExecution(params) {
      await client.workflow.start("runDelegateWorkflowRun", {
        args: [params.workflowRunId],
        taskQueue: params.taskQueue,
        workflowId: params.workflowId,
      });
    },
  };
}
