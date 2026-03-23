import Link from "next/link";

const metrics = [
  { label: "今日新会话", value: "18", detail: "其中 6 个来自群组 mention 导流" },
  { label: "付费转化", value: "3", detail: "2 个 Pass，1 个 Deep Help" },
  { label: "待人工评估", value: "4", detail: "2 个合作、1 个媒体、1 个退款" },
  { label: "FAQ 覆盖率", value: "71%", detail: "还有 5 个高频问题建议补进知识包" },
];

const inbox = [
  {
    who: "Acme AI",
    why: "想谈一周内启动的自动化合作，预算已说明",
    score: "High",
  },
  {
    who: "Creator Podcast",
    why: "媒体采访请求，需要 founder 本人确认档期",
    score: "Medium",
  },
  {
    who: "匿名用户",
    why: "要求退款，触发 ask-first 规则",
    score: "High",
  },
];

const gaps = [
  "“能不能代发 outbound 消息？”出现 4 次，需要更明确拒答话术。",
  "“你的服务对招聘团队是否适合？”出现 3 次，适合补成 FAQ。",
  "“Pass 和 Deep Help 的差别是什么？”出现 3 次，适合在公开页更前置说明。",
];

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

      <section className="page-header">
        <div>
          <p className="eyebrow">Owner View</p>
          <h1>主人需要的是外部需求仪表盘，不只是聊天记录。</h1>
        </div>
      </section>

      <section className="stats-grid">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <strong>{metric.value}</strong>
            <p>{metric.label}</p>
            <p className="muted">{metric.detail}</p>
          </article>
        ))}
      </section>

      <section className="section">
        <div className="table-grid">
          <article className="table-card">
            <h3>人工转接收件箱</h3>
            <div className="row-list">
              {inbox.map((item) => (
                <div className="row" key={item.who}>
                  <div>
                    <strong>{item.who}</strong>
                    <p>{item.why}</p>
                  </div>
                  <span className="chip">{item.score}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="table-card">
            <h3>建议补进知识包的内容</h3>
            <ul className="list">
              {gaps.map((item) => (
                <li className="list-item" key={item}>
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}
