import { NextResponse } from "next/server";

import {
  getRepresentativeDeliverables,
  upsertRepresentativeDeliverable,
} from "@delegate/web-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    const snapshot = await getRepresentativeDeliverables(slug);
    if (!snapshot) {
      return NextResponse.json({ error: "Representative not found." }, { status: 404 });
    }

    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load deliverables.",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const deliverable = await upsertRepresentativeDeliverable({
      representativeSlug: slug,
      body,
    });

    return NextResponse.json({ deliverable });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create deliverable.",
      },
      { status: 500 },
    );
  }
}
