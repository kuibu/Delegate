import Link from "next/link";

import { demoRepresentative } from "@delegate/domain";

const marketingMenu = [
  { href: "#interface", label: "Interface" },
  { href: "#trust", label: "Trust" },
  { href: "#economy", label: "Economy" },
  { href: "#control-plane", label: "Control Plane" },
  { href: "#roadmap", label: "Roadmap" },
] as const;

const proofPoints = [
  {
    stat: "10s",
    label: "陌生人应该在十秒内理解这不是闲聊 bot，而是一个公开代表入口。",
  },
  {
    stat: "70%+",
    label: "高频 inbound 询问应被代表独立接住，而不是重新把主人拉回一级前台。",
  },
  {
    stat: "4 packs",
    label: "Free / Pass / Deep Help / Sponsor 必须读起来像访问层，而不是 token 账单。",
  },
] as const;

const interfaceColumns = [
  {
    eyebrow: "Public interface",
    title: "Delegate 让别人可以使用你的公开代表，而不是进入你的私有运行时。",
    body: "它是 public-facing agent interface，不是 private assistant clone。外部人面对的是一个边界清晰、用途明确、可升级的业务接口。",
  },
  {
    eyebrow: "Bounded action",
    title: "代表知道什么、能做什么、不能做什么，都必须是显式公开的。",
    body: "公开知识包、许可技能、付费边界和 handoff 规则，组成一个可被陌生人快速理解的对外契约。",
  },
  {
    eyebrow: "Inbound operations",
    title: "价值不在会聊天，而在把 inbound 需求变成可路由、可计费、可接手的业务流。",
    body: "FAQ、报价采集、预约、资料投递和人工升级都不是附属功能，而是核心处理面。",
  },
] as const;

const trustCards = [
  {
    title: "Can see",
    points: ["仅公开知识包", "仅批准过的 FAQ / 资料 / 价格页", "不接触私有工作区与私有记忆"],
  },
  {
    title: "Can do",
    points: ["回答 FAQ", "收集线索与需求", "发起付费解锁", "触发安全 handoff"],
  },
  {
    title: "Cannot do",
    points: ["不能代表主人登录账户", "不能任意执行本地命令", "不能直接做不可逆商业承诺"],
  },
] as const;

const operatingBeats = [
  {
    step: "01",
    title: "Catch the first inbound",
    body: "陌生人先被接住，才会继续问下去、付费、或者申请升级转接。",
  },
  {
    step: "02",
    title: "Show the boundary",
    body: "对方必须清楚这是公开代表，不是主人本人，也不是一个万能 bot。",
  },
  {
    step: "03",
    title: "Route the request",
    body: "FAQ、报价采集、预约和资料投递，都要能把模糊请求变成结构化入口。",
  },
  {
    step: "04",
    title: "Continue with payment",
    body: "免费只负责接住，真正的深度服务和优先级要通过付费自然升级。",
  },
] as const;

const economyPlans = [
  { name: "Free", detail: "接住第一次接触，回答基础问题。", kicker: "Discovery" },
  { name: "Pass", detail: "允许继续追问、领资料、完成轻量 intake。", kicker: "Follow-up" },
  { name: "Deep Help", detail: "承接长上下文、复杂需求整理和优先 handoff。", kicker: "Consultation" },
  { name: "Sponsor", detail: "给代表的公共额度池续命，让入口持续可用。", kicker: "Support" },
] as const;

const controlPlaneCards = [
  {
    eyebrow: "Overview",
    title: "先看 owner inbox、付款和今天的运营脉冲。",
    body: "Dashboard 的第一屏应该帮助主人判断什么值得亲自接手，而不是展开一堆配置项。",
  },
  {
    eyebrow: "Representative",
    title: "发布一个公开代表，本质上是在发布一套外部关系接口。",
    body: "身份、契约、定价、知识包和 stepper 化 setup 需要像发布流程，而不是杂乱表单。",
  },
  {
    eyebrow: "Memory + skills",
    title: "ClawHub 和 OpenViking 属于扩展层，应该被治理，而不是被神化。",
    body: "代表能力要进入可观测面板，记忆要进入 provenance，技能要进入边界控制。",
  },
] as const;

const roadmapStages = [
  {
    eyebrow: "Agent runtime",
    title: "OpenClaw",
    body: "单 agent loop、工具闭环、私有助理定位。它解决“我有一个 AI 助手”。",
  },
  {
    eyebrow: "Agent interface + economy",
    title: "Delegate",
    body: "公开代表、trust boundary、paid continuation、human escalation。它解决“别人可以通过我的代表和我做生意”。",
  },
  {
    eyebrow: "Protocol future",
    title: "Agent Network",
    body: "接下来的上层会是 capability graph、agent-to-agent routing 和 protocol-level economy。",
  },
] as const;

