import { createLifecycleHookBus, type LifecycleEvent } from "@delegate/lifecycle-hooks";

import { prisma } from "./prisma";

export const computeLifecycleHooks = createLifecycleHookBus(
  [
    {
      name: "compute-audit-hooks",
      async onEvent(event: LifecycleEvent) {
        switch (event.kind) {
          case "tool_preflight":
            await prisma.eventAudit.create({
              data: {
                representativeId: event.scope.representativeId,
                contactId: event.scope.contactId ?? null,
                conversationId: event.scope.conversationId ?? null,
                type: "TOOL_EXECUTION_REQUESTED",
                payload: {
                  sessionId: event.sessionId,
                  capability: event.capability,
                  requestedCommand: event.requestedCommand ?? null,
                  requestedPath: event.requestedPath ?? null,
                  workingDirectory: event.workingDirectory ?? null,
                  decision: event.decision,
                  reason: event.reason,
                  estimatedCredits: event.estimatedCredits ?? null,
                },
              },
            });
            return;
          case "tool_completed":
            await prisma.eventAudit.create({
              data: {
                representativeId: event.scope.representativeId,
                contactId: event.scope.contactId ?? null,
                conversationId: event.scope.conversationId ?? null,
                type: "TOOL_EXECUTION_COMPLETED",
                payload: {
                  sessionId: event.sessionId,
                  executionId: event.executionId,
                  capability: event.capability,
                  exitCode: event.exitCode,
                  wallMs: event.wallMs,
                  artifactCount: event.artifactCount,
                  actualCredits: event.actualCredits ?? null,
                },
              },
            });
            return;
          case "session_ended":
            await prisma.eventAudit.create({
              data: {
                representativeId: event.scope.representativeId,
                contactId: event.scope.contactId ?? null,
                conversationId: event.scope.conversationId ?? null,
                type: "COMPUTE_SESSION_TERMINATED",
                payload: {
                  sessionId: event.sessionId,
                  reason: event.reason,
                  finalStatus: event.finalStatus,
                },
              },
            });
            return;
          default:
            return;
        }
      },
    },
  ],
  {
    onError(error, event, handler) {
      console.warn(
        `Compute lifecycle hook "${handler.name ?? "anonymous"}" failed for ${event.kind}:`,
        error,
      );
    },
  },
);
