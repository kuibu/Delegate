import { NextResponse } from "next/server";

import {
  getRepresentativeSkillPackSnapshot,
  installClawHubSkillPackForRepresentative,
} from "../../../../../../lib/representative-skill-packs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    const snapshot = await getRepresentativeSkillPackSnapshot(slug);
    if (!snapshot) {
      return NextResponse.json({ error: "Representative not found." }, { status: 404 });
    }

    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load representative skill packs.",
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
  const body = (await request.json()) as { skillPackSlug?: string };

  if (!body.skillPackSlug?.trim()) {
    return NextResponse.json({ error: "skillPackSlug is required." }, { status: 400 });
  }

  try {
    const skillPack = await installClawHubSkillPackForRepresentative({
      representativeSlug: slug,
      skillPackSlug: body.skillPackSlug.trim(),
    });

    return NextResponse.json({ skillPack });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to install representative skill pack.",
      },
      { status: 500 },
    );
  }
}
