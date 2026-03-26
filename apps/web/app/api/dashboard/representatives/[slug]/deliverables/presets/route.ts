import { NextResponse } from "next/server";

import { getRepresentativeDeliverablePackagingPresets } from "@delegate/web-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    const payload = await getRepresentativeDeliverablePackagingPresets(slug);
    if (!payload) {
      return NextResponse.json({ error: "Representative not found." }, { status: 404 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load packaging presets.",
      },
      { status: 500 },
    );
  }
}
