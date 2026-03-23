import Link from "next/link";

import { DashboardOverview } from "./dashboard-overview";
import { DashboardSkillPacks } from "./dashboard-skill-packs";

export default function DashboardPage() {
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
          <Link className="nav-link" href="/reps/lin-founder-rep">
            Public Representative
          </Link>
        </nav>
      </header>

      <DashboardOverview representativeSlug="lin-founder-rep" />
      <DashboardSkillPacks representativeSlug="lin-founder-rep" />
    </main>
  );
}
