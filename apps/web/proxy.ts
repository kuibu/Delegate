import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { localeCookieName, normalizeLocale } from "@delegate/web-ui";

export function proxy(request: NextRequest) {
  const requestedLocale = normalizeLocale(request.nextUrl.searchParams.get("lang"));
  if (!requestedLocale) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.cookies.set(localeCookieName, requestedLocale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
