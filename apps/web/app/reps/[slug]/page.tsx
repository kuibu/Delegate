import Link from "next/link";
import { notFound } from "next/navigation";

import type { PlanTier, Representative } from "@delegate/domain";

import {
  DashboardPanelFrame,
  DashboardSignalStrip,
  DashboardSurface,
  DashboardSurfaceGrid,
} from "../../ui/control-plane";
import { getRepresentativeSetupSnapshot } from "../../../lib/representative-setup";
import { getRepresentativeSkillPackSnapshot } from "../../../lib/representative-skill-packs";

type RepresentativeSkill = Representative["skills"][number];

const skillLabels: Record<RepresentativeSkill, string> = {
  faq_reply: "FAQ 回复",
  lead_qualify: "合作意向初筛",
  intake_collect: "需求采集",
  quote_request_collect: "报价请求采集",
  material_delivery: "资料投递",
  scheduling_request: "预约意向采集",
  human_handoff: "人工转接",
  paid_unlock: "付费续用",
};

const allowList = [
  "回答 FAQ",
  "收集合作/报价/预约信息",
  "发公开资料",
  "发起人工转接",
  "提示 Stars 付费解锁",
];

const denyList = [
  "访问私有文件系统",
  "读取主人的私有记忆",
  "代主人登录账户",
  "擅自修改真实日程",
  "做不可逆商业承诺",
];

const groupActivationLabels = {
  mention_only: "仅 mention",
  reply_or_mention: "reply 或 mention",
  always: "始终响应",
} as const;

const representativeMenu = [
  { href: "#overview", label: "Overview" },
  { href: "#trust", label: "Trust" },
  { href: "#skills", label: "Skills" },
  { href: "#knowledge", label: "Knowledge" },
  { href: "#plans", label: "Plans" },
  { href: "#handoff", label: "Handoff" },
] as const;

