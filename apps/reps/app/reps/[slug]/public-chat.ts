import type { PlanTier, Representative } from "@delegate/domain";
import type { RepresentativeSetupSnapshot } from "@delegate/web-data";
import type { ModelRuntimeRecentTurn } from "@delegate/model-runtime";

export type PublicChatRequest = {
  message: string;
  tier: PlanTier;
  recentTurns?: ModelRuntimeRecentTurn[];
};

export type PublicChatResponse = {
  reply: {
    role: "assistant";
    text: string;
  };
  plan: {
    intent: string;
    nextStep: string;
    suggestedPlan?: PlanTier;
    reasons: string[];
  };
  tier: PlanTier;
  usage: {
    freeRepliesUsed: number;
    freeRepliesRemaining: number;
    passUnlocked: boolean;
    deepHelpUnlocked: boolean;
  };
  runtime: {
    usedModel: boolean;
    provider?: "openai" | "anthropic";
    model?: string;
    fallbackReason?: string;
  };
};

export function buildPublicChatRepresentative(
  setup: RepresentativeSetupSnapshot,
): Representative {
  return {
    id: setup.id,
    slug: setup.slug,
    ownerName: setup.ownerName,
    name: setup.name,
    tagline: setup.tagline,
    tone: setup.tone,
    languages: [...setup.languages],
    groupActivation: setup.groupActivation,
    skills: [...setup.skills],
    skillPacks: [],
    knowledgePack: {
      identitySummary: setup.knowledgePack.identitySummary,
      faq: setup.knowledgePack.faq.map((item) => ({ ...item })),
      materials: setup.knowledgePack.materials.map((item) => ({ ...item })),
      policies: setup.knowledgePack.policies.map((item) => ({ ...item })),
    },
    contract: {
      freeReplyLimit: setup.contract.freeReplyLimit,
      freeScope: [...setup.contract.freeScope],
      paywalledIntents: [...setup.contract.paywalledIntents],
      handoffWindowHours: setup.contract.handoffWindowHours,
    },
    pricing: setup.pricing.map((plan) => ({ ...plan })),
    handoffPrompt: setup.handoffPrompt,
    actionGate: { ...setup.actionGate },
  };
}

export function normalizePublicChatRequest(payload: unknown): PublicChatRequest {
  const body = (payload ?? {}) as Record<string, unknown>;
  const message =
    typeof body.message === "string" ? body.message.trim() : "";
  const tier = normalizePlanTier(body.tier);

  return {
    message,
    tier,
    recentTurns: sanitizeRecentTurns(body.recentTurns),
  };
}

export function deriveTierUsage(params: {
  tier: PlanTier;
  recentTurns: ModelRuntimeRecentTurn[];
  freeReplyLimit: number;
}) {
  const freeRepliesUsed =
    params.tier === "free"
      ? params.recentTurns.filter((turn) => turn.direction === "outbound").length
      : 0;

  return {
    freeRepliesUsed,
    freeRepliesRemaining:
      params.tier === "free"
        ? Math.max(0, params.freeReplyLimit - freeRepliesUsed)
        : params.freeReplyLimit,
    passUnlocked:
      params.tier === "pass" ||
      params.tier === "deep_help" ||
      params.tier === "sponsor",
    deepHelpUnlocked:
      params.tier === "deep_help" || params.tier === "sponsor",
  };
}

function normalizePlanTier(value: unknown): PlanTier {
  if (
    value === "free" ||
    value === "pass" ||
    value === "deep_help" ||
    value === "sponsor"
  ) {
    return value;
  }

  return "free";
}

function sanitizeRecentTurns(value: unknown): ModelRuntimeRecentTurn[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const turns: ModelRuntimeRecentTurn[] = [];

  for (const item of value) {
    const turn = item as Record<string, unknown>;
    const direction =
      turn.direction === "inbound" || turn.direction === "outbound"
        ? turn.direction
        : null;
    const messageText =
      typeof turn.messageText === "string" ? turn.messageText.trim() : "";

    if (!direction || !messageText) {
      continue;
    }

    turns.push({
      direction,
      messageText,
      ...(typeof turn.intent === "string" ? { intent: turn.intent } : {}),
      ...(typeof turn.summary === "string" ? { summary: turn.summary } : {}),
    });
  }

  return turns.slice(-8);
}
