import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Newsreader, Space_Grotesk } from "next/font/google";

import "./globals.css";

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
});

const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Delegate",
  description:
    "Telegram-native public representative for founders, creators, and inbound-heavy operators.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${sans.variable} ${serif.variable}`}>{children}</body>
    </html>
  );
}
