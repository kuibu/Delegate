import { z } from "zod";

import type { ModelRuntimeEnv } from "./types";

const envSchema = z.object({
  DELEGATE_MODEL_ENABLED: z.string().optional(),
  DELEGATE_MODEL_PROVIDER: z.string().optional(),
  DELEGATE_MODEL_TIMEOUT_MS: z.string().optional(),
  DELEGATE_MODEL_MAX_INPUT_TOKENS: z.string().optional(),
  DELEGATE_MODEL_MAX_OUTPUT_TOKENS: z.string().optional(),
  DELEGATE_OPENAI_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional(),
});

export function resolveModelRuntimeEnv(env: NodeJS.ProcessEnv = process.env): ModelRuntimeEnv {
  const parsed = envSchema.parse(env);
  const enabled = parseBoolean(parsed.DELEGATE_MODEL_ENABLED, true);
  const provider = normalizeOptionalString(parsed.DELEGATE_MODEL_PROVIDER) ?? "openai";
  const timeoutMs = parseInteger(parsed.DELEGATE_MODEL_TIMEOUT_MS, 12_000);
  const maxInputTokens = parseInteger(parsed.DELEGATE_MODEL_MAX_INPUT_TOKENS, 2_400);
  const maxOutputTokens = parseInteger(parsed.DELEGATE_MODEL_MAX_OUTPUT_TOKENS, 320);
  const openaiModel = normalizeOptionalString(parsed.DELEGATE_OPENAI_MODEL) ?? "gpt-5-mini";
  const openaiApiKey = normalizeOptionalString(parsed.OPENAI_API_KEY);
  const openaiBaseUrl = normalizeOptionalString(parsed.OPENAI_BASE_URL);

  if (!enabled) {
    return {
      enabled,
      provider,
      state: "disabled",
      timeoutMs,
      maxInputTokens,
      maxOutputTokens,
      openai: {
        model: openaiModel,
        ...(openaiApiKey ? { apiKey: openaiApiKey } : {}),
        ...(openaiBaseUrl ? { baseUrl: openaiBaseUrl } : {}),
      },
    };
  }

  if (provider !== "openai") {
    return {
      enabled,
      provider,
      state: "unsupported_provider",
      timeoutMs,
      maxInputTokens,
      maxOutputTokens,
      openai: {
        model: openaiModel,
        ...(openaiApiKey ? { apiKey: openaiApiKey } : {}),
        ...(openaiBaseUrl ? { baseUrl: openaiBaseUrl } : {}),
      },
    };
  }

  if (!openaiApiKey) {
    return {
      enabled,
      provider,
      state: "missing_credentials",
      timeoutMs,
      maxInputTokens,
      maxOutputTokens,
      openai: {
        model: openaiModel,
        ...(openaiBaseUrl ? { baseUrl: openaiBaseUrl } : {}),
      },
    };
  }

  return {
    enabled,
    provider,
    state: "ready",
    timeoutMs,
    maxInputTokens,
    maxOutputTokens,
    openai: {
      model: openaiModel,
      apiKey: openaiApiKey,
      ...(openaiBaseUrl ? { baseUrl: openaiBaseUrl } : {}),
    },
  };
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

function parseInteger(value: string | undefined, defaultValue: number): number {
  if (!value) {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}
