import { describe, expect, it } from "vitest";
import { evaluateCapabilityPolicy } from "../src/index";

describe("evaluateCapabilityPolicy", () => {
  const profile = {
    id: "profile_1",
    representativeId: "rep_1",
    name: "Default",
    isDefault: true,
    defaultDecision: "ask" as const,
    maxSessionMinutes: 15,
    maxParallelSessions: 1,
    maxCommandSeconds: 30,
    artifactRetentionDays: 14,
    networkMode: "no_network" as const,
    filesystemMode: "workspace_only" as const,
    rules: [
      {
        id: "rule_allow_ls",
        capability: "exec" as const,
        decision: "allow" as const,
        commandPattern: "^(ls|cat|rg)(\\s|$)",
        priority: 100,
        requiresHumanApproval: false,
        requiresPaidPlan: false,
      },
      {
        id: "rule_ask_write",
        capability: "write" as const,
        decision: "ask" as const,
        pathPattern: "^/workspace",
        priority: 50,
        requiresHumanApproval: true,
        requiresPaidPlan: false,
      },
    ],
  };

  it("allows commands that match an allow rule", () => {
    const result = evaluateCapabilityPolicy(profile, {
      capability: "exec",
      command: "rg founder README.md",
    });

    expect(result.decision).toBe("allow");
    expect(result.matchedRuleId).toBe("rule_allow_ls");
  });

  it("asks when a matching rule requires approval", () => {
    const result = evaluateCapabilityPolicy(profile, {
      capability: "write",
      path: "/workspace/output.txt",
    });

    expect(result.decision).toBe("ask");
    expect(result.reason).toBe("human_approval_required");
  });

  it("falls back to the profile default when no rule matches", () => {
    const result = evaluateCapabilityPolicy(profile, {
      capability: "process",
    });

    expect(result.decision).toBe("ask");
    expect(result.reason).toBe("default_profile_decision");
  });
});
