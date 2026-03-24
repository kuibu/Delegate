import type { ReactNode } from "react";

export const supportedLocales = ["zh", "en"] as const;
export const localeCookieName = "delegate_locale";

export type Locale = (typeof supportedLocales)[number];

const chineseRegionCodes = new Set(["CN", "HK", "MO", "TW", "SG"]);

export function normalizeLocale(value: string | null | undefined): Locale | null {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized === "zh" || normalized.startsWith("zh-")) {
    return "zh";
  }

  if (normalized === "en" || normalized.startsWith("en-")) {
    return "en";
  }

  return null;
}

export function extractCountryHint(headerStore: Headers): string | null {
  const headerNames = [
    "x-vercel-ip-country",
    "cf-ipcountry",
    "x-country-code",
    "x-appengine-country",
    "x-geo-country",
  ];

  for (const headerName of headerNames) {
    const value = headerStore.get(headerName)?.trim();
    if (value) {
      return value.toUpperCase();
    }
  }

  return null;
}

export function getCookieLocale(value: string | null | undefined): Locale | null {
  return normalizeLocale(value);
}

export function resolveLocale(params: {
  requestedLocale?: string | null | undefined;
  acceptLanguage?: string | null | undefined;
  countryHint?: string | null | undefined;
}): Locale {
  const requestedLocale = normalizeLocale(params.requestedLocale);
  if (requestedLocale) {
    return requestedLocale;
  }

  const acceptLanguage = params.acceptLanguage?.split(",") ?? [];
  for (const part of acceptLanguage) {
    const parsed = normalizeLocale(part.split(";")[0]);
    if (parsed) {
      return parsed;
    }
  }

  if (params.countryHint && chineseRegionCodes.has(params.countryHint.toUpperCase())) {
    return "zh";
  }

  return "en";
}

export function buildLocalizedHref(href: string, locale: Locale): string {
  const isAbsolute = /^https?:\/\//.test(href);
  const url = new URL(href, isAbsolute ? href : "http://delegate.local");
  url.searchParams.set("lang", locale);

  if (isAbsolute) {
    return url.toString();
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function formatHtmlLang(locale: Locale): string {
  return locale === "zh" ? "zh-CN" : "en";
}

export function LanguageSwitcher({
  activeLocale,
  items,
  ariaLabel,
}: {
  activeLocale: Locale;
  items: Array<{
    locale: Locale;
    href: string;
    label: string;
    shortLabel?: string;
  }>;
  ariaLabel: string;
}) {
  return (
    <nav aria-label={ariaLabel} className="language-switcher">
      {items.map((item) => {
        const isActive = item.locale === activeLocale;

        return (
          <a
            aria-current={isActive ? "page" : undefined}
            className={isActive ? "language-pill language-pill-active" : "language-pill"}
            href={item.href}
            key={item.locale}
          >
            <span>{item.shortLabel ?? item.label}</span>
            <small>{item.label}</small>
          </a>
        );
      })}
    </nav>
  );
}

export function pickCopy<T extends Record<Locale, unknown>>(locale: Locale, copy: T): T[Locale] {
  return copy[locale];
}

export function renderLocaleText(
  locale: Locale,
  copy: { zh: ReactNode; en: ReactNode },
): ReactNode {
  return copy[locale];
}
