import { demoRepresentative } from "@delegate/domain";
import { describe, expect, it } from "vitest";

import {
  assembleRepresentativeReplyPrompt,
  buildRepresentativeReplyPrompt,
  calculateModelUsageCost,
  resolveModelRuntimeEnv,
  resolveProviderAttemptOrder,
} from "../src/index";

describe("buildRepresentativeReplyPrompt", () => {
  it("includes the public trust boundary and recalled context", () => {
    const prompt = buildRepresentativeReplyPrompt({
      representative: demoRepresentative,
      plan: {
        intent: "faq",
        audienceRole: "other",
        action: "answer_faq",
        nextStep: "answer",
        reasons: ["Intent detected: faq.", "Public answer allowed."],
        responseOutline: ["Answer the user directly.", "Offer a safe next step."],
      },
      userText: "你们是做什么的？",
      recentTurns: [
        {
          direction: "inbound",
          messageText: "你们是做什么的？",
          intent: "faq",
        },
      ],
      recalled: [
        {
          uri: "viking://resources/delegate/reps/lin-founder-rep/identity/bio",
          contextType: "resource",
          layer: "L1",
          score: 0.91,
          abstract: "Founder representative identity.",
          overview: "Delegate is a Telegram-native public representative.",
        },
      ],
    });

    expect(prompt.instructions).toContain("public-facing representative");
    expect(prompt.instructions).toContain("Never imply access to private workspaces");
    expect(prompt.input).toContain("Recalled public-safe context:");
    expect(prompt.input).toContain("Reply outline:");
  });

  it("tracks segment inclusion and trims lower-priority context when the budget is tight", () => {
    const assembled = assembleRepresentativeReplyPrompt(
      {
        representative: demoRepresentative,
        plan: {
          intent: "pricing",
          audienceRole: "lead",
          action: "collect_quote_request",
          nextStep: "answer",
          reasons: ["Intent detected: pricing.", "Public answer allowed."],
          responseOutline: ["Answer the user directly.", "Offer a safe next step."],
        },
        userText: "Can you tell me your pricing and send any case studies?",
        collectorState: {
          kind: "quote",
          intent: "pricing",
          stepIndex: 1,
          sourceChannel: "private_chat",
          startedAt: new Date("2026-03-24T12:00:00.000Z").toISOString(),
          answers: {
            budget: "5000 USD",
            timeline: "2 weeks",
          },
        },
        recentTurns: [
          {
            direction: "inbound",
            messageText: "Can you tell me your pricing and send any case studies?",
            intent: "pricing",
          },
        ],
        recalled: [
          {
            uri: "viking://resources/delegate/reps/lin-founder-rep/identity/bio",
            contextType: "resource",
            layer: "L1",
            score: 0.91,
            abstract: "Founder representative identity.",
            overview: "Delegate is a Telegram-native public representative.",
          },
        ],
      },
      {
        maxInputTokens: 320,
      },
    );

    expect(assembled.trace.segments.some((segment) => segment.kind === "collector_state")).toBe(true);
    expect(assembled.prompt.input).toContain("Active collector state:");
    expect(assembled.trace.estimatedInputTokens).toBeLessThanOrEqual(320);
    expect(assembled.trace.segments.some((segment) => segment.trimReason === "max_input_tokens")).toBe(true);
  });

  it("records clean knowledge titles and recall URIs in the context trace", () => {
    const assembled = assembleRepresentativeReplyPrompt({
      representative: demoRepresentative,
      plan: {
        intent: "faq",
        audienceRole: "other",
        action: "answer_faq",
        nextStep: "answer",
        reasons: ["Intent detected: faq.", "Public answer allowed."],
        responseOutline: ["Answer the user directly.", "Offer a safe next step."],
      },
      userText: "What does Delegate do?",
      recentTurns: [],
      recalled: [
        {
          uri: "viking://resources/delegate/reps/lin-founder-rep/identity/bio",
          contextType: "resource",
          layer: "L1",
          score: 0.91,
          abstract: "Founder representative identity.",
          overview: "Delegate is a Telegram-native public representative.",
        },
      ],
    });

    expect(assembled.trace.selectedRecallUris).toEqual([
      "viking://resources/delegate/reps/lin-founder-rep/identity/bio",
    ]);
    expect(assembled.trace.selectedKnowledgeTitles.length).toBeGreaterThan(0);
    expect(assembled.trace.selectedKnowledgeTitles[0]).not.toContain("[");
    expect(assembled.trace.selectedKnowledgeTitles[0]).not.toContain("- ");
  });
});

describe("resolveModelRuntimeEnv", () => {
  it("reports missing credentials when enabled without an OpenAI key", () => {
    const env = resolveModelRuntimeEnv({
      DELEGATE_MODEL_ENABLED: "true",
      DELEGATE_MODEL_PROVIDER: "openai",
    });

    expect(env.state).toBe("missing_credentials");
  });

  it("supports a dedicated max input token budget", () => {
    const env = resolveModelRuntimeEnv({
      DELEGATE_MODEL_ENABLED: "true",
      DELEGATE_MODEL_PROVIDER: "openai",
      DELEGATE_MODEL_MAX_INPUT_TOKENS: "1800",
    });

    expect(env.maxInputTokens).toBe(1800);
  });

  it("uses Anthropic as the ready fallback provider when OpenAI credentials are missing", () => {
    const env = resolveModelRuntimeEnv({
      DELEGATE_MODEL_ENABLED: "true",
      DELEGATE_MODEL_PROVIDER: "openai",
      DELEGATE_MODEL_FALLBACK_PROVIDER: "anthropic",
      DELEGATE_ANTHROPIC_MODEL: "claude-sonnet-4-5",
      ANTHROPIC_API_KEY: "anthropic-key",
    });

    expect(env.state).toBe("ready");
    expect(resolveProviderAttemptOrder(env)).toEqual(["anthropic"]);
  });

  it("calculates internal model cost from per-provider pricing", () => {
    const priced = calculateModelUsageCost({
      pricing: {
        inputCostUsdPerMillionTokens: 3,
        outputCostUsdPerMillionTokens: 15,
      },
      usage: {
        inputTokens: 10_000,
        outputTokens: 5_000,
      },
    });

    expect(priced.estimatedCostUsd).toBeCloseTo(0.105, 6);
    expect(priced.costCents).toBe(11);
  });
});
