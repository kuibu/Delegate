import Link from "next/link";
import { demoRepresentative } from "@delegate/domain";

import { DashboardOverview } from "./dashboard-overview";
import { DashboardRepresentativeDirectory } from "./dashboard-representative-directory";
import { DashboardRepresentativeSetup } from "./dashboard-representative-setup";
import { DashboardSkillPacks } from "./dashboard-skill-packs";
import { listRepresentativeDirectoryItems } from "../../lib/representative-setup";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ rep?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const representatives = await listRepresentativeDirectoryItems();
  const fallbackSlug = representatives[0]?.slug ?? demoRepresentative.slug;
  const requestedSlug = params?.rep?.trim();
  const activeSlug =
    requestedSlug && representatives.some((representative) => representative.slug === requestedSlug)
      ? requestedSlug
      : fallbackSlug;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">D</div>
          <div>
            <strong>Owner Dashboard</strong>
            <div className="muted">Telegram inbound instrumentation shell</div>
          </div>
        </div>

        <nav className="nav-links">
          <Link className="nav-link" href="/">
            Home
          </Link>
          <Link className="nav-link" href={`/reps/${activeSlug}`}>
            Public Representative
          </Link>
        </nav>
      </header>

      <DashboardRepresentativeDirectory
        activeSlug={activeSlug}
        initialRepresentatives={representatives}
      />
      <DashboardRepresentativeSetup representativeSlug={activeSlug} />
      <DashboardOverview representativeSlug={activeSlug} />
      <DashboardSkillPacks representativeSlug={activeSlug} />
    </main>
  );
}
