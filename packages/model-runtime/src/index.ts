import { generateAnthropicResponse } from "./anthropic";
import { assembleRepresentativeReplyPrompt } from "./context";
import { resolveModelRuntimeEnv, resolveProviderAttemptOrder } from "./config";
import { generateOpenAIResponse } from "./openai";
import type {
  ModelProvider,
  RepresentativeReplyInput,
  RepresentativeReplyResult,
} from "./types";

export * from "./config";
export * from "./context";
export * from "./pricing";
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
      ...(env.provider === "openai"
        ? { model: env.openai.model }
        : env.provider === "anthropic"
          ? { model: env.anthropic.model }
          : {}),
    };
  }

  const attemptOrder = resolveProviderAttemptOrder(env);
  if (!attemptOrder.length) {
    return {
      ok: false,
      reason: "Model runtime has no credentialed providers available.",
      state: "missing_credentials",
      contextTrace: assembled.trace,
      provider: env.provider,
    };
  }

  const failures: string[] = [];
  for (const provider of attemptOrder) {
    try {
      const response = await generateProviderResponse(provider, env, assembled.prompt);

      return {
        ok: true,
        replyText: response.replyText,
        provider,
        model: provider === "openai" ? env.openai.model : env.anthropic.model,
        contextTrace: assembled.trace,
        ...(response.usage ? { usage: response.usage } : {}),
      };
    } catch (error) {
      failures.push(
        `${provider}: ${error instanceof Error ? error.message : "Model generation failed."}`,
      );
    }
  }

  return {
    ok: false,
    reason: failures.join(" | "),
    state: "ready",
    contextTrace: assembled.trace,
    provider: env.provider,
    ...(env.provider === "openai"
      ? { model: env.openai.model }
      : env.provider === "anthropic"
        ? { model: env.anthropic.model }
        : {}),
  };
}

async function generateProviderResponse(
  provider: ModelProvider,
  env: ReturnType<typeof resolveModelRuntimeEnv>,
  prompt: ReturnType<typeof assembleRepresentativeReplyPrompt>["prompt"],
) {
  if (provider === "openai") {
    return generateOpenAIResponse({ env, prompt });
  }

  return generateAnthropicResponse({ env, prompt });
}
