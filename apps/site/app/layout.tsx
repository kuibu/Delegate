import type { ReactNode } from "react";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { IBM_Plex_Mono, Instrument_Sans, Instrument_Serif } from "next/font/google";

import "@delegate/web-ui/styles.css";
import { extractCountryHint, formatHtmlLang, getCookieLocale, localeCookieName, resolveLocale } from "@delegate/web-ui";

const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Delegate",
  description:
    "Telegram-native public representative for founders, creators, and inbound-heavy operators.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const locale = resolveLocale({
    requestedLocale: getCookieLocale(cookieStore.get(localeCookieName)?.value),
    acceptLanguage: headerStore.get("accept-language"),
    countryHint: extractCountryHint(headerStore),
  });

  return (
    <html lang={formatHtmlLang(locale)}>
      <body className={`${sans.variable} ${serif.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
