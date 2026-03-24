import { headers } from "next/headers";

import { demoRepresentative } from "@delegate/domain";
import {
  LanguageSwitcher,
  buildLocalizedHref,
  extractCountryHint,
  pickCopy,
  resolveLocale,
} from "@delegate/web-ui";

const copy = {
  zh: {
    brandTagline: "面向网络时代的公开委托接口",
    menu: [
      { href: "#interface", label: "接口" },
      { href: "#trust", label: "信任" },
      { href: "#economy", label: "计费" },
      { href: "#control-plane", label: "控制台" },
      { href: "#roadmap", label: "路线" },
    ],
    navDemo: "演示代表页",
    navDashboard: "Owner 控制台",
    heroEyebrow: "Agent Interface + Economy",
    heroTitle: "Delegate 把 agent 变成公开接口，而不是私有分身。",
    heroLead:
      "它不是 OpenClaw 的公开外壳，而是一个 Telegram-native 的对外代表系统：用公开知识、安全边界、付费续用和人工升级，把 inbound 关系真正接住。",
    heroPrimary: "查看公开代表",
    heroSecondary: "进入控制台",
    shipsKicker: "当前闭环",
    shipsTitle: "公开页、Telegram gateway、owner inbox、付费续用、OpenViking 记忆层。",
    shipsBody: "卖点不是“智能本身”，而是一个可托付、可治理、可付费的公开代表接口。",
    proofPoints: [
      { stat: "10 秒", label: "陌生人应该在十秒内理解这不是闲聊 bot，而是一个公开代表入口。" },
      { stat: "70%+", label: "高频 inbound 询问应被代表独立接住，而不是重新把主人拉回一级前台。" },
      { stat: "4 档", label: "Free / Pass / Deep Help / Sponsor 必须读起来像访问层，而不是 token 账单。" },
    ],
    trustEyebrow: "Trust Boundary",
    trustTitle: "公开运行时必须先让人信任，再让人付费，最后才让人深入。",
    trustLead: "Delegate 的竞争力不是更多 tools，而是把陌生人关系、边界和升级路径讲清楚。",
    trustPills: ["仅公开知识", "仅安全技能", "内建人工转接", "动作可审计"],
    operatingAria: "运营节奏",
    operatingBeats: [
      { step: "01", title: "先接住第一次 inbound", body: "陌生人先被接住，才会继续问下去、付费、或者申请升级转接。" },
      { step: "02", title: "再把边界说清楚", body: "对方必须清楚这是公开代表，不是主人本人，也不是一个万能 bot。" },
      { step: "03", title: "把请求路由成流程", body: "FAQ、报价采集、预约和资料投递，都要能把模糊请求变成结构化入口。" },
      { step: "04", title: "用付费继续深入", body: "免费只负责接住，真正的深度服务和优先级要通过付费自然升级。" },
    ],
    interfaceColumns: [
      {
        eyebrow: "Public interface",
        title: "别人使用的是你的公开代表，不是进入你的私有运行时。",
        body: "它是 public-facing agent interface，不是 private assistant clone。外部人面对的是一个边界清晰、用途明确、可升级的业务接口。",
      },
      {
        eyebrow: "Bounded action",
        title: "代表知道什么、能做什么、不能做什么，都必须显式公开。",
        body: "公开知识包、许可技能、付费边界和 handoff 规则，组成一个可被陌生人快速理解的对外契约。",
      },
      {
        eyebrow: "Inbound operations",
        title: "价值不在会聊天，而在把 inbound 需求变成可路由、可计费、可接手的业务流。",
        body: "FAQ、报价采集、预约、资料投递和人工升级都不是附属功能，而是核心处理面。",
      },
    ],
    visibleContractEyebrow: "Visible contract",
    visibleContractTitle: "Trust 是产品表面，不是法律页脚。",
    visibleContractLead:
      "外部用户必须知道代表可以看什么、可以做什么、不能做什么，以及什么时候需要转人工或付费继续。",
    trustCards: [
      { title: "能看什么", points: ["仅公开知识包", "仅批准过的 FAQ / 资料 / 价格页", "不接触私有工作区与私有记忆"] },
      { title: "能做什么", points: ["回答 FAQ", "收集线索与需求", "发起付费解锁", "触发安全 handoff"] },
      { title: "不能做什么", points: ["不能代表主人登录账户", "不能任意执行本地命令", "不能直接做不可逆商业承诺"] },
    ],
    economyEyebrow: "Economy Layer",
    economyTitle: "Delegate 卖的是访问深度，不是 token 细节。",
    economyLead: "定价应该像关系接口的层级，而不是底层模型成本的转述。",
    economyPlans: [
      { name: "Free", detail: "接住第一次接触，回答基础问题。", kicker: "探索" },
      { name: "Pass", detail: "允许继续追问、领资料、完成轻量 intake。", kicker: "跟进" },
      { name: "Deep Help", detail: "承接长上下文、复杂需求整理和优先 handoff。", kicker: "深度咨询" },
      { name: "Sponsor", detail: "给代表的公共额度池续命，让入口持续可用。", kicker: "支持" },
    ],
    controlEyebrow: "Control Plane",
    controlTitle: "Dashboard 应该像运营台，而不是设置坟场。",
    controlLead: "控制面板的顺序就是产品价值的顺序：先运营，再发布，再扩展，再治理记忆。",
    controlCards: [
      { eyebrow: "Overview", title: "先看 owner inbox、付款和今天的运营脉冲。", body: "Dashboard 的第一屏应该帮助主人判断什么值得亲自接手，而不是展开一堆配置项。" },
      { eyebrow: "Representative", title: "发布一个公开代表，本质上是在发布一套外部关系接口。", body: "身份、契约、定价、知识包和 stepper 化 setup 需要像发布流程，而不是杂乱表单。" },
      { eyebrow: "Memory + skills", title: "ClawHub 和 OpenViking 属于扩展层，应该被治理，而不是被神化。", body: "代表能力要进入可观测面板，记忆要进入 provenance，技能要进入边界控制。" },
    ],
    roadmapEyebrow: "Evolution",
    roadmapTitle: "OpenClaw 是 runtime，Delegate 是 interface，下一层才是 network。",
    roadmapLead: "我们现在做的是 `Agent Runtime -> Agent Interface + Economy` 的产品跃迁。",
    roadmapStages: [
      { eyebrow: "Agent runtime", title: "OpenClaw", body: "单 agent loop、工具闭环、私有助理定位。它解决“我有一个 AI 助手”。" },
      { eyebrow: "Agent interface + economy", title: "Delegate", body: "公开代表、trust boundary、paid continuation、human escalation。它解决“别人可以通过我的代表和我做生意”。" },
      { eyebrow: "Protocol future", title: "Agent Network", body: "接下来的上层会是 capability graph、agent-to-agent routing 和 protocol-level economy。" },
    ],
    ctaEyebrow: "开始体验",
    ctaTitle: "先把一个代表跑通，再把 trust、billing 和 handoff 做到不可替代。",
    ctaPrimary: "查看演示代表",
    ctaSecondary: "配置一个代表",
    switcher: { zh: "中文", en: "English" },
  },
  en: {
    brandTagline: "Public delegation interface for the network era",
    menu: [
      { href: "#interface", label: "Interface" },
      { href: "#trust", label: "Trust" },
      { href: "#economy", label: "Economy" },
      { href: "#control-plane", label: "Control Plane" },
      { href: "#roadmap", label: "Roadmap" },
    ],
    navDemo: "Demo representative",
    navDashboard: "Owner dashboard",
    heroEyebrow: "Agent Interface + Economy",
    heroTitle: "Delegate turns an agent into a public interface, not a private clone.",
    heroLead:
      "It is not a public wrapper around OpenClaw. It is a Telegram-native representative system that combines public knowledge, explicit trust boundaries, paid continuation, and human escalation into one inbound-facing interface.",
    heroPrimary: "Explore public representative",
    heroSecondary: "Open control plane",
    shipsKicker: "What ships",
    shipsTitle: "Public page, Telegram gateway, owner inbox, paid continuation, OpenViking memory.",
    shipsBody: "The value is not raw intelligence. It is a public business interface that feels governable, trustworthy, and worth paying for.",
    proofPoints: [
      { stat: "10s", label: "A stranger should understand within ten seconds that this is a public representative, not a generic chat bot." },
      { stat: "70%+", label: "The representative should absorb most repetitive inbound questions without pulling the founder back to the front desk." },
      { stat: "4 packs", label: "Free / Pass / Deep Help / Sponsor should read like access layers, not token pricing trivia." },
    ],
    trustEyebrow: "Trust Boundary",
    trustTitle: "A public runtime must earn trust first, charge second, and deepen the relationship third.",
    trustLead: "Delegate wins by making boundaries, escalation paths, and relationship rules obvious to strangers.",
    trustPills: ["Public knowledge only", "Bounded skills only", "Human handoff built in", "Auditable actions"],
    operatingAria: "Operating rhythm",
    operatingBeats: [
      { step: "01", title: "Catch the first inbound", body: "The stranger has to feel received before they will keep asking, pay, or request escalation." },
      { step: "02", title: "Show the boundary", body: "People should know immediately that this is a public representative, not the owner and not an unlimited bot." },
      { step: "03", title: "Route the request", body: "FAQ, quote intake, scheduling, and materials delivery should turn vague demand into structured motion." },
      { step: "04", title: "Continue with payment", body: "Free gets the relationship started; deeper help and priority should unlock naturally through payment." },
    ],
    interfaceColumns: [
      {
        eyebrow: "Public interface",
        title: "People interact with your representative, not your private runtime.",
        body: "This is a public-facing agent interface, not a private assistant clone. The outside world sees a bounded, legible, business-facing surface.",
      },
      {
        eyebrow: "Bounded action",
        title: "What the representative knows, can do, and cannot do should be explicitly visible.",
        body: "Public knowledge packs, allowed skills, pricing boundaries, and handoff rules together form a contract strangers can understand quickly.",
      },
      {
        eyebrow: "Inbound operations",
        title: "The real value is not chatting. It is routing inbound demand into billable, triageable business flow.",
        body: "FAQ, quote intake, scheduling, materials delivery, and escalation are the product, not side features.",
      },
    ],
    visibleContractEyebrow: "Visible contract",
    visibleContractTitle: "Trust is a product surface, not a legal footnote.",
    visibleContractLead:
      "External users should see what the representative can access, what it can do, what it will refuse, and when payment or human escalation begins.",
    trustCards: [
      { title: "Can see", points: ["Public knowledge pack only", "Approved FAQs, materials, and pricing only", "No private workspace or private memory"] },
      { title: "Can do", points: ["Answer FAQs", "Collect leads and structured demand", "Trigger paid continuation", "Create safe handoff requests"] },
      { title: "Cannot do", points: ["Log into owner accounts", "Run arbitrary local commands", "Make irreversible commercial commitments"] },
    ],
    economyEyebrow: "Economy Layer",
    economyTitle: "Delegate sells access depth, not token trivia.",
    economyLead: "Pricing should feel like relationship layers, not a disguised retelling of model costs.",
    economyPlans: [
      { name: "Free", detail: "Catch the first interaction and answer foundational questions.", kicker: "Discovery" },
      { name: "Pass", detail: "Let people keep asking, receive materials, and complete lightweight intake.", kicker: "Follow-up" },
      { name: "Deep Help", detail: "Handle longer context, deeper qualification, and priority handoff.", kicker: "Consultation" },
      { name: "Sponsor", detail: "Fund the shared credit pool that keeps the representative alive.", kicker: "Support" },
    ],
    controlEyebrow: "Control Plane",
    controlTitle: "The dashboard should feel like an operations desk, not a settings graveyard.",
    controlLead: "The order of the dashboard should mirror product value: operate first, publish second, expand third, govern memory last.",
    controlCards: [
      { eyebrow: "Overview", title: "Start with the owner inbox, payments, and today’s operating pulse.", body: "The first screen should help the owner decide what deserves direct attention, not dump a wall of settings." },
      { eyebrow: "Representative", title: "Publishing a representative means publishing a relationship interface.", body: "Identity, contract, pricing, knowledge, and setup should feel like a launch flow, not a messy back-office form." },
      { eyebrow: "Memory + skills", title: "ClawHub and OpenViking are expansion layers that need governance, not mystique.", body: "Skill sources belong in boundary control and memory belongs in provenance, not hidden magic." },
    ],
    roadmapEyebrow: "Evolution",
    roadmapTitle: "OpenClaw is runtime. Delegate is interface. The next layer is network.",
    roadmapLead: "Right now we are making the product leap from `Agent Runtime -> Agent Interface + Economy`.",
    roadmapStages: [
      { eyebrow: "Agent runtime", title: "OpenClaw", body: "A private assistant runtime with a single agent loop and tool closure. It answers: “I have an AI assistant.”" },
      { eyebrow: "Agent interface + economy", title: "Delegate", body: "A public representative with trust boundaries, paid continuation, and human escalation. It answers: “Other people can transact through my representative.”" },
      { eyebrow: "Protocol future", title: "Agent Network", body: "The next layer is capability graphs, agent-to-agent routing, and protocol-level payment." },
    ],
    ctaEyebrow: "Try the loop",
    ctaTitle: "Start with one representative, then harden trust, billing, and handoff until the flow feels inevitable.",
    ctaPrimary: "See demo representative",
    ctaSecondary: "Configure a representative",
    switcher: { zh: "Chinese", en: "English" },
  },
} as const;

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const headerStore = await headers();
  const locale = resolveLocale({
    requestedLocale: params?.lang,
    acceptLanguage: headerStore.get("accept-language"),
    countryHint: extractCountryHint(headerStore),
  });
  const t = pickCopy(locale, copy);
  const representativeBaseUrl = resolveServiceUrl(
    process.env.NEXT_PUBLIC_REPRESENTATIVE_URL,
    "http://localhost:3002",
  );
  const dashboardBaseUrl = resolveServiceUrl(
    process.env.NEXT_PUBLIC_DASHBOARD_URL,
    "http://localhost:3001",
  );

  return (
    <main className="marketing-shell localized-shell" data-locale={locale} lang={locale === "zh" ? "zh-CN" : "en"}>
      <header className="marketing-topbar">
        <div className="marketing-brand">
          <div className="marketing-brand-mark">D</div>
          <div>
            <strong>Delegate</strong>
            <div className="muted">{t.brandTagline}</div>
          </div>
        </div>

        <nav aria-label="Website sections" className="marketing-menu-tabs">
          {t.menu.map((item) => (
            <a className="marketing-menu-tab" href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="marketing-nav-actions">
          <LanguageSwitcher
            activeLocale={locale}
            ariaLabel="Language"
            items={[
              { locale: "zh", href: buildLocalizedHref("/", "zh"), label: t.switcher.zh, shortLabel: "ZH" },
              { locale: "en", href: buildLocalizedHref("/", "en"), label: t.switcher.en, shortLabel: "EN" },
            ]}
          />
          <a
            className="marketing-nav-link"
            href={buildLocalizedHref(`${representativeBaseUrl}/reps/${demoRepresentative.slug}`, locale)}
          >
            {t.navDemo}
          </a>
          <a
            className="marketing-button-primary"
            href={buildLocalizedHref(`${dashboardBaseUrl}/dashboard?view=overview`, locale)}
          >
            {t.navDashboard}
          </a>
        </div>
      </header>

      <section className="marketing-hero" id="interface">
        <div className="marketing-hero-copy">
          <p className="eyebrow">{t.heroEyebrow}</p>
          <h1>{t.heroTitle}</h1>
          <p className="marketing-lead">{t.heroLead}</p>

          <div className="marketing-actions">
            <a
              className="marketing-button-primary"
              href={buildLocalizedHref(`${representativeBaseUrl}/reps/${demoRepresentative.slug}`, locale)}
            >
              {t.heroPrimary}
            </a>
            <a
              className="marketing-button-secondary"
              href={buildLocalizedHref(`${dashboardBaseUrl}/dashboard?view=overview`, locale)}
            >
              {t.heroSecondary}
            </a>
          </div>
        </div>

        <div className="marketing-stage">
          <article className="marketing-stage-card marketing-stage-card-primary">
            <p className="marketing-card-kicker">{t.shipsKicker}</p>
            <h2>{t.shipsTitle}</h2>
            <p>{t.shipsBody}</p>
          </article>

          <article className="marketing-stage-card marketing-stage-card-metrics">
            {t.proofPoints.map((point) => (
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
          <p className="eyebrow">{t.trustEyebrow}</p>
          <h2>{t.trustTitle}</h2>
          <p>{t.trustLead}</p>
        </div>
        <div className="marketing-band-chips">
          {t.trustPills.map((pill) => (
            <span className="marketing-pill" key={pill}>
              {pill}
            </span>
          ))}
        </div>
      </section>

      <section aria-label={t.operatingAria} className="marketing-rhythm-strip">
        {t.operatingBeats.map((beat) => (
          <article className="marketing-beat-card" key={beat.step}>
            <span className="marketing-beat-step">{beat.step}</span>
            <h3>{beat.title}</h3>
            <p>{beat.body}</p>
          </article>
        ))}
      </section>

      <section className="marketing-grid">
        {t.interfaceColumns.map((column) => (
          <article className="marketing-feature-card" key={column.title}>
            <p className="marketing-card-kicker">{column.eyebrow}</p>
            <h3>{column.title}</h3>
            <p>{column.body}</p>
          </article>
        ))}
      </section>

      <section className="marketing-story marketing-story-shell">
        <div className="marketing-story-copy">
          <p className="eyebrow">{t.visibleContractEyebrow}</p>
          <h2>{t.visibleContractTitle}</h2>
          <p>{t.visibleContractLead}</p>
        </div>

        <div className="marketing-story-list">
          {t.trustCards.map((card) => (
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
            <p className="eyebrow">{t.economyEyebrow}</p>
            <h2>{t.economyTitle}</h2>
          </div>
          <p className="marketing-lead">{t.economyLead}</p>
        </div>

        <div className="marketing-plan-grid">
          {t.economyPlans.map((plan) => (
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
            <p className="eyebrow">{t.controlEyebrow}</p>
            <h2>{t.controlTitle}</h2>
          </div>
          <p className="marketing-lead">{t.controlLead}</p>
        </div>

        <div className="marketing-ops-grid">
          {t.controlCards.map((card) => (
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
            <p className="eyebrow">{t.roadmapEyebrow}</p>
            <h2>{t.roadmapTitle}</h2>
          </div>
          <p className="marketing-lead">{t.roadmapLead}</p>
        </div>

        <div className="marketing-roadmap-grid">
          {t.roadmapStages.map((stage) => (
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
          <p className="eyebrow">{t.ctaEyebrow}</p>
          <h2>{t.ctaTitle}</h2>
        </div>
        <div className="marketing-actions">
          <a
            className="marketing-button-primary"
            href={buildLocalizedHref(`${representativeBaseUrl}/reps/${demoRepresentative.slug}`, locale)}
          >
            {t.ctaPrimary}
          </a>
          <a
            className="marketing-button-secondary"
            href={buildLocalizedHref(`${dashboardBaseUrl}/dashboard?view=setup`, locale)}
          >
            {t.ctaSecondary}
          </a>
        </div>
      </section>
    </main>
  );
}

function resolveServiceUrl(envValue: string | undefined, fallback: string): string {
  const candidate = envValue?.trim() || fallback;
  return candidate.replace(/\/$/, "");
}
