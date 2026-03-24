import { NextResponse } from "next/server";

import { upsertRepresentativeMcpBinding } from "@delegate/web-data";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; bindingId: string }> },
) {
  const { slug, bindingId } = await params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const binding = await upsertRepresentativeMcpBinding({
      representativeSlug: slug,
      bindingId,
      representativeSkillPackLinkId:
        typeof body.representativeSkillPackLinkId === "string"
          ? body.representativeSkillPackLinkId
          : undefined,
      slug: String(body.slug ?? ""),
      displayName: String(body.displayName ?? ""),
      description:
        typeof body.description === "string" && body.description.trim()
          ? body.description.trim()
          : undefined,
      serverUrl: String(body.serverUrl ?? ""),
      transportKind: body.transportKind === "streamable_http" ? "streamable_http" : "streamable_http",
      allowedToolNames: Array.isArray(body.allowedToolNames)
        ? body.allowedToolNames.filter((value): value is string => typeof value === "string")
        : [],
      defaultToolName:
        typeof body.defaultToolName === "string" && body.defaultToolName.trim()
          ? body.defaultToolName.trim()
          : undefined,
      enabled: body.enabled !== false,
      approvalRequired: body.approvalRequired !== false,
    });

    return NextResponse.json(binding);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update MCP binding.",
      },
      { status: 400 },
    );
  }
}
