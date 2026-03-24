import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import { computeBrokerConfig } from "./config";
import { resolveMcpToolName } from "./mcp-bindings";
import { SessionError } from "./session-error";

type BindingRecord = {
  id: string;
  slug: string;
  displayName: string;
  serverUrl: string;
  defaultToolName: string | null;
  allowedToolNames: unknown;
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
  const transport = new StreamableHTTPClientTransport(bindingUrl, {
    fetch: createTimedFetch(computeBrokerConfig.mcpTimeoutMs),
    requestInit: {
      headers: {
        "user-agent": "Delegate-Compute-Broker/0.1",
      },
    },
  });
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
  } catch (error) {
    if (error instanceof SessionError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new SessionError(502, `mcp_transport_failed:${message}`);
  } finally {
    await client.close().catch(() => undefined);
  }
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
