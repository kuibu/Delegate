import type { PlanTier, Representative } from "@delegate/domain";
import type { RepresentativeSetupSnapshot } from "@delegate/web-data";
import type { ModelRuntimeRecentTurn } from "@delegate/model-runtime";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type PublicChatRequest = {
  message: string;
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

export type PublicChatSessionState = {
  freeRepliesUsed: number;
  recentTurns: ModelRuntimeRecentTurn[];
};

type PublicChatSessionCookiePayload = {
  version: 1;
  representativeSlug: string;
  freeRepliesUsed: number;
  recentTurns: ModelRuntimeRecentTurn[];
};

const PUBLIC_CHAT_STATE_VERSION = 1 as const;
const PUBLIC_CHAT_COOKIE_PREFIX = "delegate-public-chat";
const PUBLIC_CHAT_SESSION_SECRET =
  process.env.REP_PUBLIC_CHAT_SESSION_SECRET?.trim() ||
  process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ||
  randomBytes(32).toString("hex");
const PUBLIC_CHAT_RECENT_TURN_LIMIT = 8;
const PUBLIC_CHAT_TURN_TEXT_LIMIT = 240;

export const PUBLIC_CHAT_EFFECTIVE_TIER: PlanTier = "free";
export const PUBLIC_CHAT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

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

  return {
    message,
  };
}

export function deriveTierUsage(params: {
  freeRepliesUsed: number;
  freeReplyLimit: number;
}) {
  return {
    freeRepliesUsed: params.freeRepliesUsed,
    freeRepliesRemaining: Math.max(
      0,
      params.freeReplyLimit - params.freeRepliesUsed,
    ),
    passUnlocked: false,
    deepHelpUnlocked: false,
  };
}

export function sanitizeRecentTurns(value: unknown): ModelRuntimeRecentTurn[] {
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
      messageText: truncateRecentTurnText(messageText),
      ...(typeof turn.intent === "string" ? { intent: turn.intent } : {}),
      ...(typeof turn.summary === "string"
        ? { summary: truncateRecentTurnText(turn.summary) }
        : {}),
    });
  }

  return turns.slice(-PUBLIC_CHAT_RECENT_TURN_LIMIT);
}

export function getPublicChatCookieName(representativeSlug: string) {
  return `${PUBLIC_CHAT_COOKIE_PREFIX}-${representativeSlug}`;
}

export function readPublicChatSessionState(params: {
  representativeSlug: string;
  cookieValue: string | undefined;
}): PublicChatSessionState {
  if (!params.cookieValue) {
    return createEmptyPublicChatSessionState();
  }

  const [encodedPayload, encodedSignature] = params.cookieValue.split(".");
  if (!encodedPayload || !encodedSignature) {
    return createEmptyPublicChatSessionState();
  }

  const expectedSignature = signPublicChatPayload(encodedPayload);
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(encodedSignature);
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return createEmptyPublicChatSessionState();
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<PublicChatSessionCookiePayload>;

    if (
      payload.version !== PUBLIC_CHAT_STATE_VERSION ||
      payload.representativeSlug !== params.representativeSlug
    ) {
      return createEmptyPublicChatSessionState();
    }

    return {
      freeRepliesUsed: normalizeFreeRepliesUsed(payload.freeRepliesUsed),
      recentTurns: sanitizeRecentTurns(payload.recentTurns),
    };
  } catch {
    return createEmptyPublicChatSessionState();
  }
}

export function writePublicChatSessionState(params: {
  representativeSlug: string;
  state: PublicChatSessionState;
}) {
  const payload: PublicChatSessionCookiePayload = {
    version: PUBLIC_CHAT_STATE_VERSION,
    representativeSlug: params.representativeSlug,
    freeRepliesUsed: normalizeFreeRepliesUsed(params.state.freeRepliesUsed),
    recentTurns: sanitizeRecentTurns(params.state.recentTurns),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );

  return `${encodedPayload}.${signPublicChatPayload(encodedPayload)}`;
}

export function appendPublicChatTurns(params: {
  state: PublicChatSessionState;
  userMessage: string;
  assistantMessage: string;
  nextStep?: string;
}) {
  return {
    freeRepliesUsed: normalizeFreeRepliesUsed(params.state.freeRepliesUsed + 1),
    recentTurns: sanitizeRecentTurns([
      ...params.state.recentTurns,
      {
        direction: "inbound",
        messageText: params.userMessage,
      },
      {
        direction: "outbound",
        messageText: params.assistantMessage,
        ...(params.nextStep ? { summary: params.nextStep } : {}),
      },
    ]),
  } satisfies PublicChatSessionState;
}

export function createEmptyPublicChatSessionState(): PublicChatSessionState {
  return {
    freeRepliesUsed: 0,
    recentTurns: [],
  };
}

function signPublicChatPayload(encodedPayload: string) {
  return createHmac("sha256", PUBLIC_CHAT_SESSION_SECRET)
    .update(encodedPayload)
    .digest("base64url");
}

function normalizeFreeRepliesUsed(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : 0;
}

function truncateRecentTurnText(value: string) {
  const normalized = value.trim();
  return normalized.length > PUBLIC_CHAT_TURN_TEXT_LIMIT
    ? normalized.slice(0, PUBLIC_CHAT_TURN_TEXT_LIMIT)
    : normalized;
}
