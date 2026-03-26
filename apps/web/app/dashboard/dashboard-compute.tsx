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
    delegateManagedProfiles: Array<{
      id: string;
      name: string;
      managedSource?: string;
      precedence: number;
      ruleCount: number;
      highlights: string[];
    }>;
    ownerManagedOverlays: {
      baseline: {
        enabled: boolean;
        browserDecision: "allow" | "ask" | "deny";
        browserRequiresApproval: boolean;
        mcpDecision: "allow" | "ask" | "deny";
        mcpRequiresApproval: boolean;
        requiredPlanTier: "pass" | "deep_help";
      };
      trustedCustomer: {
        enabled: boolean;
        trustTier: "standard" | "verified" | "vip" | "restricted";
        browserDecision: "allow" | "ask" | "deny";
        browserRequiresApproval: boolean;
        mcpDecision: "allow" | "ask" | "deny";
        mcpRequiresApproval: boolean;
        requiredPlanTier: "pass" | "deep_help";
      };
    };
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
    estimatedCostCentsPerCall: number;
    createdAt: string;
      updatedAt: string;
      sourceSkillPack?: string;
    }>;
  };
  nativeComputerUse: {
    state: "ready" | "no_browser_session" | "missing_screenshot" | "no_ready_providers";
    sessionId: string | null;
    browserSessionId: string | null;
    browserTransportKind?: "playwright" | "openai_computer" | "claude_computer_use" | null;
    preferredProvider?: "openai" | "anthropic" | null;
    targetTransportKind?: "playwright" | "openai_computer" | "claude_computer_use" | null;
    currentUrl?: string | null;
    currentTitle?: string | null;
    latestNavigationId?: string | null;
    latestNavigationAt?: string | null;
    latestRequestedUrl?: string | null;
    latestFinalUrl?: string | null;
    latestTextSnippet?: string | null;
    latestScreenshotArtifactId?: string | null;
    latestJsonArtifactId?: string | null;
    requiresApprovalForMutations: boolean;
    supportsSessionReuse: boolean;
    providerReadiness: Array<{
      provider: "openai" | "anthropic";
      status: "ready" | "disabled" | "missing_credentials" | "missing_model";
      enabled: boolean;
      model?: string | null;
      transportKind: "playwright" | "openai_computer" | "claude_computer_use";
      reason?: string | null;
    }>;
    nextStep: string;
  };
  browserSessions: Array<{
    id: string;
    computeSessionId: string;
    status: "active" | "failed" | "closed";
    transportKind: "playwright" | "openai_computer" | "claude_computer_use";
    profilePath?: string;
    currentUrl?: string;
    currentTitle?: string;
    lastToolExecutionId?: string;
    lastNavigationAt?: string;
    closedAt?: string;
    failureReason?: string;
    createdAt: string;
    updatedAt: string;
    visitCount: number;
    latestNavigation?: {
      id: string;
      toolExecutionId: string;
      status: "succeeded" | "failed";
      transportKind: "playwright" | "openai_computer" | "claude_computer_use";
      requestedUrl: string;
      finalUrl?: string;
      pageTitle?: string;
      textSnippet?: string;
      screenshotArtifactId?: string;
      jsonArtifactId?: string;
      errorMessage?: string;
      createdAt: string;
    };
  }>;
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
    subagentId?: string;
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
    isPinned: boolean;
    pinnedAt?: string;
    pinnedBy?: string;
    downloadCount: number;
    lastDownloadedAt?: string;
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
    isPinned: boolean;
    pinnedAt?: string | null;
    pinnedBy?: string | null;
    downloadCount: number;
    lastDownloadedAt?: string | null;
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
  estimatedCostCentsPerCall: number;
};

type NativeComputerFormState = {
  task: string;
  provider: "auto" | "openai" | "anthropic";
  maxSteps: number;
  allowMutations: boolean;
};

