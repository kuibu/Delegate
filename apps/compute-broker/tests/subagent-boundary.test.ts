import { describe, expect, it } from "vitest";

import {
  createComputeSessionRequestSchema,
  toolExecutionRequestSchema,
} from "@delegate/compute-protocol";

import {
  assertExecutionSubagentRoute,
  resolveSessionComputeSubagentId,
} from "../src/policy";

describe("compute subagent transport boundary", () => {
  it("rejects browser capability inside a compute-agent session request", () => {
    const result = createComputeSessionRequestSchema.safeParse({
      representativeId: "rep_123",
      contactId: "contact_123",
      conversationId: "conversation_123",
      subagentId: "compute-agent",
      requestedBy: "audience",
      requestedCapabilities: ["browser"],
      reason: "Need to inspect a page",
    });

    expect(result.success).toBe(false);
  });

  it("rejects exec execution requests from the browser-agent lane", () => {
    const result = toolExecutionRequestSchema.safeParse({
      capability: "exec",
      subagentId: "browser-agent",
      command: "pwd",
      hasPaidEntitlement: true,
    });

    expect(result.success).toBe(false);
  });

  it("falls back to browser-agent for legacy browser sessions without a stored subagent", () => {
    expect(resolveSessionComputeSubagentId(null, "browser")).toBe("browser-agent");
  });

  it("falls back to compute-agent for legacy non-browser sessions without a stored subagent", () => {
    expect(resolveSessionComputeSubagentId(null, "exec")).toBe("compute-agent");
    expect(resolveSessionComputeSubagentId(null, "mcp")).toBe("compute-agent");
  });

  it("throws when the request subagent does not match the session route", () => {
    expect(() =>
      assertExecutionSubagentRoute({
        sessionSubagentId: "compute-agent",
        requestedSubagentId: "browser-agent",
        capability: "browser",
      }),
    ).toThrowError("compute_subagent_session_mismatch");
  });

  it("throws when the request subagent does not match the capability route", () => {
    expect(() =>
      assertExecutionSubagentRoute({
        sessionSubagentId: "compute-agent",
        requestedSubagentId: "compute-agent",
        capability: "browser",
      }),
    ).toThrowError("compute_subagent_capability_mismatch");
  });

  it("accepts a matching browser-agent route", () => {
    expect(() =>
      assertExecutionSubagentRoute({
        sessionSubagentId: "browser-agent",
        requestedSubagentId: "browser-agent",
        capability: "browser",
      }),
    ).not.toThrow();
  });
});
