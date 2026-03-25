import "dotenv/config";

import { createServer } from "node:http";

import { workflowRunnerConfig } from "./config";
import { runWorkflowTick } from "./runner";

let lastTickAt: string | null = null;
let lastTickSummary:
  | {
      processed: number;
      completed: number;
      failed: number;
    }
  | null = null;
let lastError: string | null = null;

const server = createServer((request, response) => {
  if ((request.method === "GET" || request.method === "HEAD") && request.url === "/health") {
    response.statusCode = 200;
    response.setHeader("content-type", "application/json; charset=utf-8");
    if (request.method === "HEAD") {
      response.end();
      return;
    }

    response.end(
      JSON.stringify({
        status: "ok",
        service: "workflow-runner",
        engine: workflowRunnerConfig.engine.effectiveEngine,
        configuredEngine: workflowRunnerConfig.engine.configuredEngine,
        queueName:
          workflowRunnerConfig.engine.effectiveEngine === "temporal"
            ? workflowRunnerConfig.engine.temporalTaskQueue
            : workflowRunnerConfig.engine.localQueueName,
        temporalReady: workflowRunnerConfig.engine.temporalReady,
        fallbackReason: workflowRunnerConfig.engine.fallbackReason ?? null,
        pollMs: workflowRunnerConfig.pollMs,
        lastTickAt,
        lastTickSummary,
        lastError,
      }),
    );
    return;
  }

  response.statusCode = 404;
  response.end(JSON.stringify({ error: "not_found" }));
});

server.listen(workflowRunnerConfig.port, "0.0.0.0", () => {
  console.log(`workflow-runner listening on http://0.0.0.0:${workflowRunnerConfig.port}`);
});

if (workflowRunnerConfig.engine.effectiveEngine === "local_runner") {
  void tickLoop();
} else {
  lastTickAt = new Date().toISOString();
  lastTickSummary = {
    processed: 0,
    completed: 0,
    failed: 0,
  };
}

async function tickLoop(): Promise<void> {
  try {
    const result = await runWorkflowTick({
      limit: workflowRunnerConfig.batchSize,
    });
    lastTickAt = new Date().toISOString();
    lastTickSummary = result;
    lastError = null;
  } catch (error) {
    lastTickAt = new Date().toISOString();
    lastError = error instanceof Error ? error.message : "workflow_tick_failed";
    console.error("workflow-runner tick failed:", error);
  } finally {
    setTimeout(() => {
      void tickLoop();
    }, workflowRunnerConfig.pollMs);
  }
}
