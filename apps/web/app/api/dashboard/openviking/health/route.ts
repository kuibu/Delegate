import { NextResponse } from "next/server";

import { getOpenVikingHealthSnapshot } from "../../../../../lib/openviking";

export async function GET() {
  try {
    const health = await getOpenVikingHealthSnapshot();
    return NextResponse.json(health);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to check OpenViking health.",
      },
      { status: 500 },
    );
  }
}
