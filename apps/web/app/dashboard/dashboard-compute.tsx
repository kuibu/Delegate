"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  DashboardPanelFrame,
  DashboardSignalStrip,
  DashboardSurface,
  DashboardSurfaceGrid,
  pickCopy,
  type Locale,
} from "@delegate/web-ui";

type ComputeSnapshot = {
  representative: {
    slug: string;
    displayName: string;
    computeEnabled: boolean;
    defaultPolicyMode: "allow" | "ask" | "deny";
    baseImage: string;
    maxSessionMinutes: number;
    autoApproveBudgetCents: number;
    artifactRetentionDays: number;
    networkMode: "no_network" | "allowlist" | "full";
    filesystemMode: "workspace_only" | "read_only_workspace" | "ephemeral_full";
  };
  sessions: Array<{
    id: string;
    status: string;
    requestedBy: string;
    baseImage: string;
    createdAt: string;
    startedAt?: string;
    lastHeartbeatAt?: string;
    expiresAt?: string;
    endedAt?: string;
    failureReason?: string;
    executionCount: number;
    latestExecution?: {
      id: string;
      capability: string;
      status: string;
      requestedCommand?: string;
      createdAt: string;
    };
  }>;
};

type ComputeApprovalsSnapshot = {
  approvals: Array<{
    id: string;
    status: string;
    reason: string;
    requestedActionSummary: string;
    riskSummary: string;
    requestedAt: string;
    resolvedAt?: string;
    resolvedBy?: string;
    toolExecutionId?: string;
    sessionId?: string;
  }>;
};

type ComputeArtifactsSnapshot = {
  artifacts: Array<{
    id: string;
    kind: string;
    bucket: string;
    objectKey: string;
    mimeType: string;
    sizeBytes: number;
    summary?: string;
    createdAt: string;
    sessionId?: string;
    toolExecutionId?: string;
  }>;
};

