import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

process.env.COMPUTE_BROKER_INTERNAL_TOKEN ??= "test-internal-token";

let httpServer: ReturnType<typeof createServer> | null = null;
let mcpServer: McpServer | null = null;
let transport: StreamableHTTPServerTransport | null = null;
let serverUrl = "";

beforeAll(async () => {
  mcpServer = new McpServer({
    name: "delegate-test-mcp",
    version: "1.0.0",
  });

  mcpServer.registerTool(
    "lookup",
    {
      description: "Return a deterministic weather string for tests.",
      inputSchema: {
        city: z.string(),
      },
    },
    async ({ city }) => ({
      content: [
        {
          type: "text",
          text: `Weather for ${city}: clear`,
        },
      ],
    }),
  );

  transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => `test-session-${Math.random().toString(16).slice(2, 10)}`,
  });
  await mcpServer.connect(transport as unknown as Transport);

  httpServer = createServer((request, response) => {
    if (!transport) {
      response.statusCode = 500;
      response.end("transport_not_ready");
      return;
    }

    if ((request.url ?? "/") !== "/mcp") {
      response.statusCode = 404;
      response.end("not_found");
      return;
    }

    void transport.handleRequest(request, response);
  });

  await new Promise<void>((resolve) => {
    httpServer!.listen(0, "127.0.0.1", () => resolve());
  });

  const address = httpServer.address() as AddressInfo;
  serverUrl = `http://127.0.0.1:${address.port}/mcp`;
});

afterAll(async () => {
  await transport?.close();
  await mcpServer?.close();
  await new Promise<void>((resolve, reject) => {
    if (!httpServer) {
      resolve();
      return;
    }

    httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

describe("callRemoteMcpTool", () => {
  it("calls an MCP tool over streamable HTTP and returns a summarized result", async () => {
    const { callRemoteMcpTool } = await import("../src/mcp");
    const result = await callRemoteMcpTool({
      binding: {
        id: "binding_weather",
        slug: "weather",
        displayName: "Weather MCP",
        serverUrl,
        defaultToolName: "lookup",
        allowedToolNames: ["lookup"],
      },
      toolArguments: {
        city: "Shanghai",
      },
    });

    expect(result.toolName).toBe("lookup");
    expect(result.availableToolNames).toContain("lookup");
    expect(result.summary).toContain("Weather for Shanghai");
  });
});
