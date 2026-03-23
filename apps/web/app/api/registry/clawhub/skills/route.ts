import { searchClawHubRepresentativeSkills } from "@delegate/registry";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() ?? "";
  const limit = Number.parseInt(searchParams.get("limit") ?? "8", 10);

  try {
    const results = await searchClawHubRepresentativeSkills({
      query,
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 20) : 8,
    });

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to search ClawHub skills.",
      },
      { status: 502 },
    );
  }
}