export default async function RepresentativePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const telegramBotUsername = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
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

  return (
    <main className="dashboard-shell representative-shell">
      <header className="representative-topbar">
        <div className="dashboard-brand">
          <div className="dashboard-brand-mark">R</div>
          <div>
            <strong>{representative.name}</strong>
            <div className="muted">Trust-first public representative profile</div>
          </div>
        </div>

        <nav aria-label="Representative sections" className="representative-menu-tabs">
          {representativeMenu.map((item) => (
            <a className="dashboard-menu-tab" href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="dashboard-nav-links">
          <Link className="dashboard-nav-link" href="/">
            Home
          </Link>
          <Link className="dashboard-nav-link" href={`/dashboard?rep=${representative.slug}&view=overview`}>
            Dashboard
          </Link>
        </div>
      </header>

      <section className="dashboard-stage representative-stage" id="overview">
        <div>
          <p className="eyebrow">Representative Profile</p>
          <h1>{representative.name}</h1>
          <p className="dashboard-stage-copy">{representative.tagline}</p>
          <div className="chip-row">
            {representative.languages.map((language) => (
              <span className="chip" key={language}>
                {language}
              </span>
            ))}
            <span className="chip chip-safe">{groupActivationLabels[representative.groupActivation]}</span>
            <span className="chip">{representative.humanInLoop ? "ai + human" : "ai only"}</span>
          </div>
        </div>

        <div className="representative-stage-aside">
          <article className="dashboard-highlight-card dashboard-highlight-card-primary">
            <p className="panel-title">Who this representative works for</p>
            <h3>{representative.ownerName}</h3>
            <p>{representative.knowledgePack.identitySummary}</p>
            <p className="footer-note">
              This representative may remember prior public-safe interactions within this representative only. It does not access the owner&apos;s private workspace, private files, or private accounts.
            </p>
          </article>

          <div className="button-row representative-stage-links">
            {telegramBotUsername ? (
              <a
                className="button-primary"
                href={buildTelegramPlanLink(telegramBotUsername, representative.slug, "free")}
                rel="noreferrer"
                target="_blank"
              >
                Ask in Telegram
              </a>
            ) : null}
            <Link className="button-secondary" href={`/dashboard?rep=${representative.slug}&view=setup`}>
              View control plane
            </Link>
          </div>
        </div>
      </section>

      <DashboardSignalStrip
        cards={[
          {
            label: "Free replies",
            value: `${representative.contract.freeReplyLimit}`,
            detail: "首次接触阶段能被代表独立接住的免费深度。",
            tone: "accent",
          },
          {
            label: "Enabled skills",
            value: `${representative.skills.length}`,
            detail: "当前公开声明并可被用户理解的能力条数。",
            tone: "safe",
          },
          {
            label: "Knowledge items",
            value: `${totalKnowledgeItems}`,
            detail: "FAQ、资料和政策构成的公开知识包。",
          },
          {
            label: "Skill packs",
            value: `${enabledSkillPacks.length}`,
            detail: "已启用且进入代表运行时的 skill pack 数量。",
          },
        ]}
      />

      <DashboardPanelFrame
        eyebrow="Trust Interface"
        id="trust"
        summary="公开能力、拒绝范围、升级路径和计费方式都不应该藏在对话里。"
        title="用户一进来就该先看到边界和契约"
      >
        <DashboardSurfaceGrid columns={3}>
          <DashboardSurface eyebrow="Allowed" title="代表会做什么" tone="accent">
            <ul className="list">
              {allowList.map((item) => (
                <li className="list-item" key={item}>
                  {item}
                </li>
              ))}
            </ul>
          </DashboardSurface>

          <DashboardSurface eyebrow="Not allowed" title="代表明确不会做什么">
            <ul className="list">
              {denyList.map((item) => (
                <li className="list-item" key={item}>
                  {item}
                </li>
              ))}
            </ul>
          </DashboardSurface>

          <DashboardSurface eyebrow="Conversation contract" title="免费、升级和转接规则">
            <p className="section-copy">
              免费规则：前 {representative.contract.freeReplyLimit} 条回复适合基础问答与资料领取；更深的合作判断、报价采集和预约意向会引导到付费续用或人工转接。
            </p>
            <div className="chip-row">
              <span className="chip chip-safe">{groupActivationLabels[representative.groupActivation]}</span>
              <span className="chip">{representative.publicMode ? "public runtime" : "private draft"}</span>
              <span className="chip">{representative.humanInLoop ? "handoff ready" : "ai only"}</span>
            </div>
            <p className="footer-note">
              记忆边界：只会记住这个代表范围内的公开安全互动，不会读取主人的私有工作区、私有文件或私有账号。
            </p>
          </DashboardSurface>
        </DashboardSurfaceGrid>
      </DashboardPanelFrame>

      <DashboardPanelFrame
        eyebrow="Skill Sources"
        id="skills"
        summary="参考 OpenClaw 的 ClawHub 习惯后，这里把 builtin 与 registry-backed skill packs 分开，并强调越权永远不被允许。"
        title="技能包可以有来源，但不能有越权"
      >
        <DashboardSurfaceGrid>
          <DashboardSurface
            eyebrow="Declared skills"
            meta={<span className="chip chip-safe">{representative.skills.length} skills</span>}
            title="公开代表会如何接住外部请求"
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
            eyebrow="Skill packs"
            meta={<span className="chip">{representative.skillPacks.length} tracked</span>}
            title="已安装来源与能力标签"
          >
            <div className="row-list">
              {representative.skillPacks.map((skillPack) => (
                <div className="skill-row" key={skillPack.id}>
                  <div>
                    <strong>{skillPack.displayName}</strong>
                    <p>{skillPack.summary}</p>
                    <div className="chip-row">
                      <span className="chip">
                        {skillPack.source === "clawhub" ? "ClawHub" : "Built-in"}
                      </span>
                      <span className="chip">{skillPack.installStatus}</span>
                      {skillPack.verificationTier ? (
                        <span className="chip chip-safe">{skillPack.verificationTier}</span>
                      ) : null}
                    </div>
                    <p className="footer-note">
                      {skillPack.executesCode
                        ? "This pack executes code and would require extra review."
                        : "This pack is currently modeled as declarative/non-privileged for public runtime safety."}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </DashboardSurface>
        </DashboardSurfaceGrid>
      </DashboardPanelFrame>

      <DashboardPanelFrame
        eyebrow="Knowledge Pack"
        id="knowledge"
        summary="代表先从结构化知识里拿答案，再决定下一步是继续回答、收集 intake 还是升级转接。"
        title="公开知识包先于自由发挥"
      >
        <DashboardSurfaceGrid columns={3}>
          <DashboardSurface eyebrow="FAQ" title="高频标准答案" tone="accent">
            <ul className="list">
              {representative.knowledgePack.faq.map((item) => (
                <li className="list-item" key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                </li>
              ))}
            </ul>
          </DashboardSurface>

          <DashboardSurface eyebrow="Materials" title="可直接投递的公开材料">
            <ul className="list">
              {representative.knowledgePack.materials.map((item) => (
                <li className="list-item" key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                </li>
              ))}
            </ul>
          </DashboardSurface>

          <DashboardSurface eyebrow="Policies" title="合作边界与响应规则">
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
        eyebrow="Plans"
        id="plans"
        summary="用户不该理解原始模型成本，只需要理解还能继续聊多深、能做哪些动作。"
        title="四档访问深度，而不是 token 定价"
      >
        <DashboardSurfaceGrid>
          {representative.pricing.map((plan) => (
            <DashboardSurface
              eyebrow="Access layer"
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
                <span className="chip">{plan.includedReplies} replies</span>
                {plan.includesPriorityHandoff ? (
                  <span className="chip chip-safe">priority handoff</span>
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
                    {plan.tier === "free" ? "Open in Telegram" : "Buy in Telegram"}
                  </a>
                </div>
              ) : null}
            </DashboardSurface>
          ))}
        </DashboardSurfaceGrid>
      </DashboardPanelFrame>

      <DashboardPanelFrame
        eyebrow="Human Handoff"
        id="handoff"
        summary="当公开代表接近边界时，转接不该是一句拒答，而应该是一条明确可预期的升级路径。"
        title="主人最终接手的是高价值收件项，不是原始噪音"
      >
        <DashboardSurfaceGrid>
          <DashboardSurface eyebrow="Handoff copy" title="对外升级说明" tone="accent">
            <p>{representative.handoffPrompt}</p>
          </DashboardSurface>

          <DashboardSurface eyebrow="Entry points" title="继续对话的公开入口">
            <p className="section-copy">
              优先入口仍然是 Telegram 私聊；在群组场景下，代表只会按 {groupActivationLabels[representative.groupActivation]} 的策略保守响应。
            </p>
            <div className="button-row">
              {telegramBotUsername ? (
                <a
                  className="button-primary"
                  href={buildTelegramPlanLink(telegramBotUsername, representative.slug, "free")}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open representative
                </a>
              ) : null}
              <Link className="button-secondary" href={`/dashboard?rep=${representative.slug}&view=memory`}>
                Inspect memory policy
              </Link>
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
