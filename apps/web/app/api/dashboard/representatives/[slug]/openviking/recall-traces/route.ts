import { NextResponse } from "next/server";

import { getRepresentativeOpenVikingRecallTraces } from "@delegate/web-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    const traces = await getRepresentativeOpenVikingRecallTraces(slug);
    return NextResponse.json({ traces });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load OpenViking recall traces.",
      },
      { status: 500 },
    );
  }
}
