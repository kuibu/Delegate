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
    networkAllowlist: string[];
    filesystemMode: "workspace_only" | "read_only_workspace" | "ephemeral_full";
    wallet: {
      balanceCredits: number;
      sponsorPoolCredit: number;
      starsBalance: number;
    };
    managedProfiles: Array<{
      id: string;
      name: string;
      managedSource?: string;
      precedence: number;
      ruleCount: number;
      highlights: string[];
    }>;
    mcpBindings: Array<{
      id: string;
      representativeId: string;
      representativeSkillPackLinkId?: string | null;
      slug: string;
      displayName: string;
      description?: string | null;
      serverUrl: string;
      transportKind: "streamable_http";
      allowedToolNames: string[];
      defaultToolName?: string | null;
      enabled: boolean;
      approvalRequired: boolean;
      createdAt: string;
      updatedAt: string;
      sourceSkillPack?: string;
    }>;
  };
  sessions: Array<{
    id: string;
    status: string;
    leaseStatus: string;
    requestedBy: string;
    baseImage: string;
    runnerLeaseId?: string;
    containerId?: string;
    createdAt: string;
    leaseAcquiredAt?: string;
    leaseLastUsedAt?: string;
    leaseReleasedAt?: string;
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
  ledger: Array<{
    id: string;
    kind: string;
    creditDelta: number;
    costCents: number;
    quantity: number;
    unit: string;
    createdAt: string;
    notes?: string;
    sessionId?: string;
    toolExecutionId?: string;
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
    retentionUntil?: string;
    sessionId?: string;
    toolExecutionId?: string;
  }>;
};

type ComputeArtifactDetail = {
  artifact: {
    id: string;
    kind: string;
    bucket: string;
    objectKey: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    retentionUntil?: string | null;
    summary?: string | null;
    createdAt: string;
    sessionId?: string | null;
    toolExecutionId?: string | null;
  };
  contentText: string | null;
  truncated: boolean;
};

