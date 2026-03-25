import type { ModelPricingConfig, ModelUsageSnapshot } from "./types";

export function calculateModelUsageCost(params: {
  pricing: ModelPricingConfig;
  usage: Pick<ModelUsageSnapshot, "inputTokens" | "outputTokens" | "totalTokens">;
}): {
  costCents: number;
  estimatedCostUsd: number;
} {
  const inputTokens = sanitizeTokenCount(params.usage.inputTokens);
  const outputTokens = sanitizeTokenCount(
    params.usage.outputTokens,
    Math.max(0, sanitizeTokenCount(params.usage.totalTokens) - inputTokens),
  );
  const estimatedCostUsd =
    (inputTokens / 1_000_000) * params.pricing.inputCostUsdPerMillionTokens +
    (outputTokens / 1_000_000) * params.pricing.outputCostUsdPerMillionTokens;

  return {
    costCents: Math.max(0, Math.round(estimatedCostUsd * 100)),
    estimatedCostUsd,
  };
}

function sanitizeTokenCount(value: number | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}
