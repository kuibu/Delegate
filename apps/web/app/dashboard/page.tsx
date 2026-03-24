import Link from "next/link";
import { demoRepresentative } from "@delegate/domain";

import { DashboardOverview } from "./dashboard-overview";
import { DashboardOpenViking } from "./dashboard-openviking";
import { DashboardRepresentativeDirectory } from "./dashboard-representative-directory";
import { DashboardRepresentativeSetup } from "./dashboard-representative-setup";
import { DashboardSkillPacks } from "./dashboard-skill-packs";
import { listRepresentativeDirectoryItems } from "../../lib/representative-setup";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ rep?: string; view?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const representatives = await listRepresentativeDirectoryItems();
  const fallbackSlug = representatives[0]?.slug ?? demoRepresentative.slug;
  const requestedSlug = params?.rep?.trim();
  const requestedView = params?.view?.trim();
  const activeSlug =
    requestedSlug && representatives.some((representative) => representative.slug === requestedSlug)
      ? requestedSlug
      : fallbackSlug;
  const activeView = isDashboardView(requestedView) ? requestedView : "overview";
  const tabs: Array<{
    id: DashboardView;
    label: string;
    eyebrow: string;
    blurb: string;
    shortLabel: string;
  }> = [
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
      blurb: "Bounded packs from builtin or ClawHub sources.",
      shortLabel: "Skills",
    },
    {
      id: "memory",
      label: "Memory",
      eyebrow: "Advanced",
      blurb: "OpenViking sync, recall provenance, and memory.",
      shortLabel: "Memory",
    },
  ];

  return (
    <main className="dashboard-shell">
      <header className="dashboard-topbar">
        <div className="dashboard-topbar-main">
          <div className="dashboard-brand">
            <div className="dashboard-brand-mark">D</div>
            <div>
              <strong>Owner Dashboard</strong>
              <div className="muted">Operational control plane for public representatives</div>
            </div>
          </div>

          <nav aria-label="Dashboard menu" className="dashboard-menu-tabs">
            {tabs.map((tab) => {
              const isActive = tab.id === activeView;

              return (
                <Link
                  className={isActive ? "dashboard-menu-tab dashboard-menu-tab-active" : "dashboard-menu-tab"}
                  href={`/dashboard?rep=${activeSlug}&view=${tab.id}`}
                  key={tab.id}
                >
                  {tab.shortLabel}
                </Link>
              );
            })}
          </nav>

          <div className="dashboard-nav-links">
            <Link className="dashboard-nav-link" href="/">
              Website
            </Link>
            <Link className="dashboard-nav-link" href={`/reps/${activeSlug}`}>
              Public Representative
            </Link>
          </div>
        </div>

        <div className="dashboard-topbar-context">
          <span className="chip">{activeSlug}</span>
          <span className="chip chip-safe">{tabs.find((tab) => tab.id === activeView)?.label}</span>
          <span className="chip">Telegram only</span>
          <span className="chip">Trust-first runtime</span>
        </div>
      </header>

      <div className="dashboard-layout">
        <aside className="dashboard-rail">
          <DashboardRepresentativeDirectory
            activeSlug={activeSlug}
            activeView={activeView}
            initialRepresentatives={representatives}
          />
        </aside>

        <section className="dashboard-main">
          <div className="dashboard-stage">
            <div>
              <p className="eyebrow">Owner workspace</p>
              <h1>先看高频运营，再进入配置，最后再进入进阶记忆层。</h1>
              <p className="dashboard-stage-copy">
                控制面板现在按真实使用顺序分成 tab，不再把所有模块堆成一条长页面。
              </p>
            </div>

            <div className="dashboard-stage-meta">
              <span className="chip">{tabs.find((tab) => tab.id === activeView)?.eyebrow}</span>
              <span className="chip chip-safe">Public delegation interface</span>
            </div>
          </div>

          <div className="dashboard-view">
            {activeView === "overview" ? <DashboardOverview representativeSlug={activeSlug} /> : null}
            {activeView === "setup" ? <DashboardRepresentativeSetup representativeSlug={activeSlug} /> : null}
            {activeView === "skills" ? <DashboardSkillPacks representativeSlug={activeSlug} /> : null}
            {activeView === "memory" ? <DashboardOpenViking representativeSlug={activeSlug} /> : null}
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