type McpBindingFormState = {
  bindingId: string | null;
  slug: string;
  displayName: string;
  description: string;
  serverUrl: string;
  allowedToolNames: string;
  defaultToolName: string;
  enabled: boolean;
  approvalRequired: boolean;
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
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [artifactDetail, setArtifactDetail] = useState<ComputeArtifactDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mcpForm, setMcpForm] = useState<McpBindingFormState>(() => createEmptyMcpBindingForm());

  useEffect(() => {
    void refreshCompute(representativeSlug, setSnapshot, setApprovals, setArtifacts, setError);
  }, [representativeSlug]);

  useEffect(() => {
    setMcpForm(createEmptyMcpBindingForm());
  }, [representativeSlug]);

  useEffect(() => {
    if (!artifacts.length) {
      setSelectedArtifactId(null);
      setArtifactDetail(null);
      return;
    }

    if (!selectedArtifactId || !artifacts.some((artifact) => artifact.id === selectedArtifactId)) {
      setSelectedArtifactId(artifacts[0]!.id);
    }
  }, [artifacts, selectedArtifactId]);

  useEffect(() => {
    if (!selectedArtifactId) {
      setArtifactDetail(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const response = await fetch(
        `/api/dashboard/representatives/${representativeSlug}/compute/artifacts/${selectedArtifactId}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        throw new Error(await extractError(response));
      }
      const payload = (await response.json()) as ComputeArtifactDetail;
      if (!cancelled) {
        setArtifactDetail(payload);
      }
    })().catch((nextError: unknown) => {
      if (!cancelled) {
        setError(nextError instanceof Error ? nextError.message : t.messages.error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [representativeSlug, selectedArtifactId, t.messages.error]);

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
        {
          label: t.signalCards.walletCredits,
          value: `${snapshot.representative.wallet.balanceCredits}`,
          detail: t.signalCards.walletCreditsDetail,
        },
        {
          label: t.signalCards.sponsorPool,
          value: `${snapshot.representative.wallet.sponsorPoolCredit}`,
          detail: t.signalCards.sponsorPoolDetail,
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
        detail:
          snapshot.representative.networkMode === "allowlist"
            ? t.platformCards.networkAllowlistDetail(snapshot.representative.networkAllowlist)
            : t.platformCards.networkModeDetail,
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

  async function handleSaveMcpBinding() {
    if (!snapshot) {
      return;
    }

    const allowedToolNames = mcpForm.allowedToolNames
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    setBusyKey(mcpForm.bindingId ? `mcp:update:${mcpForm.bindingId}` : "mcp:create");
    setMessage(null);
    setError(null);

    startTransition(() => {
      void (async () => {
        const pathname = mcpForm.bindingId
          ? `/api/dashboard/representatives/${representativeSlug}/compute/mcp/${mcpForm.bindingId}`
          : `/api/dashboard/representatives/${representativeSlug}/compute/mcp`;
        const response = await fetch(pathname, {
          method: mcpForm.bindingId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            slug: mcpForm.slug,
            displayName: mcpForm.displayName,
            description: mcpForm.description,
            serverUrl: mcpForm.serverUrl,
            transportKind: "streamable_http",
            allowedToolNames,
            defaultToolName: mcpForm.defaultToolName,
            enabled: mcpForm.enabled,
            approvalRequired: mcpForm.approvalRequired,
          }),
        });

        if (!response.ok) {
          throw new Error(await extractError(response));
        }

        await refreshCompute(representativeSlug, setSnapshot, setApprovals, setArtifacts, setError);
        setMcpForm(createEmptyMcpBindingForm());
        setMessage(
          mcpForm.bindingId ? t.messages.mcpUpdated : t.messages.mcpCreated,
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

  function startEditMcpBinding(binding: ComputeSnapshot["representative"]["mcpBindings"][number]) {
    setMcpForm({
      bindingId: binding.id,
      slug: binding.slug,
      displayName: binding.displayName,
      description: binding.description ?? "",
      serverUrl: binding.serverUrl,
      allowedToolNames: binding.allowedToolNames.join(", "),
      defaultToolName: binding.defaultToolName ?? "",
      enabled: binding.enabled,
      approvalRequired: binding.approvalRequired,
    });
    setMessage(null);
    setError(null);
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
          eyebrow={t.managedPoliciesEyebrow}
          meta={<span className="chip">{t.managedPoliciesChip(snapshot.representative.managedProfiles.length)}</span>}
          title={t.managedPoliciesTitle}
        >
          <div className="row-list">
            {snapshot.representative.managedProfiles.length ? (
              snapshot.representative.managedProfiles.map((profile) => (
                <div className="skill-row" key={profile.id}>
                  <div>
                    <strong>{profile.name}</strong>
                    <p>
                      {t.managedPolicyMeta(profile.precedence, profile.ruleCount)}
                    </p>
                    <div className="chip-row">
                      {profile.managedSource ? <span className="chip">{profile.managedSource}</span> : null}
                      {profile.highlights.map((highlight) => (
                        <span className="chip" key={highlight}>{highlight}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">{t.noManagedPolicies}</p>
            )}
          </div>
        </DashboardSurface>

        <DashboardSurface
          eyebrow={t.mcpEyebrow}
          meta={<span className="chip">{t.mcpChip(snapshot.representative.mcpBindings.length)}</span>}
          title={t.mcpTitle}
        >
          <div className="row-list">
            {snapshot.representative.mcpBindings.length ? (
              snapshot.representative.mcpBindings.map((binding) => (
                <div className="skill-row" key={binding.id}>
                  <div>
                    <strong>{binding.displayName}</strong>
                    <p>{binding.serverUrl}</p>
                    <div className="chip-row">
                      <span className={binding.enabled ? "chip chip-safe" : "chip"}>
                        {binding.enabled ? t.enabledChip : t.disabledChip}
                      </span>
                      <span className="chip">{binding.transportKind}</span>
                      <span className="chip">{binding.slug}</span>
                      {binding.defaultToolName ? <span className="chip">{binding.defaultToolName}</span> : null}
                      {binding.sourceSkillPack ? <span className="chip">{binding.sourceSkillPack}</span> : null}
                    </div>
                    {binding.description ? <p className="footer-note">{binding.description}</p> : null}
                    <p className="footer-note">
                      {t.allowedTools(binding.allowedToolNames.join(", "))}
                    </p>
                    <p className="footer-note">
                      {binding.approvalRequired ? t.mcpRequiresApproval : t.mcpNoApproval}
                    </p>
                  </div>

                  <div className="button-row">
                    <button
                      className="button-secondary"
                      onClick={() => startEditMcpBinding(binding)}
                      type="button"
                    >
                      {t.editBinding}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">{t.noMcpBindings}</p>
            )}

            <div className="skill-row">
              <div className="dashboard-form-grid">
                <label className="field-label">
                  <span>{t.mcpFields.slug}</span>
                  <input
                    className="field-input"
                    onChange={(event) =>
                      setMcpForm((current) => ({ ...current, slug: event.target.value }))
                    }
                    placeholder="weather"
                    type="text"
                    value={mcpForm.slug}
                  />
                </label>
                <label className="field-label">
                  <span>{t.mcpFields.displayName}</span>
                  <input
                    className="field-input"
                    onChange={(event) =>
                      setMcpForm((current) => ({ ...current, displayName: event.target.value }))
                    }
                    placeholder="Weather MCP"
                    type="text"
                    value={mcpForm.displayName}
                  />
                </label>
                <label className="field-label">
                  <span>{t.mcpFields.serverUrl}</span>
                  <input
                    className="field-input"
                    onChange={(event) =>
                      setMcpForm((current) => ({ ...current, serverUrl: event.target.value }))
                    }
                    placeholder="http://host.docker.internal:8787/mcp"
                    type="url"
                    value={mcpForm.serverUrl}
                  />
                </label>
                <label className="field-label">
                  <span>{t.mcpFields.allowedTools}</span>
                  <input
                    className="field-input"
                    onChange={(event) =>
                      setMcpForm((current) => ({
                        ...current,
                        allowedToolNames: event.target.value,
                      }))
                    }
                    placeholder="lookup, forecast"
                    type="text"
                    value={mcpForm.allowedToolNames}
                  />
                </label>
                <label className="field-label">
                  <span>{t.mcpFields.defaultTool}</span>
                  <input
                    className="field-input"
                    onChange={(event) =>
                      setMcpForm((current) => ({
                        ...current,
                        defaultToolName: event.target.value,
                      }))
                    }
                    placeholder="lookup"
                    type="text"
                    value={mcpForm.defaultToolName}
                  />
                </label>
                <label className="field-label field-label-wide">
                  <span>{t.mcpFields.description}</span>
                  <textarea
                    className="field-textarea"
                    onChange={(event) =>
                      setMcpForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder={t.mcpDescriptionPlaceholder}
                    rows={3}
                    value={mcpForm.description}
                  />
                </label>
              </div>
              <div className="chip-row">
                <label className="field-toggle">
                  <input
                    checked={mcpForm.enabled}
                    onChange={(event) =>
                      setMcpForm((current) => ({ ...current, enabled: event.target.checked }))
                    }
                    type="checkbox"
                  />
                  <span>{t.mcpFields.enabled}</span>
                </label>
                <label className="field-toggle">
                  <input
                    checked={mcpForm.approvalRequired}
                    onChange={(event) =>
                      setMcpForm((current) => ({
                        ...current,
                        approvalRequired: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  <span>{t.mcpFields.approvalRequired}</span>
                </label>
              </div>
              <div className="button-row">
                <button
                  className="button-primary"
                  disabled={isPending || Boolean(busyKey?.startsWith("mcp:"))}
                  onClick={() => void handleSaveMcpBinding()}
                  type="button"
                >
                  {busyKey?.startsWith("mcp:")
                    ? t.savingBinding
                    : mcpForm.bindingId
                      ? t.updateBinding
                      : t.createBinding}
                </button>
                {mcpForm.bindingId ? (
                  <button
                    className="button-secondary"
                    onClick={() => setMcpForm(createEmptyMcpBindingForm())}
                    type="button"
                  >
                    {t.cancelBindingEdit}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </DashboardSurface>

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
                      {session.status} · lease {session.leaseStatus} · {t.requestedBy(session.requestedBy)}
                    </p>
                    <div className="chip-row">
                      <span className="chip">{formatTimestamp(session.createdAt, locale)}</span>
                      <span className="chip">{t.executionCount(session.executionCount)}</span>
                      {session.leaseAcquiredAt ? (
                        <span className="chip">lease {formatTimestamp(session.leaseAcquiredAt, locale)}</span>
                      ) : null}
                      {session.expiresAt ? (
                        <span className="chip chip-safe">
                          {t.expiresLabel(formatTimestamp(session.expiresAt, locale))}
                        </span>
                      ) : null}
                      {session.runnerLeaseId ? <span className="chip">{session.runnerLeaseId}</span> : null}
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
                <button
                  className={
                    selectedArtifactId === artifact.id ? "skill-row skill-row-active" : "skill-row"
                  }
                  key={artifact.id}
                  onClick={() => setSelectedArtifactId(artifact.id)}
                  type="button"
                >
                  <div>
                    <strong>{artifact.kind}</strong>
                    <p>{artifact.objectKey}</p>
                    <div className="chip-row">
                      <span className="chip">{artifact.mimeType}</span>
                      <span className="chip">{formatBytes(artifact.sizeBytes)}</span>
                      <span className="chip">{formatTimestamp(artifact.createdAt, locale)}</span>
                      {artifact.retentionUntil ? (
                        <span className="chip">
                          {t.retentionChip(formatTimestamp(artifact.retentionUntil, locale))}
                        </span>
                      ) : null}
                    </div>
                    {artifact.summary ? (
                      <p className="footer-note">{artifact.summary}</p>
                    ) : null}
                    {artifact.sessionId ? (
                      <p className="footer-note">{t.sessionLabel(artifact.sessionId)}</p>
                    ) : null}
                  </div>
                </button>
              ))
            ) : (
              <p className="muted">{t.noArtifacts}</p>
            )}
          </div>
        </DashboardSurface>

        <DashboardSurface
          eyebrow={t.artifactDetailEyebrow}
          meta={
            selectedArtifactId ? <span className="chip">{selectedArtifactId.slice(0, 10)}</span> : undefined
          }
          title={t.artifactDetailTitle}
        >
          {artifactDetail ? (
            <div className="row-list">
              <div className="skill-row">
                <div>
                  <strong>{artifactDetail.artifact.kind}</strong>
                  <p>{artifactDetail.artifact.objectKey}</p>
                  <div className="chip-row">
                    <span className="chip">{artifactDetail.artifact.mimeType}</span>
                    <span className="chip">{formatBytes(artifactDetail.artifact.sizeBytes)}</span>
                    <span className="chip">{artifactDetail.artifact.sha256.slice(0, 12)}</span>
                  </div>
                </div>
              </div>
              {artifactDetail.contentText ? (
                <pre className="artifact-preview">{artifactDetail.contentText}</pre>
              ) : (
                <p className="muted">{t.noArtifactPreview}</p>
              )}
              <div className="button-row">
                <a
                  className="button-secondary"
                  href={`/api/dashboard/representatives/${representativeSlug}/compute/artifacts/${artifactDetail.artifact.id}/download`}
                >
                  {t.downloadArtifact}
                </a>
                {artifactDetail.truncated ? <span className="chip">{t.previewTruncated}</span> : null}
              </div>
            </div>
          ) : (
            <p className="muted">{t.noArtifactSelected}</p>
          )}
        </DashboardSurface>

        <DashboardSurface
          eyebrow={t.ledgerEyebrow}
          meta={<span className="chip">{t.ledgerChip(snapshot.ledger.length)}</span>}
          title={t.ledgerTitle}
        >
          <div className="row-list">
            {snapshot.ledger.length ? (
              snapshot.ledger.map((entry) => (
                <div className="skill-row" key={entry.id}>
                  <div>
                    <strong>{entry.kind}</strong>
                    <p>
                      {entry.creditDelta} credits · ${ (entry.costCents / 100).toFixed(2) }
                    </p>
                    <div className="chip-row">
                      <span className="chip">{entry.quantity} {entry.unit}</span>
                      <span className="chip">{formatTimestamp(entry.createdAt, locale)}</span>
                      {entry.sessionId ? <span className="chip">{entry.sessionId.slice(0, 8)}</span> : null}
                    </div>
                    {entry.notes ? <p className="footer-note">{entry.notes}</p> : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">{t.noLedger}</p>
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

function createEmptyMcpBindingForm(): McpBindingFormState {
  return {
    bindingId: null,
    slug: "",
    displayName: "",
    description: "",
    serverUrl: "",
    allowedToolNames: "",
    defaultToolName: "",
    enabled: true,
    approvalRequired: true,
  };
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
      walletCredits: "Wallet credits",
      walletCreditsDetail: "Owner wallet 里还能直接支付 compute 的 credits。",
      sponsorPool: "Sponsor pool",
      sponsorPoolDetail: "可以给陌生人或免费流量兜底的公共 compute 额度。",
    },
    platformCards: {
      policyMode: "Default policy",
      policyModeDetail: "没有命中具体规则时，默认如何处理。",
      networkMode: "Network mode",
      networkModeDetail: "session 默认走什么网络边界。",
      networkAllowlistDetail: (value: string[]) =>
        value.length ? `Allowlist · ${value.join(", ")}` : "Allowlist 还没有配置任何域名。",
      filesystemMode: "Filesystem mode",
      filesystemModeDetail: "容器默认可见的文件系统范围。",
      retention: "Retention",
      retentionDetail: "artifact 默认保留天数。",
    },
    managedPoliciesEyebrow: "Managed Guardrails",
    managedPoliciesTitle: "Delegate-managed overlays that take precedence over owner defaults",
    managedPoliciesChip: (count: number) => `${count} overlays`,
    managedPolicyMeta: (precedence: number, rules: number) => `precedence ${precedence} · ${rules} rules`,
    noManagedPolicies: "No managed overlays loaded yet.",
    mcpEyebrow: "MCP Bindings",
    mcpTitle: "把远程 capability server 绑定成可审批、可追踪的代表能力",
    mcpChip: (count: number) => `${count} bindings`,
    noMcpBindings: "还没有 MCP binding。先把一个远程 capability server 绑进来，再让代表通过审批后的 compute 请求去调用它。",
    allowedTools: (value: string) => `Allowed tools · ${value}`,
    mcpRequiresApproval: "This binding still requires explicit approval before remote tool calls.",
    mcpNoApproval: "This binding can run without an extra binding-level approval flag.",
    editBinding: "编辑 binding",
    createBinding: "创建 binding",
    updateBinding: "更新 binding",
    cancelBindingEdit: "取消编辑",
    savingBinding: "保存中...",
    mcpFields: {
      slug: "Binding slug",
      displayName: "Display name",
      serverUrl: "Server URL",
      allowedTools: "Allowed tools",
      defaultTool: "Default tool",
      description: "Description",
      enabled: "Enabled",
      approvalRequired: "Requires approval",
    },
    mcpDescriptionPlaceholder: "告诉 owner 这个 remote MCP server 是干什么的，以及适合哪些任务。",
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
    artifactDetailEyebrow: "Artifact Detail",
    artifactDetailTitle: "直接查看 artifact 内容，而不是只看 object key",
    retentionChip: (value: string) => `retains until ${value}`,
    noArtifactSelected: "先从左侧 artifact 列表里选择一个输出。",
    noArtifactPreview: "这个 artifact 当前没有可直接内联展示的文本预览。",
    downloadArtifact: "下载 artifact",
    previewTruncated: "预览已截断",
    ledgerEyebrow: "Billing Ledger",
    ledgerTitle: "看清每次执行到底烧掉了多少 credits",
    ledgerChip: (count: number) => `${count} entries`,
    noLedger: "还没有 ledger 记录。",
    noArtifacts: "还没有 artifact。",
    messages: {
      approved: "审批已通过，若命令可恢复执行，会继续在 compute plane 中跑完。",
      rejected: "审批已拒绝，相关 execution 已取消。",
      mcpCreated: "新的 MCP binding 已保存。现在这个代表可以把远程 capability server 当成受控能力来调用。",
      mcpUpdated: "MCP binding 已更新。",
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
      walletCredits: "Wallet credits",
      walletCreditsDetail: "Credits available in the owner wallet for direct compute spend.",
      sponsorPool: "Sponsor pool",
      sponsorPoolDetail: "Shared credits that can subsidize public or free-flow compute.",
    },
    platformCards: {
      policyMode: "Default policy",
      policyModeDetail: "How unmatched requests are handled by default.",
      networkMode: "Network mode",
      networkModeDetail: "The default network boundary for sessions.",
      networkAllowlistDetail: (value: string[]) =>
        value.length ? `Allowlist · ${value.join(", ")}` : "No hostnames configured for allowlist mode yet.",
      filesystemMode: "Filesystem mode",
      filesystemModeDetail: "The default filesystem surface exposed to the container.",
      retention: "Retention",
      retentionDetail: "Default artifact retention window.",
    },
    managedPoliciesEyebrow: "托管护栏",
    managedPoliciesTitle: "优先于 owner 默认策略的 Delegate 托管 overlay",
    managedPoliciesChip: (count: number) => `${count} 个 overlay`,
    managedPolicyMeta: (precedence: number, rules: number) => `优先级 ${precedence} · ${rules} 条规则`,
    noManagedPolicies: "当前还没有托管 overlay。",
    mcpEyebrow: "MCP Bindings",
    mcpTitle: "Bind remote capability servers as governed representative tools",
    mcpChip: (count: number) => `${count} bindings`,
    noMcpBindings: "No MCP bindings yet. Attach a remote capability server here before routing approved work into it.",
    allowedTools: (value: string) => `Allowed tools · ${value}`,
    mcpRequiresApproval: "This binding still requires explicit approval before remote tool calls.",
    mcpNoApproval: "This binding can run without an extra binding-level approval flag.",
    editBinding: "Edit binding",
    createBinding: "Create binding",
    updateBinding: "Update binding",
    cancelBindingEdit: "Cancel edit",
    savingBinding: "Saving...",
    mcpFields: {
      slug: "Binding slug",
      displayName: "Display name",
      serverUrl: "Server URL",
      allowedTools: "Allowed tools",
      defaultTool: "Default tool",
      description: "Description",
      enabled: "Enabled",
      approvalRequired: "Requires approval",
    },
    mcpDescriptionPlaceholder: "Tell the owner what this remote MCP server does and when this representative should use it.",
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
    artifactDetailEyebrow: "Artifact Detail",
    artifactDetailTitle: "Inspect artifact content directly instead of just reading the object key",
    retentionChip: (value: string) => `retains until ${value}`,
    noArtifactSelected: "Select an artifact from the list to inspect it here.",
    noArtifactPreview: "This artifact does not currently have an inline text preview.",
    downloadArtifact: "Download artifact",
    previewTruncated: "Preview truncated",
    ledgerEyebrow: "Billing Ledger",
    ledgerTitle: "See how many credits each execution actually burned",
    ledgerChip: (count: number) => `${count} entries`,
    noLedger: "No ledger activity yet.",
    noArtifacts: "No artifacts yet.",
    messages: {
      approved: "Approval granted. If the execution could resume, it is now running inside the compute plane.",
      rejected: "Approval rejected. The linked execution has been canceled.",
      mcpCreated: "A new MCP binding has been saved.",
      mcpUpdated: "The MCP binding has been updated.",
      error: "Failed to resolve approval.",
    },
  },
} as const;
