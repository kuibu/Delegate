"use client";

import { useEffect, useState, useTransition } from "react";

import {
  DashboardPanelFrame,
  DashboardSignalStrip,
  DashboardSurface,
  DashboardSurfaceGrid,
} from "../ui/control-plane";

type OpenVikingSnapshot = {
  representativeSlug: string;
  enabled: boolean;
  agentId: string;
  agentIdOverride?: string;
  autoRecall: boolean;
  autoCapture: boolean;
  captureMode: "semantic" | "keyword";
  recallLimit: number;
  recallScoreThreshold: number;
  targetUri: string;
  resourceSyncEnabled: boolean;
  lastSyncAt?: string;
  lastSyncStatus: string;
  lastSyncItemCount: number;
  lastSyncError?: string;
  health: {
    status: "healthy" | "degraded" | "disabled";
    detail: string;
    mode: "local" | "remote";
    baseUrl: string;
    consoleUrl?: string;
  };
  recentSyncJobs: Array<{
    id: string;
    status: string;
    itemCount: number;
    error?: string;
    startedAt: string;
    finishedAt?: string;
  }>;
  recentCommitTraces: Array<{
    id: string;
    sessionId: string;
    sessionKey?: string;
    reason: string;
    status: string;
    memoriesExtracted?: number;
    createdAt: string;
    error?: string;
  }>;
};

type RecallTrace = {
  id: string;
  queryText: string;
  recalledUri: string;
  contextType: string;
  layer: string;
  score: number;
  createdAt: string;
};

type MemoryPreview = {
  id: string;
  uri: string;
  scope: string;
  category: string;
  summary: string;
  sourceKind: string;
  createdAt: string;
  contact?: {
    id: string;
    displayName: string;
  };
};

