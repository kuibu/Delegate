"use client";

import { useEffect, useState, useTransition } from "react";

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

  return (
    <>
      {snapshot ? (
        <>
          <section className="page-header">
            <div>
              <p className="eyebrow">Owner View</p>
              <h1>主人需要的是外部需求仪表盘，不只是聊天记录。</h1>
              <p className="section-copy">{snapshot.representative.roleSummary}</p>
            </div>

            <div className="chip-row">
              <span className="chip">{snapshot.representative.displayName}</span>
              <span className="chip chip-safe">{snapshot.wallet.starsBalance} Stars</span>
            </div>
          </section>

          <section className="stats-grid">
            {snapshot.metrics.map((metric) => (
              <article className="metric-card" key={metric.label}>
                <strong>{metric.value}</strong>
                <p>{metric.label}</p>
                <p className="muted">{metric.detail}</p>
              </article>
            ))}
          </section>
        </>
      ) : null}

      {message ? <div className="status-banner status-success">{message}</div> : null}
      {error ? <div className="status-banner status-error">{error}</div> : null}

      <section className="section">
        <div className="table-grid">
          <article className="table-card">
            <h3>人工转接收件箱</h3>
            <div className="row-list">
              {snapshot?.handoffRequests.length ? (
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

                    <div className="button-row">
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
          </article>

          <article className="table-card">
            <h3>最近 Stars 付款</h3>
            <div className="row-list">
              {snapshot?.recentInvoices.length ? (
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
                    <div className="button-row">
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
          </article>
        </div>
      </section>
    </>
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
