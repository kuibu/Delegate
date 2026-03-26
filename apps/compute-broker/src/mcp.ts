import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport, SseError } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import { computeBrokerConfig } from "./config";
import { resolveMcpToolName } from "./mcp-bindings";
import { SessionError } from "./session-error";

type BindingRecord = {
  id: string;
  slug: string;
  displayName: string;
  serverUrl: string;
  transportKind: "streamable_http" | "sse";
  defaultToolName: string | null;
  allowedToolNames: unknown;
  maxRetries: number;
  retryBackoffMs: number;
};

type CallToolResultContent = Array<
  | {
      type: string;
      text?: string;
      mimeType?: string;
      resource?: {
        uri?: string;
        text?: string;
      };
    }
  | Record<string, unknown>
>;

export async function callRemoteMcpTool(params: {
  binding: BindingRecord;
  requestedToolName?: string | null | undefined;
  toolArguments?: Record<string, unknown> | undefined;
}) {
  const bindingUrl = safeParseUrl(params.binding.serverUrl);
  const maxRetries = Math.max(0, params.binding.maxRetries ?? 0);
  const retryBackoffMs = Math.max(100, params.binding.retryBackoffMs ?? 1000);

  let attempt = 0;
  let lastError: McpTransportError | SessionError | Error | null = null;

  while (attempt <= maxRetries) {
    attempt += 1;

    try {
      const result = await callRemoteMcpToolOnce({
        binding: params.binding,
        bindingUrl,
        requestedToolName: params.requestedToolName,
        toolArguments: params.toolArguments,
      });

      return {
        ...result,
        attempts: attempt,
        transportKind: params.binding.transportKind,
      };
    } catch (error) {
      if (error instanceof SessionError && !(error instanceof McpTransportError)) {
        throw error;
      }

      const normalized = normalizeMcpError(error, params.binding.transportKind, attempt);
      lastError = normalized;

      if (!normalized.retryable || attempt > maxRetries) {
        throw normalized;
      }

      await delay(retryBackoffMs * attempt);
    }
  }

  throw lastError ?? new SessionError(502, "mcp_transport_failed:unknown_failure");
}

async function callRemoteMcpToolOnce(params: {
  binding: BindingRecord;
  bindingUrl: URL;
  requestedToolName?: string | null | undefined;
  toolArguments?: Record<string, unknown> | undefined;
}) {
  const transport = createTransport(params.binding.transportKind, params.bindingUrl);
  const client = new Client({
    name: "delegate-compute-broker",
    version: "0.1.0",
  });

  try {
    await client.connect(transport as unknown as Transport);

    const listedTools = await client.listTools();
    const availableToolNames = listedTools.tools.map((tool) => tool.name);
    const resolved = resolveMcpToolName({
      binding: params.binding,
      requestedToolName: params.requestedToolName,
    });

    if (!availableToolNames.includes(resolved.toolName)) {
      throw new SessionError(409, "mcp_tool_not_exposed_by_server");
    }

    const result = await client.callTool({
      name: resolved.toolName,
      arguments: params.toolArguments ?? {},
    });

    return {
      toolName: resolved.toolName,
      allowedToolNames: resolved.allowedToolNames,
      availableToolNames,
      result,
      summary: summarizeMcpResult(result.content),
    };
  } finally {
    await client.close().catch(() => undefined);
  }
}

function createTransport(kind: BindingRecord["transportKind"], url: URL) {
  const common = {
    fetch: createTimedFetch(computeBrokerConfig.mcpTimeoutMs),
    requestInit: {
      headers: {
        "user-agent": "Delegate-Compute-Broker/0.1",
      },
    },
  };

  if (kind === "sse") {
    return new SSEClientTransport(url, common);
  }

  return new StreamableHTTPClientTransport(url, common);
}

function safeParseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    throw new SessionError(400, "mcp_binding_invalid_url");
  }
}

function createTimedFetch(timeoutMs: number): typeof fetch {
  return (input, init = {}) => {
    const signal = AbortSignal.timeout(timeoutMs);
    return fetch(input, {
      ...init,
      signal,
    });
  };
}

type McpFailureClassification =
  | "timeout"
  | "unauthorized"
  | "endpoint_not_found"
  | "server_unavailable"
  | "transport_connection_failed";

export class McpTransportError extends SessionError {
  constructor(
    readonly classification: McpFailureClassification,
    readonly transportKind: BindingRecord["transportKind"],
    readonly attempt: number,
    readonly retryable: boolean,
    message: string,
  ) {
    super(502, `mcp_${classification}:${message}`);
  }
}

function normalizeMcpError(
  error: unknown,
  transportKind: BindingRecord["transportKind"],
  attempt: number,
) {
  const details = classifyMcpTransportFailure(error);
  return new McpTransportError(
    details.classification,
    transportKind,
    attempt,
    details.retryable,
    details.message,
  );
}

function classifyMcpTransportFailure(error: unknown): {
  classification: McpFailureClassification;
  retryable: boolean;
  message: string;
} {
  if (error instanceof StreamableHTTPError || error instanceof SseError) {
    return classifyByStatus(error.code, error.message);
  }

  if (error instanceof Error) {
    const message = error.message.trim();
    const lower = message.toLowerCase();

    if (error.name === "TimeoutError" || error.name === "AbortError" || lower.includes("timeout")) {
      return {
        classification: "timeout",
        retryable: true,
        message,
      };
    }

    if (lower.includes("401") || lower.includes("unauthorized")) {
      return {
        classification: "unauthorized",
        retryable: false,
        message,
      };
    }

    if (lower.includes("404") || lower.includes("not found")) {
      return {
        classification: "endpoint_not_found",
        retryable: false,
        message,
      };
    }

    return {
      classification: "transport_connection_failed",
      retryable: true,
      message,
    };
  }

  return {
    classification: "transport_connection_failed",
    retryable: true,
    message: String(error),
  };
}

function classifyByStatus(statusCode: number | undefined, message: string) {
  if (typeof statusCode !== "number") {
    return {
      classification: "transport_connection_failed" as const,
      retryable: true,
      message,
    };
  }

  if (statusCode === 401) {
    return {
      classification: "unauthorized" as const,
      retryable: false,
      message,
    };
  }

  if (statusCode === 404) {
    return {
      classification: "endpoint_not_found" as const,
      retryable: false,
      message,
    };
  }

  if (statusCode === 408 || statusCode === 429 || statusCode >= 500) {
    return {
      classification: "server_unavailable" as const,
      retryable: true,
      message,
    };
  }

  return {
    classification: "transport_connection_failed" as const,
    retryable: true,
    message,
  };
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function summarizeMcpResult(content: unknown) {
  if (!Array.isArray(content)) {
    return "MCP tool completed without structured content.";
  }

  const fragments = (content as CallToolResultContent)
    .map((entry) => {
      if (!entry || typeof entry !== "object" || !("type" in entry)) {
        return null;
      }

      if (entry.type === "text" && typeof entry.text === "string") {
        return entry.text.trim();
      }

      if (entry.type === "resource" && entry.resource && typeof entry.resource === "object") {
        const resource = entry.resource as { uri?: unknown; text?: unknown };
        if (typeof resource.uri === "string") {
          const resourceText = typeof resource.text === "string" ? resource.text.trim() : "";
          return resourceText ? `${resource.uri}: ${resourceText}` : resource.uri;
        }
      }

      return JSON.stringify(entry);
    })
    .filter((value): value is string => Boolean(value));

  if (!fragments.length) {
    return "MCP tool completed.";
  }

  return truncate(fragments.join(" | ").replace(/\s+/g, " "), 240);
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}