type OverlayFormState = ComputeSnapshot["representative"]["ownerManagedOverlays"];

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
  const [overlayForm, setOverlayForm] = useState<OverlayFormState>(createEmptyOverlayForm);
  const [nativeForm, setNativeForm] = useState<NativeComputerFormState>({
    task: "",
    provider: "auto",
    maxSteps: 3,
    allowMutations: false,
  });

  useEffect(() => {
    void refreshCompute(representativeSlug, setSnapshot, setApprovals, setArtifacts, setError);
  }, [representativeSlug]);

  useEffect(() => {
    setMcpForm(createEmptyMcpBindingForm());
  }, [representativeSlug]);

  useEffect(() => {
    if (snapshot) {
      setOverlayForm(snapshot.representative.ownerManagedOverlays);
    }
  }, [snapshot]);

  useEffect(() => {
    setNativeForm({
      task: "",
      provider: "auto",
      maxSteps: 3,
      allowMutations: false,
    });
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
  const activeBrowserSessions = snapshot
    ? snapshot.browserSessions.filter((session) => session.status === "active").length
    : 0;
  const readyNativeProviders = snapshot
    ? snapshot.nativeComputerUse.providerReadiness.filter((provider) => provider.status === "ready")
        .length
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
          label: t.signalCards.browserSessions,
          value: `${activeBrowserSessions}`,
          detail: t.signalCards.browserSessionsDetail,
          tone: activeBrowserSessions > 0 ? ("safe" as const) : ("default" as const),
        },
        {
          label: t.signalCards.nativeProviders,
          value: `${readyNativeProviders}`,
          detail: t.signalCards.nativeProvidersDetail(snapshot.nativeComputerUse.state),
          tone:
            readyNativeProviders > 0 && snapshot.nativeComputerUse.state === "ready"
              ? ("safe" as const)
              : ("default" as const),
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

  async function handleRunNativeComputerUse() {
    if (!snapshot?.nativeComputerUse.sessionId) {
      setError(t.messages.nativeMissingSession);
      return;
    }

    if (!nativeForm.task.trim()) {
      setError(t.messages.nativeTaskRequired);
      return;
    }

    setBusyKey("native:execute");
    setMessage(null);
    setError(null);

    startTransition(() => {
      void (async () => {
        const response = await fetch(
          `/api/dashboard/representatives/${representativeSlug}/compute/native`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionId: snapshot.nativeComputerUse.sessionId,
              task: nativeForm.task.trim(),
              ...(nativeForm.provider !== "auto" ? { provider: nativeForm.provider } : {}),
              maxSteps: nativeForm.maxSteps,
              allowMutations: nativeForm.allowMutations,
            }),
          },
        );

        if (!response.ok) {
          throw new Error(await extractError(response));
        }

        const payload = (await response.json()) as {
          nativeComputerUse?: {
            traceArtifactId?: string | null;
            finalText?: string | null;
          };
        };

        await refreshCompute(representativeSlug, setSnapshot, setApprovals, setArtifacts, setError);
        if (payload.nativeComputerUse?.traceArtifactId) {
          setSelectedArtifactId(payload.nativeComputerUse.traceArtifactId);
        }
        setMessage(
          payload.nativeComputerUse?.finalText?.trim()
            ? t.messages.nativeCompleted(payload.nativeComputerUse.finalText.trim())
            : t.messages.nativeExecuted,
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
              estimatedCostCentsPerCall: mcpForm.estimatedCostCentsPerCall,
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

  async function handleSavePolicyOverlays() {
    setBusyKey("policy-overlays:save");
    setMessage(null);
    setError(null);

    startTransition(() => {
      void (async () => {
        const response = await fetch(
          `/api/dashboard/representatives/${representativeSlug}/compute/policy-overlays`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(overlayForm),
          },
        );

        if (!response.ok) {
          throw new Error(await extractError(response));
        }

        await refreshCompute(representativeSlug, setSnapshot, setApprovals, setArtifacts, setError);
        setMessage(t.messages.policyOverlaysSaved);
      })()
        .catch((nextError: unknown) => {
          setError(nextError instanceof Error ? nextError.message : t.messages.error);
        })
        .finally(() => {
          setBusyKey(null);
        });
    });
  }

  async function handleToggleArtifactPin(artifactId: string, pinned: boolean) {
    setBusyKey(`artifact:${artifactId}:${pinned ? "pin" : "unpin"}`);
    setMessage(null);
    setError(null);

    startTransition(() => {
      void (async () => {
        const response = await fetch(
          `/api/dashboard/representatives/${representativeSlug}/compute/artifacts/${artifactId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              pinned,
              pinnedBy: "owner-dashboard",
            }),
          },
        );

        if (!response.ok) {
          throw new Error(await extractError(response));
        }

        await refreshCompute(representativeSlug, setSnapshot, setApprovals, setArtifacts, setError);
        setMessage(pinned ? t.messages.artifactPinned : t.messages.artifactUnpinned);
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
      estimatedCostCentsPerCall: binding.estimatedCostCentsPerCall,
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
          meta={
            <span className="chip">
              {t.managedPoliciesChip(snapshot.representative.delegateManagedProfiles.length)}
            </span>
          }
          title={t.managedPoliciesTitle}
        >
          <div className="row-list">
            {snapshot.representative.delegateManagedProfiles.length ? (
              snapshot.representative.delegateManagedProfiles.map((profile) => (
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
          eyebrow={t.ownerManagedEyebrow}
          meta={<span className="chip">{t.ownerManagedChip}</span>}
          title={t.ownerManagedTitle}
        >
          <div className="row-list">
            <div className="skill-row">
              <div>
                <strong>{t.ownerBaselineTitle}</strong>
                <p className="footer-note">{t.ownerBaselineSummary}</p>
              </div>
              <div className="dashboard-form-grid">
                <label className="field-label">
                  <span>{t.overlayFields.browserDecision}</span>
                  <select
                    className="field-input"
                    onChange={(event) =>
                      setOverlayForm((current) => ({
                        ...current,
                        baseline: {
                          ...current.baseline,
                          browserDecision: event.target.value as "allow" | "ask" | "deny",
                        },
                      }))
                    }
                    value={overlayForm.baseline.browserDecision}
                  >
                    <option value="deny">{t.overlayDecisions.deny}</option>
                    <option value="ask">{t.overlayDecisions.ask}</option>
                    <option value="allow">{t.overlayDecisions.allow}</option>
                  </select>
                </label>
                <label className="field-label">
                  <span>{t.overlayFields.mcpDecision}</span>
                  <select
                    className="field-input"
                    onChange={(event) =>
                      setOverlayForm((current) => ({
                        ...current,
                        baseline: {
                          ...current.baseline,
                          mcpDecision: event.target.value as "allow" | "ask" | "deny",
                        },
                      }))
                    }
                    value={overlayForm.baseline.mcpDecision}
                  >
                    <option value="deny">{t.overlayDecisions.deny}</option>
                    <option value="ask">{t.overlayDecisions.ask}</option>
                    <option value="allow">{t.overlayDecisions.allow}</option>
                  </select>
                </label>
                <label className="field-label">
                  <span>{t.overlayFields.requiredPlanTier}</span>
                  <select
                    className="field-input"
                    onChange={(event) =>
                      setOverlayForm((current) => ({
                        ...current,
                        baseline: {
                          ...current.baseline,
                          requiredPlanTier: event.target.value as "pass" | "deep_help",
                        },
                      }))
                    }
                    value={overlayForm.baseline.requiredPlanTier}
                  >
                    <option value="pass">Pass</option>
                    <option value="deep_help">Deep Help</option>
                  </select>
                </label>
              </div>
              <div className="chip-row">
                <label className="field-toggle">
                  <input
                    checked={overlayForm.baseline.enabled}
                    onChange={(event) =>
                      setOverlayForm((current) => ({
                        ...current,
                        baseline: { ...current.baseline, enabled: event.target.checked },
                      }))
                    }
                    type="checkbox"
                  />
                  <span>{t.overlayFields.enabled}</span>
                </label>
                <label className="field-toggle">
                  <input
                    checked={overlayForm.baseline.browserRequiresApproval}
                    onChange={(event) =>
                      setOverlayForm((current) => ({
                        ...current,
                        baseline: {
                          ...current.baseline,
                          browserRequiresApproval: event.target.checked,
                        },
                      }))
                    }
                    type="checkbox"
                  />
                  <span>{t.overlayFields.browserApproval}</span>
                </label>
                <label className="field-toggle">
                  <input
                    checked={overlayForm.baseline.mcpRequiresApproval}
                    onChange={(event) =>
                      setOverlayForm((current) => ({
                        ...current,
                        baseline: {
                          ...current.baseline,
                          mcpRequiresApproval: event.target.checked,
                        },
                      }))
                    }
                    type="checkbox"
                  />
                  <span>{t.overlayFields.mcpApproval}</span>
                </label>
              </div>
            </div>

            <div className="skill-row">
              <div>
                <strong>{t.trustedOverlayTitle}</strong>
                <p className="footer-note">{t.trustedOverlaySummary}</p>
              </div>
              <div className="dashboard-form-grid">
                <label className="field-label">
                  <span>{t.overlayFields.trustTier}</span>
                  <select
                    className="field-input"
                    onChange={(event) =>
                      setOverlayForm((current) => ({
                        ...current,
                        trustedCustomer: {
                          ...current.trustedCustomer,
                          trustTier: event.target.value as
                            | "standard"
                            | "verified"
                            | "vip"
                            | "restricted",
                        },
                      }))
                    }
                    value={overlayForm.trustedCustomer.trustTier}
                  >
                    <option value="standard">{t.trustTiers.standard}</option>
                    <option value="verified">{t.trustTiers.verified}</option>
                    <option value="vip">{t.trustTiers.vip}</option>
                    <option value="restricted">{t.trustTiers.restricted}</option>
                  </select>
                </label>
                <label className="field-label">
                  <span>{t.overlayFields.browserDecision}</span>
                  <select
                    className="field-input"
                    onChange={(event) =>
                      setOverlayForm((current) => ({
                        ...current,
                        trustedCustomer: {
                          ...current.trustedCustomer,
                          browserDecision: event.target.value as "allow" | "ask" | "deny",
                        },
                      }))
                    }
                    value={overlayForm.trustedCustomer.browserDecision}
                  >
                    <option value="deny">{t.overlayDecisions.deny}</option>
                    <option value="ask">{t.overlayDecisions.ask}</option>
                    <option value="allow">{t.overlayDecisions.allow}</option>
                  </select>
                </label>
                <label className="field-label">
                  <span>{t.overlayFields.mcpDecision}</span>
                  <select
                    className="field-input"
                    onChange={(event) =>
                      setOverlayForm((current) => ({
                        ...current,
                        trustedCustomer: {
                          ...current.trustedCustomer,
                          mcpDecision: event.target.value as "allow" | "ask" | "deny",
                        },
                      }))
                    }
                    value={overlayForm.trustedCustomer.mcpDecision}
                  >
                    <option value="deny">{t.overlayDecisions.deny}</option>
                    <option value="ask">{t.overlayDecisions.ask}</option>
                    <option value="allow">{t.overlayDecisions.allow}</option>
                  </select>
                </label>
                <label className="field-label">
                  <span>{t.overlayFields.requiredPlanTier}</span>
                  <select
                    className="field-input"
                    onChange={(event) =>
                      setOverlayForm((current) => ({
                        ...current,
                        trustedCustomer: {
                          ...current.trustedCustomer,
                          requiredPlanTier: event.target.value as "pass" | "deep_help",
                        },
                      }))
                    }
                    value={overlayForm.trustedCustomer.requiredPlanTier}
                  >
                    <option value="pass">Pass</option>
                    <option value="deep_help">Deep Help</option>
                  </select>
                </label>
              </div>
              <div className="chip-row">
                <label className="field-toggle">
                  <input
                    checked={overlayForm.trustedCustomer.enabled}
                    onChange={(event) =>
                      setOverlayForm((current) => ({
                        ...current,
                        trustedCustomer: {
                          ...current.trustedCustomer,
                          enabled: event.target.checked,
                        },
                      }))
                    }
                    type="checkbox"
                  />
                  <span>{t.overlayFields.enabled}</span>
                </label>
                <label className="field-toggle">
                  <input
                    checked={overlayForm.trustedCustomer.browserRequiresApproval}
                    onChange={(event) =>
                      setOverlayForm((current) => ({
                        ...current,
                        trustedCustomer: {
                          ...current.trustedCustomer,
                          browserRequiresApproval: event.target.checked,
                        },
                      }))
                    }
                    type="checkbox"
                  />
                  <span>{t.overlayFields.browserApproval}</span>
                </label>
                <label className="field-toggle">
                  <input
                    checked={overlayForm.trustedCustomer.mcpRequiresApproval}
                    onChange={(event) =>
                      setOverlayForm((current) => ({
                        ...current,
                        trustedCustomer: {
                          ...current.trustedCustomer,
                          mcpRequiresApproval: event.target.checked,
                        },
                      }))
                    }
                    type="checkbox"
                  />
                  <span>{t.overlayFields.mcpApproval}</span>
                </label>
              </div>
            </div>

            <div className="button-row">
              <button
                className="button-primary"
                disabled={isPending || busyKey === "policy-overlays:save"}
                onClick={() => void handleSavePolicyOverlays()}
                type="button"
              >
                {busyKey === "policy-overlays:save"
                  ? t.savingPolicyOverlays
                  : t.savePolicyOverlays}
              </button>
              <span className="footer-note">{t.ownerManagedFootnote}</span>
            </div>
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
                      <span className="chip">{t.mcpEstimatedCost(binding.estimatedCostCentsPerCall)}</span>
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
                  <span>{t.mcpFields.estimatedCost}</span>
                  <input
                    className="field-input"
                    min={0}
                    onChange={(event) =>
                      setMcpForm((current) => ({
                        ...current,
                        estimatedCostCentsPerCall: Math.max(
                          0,
                          Number.parseInt(event.target.value || "0", 10) || 0,
                        ),
                      }))
                    }
                    type="number"
                    value={mcpForm.estimatedCostCentsPerCall}
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
                      {approval.subagentId ? <span className="chip">{approval.subagentId}</span> : null}
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
          eyebrow={t.nativeComputerUseEyebrow}
          meta={<span className="chip">{t.nativeComputerUseState(snapshot.nativeComputerUse.state)}</span>}
          title={t.nativeComputerUseTitle}
        >
          <div className="row-list">
            <div className="skill-row">
              <div>
                <strong>{t.nativeComputerUseSessionTitle}</strong>
                <p>{snapshot.nativeComputerUse.nextStep}</p>
                <div className="chip-row">
                  {snapshot.nativeComputerUse.sessionId ? (
                    <span className="chip">{t.computeSession(snapshot.nativeComputerUse.sessionId)}</span>
                  ) : null}
                  {snapshot.nativeComputerUse.browserTransportKind ? (
                    <span className="chip">{snapshot.nativeComputerUse.browserTransportKind}</span>
                  ) : null}
                  {snapshot.nativeComputerUse.targetTransportKind ? (
                    <span className="chip">{t.targetTransport(snapshot.nativeComputerUse.targetTransportKind)}</span>
                  ) : null}
                </div>
                {snapshot.nativeComputerUse.currentTitle ? (
                  <p className="footer-note">{snapshot.nativeComputerUse.currentTitle}</p>
                ) : null}
                {snapshot.nativeComputerUse.currentUrl ? (
                  <p className="footer-note">{snapshot.nativeComputerUse.currentUrl}</p>
                ) : null}
                {snapshot.nativeComputerUse.latestTextSnippet ? (
                  <p className="footer-note">{snapshot.nativeComputerUse.latestTextSnippet}</p>
                ) : null}
                <div className="chip-row">
                  <span className="chip">
                    {snapshot.nativeComputerUse.supportsSessionReuse
                      ? t.sessionReuseEnabled
                      : t.sessionReuseDisabled}
                  </span>
                  <span className="chip">
                    {snapshot.nativeComputerUse.requiresApprovalForMutations
                      ? t.approvalRequired
                      : t.approvalNotRequired}
                  </span>
                </div>
              </div>

              <div className="button-row">
                {snapshot.nativeComputerUse.latestScreenshotArtifactId ? (
                  <button
                    className="button-secondary"
                    onClick={() =>
                      setSelectedArtifactId(snapshot.nativeComputerUse.latestScreenshotArtifactId ?? null)
                    }
                    type="button"
                  >
                    {t.openLatestScreenshot}
                  </button>
                ) : null}
                {snapshot.nativeComputerUse.latestJsonArtifactId ? (
                  <button
                    className="button-secondary"
                    onClick={() => setSelectedArtifactId(snapshot.nativeComputerUse.latestJsonArtifactId ?? null)}
                    type="button"
                  >
                    {t.openLatestJson}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="skill-row">
              <div className="dashboard-form-grid">
                <label className="field-label field-label-wide">
                  <span>{t.nativeFields.task}</span>
                  <textarea
                    className="field-textarea"
                    onChange={(event) =>
                      setNativeForm((current) => ({
                        ...current,
                        task: event.target.value,
                      }))
                    }
                    placeholder={t.nativeTaskPlaceholder}
                    rows={3}
                    value={nativeForm.task}
                  />
                </label>
                <label className="field-label">
                  <span>{t.nativeFields.provider}</span>
                  <select
                    className="field-input"
                    onChange={(event) =>
                      setNativeForm((current) => ({
                        ...current,
                        provider: event.target.value as NativeComputerFormState["provider"],
                      }))
                    }
                    value={nativeForm.provider}
                  >
                    <option value="auto">{t.nativeProviderAuto}</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </label>
                <label className="field-label">
                  <span>{t.nativeFields.maxSteps}</span>
                  <input
                    className="field-input"
                    max={8}
                    min={1}
                    onChange={(event) =>
                      setNativeForm((current) => ({
                        ...current,
                        maxSteps: Number.parseInt(event.target.value || "3", 10),
                      }))
                    }
                    type="number"
                    value={nativeForm.maxSteps}
                  />
                </label>
              </div>
              <div className="chip-row">
                <label className="field-toggle">
                  <input
                    checked={nativeForm.allowMutations}
                    onChange={(event) =>
                      setNativeForm((current) => ({
                        ...current,
                        allowMutations: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  <span>{t.nativeFields.allowMutations}</span>
                </label>
              </div>
              <div className="button-row">
                <button
                  className="button-primary"
                  disabled={
                    isPending ||
                    busyKey === "native:execute" ||
                    snapshot.nativeComputerUse.state !== "ready"
                  }
                  onClick={() => void handleRunNativeComputerUse()}
                  type="button"
                >
                  {busyKey === "native:execute" ? t.nativeRunning : t.nativeRun}
                </button>
              </div>
            </div>

            {snapshot.nativeComputerUse.providerReadiness.map((provider) => (
              <div className="skill-row" key={provider.provider}>
                <div>
                  <strong>{provider.provider}</strong>
                  <p>
                    {provider.transportKind} · {t.nativeProviderStatus(provider.status)}
                  </p>
                </div>
                <div className="chip-row">
                  {provider.model ? <span className="chip">{provider.model}</span> : null}
                  {provider.reason ? <span className="chip">{provider.reason}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </DashboardSurface>

        <DashboardSurface
          eyebrow={t.browserSessionsEyebrow}
          meta={<span className="chip">{t.browserSessionsChip(snapshot.browserSessions.length)}</span>}
          title={t.browserSessionsTitle}
        >
          <div className="row-list">
            {snapshot.browserSessions.length ? (
              snapshot.browserSessions.map((browserSession) => (
                <div className="skill-row" key={browserSession.id}>
                  <div>
                    <strong>
                      {browserSession.currentTitle ??
                        browserSession.latestNavigation?.pageTitle ??
                        browserSession.currentUrl ??
                        browserSession.latestNavigation?.requestedUrl ??
                        browserSession.id}
                    </strong>
                    <p>
                      {browserSession.transportKind} · {browserSession.status} · {t.visitCount(browserSession.visitCount)}
                    </p>
                    <div className="chip-row">
                      <span className="chip">{t.browserComputeSession(browserSession.computeSessionId)}</span>
                      {browserSession.lastNavigationAt ? (
                        <span className="chip">
                          {t.lastNavigationLabel(formatTimestamp(browserSession.lastNavigationAt, locale))}
                        </span>
                      ) : null}
                      {browserSession.profilePath ? <span className="chip">{browserSession.profilePath}</span> : null}
                    </div>
                    {browserSession.currentUrl ? (
                      <p className="footer-note">{browserSession.currentUrl}</p>
                    ) : null}
                    {browserSession.latestNavigation?.textSnippet ? (
                      <p className="footer-note">{browserSession.latestNavigation.textSnippet}</p>
                    ) : null}
                    {browserSession.failureReason ? (
                      <p className="footer-note">{t.failureReasonLabel(browserSession.failureReason)}</p>
                    ) : null}
                  </div>

                  <div className="button-row">
                    {browserSession.latestNavigation?.screenshotArtifactId ? (
                      <button
                        className="button-secondary"
                        onClick={() => setSelectedArtifactId(browserSession.latestNavigation?.screenshotArtifactId ?? null)}
                        type="button"
                      >
                        {t.openLatestScreenshot}
                      </button>
                    ) : null}
                    {browserSession.latestNavigation?.jsonArtifactId ? (
                      <button
                        className="button-secondary"
                        onClick={() => setSelectedArtifactId(browserSession.latestNavigation?.jsonArtifactId ?? null)}
                        type="button"
                      >
                        {t.openLatestManifest}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">{t.noBrowserSessions}</p>
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
                      <span className="chip">{t.downloadCountChip(artifact.downloadCount)}</span>
                      <span className="chip">{formatTimestamp(artifact.createdAt, locale)}</span>
                      {artifact.isPinned ? <span className="chip chip-safe">{t.pinnedChip}</span> : null}
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
              {(() => {
                const artifactPreviewUrl = artifactDetail.artifact.mimeType.startsWith("image/")
                  ? `/api/dashboard/representatives/${representativeSlug}/compute/artifacts/${artifactDetail.artifact.id}/download?inline=1`
                  : null;

                return (
                  <>
              <div className="skill-row">
                <div>
                  <strong>{artifactDetail.artifact.kind}</strong>
                  <p>{artifactDetail.artifact.objectKey}</p>
                  <div className="chip-row">
                    <span className="chip">{artifactDetail.artifact.mimeType}</span>
                    <span className="chip">{formatBytes(artifactDetail.artifact.sizeBytes)}</span>
                    <span className="chip">{artifactDetail.artifact.sha256.slice(0, 12)}</span>
                    <span className="chip">{t.downloadCountChip(artifactDetail.artifact.downloadCount)}</span>
                    {artifactDetail.artifact.isPinned ? (
                      <span className="chip chip-safe">{t.pinnedChip}</span>
                    ) : null}
                  </div>
                  {artifactDetail.artifact.lastDownloadedAt ? (
                    <p className="footer-note">
                      {t.lastDownloadedLabel(
                        formatTimestamp(artifactDetail.artifact.lastDownloadedAt, locale),
                      )}
                    </p>
                  ) : null}
                </div>
              </div>
              {artifactPreviewUrl ? (
                <img
                  alt={`${artifactDetail.artifact.kind} preview`}
                  className="artifact-preview-image"
                  src={artifactPreviewUrl}
                />
              ) : artifactDetail.contentText ? (
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
                <button
                  className="button-secondary"
                  disabled={
                    isPending ||
                    busyKey === `artifact:${artifactDetail.artifact.id}:pin` ||
                    busyKey === `artifact:${artifactDetail.artifact.id}:unpin`
                  }
                  onClick={() =>
                    void handleToggleArtifactPin(
                      artifactDetail.artifact.id,
                      !artifactDetail.artifact.isPinned,
                    )
                  }
                  type="button"
                >
                  {busyKey === `artifact:${artifactDetail.artifact.id}:pin` ||
                  busyKey === `artifact:${artifactDetail.artifact.id}:unpin`
                    ? artifactDetail.artifact.isPinned
                      ? t.unpinningArtifact
                      : t.pinningArtifact
                    : artifactDetail.artifact.isPinned
                      ? t.unpinArtifact
                      : t.pinArtifact}
                </button>
                {artifactDetail.truncated ? <span className="chip">{t.previewTruncated}</span> : null}
              </div>
                  </>
                );
              })()}
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

function createEmptyOverlayForm(): OverlayFormState {
  return {
    baseline: {
      enabled: true,
      browserDecision: "ask",
      browserRequiresApproval: true,
      mcpDecision: "ask",
      mcpRequiresApproval: true,
      requiredPlanTier: "pass",
    },
    trustedCustomer: {
      enabled: true,
      trustTier: "verified",
      browserDecision: "ask",
      browserRequiresApproval: true,
      mcpDecision: "allow",
      mcpRequiresApproval: false,
      requiredPlanTier: "pass",
    },
  };
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
    estimatedCostCentsPerCall: 0,
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
      browserSessions: "Browser sessions",
      browserSessionsDetail: "当前保留状态和导航历史的 browser 会话数。",
      nativeProviders: "Native lanes",
      nativeProvidersDetail: (state: string) => `当前 native computer-use preflight 状态：${state}。`,
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
    ownerManagedEyebrow: "Owner Overlays",
    ownerManagedTitle: "Owner-managed defaults and trusted-customer overlays",
    ownerManagedChip: "editable",
    ownerBaselineTitle: "Owner baseline overlay",
    ownerBaselineSummary:
      "This layer sits above representative defaults and below Delegate-managed deny rules.",
    trustedOverlayTitle: "Trusted customer overlay",
    trustedOverlaySummary:
      "Use this to grant a narrower fast lane to verified contacts without weakening global guardrails.",
    ownerManagedFootnote:
      "Contacts without an explicit trust tier are treated as standard. Delegate-managed deny rules still win.",
    overlayFields: {
      browserDecision: "Browser decision",
      mcpDecision: "MCP decision",
      requiredPlanTier: "Required plan tier",
      trustTier: "Trust tier",
      enabled: "Overlay enabled",
      browserApproval: "Browser still needs approval",
      mcpApproval: "MCP still needs approval",
    },
    overlayDecisions: {
      allow: "Allow",
      ask: "Ask",
      deny: "Deny",
    },
    trustTiers: {
      standard: "Standard",
      verified: "Verified",
      vip: "VIP",
      restricted: "Restricted",
    },
    savePolicyOverlays: "Save owner overlays",
    savingPolicyOverlays: "Saving owner overlays...",
    mcpEyebrow: "MCP Bindings",
    mcpTitle: "把远程 capability server 绑定成可审批、可追踪的代表能力",
    mcpChip: (count: number) => `${count} bindings`,
    noMcpBindings: "还没有 MCP binding。先把一个远程 capability server 绑进来，再让代表通过审批后的 compute 请求去调用它。",
    allowedTools: (value: string) => `Allowed tools · ${value}`,
    mcpEstimatedCost: (value: number) => `估算成本 ${value}¢ / call`,
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
      estimatedCost: "Estimated cost / call (¢)",
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
    browserSessionsEyebrow: "Browser Session Lane",
    nativeComputerUseEyebrow: "Native Computer-Use Prep",
    nativeComputerUseTitle: "把 retained browser session 变成未来 Claude / OpenAI computer-use 的交接点",
    nativeComputerUseSessionTitle: "Latest handoff-ready browser session",
    nativeComputerUseState: (value: string) => value.replaceAll("_", " "),
    nativeProviderStatus: (value: string) => value.replaceAll("_", " "),
    targetTransport: (value: string) => `Target · ${value}`,
    computeSession: (value: string) => `Session · ${value}`,
    nativeFields: {
      task: "Native task",
      provider: "Provider",
      maxSteps: "Max steps",
      allowMutations: "Allow mutating actions after approval",
    },
    nativeTaskPlaceholder: "例如：滚动到价格区域，确认页面上显示的主套餐名称和价格。",
    nativeProviderAuto: "自动选择 ready provider",
    nativeRun: "运行 native loop",
    nativeRunning: "运行中...",
    sessionReuseEnabled: "Session reuse on",
    sessionReuseDisabled: "Session reuse off",
    approvalRequired: "Mutation approval required",
    approvalNotRequired: "Mutation approval relaxed",
    browserSessionsTitle: "追踪 browser profile、最近导航和最新截图入口",
    browserSessionsChip: (count: number) => `${count} browser sessions`,
    visitCount: (count: number) => `${count} visits`,
    browserComputeSession: (value: string) => `Compute · ${value}`,
    lastNavigationLabel: (value: string) => `最近导航 ${value}`,
    openLatestScreenshot: "打开最新截图",
    openLatestManifest: "打开最新 manifest",
    openLatestJson: "打开最新 page JSON",
    noBrowserSessions: "还没有 browser session 历史。",
    artifactsEyebrow: "Artifact Store",
    artifactsTitle: "确认 stdout / stderr 等结果已经进入对象存储",
    artifactsChip: (count: number) => `${count} artifacts`,
    artifactDetailEyebrow: "Artifact Detail",
    artifactDetailTitle: "直接查看 artifact 内容，而不是只看 object key",
    retentionChip: (value: string) => `retains until ${value}`,
    pinnedChip: "已置顶",
    downloadCountChip: (count: number) => `下载 ${count}`,
    lastDownloadedLabel: (value: string) => `最近下载于 ${value}`,
    noArtifactSelected: "先从左侧 artifact 列表里选择一个输出。",
    noArtifactPreview: "这个 artifact 当前没有可直接内联展示的文本预览。",
    downloadArtifact: "下载 artifact",
    pinArtifact: "置顶 artifact",
    unpinArtifact: "取消置顶",
    pinningArtifact: "置顶中...",
    unpinningArtifact: "取消中...",
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
      artifactPinned: "Artifact 已置顶，会保留在对象存储里供后续复用。",
      artifactUnpinned: "Artifact 已取消置顶，并恢复默认保留策略。",
      nativeMissingSession: "当前还没有可复用的 browser session，先跑一次受控 browser step。",
      nativeTaskRequired: "先填写这次 native browser 要完成的任务。",
      nativeExecuted: "Native computer-use loop 已完成，trace artifact 已写入对象存储。",
      nativeCompleted: (value: string) => `Native computer-use 完成：${value}`,
      policyOverlaysSaved: "Owner-managed policy overlays saved.",
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
      browserSessions: "Browser sessions",
      browserSessionsDetail: "Browser profiles that still carry navigation state and recent history.",
      nativeProviders: "Native lanes",
      nativeProvidersDetail: (state: string) => `Current native computer-use preflight state: ${state}.`,
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
    ownerManagedEyebrow: "Owner Overlay",
    ownerManagedTitle: "把 owner 默认策略和可信客户 overlay 收进治理层",
    ownerManagedChip: "可编辑",
    ownerBaselineTitle: "Owner 基线 overlay",
    ownerBaselineSummary: "这一层高于 representative 默认设置，但依然低于 Delegate 托管 deny 规则。",
    trustedOverlayTitle: "可信客户 overlay",
    trustedOverlaySummary: "给已验证联系人一条更窄的快车道，同时不放松全局护栏。",
    ownerManagedFootnote:
      "没有显式 trust tier 的联系人会按 standard 处理。Delegate 托管 deny 仍然优先。",
    overlayFields: {
      browserDecision: "Browser 决策",
      mcpDecision: "MCP 决策",
      requiredPlanTier: "需要的套餐层级",
      trustTier: "信任等级",
      enabled: "启用 overlay",
      browserApproval: "Browser 仍需审批",
      mcpApproval: "MCP 仍需审批",
    },
    overlayDecisions: {
      allow: "允许",
      ask: "审批",
      deny: "拒绝",
    },
    trustTiers: {
      standard: "标准",
      verified: "已验证",
      vip: "VIP",
      restricted: "受限",
    },
    savePolicyOverlays: "保存 owner overlay",
    savingPolicyOverlays: "正在保存 owner overlay...",
    mcpEyebrow: "MCP Bindings",
    mcpTitle: "Bind remote capability servers as governed representative tools",
    mcpChip: (count: number) => `${count} bindings`,
    noMcpBindings: "No MCP bindings yet. Attach a remote capability server here before routing approved work into it.",
    allowedTools: (value: string) => `Allowed tools · ${value}`,
    mcpEstimatedCost: (value: number) => `Estimated cost ${value}¢ / call`,
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
      estimatedCost: "Estimated cost / call (¢)",
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
    browserSessionsEyebrow: "Browser Session Lane",
    nativeComputerUseEyebrow: "Native Computer-Use Prep",
    nativeComputerUseTitle: "Turn the retained browser session into a handoff point for future Claude / OpenAI computer-use loops",
    nativeComputerUseSessionTitle: "Latest handoff-ready browser session",
    nativeComputerUseState: (value: string) => value.replaceAll("_", " "),
    nativeProviderStatus: (value: string) => value.replaceAll("_", " "),
    targetTransport: (value: string) => `Target · ${value}`,
    computeSession: (value: string) => `Session · ${value}`,
    nativeFields: {
      task: "Native task",
      provider: "Provider",
      maxSteps: "Max steps",
      allowMutations: "Allow mutating actions after approval",
    },
    nativeTaskPlaceholder: "Example: scroll to the pricing area, then tell me the visible plan name and price.",
    nativeProviderAuto: "Auto-select ready provider",
    nativeRun: "Run native loop",
    nativeRunning: "Running...",
    sessionReuseEnabled: "Session reuse on",
    sessionReuseDisabled: "Session reuse off",
    approvalRequired: "Mutation approval required",
    approvalNotRequired: "Mutation approval relaxed",
    browserSessionsTitle: "Track browser profiles, recent navigations, and the latest visual capture",
    browserSessionsChip: (count: number) => `${count} browser sessions`,
    visitCount: (count: number) => `${count} visits`,
    browserComputeSession: (value: string) => `Compute · ${value}`,
    lastNavigationLabel: (value: string) => `Last navigation ${value}`,
    openLatestScreenshot: "Open latest screenshot",
    openLatestManifest: "Open latest manifest",
    openLatestJson: "Open latest page JSON",
    noBrowserSessions: "No browser sessions yet.",
    artifactsEyebrow: "Artifact Store",
    artifactsTitle: "Confirm stdout, stderr, and other outputs are persisted",
    artifactsChip: (count: number) => `${count} artifacts`,
    artifactDetailEyebrow: "Artifact Detail",
    artifactDetailTitle: "Inspect artifact content directly instead of just reading the object key",
    retentionChip: (value: string) => `retains until ${value}`,
    pinnedChip: "pinned",
    downloadCountChip: (count: number) => `${count} downloads`,
    lastDownloadedLabel: (value: string) => `Last downloaded ${value}`,
    noArtifactSelected: "Select an artifact from the list to inspect it here.",
    noArtifactPreview: "This artifact does not currently have an inline text preview.",
    downloadArtifact: "Download artifact",
    pinArtifact: "Pin artifact",
    unpinArtifact: "Unpin artifact",
    pinningArtifact: "Pinning...",
    unpinningArtifact: "Unpinning...",
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
      artifactPinned: "The artifact is pinned and will stay available beyond the default retention window.",
      artifactUnpinned: "The artifact has been unpinned and returned to the default retention policy.",
      nativeMissingSession: "There is no retained browser session yet. Run a governed browser step first.",
      nativeTaskRequired: "Enter a task for the native browser lane before running it.",
      nativeExecuted: "The native computer-use loop completed and stored a trace artifact.",
      nativeCompleted: (value: string) => `Native computer-use completed: ${value}`,
      policyOverlaysSaved: "Owner 管理的策略 overlay 已保存。",
      error: "Failed to resolve approval.",
    },
  },
} as const;
