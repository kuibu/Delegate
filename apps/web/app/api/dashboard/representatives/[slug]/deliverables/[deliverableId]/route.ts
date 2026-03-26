import { NextResponse } from "next/server";

import { upsertRepresentativeDeliverable } from "@delegate/web-data";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; deliverableId: string }> },
) {
  const { slug, deliverableId } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const deliverable = await upsertRepresentativeDeliverable({
      representativeSlug: slug,
      deliverableId,
      body,
    });

    return NextResponse.json({ deliverable });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update deliverable.",
      },
      { status: 500 },
    );
  }
}
