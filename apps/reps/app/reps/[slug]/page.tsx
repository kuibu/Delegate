import { headers } from "next/headers";
import { notFound } from "next/navigation";

import type { PlanTier, Representative } from "@delegate/domain";
import { getRepresentativeSetupSnapshot, getRepresentativeSkillPackSnapshot } from "@delegate/web-data";
import {
  DashboardPanelFrame,
  DashboardSignalStrip,
  DashboardSurface,
  DashboardSurfaceGrid,
  LanguageSwitcher,
  buildLocalizedHref,
  extractCountryHint,
  pickCopy,
  resolveLocale,
  type Locale,
} from "@delegate/web-ui";

type RepresentativeSkill = Representative["skills"][number];

export default async function RepresentativePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ lang?: string }>;
}) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : undefined;
  const headerStore = await headers();
  const locale = resolveLocale({
    requestedLocale: query?.lang,
    acceptLanguage: headerStore.get("accept-language"),
    countryHint: extractCountryHint(headerStore),
  });
  const t = pickCopy(locale, copy);
  const telegramBotUsername = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  const siteBaseUrl = resolveServiceUrl(process.env.NEXT_PUBLIC_SITE_URL, "http://localhost:3000");
  const dashboardBaseUrl = resolveServiceUrl(
    process.env.NEXT_PUBLIC_DASHBOARD_URL,
    "http://localhost:3001",
  );
  const [setupSnapshot, skillPackSnapshot] = await Promise.all([
    getRepresentativeSetupSnapshot(slug),
    getRepresentativeSkillPackSnapshot(slug),
  ]);

  if (!setupSnapshot || !skillPackSnapshot) {
    notFound();
  }

  const representative = {
    ...setupSnapshot,
    skillPacks: skillPackSnapshot.skillPacks,
  };
  const enabledSkillPacks = representative.skillPacks.filter((skillPack) => skillPack.enabled);
  const totalKnowledgeItems =
    representative.knowledgePack.faq.length +
    representative.knowledgePack.materials.length +
    representative.knowledgePack.policies.length;
  const skillLabels = buildSkillLabels(locale);
  const groupActivationLabels = buildGroupActivationLabels(locale);
  const menu = t.menu;

  return (
    <main className="dashboard-shell representative-shell localized-shell" data-locale={locale} lang={locale === "zh" ? "zh-CN" : "en"}>
      <header className="representative-topbar">
        <div className="dashboard-brand">
          <div className="dashboard-brand-mark">R</div>
          <div>
            <strong>{representative.name}</strong>
            <div className="muted">{t.brandTagline}</div>
          </div>
        </div>

        <nav aria-label={t.menuAriaLabel} className="representative-menu-tabs">
          {menu.map((item) => (
            <a className="dashboard-menu-tab" href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="dashboard-nav-links">
          <LanguageSwitcher
            activeLocale={locale}
            ariaLabel={t.languageAriaLabel}
            items={[
              {
                locale: "zh",
                href: buildLocalizedHref(`/reps/${representative.slug}`, "zh"),
                label: t.language.zh,
                shortLabel: "ZH",
              },
              {
                locale: "en",
                href: buildLocalizedHref(`/reps/${representative.slug}`, "en"),
                label: t.language.en,
                shortLabel: "EN",
              },
            ]}
          />
          <a className="dashboard-nav-link" href={buildLocalizedHref(`${siteBaseUrl}/`, locale)}>
            {t.homeLabel}
          </a>
          <a
            className="dashboard-nav-link"
            href={buildLocalizedHref(`${dashboardBaseUrl}/dashboard?rep=${representative.slug}&view=overview`, locale)}
          >
            {t.dashboardLabel}
          </a>
        </div>
      </header>

      <section className="dashboard-stage representative-stage" id="overview">
        <div>
          <p className="eyebrow">{t.profileEyebrow}</p>
          <h1>{representative.name}</h1>
          <p className="dashboard-stage-copy">{representative.tagline}</p>
          <div className="chip-row">
            {representative.languages.map((language) => (
              <span className="chip" key={language}>
                {language}
              </span>
            ))}
            <span className="chip chip-safe">{groupActivationLabels[representative.groupActivation]}</span>
            <span className="chip">{representative.humanInLoop ? t.aiHumanLabel : t.aiOnlyLabel}</span>
          </div>
        </div>

        <div className="representative-stage-aside">
          <article className="dashboard-highlight-card dashboard-highlight-card-primary">
            <p className="panel-title">{t.worksForLabel}</p>
            <h3>{representative.ownerName}</h3>
            <p>{representative.knowledgePack.identitySummary}</p>
            <p className="footer-note">{t.memoryDisclosure}</p>
          </article>

          <div className="button-row representative-stage-links">
            {telegramBotUsername ? (
              <a
                className="button-primary"
                href={buildTelegramPlanLink(telegramBotUsername, representative.slug, "free")}
                rel="noreferrer"
                target="_blank"
              >
                {t.askInTelegram}
              </a>
            ) : null}
            <a
              className="button-secondary"
              href={buildLocalizedHref(`${dashboardBaseUrl}/dashboard?rep=${representative.slug}&view=setup`, locale)}
            >
              {t.viewControlPlane}
            </a>
          </div>
        </div>
      </section>

      <DashboardSignalStrip
        cards={[
          {
            label: t.signalCards.freeRepliesLabel,
            value: `${representative.contract.freeReplyLimit}`,
            detail: t.signalCards.freeRepliesDetail,
            tone: "accent",
          },
          {
            label: t.signalCards.enabledSkillsLabel,
            value: `${representative.skills.length}`,
            detail: t.signalCards.enabledSkillsDetail,
            tone: "safe",
          },
          {
            label: t.signalCards.knowledgeItemsLabel,
            value: `${totalKnowledgeItems}`,
            detail: t.signalCards.knowledgeItemsDetail,
          },
          {
            label: t.signalCards.skillPacksLabel,
            value: `${enabledSkillPacks.length}`,
            detail: t.signalCards.skillPacksDetail,
          },
        ]}
      />

      <DashboardPanelFrame
        eyebrow={t.trustEyebrow}
        id="trust"
        summary={t.trustSummary}
        title={t.trustTitle}
      >
        <DashboardSurfaceGrid columns={3}>
          <DashboardSurface eyebrow={t.allowedEyebrow} title={t.allowedTitle} tone="accent">
            <ul className="list">
              {t.allowList.map((item) => (
                <li className="list-item" key={item}>
                  {item}
                </li>
              ))}
            </ul>
          </DashboardSurface>

          <DashboardSurface eyebrow={t.notAllowedEyebrow} title={t.notAllowedTitle}>
            <ul className="list">
              {t.denyList.map((item) => (
                <li className="list-item" key={item}>
                  {item}
                </li>
              ))}
            </ul>
          </DashboardSurface>

          <DashboardSurface eyebrow={t.contractEyebrow} title={t.contractTitle}>
            <p className="section-copy">
              {t.contractCopy(representative.contract.freeReplyLimit)}
            </p>
            <div className="chip-row">
              <span className="chip chip-safe">{groupActivationLabels[representative.groupActivation]}</span>
              <span className="chip">{representative.publicMode ? t.publicRuntimeLabel : t.privateDraftLabel}</span>
              <span className="chip">{representative.humanInLoop ? t.handoffReadyLabel : t.aiOnlyLabel}</span>
            </div>
            <p className="footer-note">{t.contractFootnote}</p>
          </DashboardSurface>
        </DashboardSurfaceGrid>
      </DashboardPanelFrame>

      <DashboardPanelFrame
        eyebrow={t.skillsEyebrow}
        id="skills"
        summary={t.skillsSummary}
        title={t.skillsTitle}
      >
        <DashboardSurfaceGrid>
          <DashboardSurface
            eyebrow={t.declaredSkillsEyebrow}
            meta={<span className="chip chip-safe">{t.skillsCountChip(representative.skills.length)}</span>}
            title={t.declaredSkillsTitle}
            tone="accent"
          >
            <div className="chip-row">
              {representative.skills.map((skill) => (
                <span className="chip" key={skill}>
                  {skillLabels[skill]}
                </span>
              ))}
            </div>
          </DashboardSurface>

          <DashboardSurface
            eyebrow={t.skillPacksEyebrow}
            meta={<span className="chip">{t.trackedChip(representative.skillPacks.length)}</span>}
            title={t.skillPacksTitle}
          >
            <div className="row-list">
              {representative.skillPacks.map((skillPack) => (
                <div className="skill-row" key={skillPack.id}>
                  <div>
                    <strong>{skillPack.displayName}</strong>
                    <p>{skillPack.summary}</p>
                    <div className="chip-row">
                      <span className="chip">
                        {skillPack.source === "clawhub" ? "ClawHub" : t.builtinLabel}
                      </span>
                      <span className="chip">{skillPack.installStatus}</span>
                      {skillPack.verificationTier ? (
                        <span className="chip chip-safe">{skillPack.verificationTier}</span>
                      ) : null}
                    </div>
                    <p className="footer-note">
                      {skillPack.executesCode ? t.executesCodeNote : t.declarativeNote}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </DashboardSurface>
        </DashboardSurfaceGrid>
      </DashboardPanelFrame>

      <DashboardPanelFrame
        eyebrow={t.knowledgeEyebrow}
        id="knowledge"
        summary={t.knowledgeSummary}
        title={t.knowledgeTitle}
      >
        <DashboardSurfaceGrid columns={3}>
          <DashboardSurface eyebrow="FAQ" title={t.faqTitle} tone="accent">
            <ul className="list">
              {representative.knowledgePack.faq.map((item) => (
                <li className="list-item" key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                </li>
              ))}
            </ul>
          </DashboardSurface>

          <DashboardSurface eyebrow={t.materialsEyebrow} title={t.materialsTitle}>
            <ul className="list">
              {representative.knowledgePack.materials.map((item) => (
                <li className="list-item" key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                </li>
              ))}
            </ul>
          </DashboardSurface>

          <DashboardSurface eyebrow={t.policiesEyebrow} title={t.policiesTitle}>
            <ul className="list">
              {representative.knowledgePack.policies.map((item) => (
                <li className="list-item" key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                </li>
              ))}
            </ul>
          </DashboardSurface>
        </DashboardSurfaceGrid>
      </DashboardPanelFrame>

      <DashboardPanelFrame
        eyebrow={t.plansEyebrow}
        id="plans"
        summary={t.plansSummary}
        title={t.plansTitle}
      >
        <DashboardSurfaceGrid>
          {representative.pricing.map((plan) => (
            <DashboardSurface
              eyebrow={t.accessLayerEyebrow}
              key={plan.tier}
              meta={
                <span className={plan.includesPriorityHandoff ? "chip chip-safe" : "chip"}>
                  {plan.tier}
                </span>
              }
              title={plan.name}
              tone={plan.tier === "deep_help" ? "accent" : "default"}
            >
              <span className="price">{plan.stars} Stars</span>
              <p>{plan.summary}</p>
              <div className="chip-row">
                <span className="chip">{t.repliesChip(plan.includedReplies)}</span>
                {plan.includesPriorityHandoff ? (
                  <span className="chip chip-safe">{t.priorityHandoffChip}</span>
                ) : null}
              </div>
              {telegramBotUsername ? (
                <div className="button-row">
                  <a
                    className={plan.tier === "free" ? "button-secondary" : "button-primary"}
                    href={buildTelegramPlanLink(telegramBotUsername, representative.slug, plan.tier)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {plan.tier === "free" ? t.openInTelegram : t.buyInTelegram}
                  </a>
                </div>
              ) : null}
            </DashboardSurface>
          ))}
        </DashboardSurfaceGrid>
      </DashboardPanelFrame>

      <DashboardPanelFrame
        eyebrow={t.handoffEyebrow}
        id="handoff"
        summary={t.handoffSummary}
        title={t.handoffTitle}
      >
        <DashboardSurfaceGrid>
          <DashboardSurface eyebrow={t.handoffCopyEyebrow} title={t.handoffCopyTitle} tone="accent">
            <p>{representative.handoffPrompt}</p>
          </DashboardSurface>

          <DashboardSurface eyebrow={t.entryPointsEyebrow} title={t.entryPointsTitle}>
            <p className="section-copy">
              {t.entryPointsCopy(groupActivationLabels[representative.groupActivation])}
            </p>
            <div className="button-row">
              {telegramBotUsername ? (
                <a
                  className="button-primary"
                  href={buildTelegramPlanLink(telegramBotUsername, representative.slug, "free")}
                  rel="noreferrer"
                  target="_blank"
                >
                  {t.openRepresentative}
                </a>
              ) : null}
              <a
                className="button-secondary"
                href={buildLocalizedHref(`${dashboardBaseUrl}/dashboard?rep=${representative.slug}&view=memory`, locale)}
              >
                {t.inspectMemoryPolicy}
              </a>
            </div>
          </DashboardSurface>
        </DashboardSurfaceGrid>
      </DashboardPanelFrame>
    </main>
  );
}

function buildTelegramPlanLink(
  botUsername: string,
  representativeSlug: string,
  tier: PlanTier,
): string {
  if (tier === "free") {
    return `https://t.me/${botUsername}?start=rep_${representativeSlug}`;
  }

  return `https://t.me/${botUsername}?start=buy_${representativeSlug}__${tier}`;
}

function resolveServiceUrl(envValue: string | undefined, fallback: string): string {
  const candidate = envValue?.trim() || fallback;
  return candidate.replace(/\/$/, "");
}

function buildSkillLabels(locale: Locale): Record<RepresentativeSkill, string> {
  if (locale === "zh") {
    return {
      faq_reply: "FAQ 回复",
      lead_qualify: "合作意向初筛",
      intake_collect: "需求采集",
      quote_request_collect: "报价请求采集",
      material_delivery: "资料投递",
      scheduling_request: "预约意向采集",
      human_handoff: "人工转接",
      paid_unlock: "付费续用",
    };
  }

  return {
    faq_reply: "FAQ replies",
    lead_qualify: "Lead qualification",
    intake_collect: "Intake collection",
    quote_request_collect: "Quote request intake",
    material_delivery: "Material delivery",
    scheduling_request: "Scheduling intake",
    human_handoff: "Human handoff",
    paid_unlock: "Paid continuation",
  };
}

function buildGroupActivationLabels(locale: Locale) {
  return locale === "zh"
    ? {
        mention_only: "仅 mention",
        reply_or_mention: "reply 或 mention",
        always: "始终响应",
      }
    : {
        mention_only: "mention only",
        reply_or_mention: "reply or mention",
        always: "always on",
      };
}

const copy = {
  zh: {
    brandTagline: "Trust-first public representative profile",
    menuAriaLabel: "代表页分区",
    languageAriaLabel: "语言切换",
    language: { zh: "中文", en: "English" },
    menu: [
      { href: "#overview", label: "概览" },
      { href: "#trust", label: "边界" },
      { href: "#skills", label: "技能" },
      { href: "#knowledge", label: "知识" },
      { href: "#plans", label: "方案" },
      { href: "#handoff", label: "转接" },
    ],
    homeLabel: "官网",
    dashboardLabel: "Dashboard",
    profileEyebrow: "Representative Profile",
    aiHumanLabel: "ai + human",
    aiOnlyLabel: "ai only",
    worksForLabel: "Who this representative works for",
    memoryDisclosure:
      "这个代表只会记住属于本代表范围内的公开安全互动，不会读取主人的私有工作区、私有文件或私有账号。",
    askInTelegram: "在 Telegram 中提问",
    viewControlPlane: "查看控制台",
    signalCards: {
      freeRepliesLabel: "免费回复",
      freeRepliesDetail: "首次接触阶段能被代表独立接住的免费深度。",
      enabledSkillsLabel: "已启用技能",
      enabledSkillsDetail: "当前公开声明并可被用户理解的能力条数。",
      knowledgeItemsLabel: "知识条目",
      knowledgeItemsDetail: "FAQ、资料和政策构成的公开知识包。",
      skillPacksLabel: "技能包",
      skillPacksDetail: "已启用且进入代表运行时的 skill pack 数量。",
    },
    trustEyebrow: "Trust Interface",
    trustSummary: "公开能力、拒绝范围、升级路径和计费方式都不应该藏在对话里。",
    trustTitle: "用户一进来就该先看到边界和契约",
    allowedEyebrow: "Allowed",
    allowedTitle: "代表会做什么",
    allowList: ["回答 FAQ", "收集合作/报价/预约信息", "发公开资料", "发起人工转接", "提示 Stars 付费解锁"],
    notAllowedEyebrow: "Not allowed",
    notAllowedTitle: "代表明确不会做什么",
    denyList: ["访问私有文件系统", "读取主人的私有记忆", "代主人登录账户", "擅自修改真实日程", "做不可逆商业承诺"],
    contractEyebrow: "Conversation contract",
    contractTitle: "免费、升级和转接规则",
    contractCopy: (limit: number) => `免费规则：前 ${limit} 条回复适合基础问答与资料领取；更深的合作判断、报价采集和预约意向会引导到付费续用或人工转接。`,
    publicRuntimeLabel: "public runtime",
    privateDraftLabel: "private draft",
    handoffReadyLabel: "handoff ready",
    contractFootnote: "记忆边界：只会记住这个代表范围内的公开安全互动，不会读取主人的私有工作区、私有文件或私有账号。",
    skillsEyebrow: "Skill Sources",
    skillsSummary: "参考 OpenClaw 的 ClawHub 习惯后，这里把 builtin 与 registry-backed skill packs 分开，并强调越权永远不被允许。",
    skillsTitle: "技能包可以有来源，但不能有越权",
    declaredSkillsEyebrow: "Declared skills",
    skillsCountChip: (count: number) => `${count} skills`,
    declaredSkillsTitle: "公开代表会如何接住外部请求",
    skillPacksEyebrow: "Skill packs",
    trackedChip: (count: number) => `${count} tracked`,
    skillPacksTitle: "已安装来源与能力标签",
    builtinLabel: "Built-in",
    executesCodeNote: "This pack executes code and would require extra review.",
    declarativeNote: "This pack is currently modeled as declarative/non-privileged for public runtime safety.",
    knowledgeEyebrow: "Knowledge Pack",
    knowledgeSummary: "代表先从结构化知识里拿答案，再决定下一步是继续回答、收集 intake 还是升级转接。",
    knowledgeTitle: "公开知识包先于自由发挥",
    faqTitle: "高频标准答案",
    materialsEyebrow: "Materials",
    materialsTitle: "可直接投递的公开材料",
    policiesEyebrow: "Policies",
    policiesTitle: "合作边界与响应规则",
    plansEyebrow: "Plans",
    plansSummary: "用户不该理解原始模型成本，只需要理解还能继续聊多深、能做哪些动作。",
    plansTitle: "四档访问深度，而不是 token 定价",
    accessLayerEyebrow: "Access layer",
    repliesChip: (count: number) => `${count} replies`,
    priorityHandoffChip: "priority handoff",
    openInTelegram: "在 Telegram 中打开",
    buyInTelegram: "在 Telegram 中购买",
    handoffEyebrow: "Human Handoff",
    handoffSummary: "当公开代表接近边界时，转接不该是一句拒答，而应该是一条明确可预期的升级路径。",
    handoffTitle: "主人最终接手的是高价值收件项，不是原始噪音",
    handoffCopyEyebrow: "Handoff copy",
    handoffCopyTitle: "对外升级说明",
    entryPointsEyebrow: "Entry points",
    entryPointsTitle: "继续对话的公开入口",
    entryPointsCopy: (strategy: string) => `优先入口仍然是 Telegram 私聊；在群组场景下，代表只会按 ${strategy} 的策略保守响应。`,
    openRepresentative: "打开代表入口",
    inspectMemoryPolicy: "查看记忆策略",
  },
  en: {
    brandTagline: "Trust-first public representative profile",
    menuAriaLabel: "Representative sections",
    languageAriaLabel: "Language switcher",
    language: { zh: "Chinese", en: "English" },
    menu: [
      { href: "#overview", label: "Overview" },
      { href: "#trust", label: "Trust" },
      { href: "#skills", label: "Skills" },
      { href: "#knowledge", label: "Knowledge" },
      { href: "#plans", label: "Plans" },
      { href: "#handoff", label: "Handoff" },
    ],
    homeLabel: "Home",
    dashboardLabel: "Dashboard",
    profileEyebrow: "Representative Profile",
    aiHumanLabel: "ai + human",
    aiOnlyLabel: "ai only",
    worksForLabel: "Who this representative works for",
    memoryDisclosure:
      "This representative may remember prior public-safe interactions within this representative only. It does not access the owner's private workspace, private files, or private accounts.",
    askInTelegram: "Ask in Telegram",
    viewControlPlane: "View control plane",
    signalCards: {
      freeRepliesLabel: "Free replies",
      freeRepliesDetail: "The free depth this representative can absorb in first-contact mode.",
      enabledSkillsLabel: "Enabled skills",
      enabledSkillsDetail: "Publicly declared abilities users should expect and understand.",
      knowledgeItemsLabel: "Knowledge items",
      knowledgeItemsDetail: "The public knowledge pack formed by FAQs, materials, and policies.",
      skillPacksLabel: "Skill packs",
      skillPacksDetail: "Enabled packs that actually enter the representative runtime.",
    },
    trustEyebrow: "Trust Interface",
    trustSummary: "Capabilities, refusals, escalation, and pricing should be visible before the conversation goes deep.",
    trustTitle: "People should see the contract before they see the magic",
    allowedEyebrow: "Allowed",
    allowedTitle: "What this representative will do",
    allowList: ["Answer FAQs", "Collect collaboration, quote, and scheduling details", "Deliver public materials", "Create safe handoff requests", "Offer Stars-powered paid continuation"],
    notAllowedEyebrow: "Not allowed",
    notAllowedTitle: "What this representative will not do",
    denyList: ["Access private file systems", "Read the owner's private memory", "Log into owner accounts", "Change the real calendar directly", "Make irreversible commercial commitments"],
    contractEyebrow: "Conversation contract",
    contractTitle: "Free scope, upgrade rules, and handoff policy",
    contractCopy: (limit: number) => `The first ${limit} replies are optimized for foundational questions and materials. Deeper collaboration judgment, quote intake, and scheduling move into paid continuation or human handoff.`,
    publicRuntimeLabel: "public runtime",
    privateDraftLabel: "private draft",
    handoffReadyLabel: "handoff ready",
    contractFootnote: "Memory boundary: this representative only keeps public-safe interaction context inside this representative. It does not read the owner's private workspace, files, or accounts.",
    skillsEyebrow: "Skill Sources",
    skillsSummary: "Borrowing the best ClawHub habits from OpenClaw, Delegate separates builtin and registry-backed packs while keeping privilege boundaries explicit.",
    skillsTitle: "Skill packs can have sources, but they cannot have authority",
    declaredSkillsEyebrow: "Declared skills",
    skillsCountChip: (count: number) => `${count} skills`,
    declaredSkillsTitle: "How this representative handles external requests",
    skillPacksEyebrow: "Skill packs",
    trackedChip: (count: number) => `${count} tracked`,
    skillPacksTitle: "Installed sources and capability tags",
    builtinLabel: "Built-in",
    executesCodeNote: "This pack executes code and would require extra review.",
    declarativeNote: "This pack is currently modeled as declarative and non-privileged for public-runtime safety.",
    knowledgeEyebrow: "Knowledge Pack",
    knowledgeSummary: "The representative should answer from structured knowledge first, then decide whether to continue, collect intake, or escalate.",
    knowledgeTitle: "Structured public knowledge comes before improvisation",
    faqTitle: "High-frequency answers",
    materialsEyebrow: "Materials",
    materialsTitle: "Public materials that can be delivered directly",
    policiesEyebrow: "Policies",
    policiesTitle: "Boundary and response rules",
    plansEyebrow: "Plans",
    plansSummary: "Users should understand how deep they can go and what actions unlock next, not the raw model cost underneath.",
    plansTitle: "Four access layers instead of token pricing",
    accessLayerEyebrow: "Access layer",
    repliesChip: (count: number) => `${count} replies`,
    priorityHandoffChip: "priority handoff",
    openInTelegram: "Open in Telegram",
    buyInTelegram: "Buy in Telegram",
    handoffEyebrow: "Human Handoff",
    handoffSummary: "When the public representative reaches its boundary, escalation should feel like a predictable workflow instead of a vague refusal.",
    handoffTitle: "The owner should receive high-value inbox items, not raw noise",
    handoffCopyEyebrow: "Handoff copy",
    handoffCopyTitle: "Public escalation copy",
    entryPointsEyebrow: "Entry points",
    entryPointsTitle: "Public paths to continue the conversation",
    entryPointsCopy: (strategy: string) => `Telegram private chat is still the primary path. In groups, the representative responds conservatively using a ${strategy} activation policy.`,
    openRepresentative: "Open representative",
    inspectMemoryPolicy: "Inspect memory policy",
  },
} as const;
