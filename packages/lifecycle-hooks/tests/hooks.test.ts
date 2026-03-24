import { describe, expect, it, vi } from "vitest";

import { createLifecycleHookBus } from "../src/index";

describe("createLifecycleHookBus", () => {
  it("emits events to handlers in order", async () => {
    const calls: string[] = [];
    const bus = createLifecycleHookBus([
      {
        name: "first",
        onEvent() {
          calls.push("first");
        },
      },
      {
        name: "second",
        onEvent() {
          calls.push("second");
        },
      },
    ]);

    await bus.emit({
      kind: "session_ended",
      scope: {
        representativeId: "rep_1",
      },
      sessionId: "session_1",
      finalStatus: "completed",
      reason: "test",
    });

    expect(calls).toEqual(["first", "second"]);
  });

  it("continues when one handler throws", async () => {
    const onError = vi.fn();
    const calls: string[] = [];
    const bus = createLifecycleHookBus(
      [
        {
          name: "broken",
          onEvent() {
            throw new Error("boom");
          },
        },
        {
          name: "healthy",
          onEvent() {
            calls.push("healthy");
          },
        },
      ],
      {
        onError,
      },
    );

    await bus.emit({
      kind: "session_ended",
      scope: {
        representativeId: "rep_1",
      },
      sessionId: "session_1",
      finalStatus: "completed",
      reason: "test",
    });

    expect(calls).toEqual(["healthy"]);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
