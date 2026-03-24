"use client";

import { useEffect, useState, useTransition } from "react";

import {
  DashboardPanelFrame,
  DashboardSignalStrip,
  DashboardSurface,
  DashboardSurfaceGrid,
  pickCopy,
  type Locale,
} from "@delegate/web-ui";

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
  locale,
}: {
  representativeSlug: string;
  locale: Locale;
}) {
  const t = pickCopy(locale, copy);
  const [snapshot, setSnapshot] = useState<DashboardOverviewSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void refreshOverview(representativeSlug, locale, setSnapshot, setError);
  }, [representativeSlug, locale]);

  const openHandoffCount = snapshot
    ? snapshot.handoffRequests.filter((item) => item.status === "open" || item.status === "reviewing")
        .length
    : 0;
  const signalCards = snapshot
    ? [
        {
          label: t.signalCards.openHandoffsLabel,
          value: `${openHandoffCount}`,
          detail: t.signalCards.openHandoffsDetail,
          tone: "accent" as const,
        },
        {
          label: t.signalCards.starsLiveLabel,
          value: `${snapshot.wallet.starsBalance}`,
          detail: t.signalCards.starsLiveDetail,
          tone: "safe" as const,
        },
        {
          label: t.signalCards.sponsorPoolLabel,
          value: `${snapshot.wallet.sponsorPoolCredit}`,
          detail: t.signalCards.sponsorPoolDetail,
        },
        {
          label: t.signalCards.recentInvoicesLabel,
          value: `${snapshot.recentInvoices.length}`,
          detail: t.signalCards.recentInvoicesDetail,
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

        await refreshOverview(representativeSlug, locale, setSnapshot, setError);
        setMessage(t.statusSaved(label, statusLabel[nextStatus]));
      })()
        .catch((nextError: unknown) => {
          setError(nextError instanceof Error ? nextError.message : t.updateError);
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
          <p className="panel-title">{t.loadingTitle}</p>
          <h3>{t.loadingHeadline}</h3>
          <p>{t.loadingCopy}</p>
        </article>
      </section>
    );
  }

  return (
    <DashboardPanelFrame
      eyebrow={t.ownerViewEyebrow}
      summary={t.summary(snapshot.representative.displayName)}
      title={t.panelTitle}
    >
      <div className="dashboard-panel-hero">
        <article className="dashboard-highlight-card dashboard-highlight-card-primary">
          <p className="panel-title">{t.heroKicker}</p>
          <h3>{t.heroTitle}</h3>
          <p>{snapshot.representative.roleSummary}</p>
          <div className="chip-row">
            <span className="chip">{snapshot.representative.displayName}</span>
            <span className="chip chip-safe">{t.starsLiveChip(snapshot.wallet.starsBalance)}</span>
            <span className="chip">{t.activeHandoffsChip(openHandoffCount)}</span>
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
              <h3>{t.openVikingTitle}</h3>
            </div>
            <p className="section-copy">{t.openVikingCopy}</p>
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
          eyebrow={t.handoffEyebrow}
          meta={<span className="chip chip-safe">{t.activeChip(openHandoffCount)}</span>}
          title={t.handoffTitle}
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
                      {item.isPaid ? <span className="chip chip-safe">{t.paidLabel}</span> : null}
                    </div>
                    <p className="footer-note">{t.ownerActionLabel(item.recommendedOwnerAction)}</p>
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
                        {busyKey === `${item.id}:${action.status}` ? t.saving : translateActionLabel(locale, action.label)}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">{t.noHandoffs}</p>
            )}
          </div>
        </DashboardSurface>

        <DashboardSurface
          eyebrow={t.billingEyebrow}
          meta={<span className="chip">{t.invoicesChip(snapshot.recentInvoices.length)}</span>}
          title={t.billingTitle}
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
                      <span className="chip">{formatTimestamp(invoice.createdAt, locale)}</span>
                      {invoice.paidAt ? (
                        <span className="chip chip-safe">{formatTimestamp(invoice.paidAt, locale)}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="button-row button-row-stretch">
                    {invoice.invoiceLink ? (
                      <a className="button-secondary" href={invoice.invoiceLink} target="_blank" rel="noreferrer">
                        {t.openInvoice}
                      </a>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">{t.noInvoices}</p>
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
  locale: Locale,
  setSnapshot: (value: DashboardOverviewSnapshot) => void,
  setError: (value: string | null) => void,
) {
  const response = await fetch(`/api/dashboard/representatives/${representativeSlug}/overview?lang=${locale}`, {
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

function formatTimestamp(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function translateActionLabel(locale: Locale, label: string): string {
  if (locale === "en") {
    return label;
  }

  switch (label) {
    case "Review":
      return "评估";
    case "Accept":
      return "接受";
    case "Decline":
      return "拒绝";
    case "Close":
      return "关闭";
    default:
      return label;
  }
}

const copy = {
  zh: {
    signalCards: {
      openHandoffsLabel: "待处理 handoff",
      openHandoffsDetail: "当前值得主人优先判断与接手的请求数。",
      starsLiveLabel: "Stars 余额",
      starsLiveDetail: "当前可支撑公开代表持续应答的 Stars 余额。",
      sponsorPoolLabel: "赞助池",
      sponsorPoolDetail: "公共赞助池还能继续支撑多少代表流量。",
      recentInvoicesLabel: "最近付款",
      recentInvoicesDetail: "最近的付费信号与续用动作。",
    },
    statusSaved: (label: string, status: string) => `${label} 现在是 ${status}。`,
    updateError: "更新 owner inbox 状态失败。",
    loadingTitle: "概览加载中",
    loadingHeadline: "正在读取 owner dashboard 的最新快照。",
    loadingCopy: "会先加载指标、handoff 收件箱和最近的 Stars 付款记录。",
    ownerViewEyebrow: "Owner View",
    summary: (name: string) => `${name} 的 dashboard 先展示高频信号，再进入 handoff 和付款细节。`,
    panelTitle: "先看今天的运营脉冲，再决定要不要深入处理。",
    heroKicker: "Daily operating pulse",
    heroTitle: "主人需要的是“值不值得亲自接手”的判断面板，不是长聊天记录。",
    starsLiveChip: (stars: number) => `${stars} Stars live`,
    activeHandoffsChip: (count: number) => `${count} active handoffs`,
    openVikingTitle: "记忆层也应该像收件箱一样可观测。",
    openVikingCopy: "capture、commit、resource sync 和 recall 必须进入 owner 的日常读数，而不是藏在日志里。",
    handoffEyebrow: "Handoff inbox",
    activeChip: (count: number) => `${count} active`,
    handoffTitle: "人工转接收件箱",
    paidLabel: "已付费",
    ownerActionLabel: (value: string) => `Owner action: ${value}`,
    saving: "保存中...",
    noHandoffs: "当前没有待处理的 handoff 请求。",
    billingEyebrow: "Billing",
    invoicesChip: (count: number) => `${count} 笔 invoices`,
    billingTitle: "最近 Stars 付款",
    openInvoice: "查看发票",
    noInvoices: "还没有任何 Stars invoice 记录。",
  },
  en: {
    signalCards: {
      openHandoffsLabel: "Open handoffs",
      openHandoffsDetail: "Requests that deserve direct owner review right now.",
      starsLiveLabel: "Stars live",
      starsLiveDetail: "The current Stars balance keeping the public representative active.",
      sponsorPoolLabel: "Sponsor pool",
      sponsorPoolDetail: "How much shared credit is left to support representative traffic.",
      recentInvoicesLabel: "Recent invoices",
      recentInvoicesDetail: "The latest payment and continuation signals.",
    },
    statusSaved: (label: string, status: string) => `${label} is now ${status}.`,
    updateError: "Failed to update owner inbox status.",
    loadingTitle: "Loading overview",
    loadingHeadline: "Fetching the latest owner dashboard snapshot.",
    loadingCopy: "Metrics, handoff inbox items, and recent Stars payments load first.",
    ownerViewEyebrow: "Owner View",
    summary: (name: string) => `${name}'s dashboard surfaces high-frequency signal before handoff and billing detail.`,
    panelTitle: "Read today's operating pulse before deciding what deserves deeper attention.",
    heroKicker: "Daily operating pulse",
    heroTitle: "Owners need a triage panel that answers “should I step in?”, not a long chat log.",
    starsLiveChip: (stars: number) => `${stars} Stars live`,
    activeHandoffsChip: (count: number) => `${count} active handoffs`,
    openVikingTitle: "The memory layer should be as observable as the inbox.",
    openVikingCopy: "Capture, commit, resource sync, and recall belong in daily owner metrics instead of hidden logs.",
    handoffEyebrow: "Handoff inbox",
    activeChip: (count: number) => `${count} active`,
    handoffTitle: "Human handoff inbox",
    paidLabel: "paid",
    ownerActionLabel: (value: string) => `Owner action: ${value}`,
    saving: "Saving...",
    noHandoffs: "There are no handoff requests waiting right now.",
    billingEyebrow: "Billing",
    invoicesChip: (count: number) => `${count} invoices`,
    billingTitle: "Recent Stars payments",
    openInvoice: "View invoice",
    noInvoices: "There are no Stars invoices yet.",
  },
} as const;
