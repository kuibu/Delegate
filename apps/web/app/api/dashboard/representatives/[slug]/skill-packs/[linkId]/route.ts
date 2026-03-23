import { NextResponse } from "next/server";

import { setRepresentativeSkillPackEnabled } from "../../../../../../../lib/representative-skill-packs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; linkId: string }> },
) {
  const { slug, linkId } = await params;
  const body = (await request.json()) as { enabled?: boolean };

  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean." }, { status: 400 });
  }

  try {
    const skillPack = await setRepresentativeSkillPackEnabled({
      representativeSlug: slug,
      linkId,
      enabled: body.enabled,
    });

    return NextResponse.json({ skillPack });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update representative skill pack.",
      },
      { status: 500 },
    );
  }
}
