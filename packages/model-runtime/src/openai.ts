import OpenAI from "openai";

import type { ModelRuntimeEnv, ModelUsageSnapshot, RepresentativeReplyPrompt } from "./types";

export async function generateOpenAIResponse(params: {
  env: ModelRuntimeEnv;
  prompt: RepresentativeReplyPrompt;
}): Promise<{
  replyText: string;
  usage?: ModelUsageSnapshot;
}> {
  if (params.env.state !== "ready" || !params.env.openai.apiKey) {
    throw new Error(`OpenAI runtime is not ready: ${params.env.state}.`);
  }

  const client = new OpenAI({
    apiKey: params.env.openai.apiKey,
    ...(params.env.openai.baseUrl ? { baseURL: params.env.openai.baseUrl } : {}),
    timeout: params.env.timeoutMs,
  });

  const response = await client.responses.create({
    model: params.env.openai.model,
    instructions: params.prompt.instructions,
    input: params.prompt.input,
    max_output_tokens: params.env.maxOutputTokens,
  });

  const replyText = extractResponseText(response);
  if (!replyText) {
    throw new Error("OpenAI Responses returned no text output.");
  }

  const usage = response.usage
    ? {
        provider: "openai" as const,
        model: params.env.openai.model,
        ...(typeof response.id === "string" ? { responseId: response.id } : {}),
        ...(typeof response.usage.input_tokens === "number"
          ? { inputTokens: response.usage.input_tokens }
          : {}),
        ...(typeof response.usage.output_tokens === "number"
          ? { outputTokens: response.usage.output_tokens }
          : {}),
        ...(typeof response.usage.total_tokens === "number"
          ? { totalTokens: response.usage.total_tokens }
          : {}),
      }
    : undefined;

  return {
    replyText,
    ...(usage ? { usage } : {}),
  };
}

function extractResponseText(response: {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}): string {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const chunks: string[] = [];
  for (const item of response.output ?? []) {
    if (item.type !== "message") {
      continue;
    }

    for (const part of item.content ?? []) {
      if (part.type === "output_text" && typeof part.text === "string" && part.text.trim()) {
        chunks.push(part.text.trim());
      }
    }
  }

  return chunks.join("\n\n").trim();
}
