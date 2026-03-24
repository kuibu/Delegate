import { NextResponse } from "next/server";

import { syncRepresentativeOpenVikingResources } from "@delegate/web-data";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    const snapshot = await syncRepresentativeOpenVikingResources({
      representativeSlug: slug,
      trigger: "manual",
    });
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to sync representative public knowledge into OpenViking.",
      },
      { status: 500 },
    );
  }
}