export function DashboardCompute({
  representativeSlug,
  locale,
}: {
  representativeSlug: string;
  locale: Locale;
}) {
  const t = pickCopy(locale, copy);
  const [snapshot, setSnapshot] = useState<ComputeSnapshot | null>(null);
  const [approvals, setApprovals] = useState<ComputeApprovalsSnapshot["approvals"]>([]);
  const [artifacts, setArtifacts] = useState<ComputeArtifactsSnapshot["artifacts"]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void refreshCompute(representativeSlug, setSnapshot, setApprovals, setArtifacts, setError);
  }, [representativeSlug]);

  const pendingApprovals = approvals.filter((approval) => approval.status === "pending").length;
  const liveSessions = snapshot
    ? snapshot.sessions.filter((session) =>
        ["requested", "starting", "running", "idle"].includes(session.status),
      ).length
    : 0;
  const failedSessions = snapshot
    ? snapshot.sessions.filter((session) => session.status === "failed").length
    : 0;
  const signalCards = snapshot
    ? [
        {
          label: t.signalCards.pendingApprovals,
          value: `${pendingApprovals}`,
          detail: t.signalCards.pendingApprovalsDetail,
          tone: pendingApprovals > 0 ? ("accent" as const) : ("safe" as const),
        },
        {
          label: t.signalCards.liveSessions,
          value: `${liveSessions}`,
          detail: t.signalCards.liveSessionsDetail,
          tone: "safe" as const,
        },
        {
          label: t.signalCards.artifacts,
          value: `${artifacts.length}`,
          detail: t.signalCards.artifactsDetail,
        },
        {
          label: t.signalCards.autoApproveBudget,
          value: `$${(snapshot.representative.autoApproveBudgetCents / 100).toFixed(2)}`,
          detail: t.signalCards.autoApproveBudgetDetail,
        },
      ]
    : [];

  const platformCards = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return [
      {
        label: t.platformCards.policyMode,
        value: snapshot.representative.defaultPolicyMode,
        detail: t.platformCards.policyModeDetail,
        tone:
          snapshot.representative.defaultPolicyMode === "ask"
            ? ("accent" as const)
            : snapshot.representative.defaultPolicyMode === "allow"
              ? ("safe" as const)
              : ("default" as const),
      },
      {
        label: t.platformCards.networkMode,
        value: snapshot.representative.networkMode,
        detail: t.platformCards.networkModeDetail,
      },
      {
        label: t.platformCards.filesystemMode,
        value: snapshot.representative.filesystemMode,
        detail: t.platformCards.filesystemModeDetail,
      },
      {
        label: t.platformCards.retention,
        value: `${snapshot.representative.artifactRetentionDays}d`,
        detail: t.platformCards.retentionDetail,
      },
    ] satisfies Array<{
      label: string;
      value: string;
      detail: string;
      tone?: "default" | "safe" | "accent";
    }>;
  }, [snapshot, t]);

  async function handleResolve(approvalId: string, resolution: "approved" | "rejected") {
    setBusyKey(`${approvalId}:${resolution}`);
    setMessage(null);
    setError(null);

    startTransition(() => {
      void (async () => {
        const response = await fetch(
          `/api/dashboard/representatives/${representativeSlug}/compute/approvals/${approvalId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              resolution,
              resolvedBy: "owner-dashboard",
            }),
          },
        );

        if (!response.ok) {
          throw new Error(await extractError(response));
        }

        await refreshCompute(representativeSlug, setSnapshot, setApprovals, setArtifacts, setError);
        setMessage(
          resolution === "approved" ? t.messages.approved : t.messages.rejected,
        );
      })()
        .catch((nextError: unknown) => {
          setError(nextError instanceof Error ? nextError.message : t.messages.error);
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
      eyebrow={t.panelEyebrow}
      summary={t.panelSummary(snapshot.representative.displayName)}
      title={t.panelTitle}
    >
      <div className="dashboard-panel-hero">
        <article className="dashboard-highlight-card dashboard-highlight-card-primary">
          <p className="panel-title">{t.heroKicker}</p>
          <h3>
            {snapshot.representative.computeEnabled ? t.enabledHeadline : t.disabledHeadline}
          </h3>
          <p>{t.heroCopy(snapshot.representative.baseImage, snapshot.representative.maxSessionMinutes)}</p>
          <div className="chip-row">
            <span className="chip">{snapshot.representative.slug}</span>
            <span
              className={
                snapshot.representative.computeEnabled ? "chip chip-safe" : "chip chip-danger"
              }
            >
              {snapshot.representative.computeEnabled ? t.enabledChip : t.disabledChip}
            </span>
            <span className="chip">{t.policyChip(snapshot.representative.defaultPolicyMode)}</span>
          </div>
        </article>

        <DashboardSignalStrip cards={signalCards} />
      </div>

      {message ? <div className="status-banner status-success">{message}</div> : null}
      {error ? <div className="status-banner status-error">{error}</div> : null}

      <DashboardSignalStrip cards={platformCards} />

      <DashboardSurfaceGrid columns={2}>
        <DashboardSurface
          eyebrow={t.approvalsEyebrow}
          meta={<span className="chip">{t.pendingChip(pendingApprovals)}</span>}
          title={t.approvalsTitle}
          tone="accent"
        >
          <div className="row-list">
            {approvals.length ? (
              approvals.map((approval) => (
                <div className="skill-row" key={approval.id}>
                  <div>
                    <strong>{approval.requestedActionSummary}</strong>
                    <p>{approval.riskSummary}</p>
                    <div className="chip-row">
                      <span className="chip">{approval.status}</span>
                      <span className="chip">{approval.reason}</span>
                      <span className="chip">{formatTimestamp(approval.requestedAt, locale)}</span>
                    </div>
                    {approval.sessionId ? (
                      <p className="footer-note">{t.sessionLabel(approval.sessionId)}</p>
                    ) : null}
                    {approval.resolvedAt ? (
                      <p className="footer-note">
                        {t.resolvedLabel(
                          formatTimestamp(approval.resolvedAt, locale),
                          approval.resolvedBy ?? t.ownerFallback,
                        )}
                      </p>
                    ) : null}
                  </div>

                  {approval.status === "pending" ? (
                    <div className="button-row button-row-stretch">
                      <button
                        className="button-primary"
                        disabled={isPending || busyKey === `${approval.id}:approved`}
                        onClick={() => handleResolve(approval.id, "approved")}
                        type="button"
                      >
                        {busyKey === `${approval.id}:approved` ? t.approving : t.approve}
                      </button>
                      <button
                        className="button-secondary"
                        disabled={isPending || busyKey === `${approval.id}:rejected`}
                        onClick={() => handleResolve(approval.id, "rejected")}
                        type="button"
                      >
                        {busyKey === `${approval.id}:rejected` ? t.rejecting : t.reject}
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="muted">{t.noApprovals}</p>
            )}
          </div>
        </DashboardSurface>

        <DashboardSurface
          eyebrow={t.sessionsEyebrow}
          meta={<span className="chip">{t.liveChip(liveSessions, failedSessions)}</span>}
          title={t.sessionsTitle}
        >
          <div className="row-list">
            {snapshot.sessions.length ? (
              snapshot.sessions.map((session) => (
                <div className="skill-row" key={session.id}>
                  <div>
                    <strong>{session.baseImage}</strong>
                    <p>
                      {session.status} · {t.requestedBy(session.requestedBy)}
                    </p>
                    <div className="chip-row">
                      <span className="chip">{formatTimestamp(session.createdAt, locale)}</span>
                      <span className="chip">{t.executionCount(session.executionCount)}</span>
                      {session.expiresAt ? (
                        <span className="chip chip-safe">
                          {t.expiresLabel(formatTimestamp(session.expiresAt, locale))}
                        </span>
                      ) : null}
                    </div>
                    {session.latestExecution ? (
                      <p className="footer-note">
                        {t.latestExecutionLabel(
                          session.latestExecution.status,
                          session.latestExecution.requestedCommand ?? session.latestExecution.capability,
                        )}
                      </p>
                    ) : null}
                    {session.failureReason ? (
                      <p className="footer-note">{t.failureReasonLabel(session.failureReason)}</p>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">{t.noSessions}</p>
            )}
          </div>
        </DashboardSurface>

        <DashboardSurface
          eyebrow={t.artifactsEyebrow}
          meta={<span className="chip">{t.artifactsChip(artifacts.length)}</span>}
          title={t.artifactsTitle}
        >
          <div className="row-list">
            {artifacts.length ? (
              artifacts.map((artifact) => (
                <div className="skill-row" key={artifact.id}>
                  <div>
                    <strong>{artifact.kind}</strong>
                    <p>{artifact.objectKey}</p>
                    <div className="chip-row">
                      <span className="chip">{artifact.mimeType}</span>
                      <span className="chip">{formatBytes(artifact.sizeBytes)}</span>
                      <span className="chip">{formatTimestamp(artifact.createdAt, locale)}</span>
                    </div>
                    {artifact.summary ? (
                      <p className="footer-note">{artifact.summary}</p>
                    ) : null}
                    {artifact.sessionId ? (
                      <p className="footer-note">{t.sessionLabel(artifact.sessionId)}</p>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">{t.noArtifacts}</p>
            )}
          </div>
        </DashboardSurface>
      </DashboardSurfaceGrid>
    </DashboardPanelFrame>
  );
}

async function refreshCompute(
  representativeSlug: string,
  setSnapshot: (value: ComputeSnapshot | null) => void,
  setApprovals: (value: ComputeApprovalsSnapshot["approvals"]) => void,
  setArtifacts: (value: ComputeArtifactsSnapshot["artifacts"]) => void,
  setError: (value: string | null) => void,
) {
  try {
    setError(null);
    const [snapshotResponse, approvalsResponse, artifactsResponse] = await Promise.all([
      fetch(`/api/dashboard/representatives/${representativeSlug}/compute`, { cache: "no-store" }),
      fetch(`/api/dashboard/representatives/${representativeSlug}/compute/approvals`, {
        cache: "no-store",
      }),
      fetch(`/api/dashboard/representatives/${representativeSlug}/compute/artifacts`, {
        cache: "no-store",
      }),
    ]);

    if (!snapshotResponse.ok) {
      throw new Error(await extractError(snapshotResponse));
    }

    if (!approvalsResponse.ok) {
      throw new Error(await extractError(approvalsResponse));
    }

    if (!artifactsResponse.ok) {
      throw new Error(await extractError(artifactsResponse));
    }

    const snapshotPayload = (await snapshotResponse.json()) as ComputeSnapshot;
    const approvalsPayload = (await approvalsResponse.json()) as ComputeApprovalsSnapshot;
    const artifactsPayload = (await artifactsResponse.json()) as ComputeArtifactsSnapshot;

    setSnapshot(snapshotPayload);
    setApprovals(approvalsPayload.approvals);
    setArtifacts(artifactsPayload.artifacts);
  } catch (error) {
    setError(error instanceof Error ? error.message : "Failed to load compute control plane.");
  }
}

async function extractError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error || `Request failed with ${response.status}`;
}

function formatTimestamp(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

const copy = {
  zh: {
    panelEyebrow: "Compute Plane",
    panelTitle: "把审批、执行和 artifact 放进可治理的隔离计算控制台",
    panelSummary: (name: string) =>
      `${name} 的 compute lane 应该像真正的控制面：看得见执行额度、审批队列、artifact 和记账，而不是只看到几条日志。`,
    loadingTitle: "Compute Plane",
    loadingHeadline: "正在加载隔离 compute 控制台",
    loadingCopy: "再等一下，加载完成后这里会显示审批队列、session 和 artifact。",
    heroKicker: "Governed compute",
    enabledHeadline: "这个代表已经可以申请隔离 compute session",
    disabledHeadline: "这个代表的 compute 目前仍然关闭",
    heroCopy: (image: string, minutes: number) =>
      `默认镜像是 ${image}，session 上限 ${minutes} 分钟。这里不只是看命令有没有跑，而是看 approval、artifact 和成本是否受控。`,
    enabledChip: "compute on",
    disabledChip: "compute off",
    policyChip: (value: string) => `default: ${value}`,
    signalCards: {
      pendingApprovals: "Pending approvals",
      pendingApprovalsDetail: "还需要 owner 决策的命令请求。",
      liveSessions: "Live sessions",
      liveSessionsDetail: "仍然可以继续执行的会话数。",
      artifacts: "Artifacts",
      artifactsDetail: "已经落入对象存储的输出总数。",
      autoApproveBudget: "Auto-approve budget",
      autoApproveBudgetDetail: "当前代表级预算阈值，后续可用于轻量自动放行。",
    },
    platformCards: {
      policyMode: "Default policy",
      policyModeDetail: "没有命中具体规则时，默认如何处理。",
      networkMode: "Network mode",
      networkModeDetail: "session 默认走什么网络边界。",
      filesystemMode: "Filesystem mode",
      filesystemModeDetail: "容器默认可见的文件系统范围。",
      retention: "Retention",
      retentionDetail: "artifact 默认保留天数。",
    },
    approvalsEyebrow: "Approval Queue",
    approvalsTitle: "先决定哪些请求值得放进 compute plane",
    pendingChip: (count: number) => `${count} pending`,
    sessionLabel: (value: string) => `Session · ${value}`,
    resolvedLabel: (time: string, by: string) => `已在 ${time} 由 ${by} 处理`,
    ownerFallback: "owner",
    approving: "批准中...",
    approve: "批准并继续执行",
    rejecting: "拒绝中...",
    reject: "拒绝",
    noApprovals: "当前没有待处理的审批请求。",
    sessionsEyebrow: "Session Lane",
    sessionsTitle: "看到哪些 session 活着、失败了，最近执行了什么",
    liveChip: (live: number, failed: number) => `${live} live · ${failed} failed`,
    requestedBy: (value: string) => `requested by ${value}`,
    executionCount: (count: number) => `${count} executions`,
    expiresLabel: (value: string) => `expires ${value}`,
    latestExecutionLabel: (status: string, value: string) => `最近执行 ${status} · ${value}`,
    failureReasonLabel: (value: string) => `Failure: ${value}`,
    noSessions: "还没有 compute session。",
    artifactsEyebrow: "Artifact Store",
    artifactsTitle: "确认 stdout / stderr 等结果已经进入对象存储",
    artifactsChip: (count: number) => `${count} artifacts`,
    noArtifacts: "还没有 artifact。",
    messages: {
      approved: "审批已通过，若命令可恢复执行，会继续在 compute plane 中跑完。",
      rejected: "审批已拒绝，相关 execution 已取消。",
      error: "处理审批失败。",
    },
  },
  en: {
    panelEyebrow: "Compute Plane",
    panelTitle: "Run approvals, execution, and artifacts as a governed compute control plane",
    panelSummary: (name: string) =>
      `${name} should expose compute like a real control plane: approvals, sessions, artifacts, and billing signals, not just backend logs.`,
    loadingTitle: "Compute Plane",
    loadingHeadline: "Loading the isolated compute lane",
    loadingCopy: "One moment. This view will show the approval queue, sessions, and artifacts.",
    heroKicker: "Governed compute",
    enabledHeadline: "This representative can request isolated compute sessions",
    disabledHeadline: "This representative still has compute turned off",
    heroCopy: (image: string, minutes: number) =>
      `Default image ${image}, session limit ${minutes} minutes. This lane is about approval, artifacts, and controlled cost, not just whether a command ran.`,
    enabledChip: "compute on",
    disabledChip: "compute off",
    policyChip: (value: string) => `default: ${value}`,
    signalCards: {
      pendingApprovals: "Pending approvals",
      pendingApprovalsDetail: "Requests still waiting for an owner decision.",
      liveSessions: "Live sessions",
      liveSessionsDetail: "Sessions that can still accept work.",
      artifacts: "Artifacts",
      artifactsDetail: "Outputs already persisted into object storage.",
      autoApproveBudget: "Auto-approve budget",
      autoApproveBudgetDetail: "Representative-level budget threshold for future low-risk auto-approval.",
    },
    platformCards: {
      policyMode: "Default policy",
      policyModeDetail: "How unmatched requests are handled by default.",
      networkMode: "Network mode",
      networkModeDetail: "The default network boundary for sessions.",
      filesystemMode: "Filesystem mode",
      filesystemModeDetail: "The default filesystem surface exposed to the container.",
      retention: "Retention",
      retentionDetail: "Default artifact retention window.",
    },
    approvalsEyebrow: "Approval Queue",
    approvalsTitle: "Decide which requests are worth letting into the compute plane",
    pendingChip: (count: number) => `${count} pending`,
    sessionLabel: (value: string) => `Session · ${value}`,
    resolvedLabel: (time: string, by: string) => `Resolved ${time} by ${by}`,
    ownerFallback: "owner",
    approving: "Approving...",
    approve: "Approve and resume",
    rejecting: "Rejecting...",
    reject: "Reject",
    noApprovals: "No approval requests right now.",
    sessionsEyebrow: "Session Lane",
    sessionsTitle: "See which sessions are alive, failed, and what they last executed",
    liveChip: (live: number, failed: number) => `${live} live · ${failed} failed`,
    requestedBy: (value: string) => `requested by ${value}`,
    executionCount: (count: number) => `${count} executions`,
    expiresLabel: (value: string) => `expires ${value}`,
    latestExecutionLabel: (status: string, value: string) => `Latest execution ${status} · ${value}`,
    failureReasonLabel: (value: string) => `Failure: ${value}`,
    noSessions: "No compute sessions yet.",
    artifactsEyebrow: "Artifact Store",
    artifactsTitle: "Confirm stdout, stderr, and other outputs are persisted",
    artifactsChip: (count: number) => `${count} artifacts`,
    noArtifacts: "No artifacts yet.",
    messages: {
      approved: "Approval granted. If the execution could resume, it is now running inside the compute plane.",
      rejected: "Approval rejected. The linked execution has been canceled.",
      error: "Failed to resolve approval.",
    },
  },
} as const;
