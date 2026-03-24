"use client";

import { useEffect, useState, useTransition } from "react";

import {
  DashboardPanelFrame,
  DashboardSignalStrip,
  DashboardSurface,
  DashboardSurfaceGrid,
} from "../ui/control-plane";

type DashboardOverviewSnapshot = {
  representative: {
    slug: string;
    displayName: string;
    roleSummary: string;
  };
  metrics: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
  wallet: {
    starsBalance: number;
    sponsorPoolCredit: number;
    balanceCredits: number;
  };
  openVikingMetrics: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
  handoffRequests: Array<{
    id: string;
    who: string;
    why: string;
    score: "High" | "Medium" | "Low";
    status: "open" | "reviewing" | "accepted" | "declined" | "closed";
    recommendedOwnerAction: string;
    requestType: string;
    isPaid: boolean;
    requestedAt: string;
  }>;
  recentInvoices: Array<{
    id: string;
    who: string;
    planName: string;
    planType: "free" | "pass" | "deep_help" | "sponsor";
    starsAmount: number;
    status: "pending" | "paid" | "fulfilled" | "refunded" | "failed" | "canceled";
    createdAt: string;
    paidAt?: string;
    invoiceLink?: string;
  }>;
};

const statusLabel = {
  open: "open",
  reviewing: "reviewing",
  accepted: "accepted",
  declined: "declined",
  closed: "closed",
} as const;

