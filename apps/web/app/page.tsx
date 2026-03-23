import Link from "next/link";

import { demoRepresentative } from "@delegate/domain";

const pillars = [
  {
    title: "公开优先",
    body: "代表只能读取主人明确公开出来的资料、FAQ、价格和政策，而不是去碰私有记忆或工作区。",
  },
  {
    title: "边界可见",
    body: "用户一进来就能看到它是谁的、会什么、不会什么、免费到哪里、什么时候转人工。",
  },
  {
    title: "计费闭环",
    body: "不是无限免费聊天，而是 Free 接住、Pass 续用、Deep Help 深聊、Sponsor 支持公共额度池。",
  },
];

const layers = [
  "Telegram Gateway",
  "Representative Runtime",
  "Public Knowledge + Skill Layer",
  "Billing + Wallet",
  "Handoff + Analytics",
];

const milestones = [
  "Founder Representative / 私聊闭环",
  "Group mention / 社群承接与导流",
  "Deep Service / 报价采集与预约意向",
];

export default function HomePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">D</div>
          <div>
            <strong>Delegate</strong>
            <div className="muted">Telegram-native public representative</div>
          </div>
        </div>

        <nav className="nav-links">
          <Link className="nav-link" href="/reps/lin-founder-rep">
            Demo Representative
          </Link>
          <Link className="nav-link" href="/dashboard">
            Dashboard Shell
          </Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Founder Representative on Telegram</p>
          <h1>把“对外代表”做成一个可计费、可转人工、边界清晰的 Telegram 入口。</h1>
          <p>
            {demoRepresentative.name} 的目标不是替主人暴露私有工作区，而是用公开知识、结构化 intake、
            安全动作和付费续用，把高频 inbound 稳稳接住。
          </p>

          <div className="hero-actions">
            <Link className="button-primary" href={`/reps/${demoRepresentative.slug}`}>
              打开公开代表页
            </Link>
            <Link className="button-secondary" href="/dashboard">
              查看主人仪表盘壳子
            </Link>
          </div>
        </div>

        <div className="hero-side">
          <div className="panel">
            <p className="panel-title">This Repository Ships</p>
            <div className="chip-row">
              <span className="chip chip-safe">Next.js public surface</span>
              <span className="chip chip-safe">grammY bot skeleton</span>
              <span className="chip chip-safe">Action Gate runtime</span>
              <span className="chip chip-safe">Prisma domain schema</span>
            </div>
          </div>

          <div className="stats-grid">
            <div className="metric-card">
              <strong>10s</strong>
              <p>陌生人应在 10 秒内理解“这不是普通 bot，而是一个有边界的业务代表”。</p>
            </div>
            <div className="metric-card">
              <strong>70%</strong>
              <p>目标是让高频外部问题被代表独立接住，不把主人拉回前台做重复劳动。</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Core Principles</p>
            <h2>先把 Telegram 单点做深</h2>
          </div>
          <p className="section-copy">这版不做多渠道统一，不做私有记忆接入，不做泛 agent。</p>
        </div>

        <div className="card-grid">
          {pillars.map((pillar) => (
            <article className="panel list-card" key={pillar.title}>
              <span className="kicker">{pillar.title}</span>
              <p>{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Architecture</p>
            <h2>五层结构围绕公开运行时收敛</h2>
          </div>
          <p className="section-copy">所有深度都围绕 Telegram gateway、代表 runtime、计费、转接和分析来做。</p>
        </div>

        <div className="card-grid two-up">
          <article className="panel list-card">
            <h3>Layer Stack</h3>
            <ul className="list">
              {layers.map((layer) => (
                <li className="list-item" key={layer}>
                  {layer}
                </li>
              ))}
            </ul>
          </article>

          <article className="panel list-card">
            <h3>Delivery Path</h3>
            <ul className="list">
              {milestones.map((milestone) => (
                <li className="list-item" key={milestone}>
                  {milestone}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}
