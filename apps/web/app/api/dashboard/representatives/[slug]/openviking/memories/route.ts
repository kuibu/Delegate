import { NextResponse } from "next/server";

import { getRepresentativeOpenVikingMemoryPreview } from "@delegate/web-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    const memories = await getRepresentativeOpenVikingMemoryPreview(slug);
    return NextResponse.json({ memories });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load OpenViking memory preview.",
      },
      { status: 500 },
    );
  }
}