export function DashboardOverview({
  representativeSlug,
}: {
  representativeSlug: string;
}) {
  const [snapshot, setSnapshot] = useState<DashboardOverviewSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void refreshOverview(representativeSlug, setSnapshot, setError);
  }, [representativeSlug]);

  const openHandoffCount = snapshot
    ? snapshot.handoffRequests.filter((item) => item.status === "open" || item.status === "reviewing")
        .length
    : 0;
  const signalCards = snapshot
    ? [
        {
          label: "Open handoffs",
          value: `${openHandoffCount}`,
          detail: "当前值得主人优先判断与接手的请求数。",
          tone: "accent" as const,
        },
        {
          label: "Stars live",
          value: `${snapshot.wallet.starsBalance}`,
          detail: "当前可支撑公开代表持续应答的 Stars 余额。",
          tone: "safe" as const,
        },
        {
          label: "Sponsor pool",
          value: `${snapshot.wallet.sponsorPoolCredit}`,
          detail: "公共赞助池还能继续支撑多少代表流量。",
        },
        {
          label: "Recent invoices",
          value: `${snapshot.recentInvoices.length}`,
          detail: "最近的付费信号与续用动作。",
        },
      ]
    : [];

  function handleStatusChange(
    handoffId: string,
    nextStatus: DashboardOverviewSnapshot["handoffRequests"][number]["status"],
    label: string,
  ) {
    setBusyKey(`${handoffId}:${nextStatus}`);
    setError(null);
    setMessage(null);

    startTransition(() => {
      void (async () => {
        const response = await fetch(
          `/api/dashboard/representatives/${representativeSlug}/handoffs/${handoffId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ status: nextStatus }),
          },
        );

        if (!response.ok) {
          throw new Error(await extractError(response));
        }

        await refreshOverview(representativeSlug, setSnapshot, setError);
        setMessage(`${label} is now ${statusLabel[nextStatus]}.`);
      })()
        .catch((nextError: unknown) => {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Failed to update owner inbox status.",
          );
        })
        .finally(() => {
          setBusyKey(null);
        });
    });
  }

  if (!snapshot) {
    return (
      <section className="section">
        <article className="dashboard-highlight-card">
          <p className="panel-title">Loading overview</p>
          <h3>正在读取 owner dashboard 的最新快照。</h3>
          <p>会先加载指标、handoff 收件箱和最近的 Stars 付款记录。</p>
        </article>
      </section>
    );
  }

  return (
    <DashboardPanelFrame
      eyebrow="Owner View"
      summary={`${snapshot.representative.displayName} 的 dashboard 先展示高频信号，再进入 handoff 和付款细节。`}
      title="先看今天的运营脉冲，再决定要不要深入处理。"
    >
      <div className="dashboard-panel-hero">
        <article className="dashboard-highlight-card dashboard-highlight-card-primary">
          <p className="panel-title">Daily operating pulse</p>
          <h3>主人需要的是“值不值得亲自接手”的判断面板，不是长聊天记录。</h3>
          <p>{snapshot.representative.roleSummary}</p>
          <div className="chip-row">
            <span className="chip">{snapshot.representative.displayName}</span>
            <span className="chip chip-safe">{snapshot.wallet.starsBalance} Stars live</span>
            <span className="chip">{openHandoffCount} active handoffs</span>
          </div>
        </article>

        <DashboardSignalStrip cards={signalCards} />
      </div>

      {message ? <div className="status-banner status-success">{message}</div> : null}
      {error ? <div className="status-banner status-error">{error}</div> : null}

      <DashboardSignalStrip
        cards={snapshot.metrics.map((metric, index) => ({
          label: metric.label,
          value: metric.value,
          detail: metric.detail,
          tone: index === 0 ? ("accent" as const) : "default",
        }))}
      />

      {snapshot.openVikingMetrics.length ? (
        <div className="dashboard-subsection-stack">
          <div className="dashboard-inline-section-heading">
            <div>
              <p className="eyebrow">OpenViking</p>
              <h3>记忆层也应该像收件箱一样可观测。</h3>
            </div>
            <p className="section-copy">
              capture、commit、resource sync 和 recall 必须进入 owner 的日常读数，而不是藏在日志里。
            </p>
          </div>
          <DashboardSignalStrip
            cards={snapshot.openVikingMetrics.map((metric) => ({
              label: metric.label,
              value: metric.value,
              detail: metric.detail,
              tone: "safe" as const,
            }))}
          />
        </div>
      ) : null}

      <DashboardSurfaceGrid>
        <DashboardSurface
          eyebrow="Handoff inbox"
          meta={<span className="chip chip-safe">{openHandoffCount} active</span>}
          title="人工转接收件箱"
        >
          <div className="row-list">
            {snapshot.handoffRequests.length ? (
              snapshot.handoffRequests.map((item) => (
                <div className="skill-row" key={item.id}>
                  <div>
                    <strong>{item.who}</strong>
                    <p>{item.why}</p>
                    <div className="chip-row">
                      <span className="chip">{item.score}</span>
                      <span className="chip">{item.requestType}</span>
                      <span className="chip">{item.status}</span>
                      {item.isPaid ? <span className="chip chip-safe">paid</span> : null}
                    </div>
                    <p className="footer-note">Owner action: {item.recommendedOwnerAction}</p>
                  </div>

                  <div className="button-row button-row-stretch">
                    {buildNextStatusActions(item.status).map((action) => (
                      <button
                        className={action.emphasis === "primary" ? "button-primary" : "button-secondary"}
                        disabled={isPending || busyKey === `${item.id}:${action.status}`}
                        key={action.status}
                        onClick={() => handleStatusChange(item.id, action.status, item.who)}
                        type="button"
                      >
                        {busyKey === `${item.id}:${action.status}` ? "Saving..." : action.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">当前没有待处理的 handoff 请求。</p>
            )}
          </div>
        </DashboardSurface>

        <DashboardSurface
          eyebrow="Billing"
          meta={<span className="chip">{snapshot.recentInvoices.length} invoices</span>}
          title="最近 Stars 付款"
        >
          <div className="row-list">
            {snapshot.recentInvoices.length ? (
              snapshot.recentInvoices.map((invoice) => (
                <div className="skill-row" key={invoice.id}>
                  <div>
                    <strong>
                      {invoice.who} · {invoice.planName}
                    </strong>
                    <p>
                      {invoice.starsAmount} Stars · {invoice.status}
                    </p>
                    <div className="chip-row">
                      <span className="chip">{invoice.planType}</span>
                      <span className="chip">{formatTimestamp(invoice.createdAt)}</span>
                      {invoice.paidAt ? (
                        <span className="chip chip-safe">{formatTimestamp(invoice.paidAt)}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="button-row button-row-stretch">
                    {invoice.invoiceLink ? (
                      <a className="button-secondary" href={invoice.invoiceLink} target="_blank" rel="noreferrer">
                        View invoice
                      </a>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">还没有任何 Stars invoice 记录。</p>
            )}
          </div>
        </DashboardSurface>
      </DashboardSurfaceGrid>
    </DashboardPanelFrame>
  );
}

function buildNextStatusActions(
  status: DashboardOverviewSnapshot["handoffRequests"][number]["status"],
): Array<{
  status: DashboardOverviewSnapshot["handoffRequests"][number]["status"];
  label: string;
  emphasis: "primary" | "secondary";
}> {
  switch (status) {
    case "open":
      return [
        { status: "reviewing", label: "Review", emphasis: "secondary" },
        { status: "accepted", label: "Accept", emphasis: "primary" },
        { status: "declined", label: "Decline", emphasis: "secondary" },
      ];
    case "reviewing":
      return [
        { status: "accepted", label: "Accept", emphasis: "primary" },
        { status: "closed", label: "Close", emphasis: "secondary" },
      ];
    case "accepted":
      return [{ status: "closed", label: "Close", emphasis: "secondary" }];
    case "declined":
    case "closed":
    default:
      return [];
  }
}

async function refreshOverview(
  representativeSlug: string,
  setSnapshot: (value: DashboardOverviewSnapshot) => void,
  setError: (value: string | null) => void,
) {
  const response = await fetch(`/api/dashboard/representatives/${representativeSlug}/overview`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await extractError(response));
  }

  const payload = (await response.json()) as DashboardOverviewSnapshot;
  setSnapshot(payload);
  setError(null);
}

async function extractError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload.error) {
      return payload.error;
    }
  } catch {
    // ignore
  }
  return `${response.status} ${response.statusText}`;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
