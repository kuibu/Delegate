import Link from "next/link";
import { headers } from "next/headers";
import { demoRepresentative } from "@delegate/domain";
import {
  LanguageSwitcher,
  buildLocalizedHref,
  extractCountryHint,
  pickCopy,
  resolveLocale,
  type Locale,
} from "@delegate/web-ui";

import { DashboardOverview } from "./dashboard-overview";
import { DashboardOpenViking } from "./dashboard-openviking";
import { DashboardRepresentativeDirectory } from "./dashboard-representative-directory";
import { DashboardRepresentativeSetup } from "./dashboard-representative-setup";
import { DashboardSkillPacks } from "./dashboard-skill-packs";
import { listRepresentativeDirectoryItems } from "@delegate/web-data";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ rep?: string; view?: string; lang?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const headerStore = await headers();
  const locale = resolveLocale({
    requestedLocale: params?.lang,
    acceptLanguage: headerStore.get("accept-language"),
    countryHint: extractCountryHint(headerStore),
  });
  const t = pickCopy(locale, dashboardCopy);
  const representatives = await listRepresentativeDirectoryItems();
  const fallbackSlug = representatives[0]?.slug ?? demoRepresentative.slug;
  const requestedSlug = params?.rep?.trim();
  const requestedView = params?.view?.trim();
  const activeSlug =
    requestedSlug && representatives.some((representative) => representative.slug === requestedSlug)
      ? requestedSlug
      : fallbackSlug;
  const activeView = isDashboardView(requestedView) ? requestedView : "overview";
  const websiteBaseUrl = resolveServiceUrl(process.env.NEXT_PUBLIC_SITE_URL, "http://localhost:3000");
  const representativeBaseUrl = resolveServiceUrl(
    process.env.NEXT_PUBLIC_REPRESENTATIVE_URL,
    "http://localhost:3002",
  );
  const tabs = t.tabs;

  return (
    <main className="dashboard-shell localized-shell" data-locale={locale} lang={locale === "zh" ? "zh-CN" : "en"}>
      <header className="dashboard-topbar">
        <div className="dashboard-topbar-main">
          <div className="dashboard-brand">
            <div className="dashboard-brand-mark">D</div>
            <div>
              <strong>{t.brandTitle}</strong>
              <div className="muted">{t.brandTagline}</div>
            </div>
          </div>

          <nav aria-label={t.menuAriaLabel} className="dashboard-menu-tabs">
            {tabs.map((tab) => {
              const isActive = tab.id === activeView;

              return (
                <Link
                  className={isActive ? "dashboard-menu-tab dashboard-menu-tab-active" : "dashboard-menu-tab"}
                  href={`/dashboard?rep=${activeSlug}&view=${tab.id}&lang=${locale}`}
                  key={tab.id}
                >
                  {tab.shortLabel}
                </Link>
              );
            })}
          </nav>

          <div className="dashboard-nav-links">
            <LanguageSwitcher
              activeLocale={locale}
              ariaLabel={t.languageAriaLabel}
              items={[
                {
                  locale: "zh",
                  href: `/dashboard?rep=${activeSlug}&view=${activeView}&lang=zh`,
                  label: t.language.zh,
                  shortLabel: "ZH",
                },
                {
                  locale: "en",
                  href: `/dashboard?rep=${activeSlug}&view=${activeView}&lang=en`,
                  label: t.language.en,
                  shortLabel: "EN",
                },
              ]}
            />
            <a className="dashboard-nav-link" href={buildLocalizedHref(`${websiteBaseUrl}/`, locale)}>
              {t.websiteLabel}
            </a>
            <a
              className="dashboard-nav-link"
              href={buildLocalizedHref(`${representativeBaseUrl}/reps/${activeSlug}`, locale)}
            >
              {t.publicRepresentativeLabel}
            </a>
          </div>
        </div>

        <div className="dashboard-topbar-context">
          <span className="chip">{activeSlug}</span>
          <span className="chip chip-safe">{tabs.find((tab) => tab.id === activeView)?.label}</span>
          <span className="chip">{t.telegramOnlyLabel}</span>
          <span className="chip">{t.runtimeLabel}</span>
        </div>
      </header>

      <div className="dashboard-layout">
        <aside className="dashboard-rail">
          <DashboardRepresentativeDirectory
            activeSlug={activeSlug}
            activeView={activeView}
            initialRepresentatives={representatives}
            locale={locale}
            representativeBaseUrl={representativeBaseUrl}
          />
        </aside>

        <section className="dashboard-main">
          <div className="dashboard-stage">
            <div>
              <p className="eyebrow">{t.workspaceEyebrow}</p>
              <h1>{t.workspaceTitle}</h1>
              <p className="dashboard-stage-copy">{t.workspaceCopy}</p>
            </div>

            <div className="dashboard-stage-meta">
              <span className="chip">{tabs.find((tab) => tab.id === activeView)?.eyebrow}</span>
              <span className="chip chip-safe">{t.stageMetaLabel}</span>
            </div>
          </div>

          <div className="dashboard-view">
            {activeView === "overview" ? <DashboardOverview locale={locale} representativeSlug={activeSlug} /> : null}
            {activeView === "setup" ? (
              <DashboardRepresentativeSetup locale={locale} representativeSlug={activeSlug} />
            ) : null}
            {activeView === "skills" ? <DashboardSkillPacks locale={locale} representativeSlug={activeSlug} /> : null}
            {activeView === "memory" ? <DashboardOpenViking locale={locale} representativeSlug={activeSlug} /> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

type DashboardView = "overview" | "setup" | "skills" | "memory";

function isDashboardView(value: string | undefined): value is DashboardView {
  return value === "overview" || value === "setup" || value === "skills" || value === "memory";
}

function resolveServiceUrl(envValue: string | undefined, fallback: string): string {
  const candidate = envValue?.trim() || fallback;
  return candidate.replace(/\/$/, "");
}

const dashboardCopy: Record<
  Locale,
  {
    brandTitle: string;
    brandTagline: string;
    menuAriaLabel: string;
    tabs: Array<{
      id: DashboardView;
      label: string;
      eyebrow: string;
      blurb: string;
      shortLabel: string;
    }>;
    languageAriaLabel: string;
    language: { zh: string; en: string };
    websiteLabel: string;
    publicRepresentativeLabel: string;
    telegramOnlyLabel: string;
    runtimeLabel: string;
    workspaceEyebrow: string;
    workspaceTitle: string;
    workspaceCopy: string;
    stageMetaLabel: string;
  }
> = {
  zh: {
    brandTitle: "Owner 控制台",
    brandTagline: "面向公开代表的运营控制平面",
    menuAriaLabel: "控制台菜单",
    tabs: [
      {
        id: "overview",
        label: "概览",
        eyebrow: "高频",
        blurb: "先看 owner inbox、付款和今天的信号。",
        shortLabel: "概览",
      },
      {
        id: "setup",
        label: "代表",
        eyebrow: "发布",
        blurb: "身份、契约、价格与公开知识。",
        shortLabel: "代表",
      },
      {
        id: "skills",
        label: "技能",
        eyebrow: "扩展",
        blurb: "来自内建与 ClawHub 的安全技能包。",
        shortLabel: "技能",
      },
      {
        id: "memory",
        label: "记忆",
        eyebrow: "进阶",
        blurb: "OpenViking sync、recall provenance 与记忆治理。",
        shortLabel: "记忆",
      },
    ],
    languageAriaLabel: "语言切换",
    language: { zh: "中文", en: "English" },
    websiteLabel: "官网",
    publicRepresentativeLabel: "公开代表页",
    telegramOnlyLabel: "仅 Telegram",
    runtimeLabel: "Trust-first runtime",
    workspaceEyebrow: "Owner workspace",
    workspaceTitle: "先看高频运营，再进入配置，最后再治理进阶记忆层。",
    workspaceCopy: "控制面板按真实使用顺序分成 tab，不再把所有模块堆成一条长页面。",
    stageMetaLabel: "Public delegation interface",
  },
  en: {
    brandTitle: "Owner Dashboard",
    brandTagline: "Operational control plane for public representatives",
    menuAriaLabel: "Dashboard menu",
    tabs: [
      {
        id: "overview",
        label: "Overview",
        eyebrow: "High frequency",
        blurb: "Owner inbox, payment flow, and daily signal first.",
        shortLabel: "Overview",
      },
      {
        id: "setup",
        label: "Representative",
        eyebrow: "Launch",
        blurb: "Profile, contract, pricing, and public knowledge.",
        shortLabel: "Representative",
      },
      {
        id: "skills",
        label: "Skills",
        eyebrow: "Expansion",
        blurb: "Bounded packs from builtin and ClawHub sources.",
        shortLabel: "Skills",
      },
      {
        id: "memory",
        label: "Memory",
        eyebrow: "Advanced",
        blurb: "OpenViking sync, recall provenance, and memory governance.",
        shortLabel: "Memory",
      },
    ],
    languageAriaLabel: "Language switcher",
    language: { zh: "Chinese", en: "English" },
    websiteLabel: "Website",
    publicRepresentativeLabel: "Public Representative",
    telegramOnlyLabel: "Telegram only",
    runtimeLabel: "Trust-first runtime",
    workspaceEyebrow: "Owner workspace",
    workspaceTitle: "Operate first, configure second, and govern advanced memory last.",
    workspaceCopy: "The dashboard is organized by actual working order instead of one long scrolling settings wall.",
    stageMetaLabel: "Public delegation interface",
  },
};
