import { assembleRepresentativeReplyPrompt } from "./context";
import { resolveModelRuntimeEnv } from "./config";
import { generateOpenAIResponse } from "./openai";
import type { RepresentativeReplyInput, RepresentativeReplyResult } from "./types";

export * from "./config";
export * from "./context";
export * from "./types";

export async function generateRepresentativeReply(
  params: RepresentativeReplyInput,
): Promise<RepresentativeReplyResult> {
  const env = resolveModelRuntimeEnv();
  const assembled = assembleRepresentativeReplyPrompt(params, {
    maxInputTokens: env.maxInputTokens,
  });
  if (env.state !== "ready") {
    return {
      ok: false,
      reason: `Model runtime unavailable: ${env.state}.`,
      state: env.state,
      contextTrace: assembled.trace,
      provider: env.provider,
      ...(env.provider === "openai" ? { model: env.openai.model } : {}),
    };
  }

  if (env.provider !== "openai") {
    return {
      ok: false,
      reason: `Unsupported model provider: ${env.provider}.`,
      state: "unsupported_provider",
      contextTrace: assembled.trace,
      provider: env.provider,
    };
  }

  try {
    const response = await generateOpenAIResponse({
      env,
      prompt: assembled.prompt,
    });

    return {
      ok: true,
      replyText: response.replyText,
      provider: "openai",
      model: env.openai.model,
      contextTrace: assembled.trace,
      ...(response.usage ? { usage: response.usage } : {}),
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Model generation failed.",
      state: "ready",
      contextTrace: assembled.trace,
      provider: env.provider,
      ...(env.provider === "openai" ? { model: env.openai.model } : {}),
    };
  }
}