export function DashboardOpenViking({
  representativeSlug,
}: {
  representativeSlug: string;
}) {
  const [snapshot, setSnapshot] = useState<OpenVikingSnapshot | null>(null);
  const [recallTraces, setRecallTraces] = useState<RecallTrace[]>([]);
  const [memories, setMemories] = useState<MemoryPreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void refreshAll(representativeSlug, setSnapshot, setRecallTraces, setMemories, setError);
  }, [representativeSlug]);

  if (!snapshot) {
    return (
      <section className="section">
        <article className="dashboard-highlight-card">
          <p className="panel-title">Loading memory console</p>
          <h3>正在读取 OpenViking 的 sync、recall、commit 和 memory preview。</h3>
          <p>完成后会优先展示健康状态和最近的运行痕迹。</p>
        </article>
      </section>
    );
  }

  function triggerSync(trigger: "manual" | "retry") {
    setBusyKey(trigger);
    setMessage(null);
    setError(null);

    startTransition(() => {
      void (async () => {
        const response = await fetch(
          `/api/dashboard/representatives/${representativeSlug}/openviking/sync`,
          {
            method: "POST",
          },
        );

        if (!response.ok) {
          throw new Error(await extractError(response));
        }

        await refreshAll(representativeSlug, setSnapshot, setRecallTraces, setMemories, setError);
        setMessage(trigger === "retry" ? "Retry sync completed." : "Representative knowledge re-synced.");
      })()
        .catch((nextError: unknown) => {
          setError(
            nextError instanceof Error ? nextError.message : "OpenViking sync failed.",
          );
        })
        .finally(() => {
          setBusyKey(null);
        });
    });
  }

  return (
    <DashboardPanelFrame
      eyebrow="OpenViking Console"
      summary="这里展示 OpenViking 最近的资源同步、recall provenance、session commit 和记忆摘要。"
      title="把 recall / commit / memory preview 变成 owner 可操作的控制面板"
    >
      <div className="dashboard-panel-hero">
        <article className="dashboard-highlight-card dashboard-highlight-card-primary">
          <p className="panel-title">Memory runtime</p>
          <h3>{snapshot.enabled ? "这层记忆已经接到代表工作流里。" : "这层记忆目前处于关闭状态。"}</h3>
          <p>{snapshot.health.detail}</p>
          <div className="chip-row">
            <span className="chip">{snapshot.health.mode}</span>
            <span
              className={
                snapshot.health.status === "healthy"
                  ? "chip chip-safe"
                  : snapshot.health.status === "disabled"
                    ? "chip"
                    : "chip chip-danger"
              }
            >
              {snapshot.health.status}
            </span>
            <span className="chip">{snapshot.lastSyncStatus}</span>
          </div>
        </article>

        <DashboardSignalStrip
          cards={[
            {
              label: "Agent ID",
              value: snapshot.agentIdOverride ?? snapshot.agentId,
              detail: "代表级的 session 和记忆命名空间标识。",
              tone: "accent" as const,
            },
            {
              label: "Recall limit",
              value: `${snapshot.recallLimit}`,
              detail: "默认一次回复可召回的上下文数量上限。",
            },
            {
              label: "Capture mode",
              value: snapshot.captureMode,
              detail: "当前的自动记忆提取模式。",
              tone: snapshot.autoCapture ? ("safe" as const) : "default",
            },
            {
              label: "Synced items",
              value: `${snapshot.lastSyncItemCount}`,
              detail: "最近一次知识同步写入的资源数量。",
            },
          ]}
        />
      </div>

      {message ? <div className="status-banner status-success">{message}</div> : null}
      {error ? <div className="status-banner status-error">{error}</div> : null}

      <div className="dashboard-action-bar">
        <button
          className="button-primary"
          disabled={isPending || busyKey === "manual"}
          onClick={() => triggerSync("manual")}
          type="button"
        >
          {busyKey === "manual" ? "Syncing..." : "Resync public knowledge"}
        </button>
        <button
          className="button-secondary"
          disabled={isPending || busyKey === "retry"}
          onClick={() => triggerSync("retry")}
          type="button"
        >
          {busyKey === "retry" ? "Retrying..." : "Retry failed sync"}
        </button>
        {snapshot.health.consoleUrl ? (
          <a
            className="button-secondary"
            href={snapshot.health.consoleUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open OpenViking Console
          </a>
        ) : null}
      </div>

      <DashboardSignalStrip
        cards={[
          {
            label: "Health",
            value: snapshot.health.status,
            detail: snapshot.health.detail,
            tone:
              snapshot.health.status === "healthy"
                ? ("safe" as const)
                : snapshot.health.status === "degraded"
                  ? ("accent" as const)
                  : "default",
          },
          {
            label: "Auto recall",
            value: snapshot.autoRecall ? "Enabled" : "Off",
            detail: "是否在回复前自动召回代表级上下文。",
          },
          {
            label: "Auto capture",
            value: snapshot.autoCapture ? "Enabled" : "Off",
            detail: "是否在关键会话节点自动提交公开安全记忆。",
          },
          {
            label: "Target URI",
            value: snapshot.targetUri,
            detail: "当前资源同步与召回默认使用的命名空间前缀。",
          },
        ]}
      />

      <DashboardSurfaceGrid columns={2}>
        <DashboardSurface
          eyebrow="Sync"
          meta={<span className="chip">{snapshot.recentSyncJobs.length} jobs</span>}
          title="Recent sync jobs"
        >
          <div className="row-list">
            {snapshot.recentSyncJobs.length ? (
              snapshot.recentSyncJobs.map((job) => (
                <div className="skill-row" key={job.id}>
                  <div>
                    <strong>{job.status}</strong>
                    <p>
                      {job.itemCount} items · started {formatTimestamp(job.startedAt)}
                    </p>
                    <p className="footer-note">
                      {job.finishedAt ? `Finished ${formatTimestamp(job.finishedAt)}` : "Still running"}
                    </p>
                    {job.error ? <p className="footer-note">Error: {job.error}</p> : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">还没有任何 OpenViking sync job。</p>
            )}
          </div>
        </DashboardSurface>

        <DashboardSurface
          eyebrow="Commit"
          meta={<span className="chip">{snapshot.recentCommitTraces.length} traces</span>}
          title="Recent commit traces"
        >
          <div className="row-list">
            {snapshot.recentCommitTraces.length ? (
              snapshot.recentCommitTraces.map((trace) => (
                <div className="skill-row" key={trace.id}>
                  <div>
                    <strong>{trace.reason}</strong>
                    <p>
                      {trace.status} · session {trace.sessionId}
                    </p>
                    <div className="chip-row">
                      <span className="chip">{formatTimestamp(trace.createdAt)}</span>
                      {typeof trace.memoriesExtracted === "number" ? (
                        <span className="chip chip-safe">{trace.memoriesExtracted} memories</span>
                      ) : null}
                    </div>
                    {trace.sessionKey ? (
                      <p className="footer-note">Session key: {trace.sessionKey}</p>
                    ) : null}
                    {trace.error ? <p className="footer-note">Error: {trace.error}</p> : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">还没有任何 OpenViking commit trace。</p>
            )}
          </div>
        </DashboardSurface>

        <DashboardSurface
          eyebrow="Recall"
          meta={<span className="chip">{recallTraces.length} traces</span>}
          title="Recent recall traces"
        >
          <div className="row-list">
            {recallTraces.length ? (
              recallTraces.map((trace) => (
                <div className="skill-row" key={trace.id}>
                  <div>
                    <strong>{trace.queryText}</strong>
                    <p>{trace.recalledUri}</p>
                    <div className="chip-row">
                      <span className="chip">{trace.contextType}</span>
                      <span className="chip">{trace.layer}</span>
                      <span className="chip chip-safe">{trace.score.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">还没有任何 recall provenance 记录。</p>
            )}
          </div>
        </DashboardSurface>

        <DashboardSurface
          eyebrow="Memory preview"
          meta={<span className="chip">{memories.length} memories</span>}
          title="Extracted memory preview"
        >
          <div className="row-list">
            {memories.length ? (
              memories.map((memory) => (
                <div className="skill-row" key={memory.id}>
                  <div>
                    <strong>
                      {memory.contact ? `${memory.contact.displayName} · ` : ""}
                      {memory.category}
                    </strong>
                    <p>{memory.summary}</p>
                    <div className="chip-row">
                      <span className="chip">{memory.scope}</span>
                      <span className="chip">{memory.sourceKind}</span>
                      <span className="chip">{formatTimestamp(memory.createdAt)}</span>
                    </div>
                    <p className="footer-note">{memory.uri}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">还没有任何可展示的公开安全记忆摘要。</p>
            )}
          </div>
        </DashboardSurface>
      </DashboardSurfaceGrid>
    </DashboardPanelFrame>
  );
}

async function refreshAll(
  representativeSlug: string,
  setSnapshot: (value: OpenVikingSnapshot) => void,
  setRecallTraces: (value: RecallTrace[]) => void,
  setMemories: (value: MemoryPreview[]) => void,
  setError: (value: string | null) => void,
) {
  const [snapshotResponse, tracesResponse, memoriesResponse] = await Promise.all([
    fetch(`/api/dashboard/representatives/${representativeSlug}/openviking`, {
      cache: "no-store",
    }),
    fetch(`/api/dashboard/representatives/${representativeSlug}/openviking/recall-traces`, {
      cache: "no-store",
    }),
    fetch(`/api/dashboard/representatives/${representativeSlug}/openviking/memories`, {
      cache: "no-store",
    }),
  ]);

  if (!snapshotResponse.ok) {
    setError(await extractError(snapshotResponse));
    return;
  }

  if (!tracesResponse.ok) {
    setError(await extractError(tracesResponse));
    return;
  }

  if (!memoriesResponse.ok) {
    setError(await extractError(memoriesResponse));
    return;
  }

  const snapshot = (await snapshotResponse.json()) as OpenVikingSnapshot;
  const tracesPayload = (await tracesResponse.json()) as { traces: RecallTrace[] };
  const memoriesPayload = (await memoriesResponse.json()) as { memories: MemoryPreview[] };

  setSnapshot(snapshot);
  setRecallTraces(tracesPayload.traces);
  setMemories(memoriesPayload.memories);
  setError(null);
}

async function extractError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}
