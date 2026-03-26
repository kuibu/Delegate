import { NextResponse } from "next/server";

import { getRepresentativeDeliverableDownload } from "@delegate/web-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; deliverableId: string }> },
) {
  const { slug, deliverableId } = await params;

  try {
    const deliverable = await getRepresentativeDeliverableDownload(slug, deliverableId, {
      publicOnly: true,
    });
    if (!deliverable) {
      return NextResponse.json({ error: "Deliverable not found." }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(deliverable.buffer), {
      status: 200,
      headers: {
        "Content-Type": deliverable.mimeType,
        "Content-Disposition": `attachment; filename="${deliverable.fileName}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to download deliverable.",
      },
      { status: 500 },
    );
  }
}