export default function HomePage() {
  return (
    <main className="marketing-shell">
      <header className="marketing-topbar">
        <div className="marketing-brand">
          <div className="marketing-brand-mark">D</div>
          <div>
            <strong>Delegate</strong>
            <div className="muted">Public delegation interface for the network era</div>
          </div>
        </div>

        <nav aria-label="Website sections" className="marketing-menu-tabs">
          {marketingMenu.map((item) => (
            <a className="marketing-menu-tab" href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="marketing-nav-actions">
          <Link className="marketing-nav-link" href={`/reps/${demoRepresentative.slug}`}>
            Demo representative
          </Link>
          <Link className="marketing-button-primary" href="/dashboard?view=overview">
            Owner dashboard
          </Link>
        </div>
      </header>

      <section className="marketing-hero" id="interface">
        <div className="marketing-hero-copy">
          <p className="eyebrow">Agent Interface + Economy</p>
          <h1>Delegate turns an agent into a public interface, not a private clone.</h1>
          <p className="marketing-lead">
            Delegate 不是 OpenClaw 的公开外壳。它把公开知识、可信边界、付费续用和人工升级做成一个
            Telegram-native 的对外代表系统，为 founder、advisor、creator 和 inbound-heavy
            operator 服务。
          </p>

          <div className="marketing-actions">
            <Link className="marketing-button-primary" href={`/reps/${demoRepresentative.slug}`}>
              Explore public representative
            </Link>
            <Link className="marketing-button-secondary" href="/dashboard?view=overview">
              Open control plane
            </Link>
          </div>
        </div>

        <div className="marketing-stage">
          <article className="marketing-stage-card marketing-stage-card-primary">
            <p className="marketing-card-kicker">What ships</p>
            <h2>Public page, Telegram gateway, owner inbox, paid continuation, OpenViking memory.</h2>
            <p>卖点不是“智能本身”，而是一个可托付、可治理、可付费的公开代表接口。</p>
          </article>

          <article className="marketing-stage-card marketing-stage-card-metrics">
            {proofPoints.map((point) => (
              <div className="marketing-metric" key={point.stat}>
                <strong>{point.stat}</strong>
                <p>{point.label}</p>
              </div>
            ))}
          </article>
        </div>
      </section>

      <section className="marketing-band" id="trust">
        <div className="marketing-band-copy">
          <p className="eyebrow">Trust Boundary</p>
          <h2>公开运行时必须先让人信任，再让人付费，最后才让人深入。</h2>
          <p>
            Delegate 的竞争力不是更多 tools，而是把陌生人关系、边界和升级路径讲清楚。
          </p>
        </div>
        <div className="marketing-band-chips">
          <span className="marketing-pill">Public knowledge only</span>
          <span className="marketing-pill">Bounded skills only</span>
          <span className="marketing-pill">Human handoff built in</span>
          <span className="marketing-pill">Auditable actions</span>
        </div>
      </section>

      <section aria-label="Operating rhythm" className="marketing-rhythm-strip">
        {operatingBeats.map((beat) => (
          <article className="marketing-beat-card" key={beat.step}>
            <span className="marketing-beat-step">{beat.step}</span>
            <h3>{beat.title}</h3>
            <p>{beat.body}</p>
          </article>
        ))}
      </section>

      <section className="marketing-grid">
        {interfaceColumns.map((column) => (
          <article className="marketing-feature-card" key={column.title}>
            <p className="marketing-card-kicker">{column.eyebrow}</p>
            <h3>{column.title}</h3>
            <p>{column.body}</p>
          </article>
        ))}
      </section>

      <section className="marketing-story marketing-story-shell">
        <div className="marketing-story-copy">
          <p className="eyebrow">Visible contract</p>
          <h2>Trust is a product surface, not a legal footnote.</h2>
          <p>
            外部用户必须知道代表可以看什么、可以做什么、不能做什么，以及什么时候需要转人工或付费继续。
          </p>
        </div>

        <div className="marketing-story-list">
          {trustCards.map((card) => (
            <article className="marketing-story-item" key={card.title}>
              <h3>{card.title}</h3>
              <ul className="marketing-bullet-list">
                {card.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section marketing-section-shell marketing-section-shell-economy" id="economy">
        <div className="marketing-section-heading">
          <div>
            <p className="eyebrow">Economy Layer</p>
            <h2>Delegate sells access depth, not token trivia.</h2>
          </div>
          <p className="marketing-lead">
            定价应该像关系接口的层级，而不是底层模型成本的转述。
          </p>
        </div>

        <div className="marketing-plan-grid">
          {economyPlans.map((plan) => (
            <article className="marketing-plan-card" key={plan.name}>
              <p className="marketing-card-kicker">{plan.kicker}</p>
              <h3>{plan.name}</h3>
              <p>{plan.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section marketing-section-shell marketing-section-shell-control" id="control-plane">
        <div className="marketing-section-heading">
          <div>
            <p className="eyebrow">Control Plane</p>
            <h2>The dashboard should feel like an operations desk, not a settings graveyard.</h2>
          </div>
          <p className="marketing-lead">
            控制面板的顺序就是产品价值的顺序：先运营，再发布，再扩展，再治理记忆。
          </p>
        </div>

        <div className="marketing-ops-grid">
          {controlPlaneCards.map((card) => (
            <article className="marketing-feature-card" key={card.title}>
              <p className="marketing-card-kicker">{card.eyebrow}</p>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section marketing-section-shell marketing-section-shell-roadmap" id="roadmap">
        <div className="marketing-section-heading">
          <div>
            <p className="eyebrow">Evolution</p>
            <h2>OpenClaw is runtime. Delegate is interface. The next layer is network.</h2>
          </div>
          <p className="marketing-lead">
            我们现在做的是 `Agent Runtime → Agent Interface + Economy` 的产品跃迁。
          </p>
        </div>

        <div className="marketing-roadmap-grid">
          {roadmapStages.map((stage) => (
            <article className="marketing-roadmap-card" key={stage.title}>
              <p className="marketing-card-kicker">{stage.eyebrow}</p>
              <h3>{stage.title}</h3>
              <p>{stage.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-cta">
        <div>
          <p className="eyebrow">Try the loop</p>
          <h2>Start with one representative, then harden trust, billing, and handoff until it feels inevitable.</h2>
        </div>
        <div className="marketing-actions">
          <Link className="marketing-button-primary" href={`/reps/${demoRepresentative.slug}`}>
            See demo representative
          </Link>
          <Link className="marketing-button-secondary" href="/dashboard?view=setup">
            Configure a representative
          </Link>
        </div>
      </section>
    </main>
  );
}
