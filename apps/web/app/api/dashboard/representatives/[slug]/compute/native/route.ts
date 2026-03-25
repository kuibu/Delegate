import { NextResponse } from "next/server";

import { executeRepresentativeNativeComputerUse } from "@delegate/web-data";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result = await executeRepresentativeNativeComputerUse({
      representativeSlug: slug,
      sessionId: typeof body.sessionId === "string" ? body.sessionId : "",
      task: typeof body.task === "string" ? body.task : "",
      ...(body.provider === "openai" || body.provider === "anthropic"
        ? { provider: body.provider }
        : {}),
      ...(typeof body.maxSteps === "number" ? { maxSteps: body.maxSteps } : {}),
      ...(typeof body.allowMutations === "boolean"
        ? { allowMutations: body.allowMutations }
        : {}),
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to execute native computer-use run.",
      },
      { status: 400 },
    );
  }
}
