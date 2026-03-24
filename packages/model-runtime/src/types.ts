import type { Representative } from "@delegate/domain";
import type { OpenVikingRecallItem } from "@delegate/openviking";
import type { ConversationPlan, StructuredCollectorState } from "@delegate/runtime";
import type { ModelContextSegmentTrace } from "@delegate/lifecycle-hooks";

export type ModelProvider = "openai";

export type ModelRuntimeState = "ready" | "disabled" | "missing_credentials" | "unsupported_provider";

export type ModelRuntimeEnv = {
  enabled: boolean;
  provider: string;
  state: ModelRuntimeState;
  timeoutMs: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  openai: {
    model: string;
    apiKey?: string;
    baseUrl?: string;
  };
};

export type ModelRuntimeRecentTurn = {
  direction: "inbound" | "outbound";
  messageText: string;
  intent?: string | null;
  summary?: string | null;
};

export type RepresentativeReplyInput = {
  representative: Representative;
  plan: ConversationPlan;
  userText: string;
  recalled: OpenVikingRecallItem[];
  recentTurns: ModelRuntimeRecentTurn[];
  collectorState?: StructuredCollectorState | null;
};

export type RepresentativeReplyPrompt = {
  instructions: string;
  input: string;
};

export type RepresentativeReplyContextTrace = {
  estimatedInputTokens: number;
  segments: ModelContextSegmentTrace[];
  selectedKnowledgeTitles: string[];
  selectedRecallUris: string[];
};

export type ModelUsageSnapshot = {
  provider: ModelProvider;
  model: string;
  responseId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type RepresentativeReplyResult =
  | {
      ok: true;
      replyText: string;
      provider: ModelProvider;
      model: string;
      contextTrace: RepresentativeReplyContextTrace;
      usage?: ModelUsageSnapshot;
    }
  | {
      ok: false;
      reason: string;
      state: ModelRuntimeState;
      contextTrace?: RepresentativeReplyContextTrace;
      provider?: string;
      model?: string;
    };
