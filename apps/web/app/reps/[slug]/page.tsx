import Link from "next/link";
import { notFound } from "next/navigation";

import { demoRepresentative } from "@delegate/domain";

const skillLabels: Record<(typeof demoRepresentative.skills)[number], string> = {
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

export default async function RepresentativePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (slug !== demoRepresentative.slug) {
    notFound();
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">R</div>
          <div>
            <strong>{demoRepresentative.name}</strong>
            <div className="muted">Public-facing representative profile</div>
          </div>
        </div>

        <nav className="nav-links">
          <Link className="nav-link" href="/">
            Home
          </Link>
          <Link className="nav-link" href="/dashboard">
            Dashboard
          </Link>
        </nav>
      </header>

      <section className="page-header">
        <div>
          <p className="eyebrow">Representative Profile</p>
          <h1>{demoRepresentative.name}</h1>
          <p className="section-copy">{demoRepresentative.tagline}</p>
        </div>

        <div className="chip-row">
          {demoRepresentative.languages.map((language) => (
            <span className="chip" key={language}>
              {language}
            </span>
          ))}
        </div>
      </section>

      <section className="profile-grid">
        <article className="panel">
          <p className="panel-title">Who this representative works for</p>
          <h3>{demoRepresentative.ownerName}</h3>
          <p>{demoRepresentative.knowledgePack.identitySummary}</p>

          <div className="chip-row">
            <span className="chip chip-safe">公开知识运行时</span>
            <span className="chip chip-safe">AI + 人工升级转接</span>
            <span className="chip chip-danger">无私有记忆接入</span>
          </div>
        </article>

        <article className="panel">
          <p className="panel-title">What it can do</p>
          <div className="chip-row">
            {demoRepresentative.skills.map((skill) => (
              <span className="chip" key={skill}>
                {skillLabels[skill]}
              </span>
            ))}
          </div>

          <p className="footer-note">
            免费规则：前 {demoRepresentative.contract.freeReplyLimit} 条回复适合基础问答与资料领取；更深的合作判断、
            报价采集和预约意向会引导到付费续用或人工转接。
          </p>
        </article>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Trust Interface</p>
            <h2>用户一进来就该看到边界</h2>
          </div>
          <p className="section-copy">公开能力、拒绝范围、升级路径和计费方式都不应该藏在对话里。</p>
        </div>

        <div className="card-grid two-up">
          <article className="panel list-card">
            <h3>Allowed</h3>
            <ul className="list">
              {allowList.map((item) => (
                <li className="list-item" key={item}>
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="panel list-card">
            <h3>Not Allowed</h3>
            <ul className="list">
              {denyList.map((item) => (
                <li className="list-item" key={item}>
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Knowledge Pack</p>
            <h2>公开知识包先于自由发挥</h2>
          </div>
          <p className="section-copy">代表先从结构化知识里拿答案，再决定下一步是继续回答、收集 intake 还是升级转接。</p>
        </div>

        <div className="card-grid">
          <article className="panel list-card">
            <h3>FAQ</h3>
            <ul className="list">
              {demoRepresentative.knowledgePack.faq.map((item) => (
                <li className="list-item" key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                </li>
              ))}
            </ul>
          </article>

          <article className="panel list-card">
            <h3>Materials</h3>
            <ul className="list">
              {demoRepresentative.knowledgePack.materials.map((item) => (
                <li className="list-item" key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                </li>
              ))}
            </ul>
          </article>

          <article className="panel list-card">
            <h3>Policies</h3>
            <ul className="list">
              {demoRepresentative.knowledgePack.policies.map((item) => (
                <li className="list-item" key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Plans</p>
            <h2>四档访问深度，而不是 token 定价</h2>
          </div>
          <p className="section-copy">用户不该理解原始模型成本，只需要理解还能继续聊多深、能做哪些动作。</p>
        </div>

        <div className="plan-grid">
          {demoRepresentative.pricing.map((plan) => (
            <article className="plan-card" key={plan.tier}>
              <h3>{plan.name}</h3>
              <span className="price">{plan.stars} Stars</span>
              <p>{plan.summary}</p>
              <div className="chip-row">
                <span className="chip">{plan.includedReplies} replies</span>
                {plan.includesPriorityHandoff ? (
                  <span className="chip chip-safe">priority handoff</span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <article className="panel">
          <p className="panel-title">Human handoff copy</p>
          <p>{demoRepresentative.handoffPrompt}</p>
        </article>
      </section>
    </main>
  );
}
