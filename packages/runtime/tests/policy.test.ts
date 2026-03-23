import { demoRepresentative } from "@delegate/domain";
import { describe, expect, it } from "vitest";

import {
  createConversationPlan,
  evaluateActionGate,
  resolveTelegramGroupHandling,
  renderReplyPreview,
} from "../src/index";

describe("action gate", () => {
  it("denies private file access", () => {
    const decision = evaluateActionGate(demoRepresentative, "access_private_files");

    expect(decision.mode).toBe("deny");
    expect(decision.allowed).toBe(false);
  });

  it("requires owner approval for discounts", () => {
    const decision = evaluateActionGate(demoRepresentative, "offer_discount");

    expect(decision.mode).toBe("ask_first");
    expect(decision.requiresOwnerApproval).toBe(true);
  });
});

describe("conversation planning", () => {
  it("answers a free FAQ request directly", () => {
    const plan = createConversationPlan({
      text: "你们是做什么的？",
      channel: "private_chat",
      representative: demoRepresentative,
      usage: {
        freeRepliesUsed: 0,
        passUnlocked: false,
        deepHelpUnlocked: false,
      },
    });

    expect(plan.intent).toBe("faq");
    expect(plan.nextStep).toBe("answer");
  });

  it("switches pricing conversations to paid continuation when free quota is exhausted", () => {
    const plan = createConversationPlan({
      text: "我想问一下报价和预算怎么安排？",
      channel: "private_chat",
      representative: demoRepresentative,
      usage: {
        freeRepliesUsed: 4,
        passUnlocked: false,
        deepHelpUnlocked: false,
      },
    });

    expect(plan.intent).toBe("pricing");
    expect(plan.nextStep).toBe("offer_paid_unlock");
    expect(plan.suggestedPlan).toBe("pass");
  });

  it("creates structured intake for collaboration requests", () => {
    const plan = createConversationPlan({
      text: "我们想聊一个合作试点，可以先了解下吗？",
      channel: "group_mention",
      representative: demoRepresentative,
      usage: {
        freeRepliesUsed: 1,
        passUnlocked: false,
        deepHelpUnlocked: false,
      },
    });

    expect(plan.intent).toBe("collaboration");
    expect(plan.nextStep).toBe("collect_intake");
    expect(plan.responseOutline[0]).toContain("私聊");
  });

  it("creates a handoff flow when the user asks for a human", () => {
    const plan = createConversationPlan({
      text: "我希望直接和 founder 本人沟通一下",
      channel: "private_chat",
      representative: demoRepresentative,
      usage: {
        freeRepliesUsed: 0,
        passUnlocked: false,
        deepHelpUnlocked: false,
      },
    });

    expect(plan.intent).toBe("handoff");
    expect(plan.nextStep).toBe("handoff");
    expect(renderReplyPreview(demoRepresentative, plan)).toContain("人工转接");
  });

  it("routes refunds into ask-owner flow instead of denying them", () => {
    const plan = createConversationPlan({
      text: "我想申请退款",
      channel: "private_chat",
      representative: demoRepresentative,
      usage: {
        freeRepliesUsed: 0,
        passUnlocked: false,
        deepHelpUnlocked: false,
      },
    });

    expect(plan.intent).toBe("refund");
    expect(plan.nextStep).toBe("ask_owner");
  });
});

describe("telegram group gating", () => {
  it("always handles private chats", () => {
    const result = resolveTelegramGroupHandling({
      chatType: "private",
      activation: "mention_only",
      wasMentioned: false,
      isReplyToRepresentative: false,
    });

    expect(result.shouldHandle).toBe(true);
    expect(result.reason).toBe("private_chat");
  });

  it("allows reply-based activation when configured", () => {
    const result = resolveTelegramGroupHandling({
      chatType: "group",
      activation: "reply_or_mention",
      wasMentioned: false,
      isReplyToRepresentative: true,
    });

    expect(result.shouldHandle).toBe(true);
    expect(result.reason).toBe("reply");
  });

  it("ignores ambient group traffic when mention_only is active", () => {
    const result = resolveTelegramGroupHandling({
      chatType: "supergroup",
      activation: "mention_only",
      wasMentioned: false,
      isReplyToRepresentative: true,
    });

    expect(result.shouldHandle).toBe(false);
    expect(result.reason).toBe("ignored");
  });
});
