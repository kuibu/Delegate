"use client";

import type { FormEvent } from "react";
import { useEffect, useState, useTransition } from "react";

import {
  DashboardPanelFrame,
  DashboardSignalStrip,
  DashboardSurface,
  DashboardSurfaceGrid,
} from "../ui/control-plane";

type InquiryIntent =
  | "faq"
  | "collaboration"
  | "pricing"
  | "materials"
  | "scheduling"
  | "handoff"
  | "refund"
  | "discount"
  | "candidate"
  | "media"
  | "support"
  | "restricted"
  | "unknown";

type GroupActivation = "mention_only" | "reply_or_mention" | "always";
type KnowledgeDocumentKind =
  | "bio"
  | "faq"
  | "policy"
  | "pricing"
  | "case_study"
  | "deck"
  | "calendar"
  | "download";

type KnowledgeDocument = {
  id: string;
  title: string;
  kind: KnowledgeDocumentKind;
  summary: string;
  url?: string | undefined;
};

type PricingPlan = {
  tier: "free" | "pass" | "deep_help" | "sponsor";
  name: string;
  stars: number;
  summary: string;
  includedReplies: number;
  includesPriorityHandoff: boolean;
};

type RepresentativeSetupSnapshot = {
  id: string;
  slug: string;
  ownerName: string;
  name: string;
  tagline: string;
  tone: string;
  languages: string[];
  groupActivation: GroupActivation;
  publicMode: boolean;
  humanInLoop: boolean;
  contract: {
    freeReplyLimit: number;
    freeScope: InquiryIntent[];
    paywalledIntents: InquiryIntent[];
    handoffWindowHours: number;
  };
  pricing: PricingPlan[];
  knowledgePack: {
    identitySummary: string;
    faq: KnowledgeDocument[];
    materials: KnowledgeDocument[];
    policies: KnowledgeDocument[];
  };
  handoffPrompt: string;
};

type RepresentativeOpenVikingSnapshot = {
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
};

const groupActivationLabels: Record<GroupActivation, string> = {
  mention_only: "仅 mention",
  reply_or_mention: "reply 或 mention",
  always: "始终响应",
};

const intentOptions: Array<{ value: InquiryIntent; label: string }> = [
  { value: "faq", label: "FAQ" },
  { value: "materials", label: "资料" },
  { value: "pricing", label: "报价" },
  { value: "collaboration", label: "合作" },
  { value: "scheduling", label: "预约" },
  { value: "handoff", label: "人工转接" },
  { value: "candidate", label: "招聘" },
  { value: "media", label: "媒体" },
  { value: "support", label: "支持" },
  { value: "unknown", label: "未知问题" },
];

const materialKindOptions: Array<{ value: KnowledgeDocumentKind; label: string }> = [
  { value: "deck", label: "Deck" },
  { value: "case_study", label: "Case study" },
  { value: "download", label: "Download" },
  { value: "calendar", label: "Calendar" },
  { value: "pricing", label: "Pricing" },
];

const pricingTierLabels: Record<PricingPlan["tier"], string> = {
  free: "Free",
  pass: "Pass",
  deep_help: "Deep Help",
  sponsor: "Sponsor",
};

type SetupSectionId = "basics" | "contract" | "pricing" | "knowledge" | "memory";

const setupSections: Array<{
  id: SetupSectionId;
  step: string;
  label: string;
  blurb: string;
}> = [
  {
    id: "basics",
    step: "01",
    label: "Basics",
    blurb: "先定义代表身份、语气和群组触发规则。",
  },
  {
    id: "contract",
    step: "02",
    label: "Contract",
    blurb: "明确免费范围、付费边界和人工介入时窗。",
  },
  {
    id: "pricing",
    step: "03",
    label: "Pricing",
    blurb: "把四档产品包和优先级讲清楚。",
  },
  {
    id: "knowledge",
    step: "04",
    label: "Knowledge",
    blurb: "整理 FAQ、资料和政策，让 bot 先读结构化公开知识。",
  },
  {
    id: "memory",
    step: "05",
    label: "Memory",
    blurb: "最后再配置 OpenViking 这层进阶记忆和资源同步。",
  },
];

export function DashboardRepresentativeSetup({
  representativeSlug,
}: {
  representativeSlug: string;
}) {
  const [snapshot, setSnapshot] = useState<RepresentativeSetupSnapshot | null>(null);
  const [draft, setDraft] = useState<RepresentativeSetupSnapshot | null>(null);
  const [openVikingSnapshot, setOpenVikingSnapshot] =
    useState<RepresentativeOpenVikingSnapshot | null>(null);
  const [openVikingDraft, setOpenVikingDraft] =
    useState<RepresentativeOpenVikingSnapshot | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SetupSectionId>("basics");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void Promise.all([
      refreshSetup(representativeSlug, setSnapshot, setDraft, setError),
      refreshOpenViking(representativeSlug, setOpenVikingSnapshot, setOpenVikingDraft, setError),
    ]);
  }, [representativeSlug]);

  useEffect(() => {
    setActiveSection("basics");
  }, [representativeSlug]);

  function updateDraft(mutator: (value: RepresentativeSetupSnapshot) => RepresentativeSetupSnapshot) {
    setDraft((current) => (current ? mutator(cloneSnapshot(current)) : current));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft) {
      return;
    }

    setMessage(null);
    setError(null);

    startTransition(() => {
      void (async () => {
        const response = await fetch(`/api/dashboard/representatives/${representativeSlug}/setup`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(draft),
        });

        if (!response.ok) {
          throw new Error(await extractError(response));
        }

        const nextSnapshot = (await response.json()) as RepresentativeSetupSnapshot;
        setSnapshot(nextSnapshot);
        setDraft(cloneSnapshot(nextSnapshot));
        setMessage("Representative setup saved.");
      })().catch((nextError: unknown) => {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to save representative setup.",
        );
      });
    });
  }

  function updateOpenVikingDraft(
    mutator: (value: RepresentativeOpenVikingSnapshot) => RepresentativeOpenVikingSnapshot,
  ) {
    setOpenVikingDraft((current) => (current ? mutator({ ...current }) : current));
  }

  function handleOpenVikingSubmit() {
    if (!openVikingDraft) {
      return;
    }

    setBusyKey("openviking:save");
    setMessage(null);
    setError(null);

    startTransition(() => {
      void (async () => {
        const response = await fetch(
          `/api/dashboard/representatives/${representativeSlug}/openviking`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              enabled: openVikingDraft.enabled,
              agentIdOverride: openVikingDraft.agentIdOverride,
              autoRecall: openVikingDraft.autoRecall,
              autoCapture: openVikingDraft.autoCapture,
              captureMode: openVikingDraft.captureMode,
              recallLimit: openVikingDraft.recallLimit,
              recallScoreThreshold: openVikingDraft.recallScoreThreshold,
              targetUri: openVikingDraft.targetUri,
            }),
          },
        );

        if (!response.ok) {
          throw new Error(await extractError(response));
        }

        const nextSnapshot = (await response.json()) as RepresentativeOpenVikingSnapshot;
        setOpenVikingSnapshot(nextSnapshot);
        setOpenVikingDraft(cloneOpenVikingSnapshot(nextSnapshot));
        setMessage("OpenViking memory settings saved.");
      })()
        .catch((nextError: unknown) => {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Failed to save OpenViking memory settings.",
          );
        })
        .finally(() => {
          setBusyKey(null);
        });
    });
  }

  function handleOpenVikingSync() {
    setBusyKey("openviking:sync");
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

        const nextSnapshot = (await response.json()) as RepresentativeOpenVikingSnapshot;
        setOpenVikingSnapshot(nextSnapshot);
        setOpenVikingDraft(cloneOpenVikingSnapshot(nextSnapshot));
        setMessage("Representative public knowledge synced into OpenViking.");
      })()
        .catch((nextError: unknown) => {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Failed to sync representative public knowledge into OpenViking.",
          );
        })
        .finally(() => {
          setBusyKey(null);
        });
    });
  }

  if (!draft) {
    return (
      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Representative Setup</p>
            <h2>把 demo 配置变成真的 owner 配置</h2>
          </div>
          <p className="section-copy">正在加载当前代表配置。</p>
        </div>
      </section>
    );
  }

  const activeSectionIndex = Math.max(
    0,
    setupSections.findIndex((section) => section.id === activeSection),
  );
  const currentSection = setupSections[activeSectionIndex]!;
  const totalKnowledgeItems =
    draft.knowledgePack.faq.length +
    draft.knowledgePack.materials.length +
    draft.knowledgePack.policies.length;
  const setupSignalCards = [
    {
      label: "Languages",
      value: `${draft.languages.length}`,
      detail: "代表当前对外声明支持的语言数。",
      tone: "accent" as const,
    },
    {
      label: "Free replies",
      value: `${draft.contract.freeReplyLimit}`,
      detail: "首次接触阶段的免费回复额度。",
      tone: "safe" as const,
    },
    {
      label: "Pricing tiers",
      value: `${draft.pricing.length}`,
      detail: "当前公开提供的访问深度层级。",
    },
    {
      label: "Knowledge items",
      value: `${totalKnowledgeItems}`,
      detail: "已经可供 bot 使用的结构化公开知识条目。",
    },
  ];
  const currentStepCards = buildSetupStepCards(draft, currentSection, openVikingDraft);

  return (
    <DashboardPanelFrame
      eyebrow="Representative Setup"
      summary={`当前编辑的是 ${snapshot?.name ?? draft.name}，保存后公开页和运行时都应该使用这份配置。`}
      title="让公开资料页和 bot 都读同一份代表配置"
    >
      {message ? <div className="status-banner status-success">{message}</div> : null}
      {error ? <div className="status-banner status-error">{error}</div> : null}

      <div className="dashboard-panel-hero">
        <article className="dashboard-highlight-card dashboard-highlight-card-primary">
          <p className="panel-title">Representative identity</p>
          <h3>{draft.name}</h3>
          <p>{draft.tagline}</p>
          <div className="chip-row">
            <span className="chip">{draft.ownerName}</span>
            <span className="chip chip-safe">{groupActivationLabels[draft.groupActivation]}</span>
            <span className="chip">{draft.publicMode ? "public" : "private"}</span>
            <span className="chip">{draft.humanInLoop ? "ai + human" : "ai only"}</span>
          </div>
        </article>
        <DashboardSignalStrip cards={setupSignalCards} />
      </div>

      <DashboardSurfaceGrid>
        <DashboardSurface
          eyebrow="Launch flow"
          meta={<span className="chip chip-safe">{draft.slug}</span>}
          title="Progressive representative setup"
          tone="accent"
        >
          <div className="setup-stepper-shell">
            <nav aria-label="Representative setup steps" className="setup-stepper">
              {setupSections.map((section, index) => {
                const isActive = section.id === activeSection;
                const isComplete = index < activeSectionIndex;

                return (
                  <button
                    className={
                      isActive
                        ? "setup-step-button setup-step-button-active"
                        : isComplete
                          ? "setup-step-button setup-step-button-complete"
                          : "setup-step-button"
                    }
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    type="button"
                  >
                    <span className="setup-step-number">{section.step}</span>
                    <strong>{section.label}</strong>
                    <span>{section.blurb}</span>
                  </button>
                );
              })}
            </nav>

            <article className="setup-step-summary">
              <div>
                <p className="panel-title">Current step</p>
                <h3>{currentSection.label}</h3>
                <p>{currentSection.blurb}</p>
              </div>
              <div className="chip-row">
                <span className="chip">
                  {activeSectionIndex + 1} / {setupSections.length}
                </span>
                <span className="chip chip-safe">{draft.slug}</span>
              </div>
            </article>
          </div>
        </DashboardSurface>

        <DashboardSurface
          eyebrow="Step preview"
          meta={
            <span className="chip">
              {activeSectionIndex + 1} / {setupSections.length}
            </span>
          }
          title={`${currentSection.label} should feel publishable`}
        >
          <div>
            <p className="section-copy">
              每一步都不是后台参数页，而是在定义一个对外关系接口该如何被理解、收费和接手。
            </p>
          </div>
          <DashboardSignalStrip cards={currentStepCards} />
        </DashboardSurface>
      </DashboardSurfaceGrid>

      <form className="setup-stack" onSubmit={handleSubmit}>
        {activeSection === "basics" || activeSection === "contract" ? (
          <DashboardSurfaceGrid columns={1}>
            {activeSection === "basics" ? (
              <DashboardSurface
                eyebrow="Basics"
                meta={
                  <div className="chip-row">
                    <span className="chip">{groupActivationLabels[draft.groupActivation]}</span>
                    <span className="chip">{draft.publicMode ? "public" : "private"}</span>
                    <span className="chip">{draft.humanInLoop ? "ai + human" : "ai only"}</span>
                  </div>
                }
                title="代表是谁、代表谁、说话风格和群组激活规则。"
                tone="accent"
              >
                <div className="setup-grid">
                  <label className="field-stack">
                    <span>Owner name</span>
                    <input
                      className="text-input"
                      onChange={(event) =>
                        updateDraft((value) => ({ ...value, ownerName: event.target.value }))
                      }
                      value={draft.ownerName}
                    />
                  </label>

              <label className="field-stack">
                <span>Representative name</span>
                <input
                  className="text-input"
                  onChange={(event) =>
                    updateDraft((value) => ({ ...value, name: event.target.value }))
                  }
                  value={draft.name}
                />
              </label>

              <label className="field-stack field-span-full">
                <span>Tagline</span>
                <input
                  className="text-input"
                  onChange={(event) =>
                    updateDraft((value) => ({ ...value, tagline: event.target.value }))
                  }
                  value={draft.tagline}
                />
              </label>

              <label className="field-stack field-span-full">
                <span>Tone</span>
                <textarea
                  className="text-input textarea-input"
                  onChange={(event) =>
                    updateDraft((value) => ({ ...value, tone: event.target.value }))
                  }
                  rows={3}
                  value={draft.tone}
                />
              </label>

              <label className="field-stack">
                <span>Languages</span>
                <input
                  className="text-input"
                  onChange={(event) =>
                    updateDraft((value) => ({
                      ...value,
                      languages: parseCommaSeparatedList(event.target.value),
                    }))
                  }
                  value={draft.languages.join(", ")}
                />
              </label>

              <label className="field-stack">
                <span>Group activation</span>
                <select
                  className="text-input"
                  onChange={(event) =>
                    updateDraft((value) => ({
                      ...value,
                      groupActivation: event.target.value as GroupActivation,
                    }))
                  }
                  value={draft.groupActivation}
                >
                  {Object.entries(groupActivationLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="field-stack field-span-full">
                <span>Mode</span>
                <div className="toggle-grid">
                  <label className="toggle-row">
                    <input
                      checked={draft.publicMode}
                      onChange={(event) =>
                        updateDraft((value) => ({ ...value, publicMode: event.target.checked }))
                      }
                      type="checkbox"
                    />
                    <span>Public mode</span>
                  </label>
                  <label className="toggle-row">
                    <input
                      checked={draft.humanInLoop}
                      onChange={(event) =>
                        updateDraft((value) => ({
                          ...value,
                          humanInLoop: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    <span>Human in loop</span>
                  </label>
                </div>
              </div>

                  <label className="field-stack field-span-full">
                    <span>Handoff prompt</span>
                    <textarea
                      className="text-input textarea-input"
                      onChange={(event) =>
                        updateDraft((value) => ({ ...value, handoffPrompt: event.target.value }))
                      }
                      rows={4}
                      value={draft.handoffPrompt}
                    />
                  </label>
                </div>
              </DashboardSurface>
            ) : null}

            {activeSection === "contract" ? (
              <DashboardSurface
                eyebrow="Conversation Contract"
                title="免费范围、付费边界和人工评估时窗。"
              >
                <div className="setup-grid">
                  <label className="field-stack">
                    <span>Free reply limit</span>
                    <input
                      className="text-input"
                      min={1}
                      onChange={(event) =>
                        updateDraft((value) => ({
                          ...value,
                          contract: {
                            ...value.contract,
                            freeReplyLimit: Number(event.target.value || 0),
                          },
                        }))
                      }
                      type="number"
                      value={draft.contract.freeReplyLimit}
                    />
                  </label>

              <label className="field-stack">
                <span>Handoff window (hours)</span>
                <input
                  className="text-input"
                  min={1}
                  onChange={(event) =>
                    updateDraft((value) => ({
                      ...value,
                      contract: {
                        ...value.contract,
                        handoffWindowHours: Number(event.target.value || 0),
                      },
                    }))
                  }
                  type="number"
                  value={draft.contract.handoffWindowHours}
                />
              </label>

              <div className="field-stack field-span-full">
                <span>Free scope</span>
                <div className="checkbox-grid">
                  {intentOptions.map((intent) => (
                    <label className="toggle-row" key={`free-${intent.value}`}>
                      <input
                        checked={draft.contract.freeScope.includes(intent.value)}
                        onChange={(event) =>
                          updateDraft((value) => ({
                            ...value,
                            contract: {
                              ...value.contract,
                              freeScope: toggleIntent(
                                value.contract.freeScope,
                                intent.value,
                                event.target.checked,
                              ),
                            },
                          }))
                        }
                        type="checkbox"
                      />
                      <span>{intent.label}</span>
                    </label>
                  ))}
                </div>
              </div>

                  <div className="field-stack field-span-full">
                    <span>Paywalled intents</span>
                    <div className="checkbox-grid">
                      {intentOptions.map((intent) => (
                        <label className="toggle-row" key={`paid-${intent.value}`}>
                          <input
                            checked={draft.contract.paywalledIntents.includes(intent.value)}
                            onChange={(event) =>
                              updateDraft((value) => ({
                                ...value,
                                contract: {
                                  ...value.contract,
                                  paywalledIntents: toggleIntent(
                                    value.contract.paywalledIntents,
                                    intent.value,
                                    event.target.checked,
                                  ),
                                },
                              }))
                            }
                            type="checkbox"
                          />
                          <span>{intent.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </DashboardSurface>
            ) : null}
          </DashboardSurfaceGrid>
        ) : null}

        {activeSection === "pricing" ? (
          <DashboardSurface
            eyebrow="Pricing Plans"
            title="坚持四档：Free / Pass / Deep Help / Sponsor。"
          >
            <div className="pricing-editor-grid">
              {draft.pricing.map((plan) => (
                <div className="panel setup-plan-card" key={plan.tier}>
                  <div className="chip-row">
                    <span className="chip chip-safe">{pricingTierLabels[plan.tier]}</span>
                  </div>
                  <div className="setup-grid compact-grid">
                  <label className="field-stack">
                    <span>Name</span>
                    <input
                      className="text-input"
                      onChange={(event) =>
                        updateDraft((value) => ({
                          ...value,
                          pricing: value.pricing.map((entry) =>
                            entry.tier === plan.tier
                              ? { ...entry, name: event.target.value }
                              : entry,
                          ),
                        }))
                      }
                      value={plan.name}
                    />
                  </label>

                  <label className="field-stack">
                    <span>Stars</span>
                    <input
                      className="text-input"
                      min={0}
                      onChange={(event) =>
                        updateDraft((value) => ({
                          ...value,
                          pricing: value.pricing.map((entry) =>
                            entry.tier === plan.tier
                              ? { ...entry, stars: Number(event.target.value || 0) }
                              : entry,
                          ),
                        }))
                      }
                      type="number"
                      value={plan.stars}
                    />
                  </label>

                  <label className="field-stack">
                    <span>Replies</span>
                    <input
                      className="text-input"
                      min={0}
                      onChange={(event) =>
                        updateDraft((value) => ({
                          ...value,
                          pricing: value.pricing.map((entry) =>
                            entry.tier === plan.tier
                              ? { ...entry, includedReplies: Number(event.target.value || 0) }
                              : entry,
                          ),
                        }))
                      }
                      type="number"
                      value={plan.includedReplies}
                    />
                  </label>

                  <label className="field-stack field-span-full">
                    <span>Summary</span>
                    <textarea
                      className="text-input textarea-input"
                      onChange={(event) =>
                        updateDraft((value) => ({
                          ...value,
                          pricing: value.pricing.map((entry) =>
                            entry.tier === plan.tier
                              ? { ...entry, summary: event.target.value }
                              : entry,
                          ),
                        }))
                      }
                      rows={3}
                      value={plan.summary}
                    />
                  </label>

                    <label className="toggle-row">
                      <input
                        checked={plan.includesPriorityHandoff}
                        onChange={(event) =>
                          updateDraft((value) => ({
                            ...value,
                            pricing: value.pricing.map((entry) =>
                              entry.tier === plan.tier
                                ? {
                                    ...entry,
                                    includesPriorityHandoff: event.target.checked,
                                  }
                                : entry,
                            ),
                          }))
                        }
                        type="checkbox"
                      />
                      <span>Includes priority handoff</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </DashboardSurface>
        ) : null}

        {activeSection === "knowledge" ? (
          <DashboardSurface
            eyebrow="Knowledge Pack"
            title="让公开知识先于自由发挥，回答和材料都从这里长出来。"
          >
            <div className="setup-stack">
              <label className="field-stack">
                <span>Identity summary</span>
                <textarea
                  className="text-input textarea-input"
                  onChange={(event) =>
                    updateDraft((value) => ({
                      ...value,
                      knowledgePack: {
                        ...value.knowledgePack,
                        identitySummary: event.target.value,
                      },
                    }))
                  }
                  rows={4}
                  value={draft.knowledgePack.identitySummary}
                />
              </label>

              <KnowledgeDocumentEditor
                documents={draft.knowledgePack.faq}
                fixedKind="faq"
                onChange={(documents) =>
                  updateDraft((value) => ({
                    ...value,
                    knowledgePack: {
                      ...value.knowledgePack,
                      faq: documents,
                    },
                  }))
                }
                title="FAQ"
              />

              <KnowledgeDocumentEditor
                documents={draft.knowledgePack.materials}
                kindOptions={materialKindOptions}
                onChange={(documents) =>
                  updateDraft((value) => ({
                    ...value,
                    knowledgePack: {
                      ...value.knowledgePack,
                      materials: documents,
                    },
                  }))
                }
                title="Materials"
              />

              <KnowledgeDocumentEditor
                documents={draft.knowledgePack.policies}
                fixedKind="policy"
                onChange={(documents) =>
                  updateDraft((value) => ({
                    ...value,
                    knowledgePack: {
                      ...value.knowledgePack,
                      policies: documents,
                    },
                  }))
                }
                title="Policies"
              />
            </div>
          </DashboardSurface>
        ) : null}

        {activeSection === "memory" && openVikingDraft ? (
          <DashboardSurface
            eyebrow="OpenViking Memory"
            meta={
              <div className="chip-row">
                <span className="chip">{openVikingDraft.health.mode}</span>
                <span
                  className={
                    openVikingDraft.health.status === "healthy"
                      ? "chip chip-safe"
                      : openVikingDraft.health.status === "disabled"
                        ? "chip"
                        : "chip chip-danger"
                  }
                >
                  {openVikingDraft.health.status}
                </span>
                <span className="chip">{openVikingDraft.lastSyncStatus}</span>
              </div>
            }
            title="代表级公开记忆层：资源同步、recall、capture 和可观测性。"
            tone="accent"
          >
            <div className="setup-grid">
              <div className="field-stack field-span-full">
                <span>Health</span>
                <p className="muted">{openVikingDraft.health.detail}</p>
                <p className="footer-note">Base URL: {openVikingDraft.health.baseUrl}</p>
                {openVikingDraft.health.consoleUrl ? (
                  <p className="footer-note">Console: {openVikingDraft.health.consoleUrl}</p>
                ) : null}
              </div>

              <div className="field-stack field-span-full">
                <span>Toggles</span>
                <div className="toggle-grid">
                  <label className="toggle-row">
                    <input
                      checked={openVikingDraft.enabled}
                      onChange={(event) =>
                        updateOpenVikingDraft((value) => ({
                          ...value,
                          enabled: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    <span>Enable OpenViking</span>
                  </label>
                  <label className="toggle-row">
                    <input
                      checked={openVikingDraft.autoRecall}
                      onChange={(event) =>
                        updateOpenVikingDraft((value) => ({
                          ...value,
                          autoRecall: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    <span>Auto recall</span>
                  </label>
                  <label className="toggle-row">
                    <input
                      checked={openVikingDraft.autoCapture}
                      onChange={(event) =>
                        updateOpenVikingDraft((value) => ({
                          ...value,
                          autoCapture: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    <span>Auto capture</span>
                  </label>
                </div>
              </div>

              <label className="field-stack">
                <span>Agent ID override</span>
                <input
                  className="text-input"
                  onChange={(event) =>
                    updateOpenVikingDraft((value) => {
                      const nextOverride = event.target.value.trim();
                      return {
                        representativeSlug: value.representativeSlug,
                        enabled: value.enabled,
                        agentId: value.agentId,
                        ...(nextOverride ? { agentIdOverride: nextOverride } : {}),
                        autoRecall: value.autoRecall,
                        autoCapture: value.autoCapture,
                        captureMode: value.captureMode,
                        recallLimit: value.recallLimit,
                        recallScoreThreshold: value.recallScoreThreshold,
                        targetUri: value.targetUri,
                        resourceSyncEnabled: value.resourceSyncEnabled,
                        ...(value.lastSyncAt ? { lastSyncAt: value.lastSyncAt } : {}),
                        lastSyncStatus: value.lastSyncStatus,
                        lastSyncItemCount: value.lastSyncItemCount,
                        ...(value.lastSyncError ? { lastSyncError: value.lastSyncError } : {}),
                        health: {
                          status: value.health.status,
                          detail: value.health.detail,
                          mode: value.health.mode,
                          baseUrl: value.health.baseUrl,
                          ...(value.health.consoleUrl
                            ? { consoleUrl: value.health.consoleUrl }
                            : {}),
                        },
                      };
                    })
                  }
                  placeholder={openVikingDraft.agentId}
                  value={openVikingDraft.agentIdOverride ?? ""}
                />
              </label>

              <label className="field-stack">
                <span>Capture mode</span>
                <select
                  className="text-input"
                  onChange={(event) =>
                    updateOpenVikingDraft((value) => ({
                      ...value,
                      captureMode: event.target.value as "semantic" | "keyword",
                    }))
                  }
                  value={openVikingDraft.captureMode}
                >
                  <option value="semantic">semantic</option>
                  <option value="keyword">keyword</option>
                </select>
              </label>

              <label className="field-stack">
                <span>Recall limit</span>
                <input
                  className="text-input"
                  min={1}
                  max={20}
                  onChange={(event) =>
                    updateOpenVikingDraft((value) => ({
                      ...value,
                      recallLimit: Number(event.target.value || 1),
                    }))
                  }
                  type="number"
                  value={openVikingDraft.recallLimit}
                />
              </label>

              <label className="field-stack">
                <span>Recall score threshold</span>
                <input
                  className="text-input"
                  max={1}
                  min={0}
                  onChange={(event) =>
                    updateOpenVikingDraft((value) => ({
                      ...value,
                      recallScoreThreshold: Number(event.target.value || 0),
                    }))
                  }
                  step="0.01"
                  type="number"
                  value={openVikingDraft.recallScoreThreshold}
                />
              </label>

              <label className="field-stack field-span-full">
                <span>Target resource scope</span>
                <input
                  className="text-input"
                  onChange={(event) =>
                    updateOpenVikingDraft((value) => ({
                      ...value,
                      targetUri: event.target.value,
                    }))
                  }
                  value={openVikingDraft.targetUri}
                />
              </label>

              <div className="field-stack field-span-full">
                <span>Sync status</span>
                <p className="muted">
                  Last sync: {openVikingDraft.lastSyncAt ? formatTimestamp(openVikingDraft.lastSyncAt) : "never"}
                </p>
                <p className="footer-note">
                  Status: {openVikingDraft.lastSyncStatus} · items: {openVikingDraft.lastSyncItemCount}
                </p>
                {openVikingDraft.lastSyncError ? (
                  <p className="footer-note">Error: {openVikingDraft.lastSyncError}</p>
                ) : null}
              </div>
            </div>

            <div className="dashboard-action-bar">
              <button
                className="button-primary"
                disabled={isPending || busyKey === "openviking:save"}
                onClick={handleOpenVikingSubmit}
                type="button"
              >
                {busyKey === "openviking:save" ? "Saving..." : "Save OpenViking settings"}
              </button>
              <button
                className="button-secondary"
                disabled={isPending || busyKey === "openviking:sync" || !openVikingDraft.resourceSyncEnabled}
                onClick={handleOpenVikingSync}
                type="button"
              >
                {busyKey === "openviking:sync" ? "Syncing..." : "Sync public knowledge"}
              </button>
            </div>
          </DashboardSurface>
        ) : null}

        {activeSection === "memory" && !openVikingDraft ? (
          <DashboardSurface eyebrow="OpenViking Memory" title="正在加载代表级公开记忆配置。">
            <p className="muted">再等一下，加载完成后这里会展示代表级公开记忆配置。</p>
          </DashboardSurface>
        ) : null}

        <div className="dashboard-form-footer">
          <div className="button-row">
            <button
              className="button-secondary"
              disabled={activeSectionIndex <= 0}
              onClick={() =>
                setActiveSection(
                  setupSections[Math.max(0, activeSectionIndex - 1)]?.id ?? "basics",
                )
              }
              type="button"
            >
              Previous step
            </button>
            <button
              className="button-secondary"
              disabled={activeSectionIndex >= setupSections.length - 1}
              onClick={() =>
                setActiveSection(
                  setupSections[Math.min(setupSections.length - 1, activeSectionIndex + 1)]?.id ??
                    "memory",
                )
              }
              type="button"
            >
              Next step
            </button>
          </div>

          <div className="button-row">
            <span className="muted">
              Step {activeSectionIndex + 1} of {setupSections.length}
            </span>
            <button className="button-primary" disabled={isPending} type="submit">
              {isPending ? "Saving..." : "Save representative setup"}
            </button>
          </div>
        </div>
      </form>
    </DashboardPanelFrame>
  );
}

function buildSetupStepCards(
  draft: RepresentativeSetupSnapshot,
  currentSection: { id: SetupSectionId; label: string; blurb: string },
  openVikingDraft: RepresentativeOpenVikingSnapshot | null,
): Array<{
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "safe" | "accent";
}> {
  switch (currentSection.id) {
    case "basics":
      return [
        {
          label: "Owner",
          value: draft.ownerName,
          detail: "这个代表最终替谁接住外部请求。",
          tone: "accent",
        },
        {
          label: "Mode",
          value: draft.publicMode ? "Public" : "Private",
          detail: "是否作为公开代表对外开放。",
        },
        {
          label: "Group trigger",
          value: groupActivationLabels[draft.groupActivation],
          detail: "群组里默认采用的保守响应策略。",
          tone: "safe",
        },
        {
          label: "Handoff",
          value: draft.humanInLoop ? "Ready" : "AI only",
          detail: "高价值请求是否允许升级到人工接手。",
        },
      ];
    case "contract":
      return [
        {
          label: "Free limit",
          value: `${draft.contract.freeReplyLimit}`,
          detail: "免费阶段允许的回复上限。",
          tone: "accent",
        },
        {
          label: "Free intents",
          value: `${draft.contract.freeScope.length}`,
          detail: "当前被纳入免费范围的意图类型。",
        },
        {
          label: "Paywalled",
          value: `${draft.contract.paywalledIntents.length}`,
          detail: "需要付费续用才能继续深入的问题类型。",
          tone: "safe",
        },
        {
          label: "Handoff SLA",
          value: `${draft.contract.handoffWindowHours}h`,
          detail: "人工升级预期的响应窗口。",
        },
      ];
    case "pricing":
      return [
        {
          label: "Plans",
          value: `${draft.pricing.length}`,
          detail: "当前对外公开的访问深度层级数。",
          tone: "accent",
        },
        {
          label: "Paid tiers",
          value: `${draft.pricing.filter((plan) => plan.stars > 0).length}`,
          detail: "真正会触发付费动作的层级数量。",
        },
        {
          label: "Priority handoff",
          value: `${draft.pricing.filter((plan) => plan.includesPriorityHandoff).length}`,
          detail: "包含优先人工升级的定价层级。",
          tone: "safe",
        },
        {
          label: "Highest tier",
          value: `${Math.max(...draft.pricing.map((plan) => plan.stars), 0)} Stars`,
          detail: "当前最深服务层的 Telegram Stars 价格。",
        },
      ];
    case "knowledge":
      return [
        {
          label: "FAQ",
          value: `${draft.knowledgePack.faq.length}`,
          detail: "高频标准答案的条目数。",
          tone: "accent",
        },
        {
          label: "Materials",
          value: `${draft.knowledgePack.materials.length}`,
          detail: "可直接投递的 deck、case study、download 数量。",
        },
        {
          label: "Policies",
          value: `${draft.knowledgePack.policies.length}`,
          detail: "公开边界、价格与流程相关的规则条目。",
          tone: "safe",
        },
        {
          label: "Identity",
          value: draft.knowledgePack.identitySummary ? "Ready" : "Missing",
          detail: "代表自我介绍是否已经足够清晰。",
        },
      ];
    case "memory":
      return [
        {
          label: "OpenViking",
          value: openVikingDraft?.enabled ? "Enabled" : "Off",
          detail: "是否启用代表级公开记忆层。",
          tone: "accent",
        },
        {
          label: "Recall",
          value: openVikingDraft?.autoRecall ? "Auto" : "Manual",
          detail: "是否在回复前自动召回公开上下文。",
        },
        {
          label: "Capture",
          value: openVikingDraft?.autoCapture ? "Auto" : "Manual",
          detail: "是否在关键节点自动提交公开安全记忆。",
          tone: "safe",
        },
        {
          label: "Last sync",
          value: openVikingDraft?.lastSyncStatus ?? "unknown",
          detail: "最近一次资源同步的状态。",
        },
      ];
  }
}

function KnowledgeDocumentEditor({
  title,
  documents,
  onChange,
  fixedKind,
  kindOptions,
}: {
  title: string;
  documents: KnowledgeDocument[];
  onChange: (documents: KnowledgeDocument[]) => void;
  fixedKind?: KnowledgeDocumentKind;
  kindOptions?: Array<{ value: KnowledgeDocumentKind; label: string }>;
}) {
  const options =
    kindOptions ??
    (fixedKind ? [{ value: fixedKind, label: fixedKind }] : [{ value: "faq", label: "faq" }]);

  function updateDocument(id: string, next: Partial<KnowledgeDocument>) {
    onChange(
      documents.map((document) => (document.id === id ? { ...document, ...next } : document)),
    );
  }

  function addDocument() {
    const defaultKind = fixedKind ?? options[0]?.value ?? "faq";
    onChange([
      ...documents,
      {
        id: crypto.randomUUID(),
        title: "",
        kind: defaultKind,
        summary: "",
      },
    ]);
  }

  function removeDocument(id: string) {
    onChange(documents.filter((document) => document.id !== id));
  }

  return (
    <div className="setup-subsection">
      <div className="setup-section-header">
        <div>
          <h3>{title}</h3>
          <p>{documents.length} items</p>
        </div>
        <button className="button-secondary" onClick={addDocument} type="button">
          Add item
        </button>
      </div>

      <div className="setup-stack">
        {documents.length ? (
          documents.map((document) => (
            <div className="knowledge-editor-card" key={document.id}>
              <div className="setup-grid compact-grid">
                <label className="field-stack">
                  <span>Title</span>
                  <input
                    className="text-input"
                    onChange={(event) =>
                      updateDocument(document.id, { title: event.target.value })
                    }
                    value={document.title}
                  />
                </label>

                {fixedKind ? (
                  <label className="field-stack">
                    <span>Kind</span>
                    <input className="text-input" readOnly value={fixedKind} />
                  </label>
                ) : (
                  <label className="field-stack">
                    <span>Kind</span>
                    <select
                      className="text-input"
                      onChange={(event) =>
                        updateDocument(document.id, {
                          kind: event.target.value as KnowledgeDocumentKind,
                        })
                      }
                      value={document.kind}
                    >
                      {options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="field-stack field-span-full">
                  <span>Summary</span>
                  <textarea
                    className="text-input textarea-input"
                    onChange={(event) =>
                      updateDocument(document.id, { summary: event.target.value })
                    }
                    rows={3}
                    value={document.summary}
                  />
                </label>

                <label className="field-stack field-span-full">
                  <span>URL</span>
                  <input
                    className="text-input"
                    onChange={(event) =>
                      updateDocument(document.id, {
                        url: event.target.value.trim() ? event.target.value : undefined,
                      })
                    }
                    placeholder="https://..."
                    value={document.url ?? ""}
                  />
                </label>
              </div>

              <div className="button-row">
                <button
                  className="button-secondary"
                  onClick={() => removeDocument(document.id)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="muted">No items yet.</p>
        )}
      </div>
    </div>
  );
}

async function refreshSetup(
  representativeSlug: string,
  setSnapshot: (value: RepresentativeSetupSnapshot) => void,
  setDraft: (value: RepresentativeSetupSnapshot) => void,
  setError: (value: string | null) => void,
) {
  const response = await fetch(`/api/dashboard/representatives/${representativeSlug}/setup`, {
    cache: "no-store",
  });

  if (!response.ok) {
    setError(await extractError(response));
    return;
  }

  const nextSnapshot = (await response.json()) as RepresentativeSetupSnapshot;
  setSnapshot(nextSnapshot);
  setDraft(cloneSnapshot(nextSnapshot));
  setError(null);
}

async function refreshOpenViking(
  representativeSlug: string,
  setSnapshot: (value: RepresentativeOpenVikingSnapshot) => void,
  setDraft: (value: RepresentativeOpenVikingSnapshot) => void,
  setError: (value: string | null) => void,
) {
  const response = await fetch(`/api/dashboard/representatives/${representativeSlug}/openviking`, {
    cache: "no-store",
  });

  if (!response.ok) {
    setError(await extractError(response));
    return;
  }

  const nextSnapshot = (await response.json()) as RepresentativeOpenVikingSnapshot;
  setSnapshot(nextSnapshot);
  setDraft(cloneOpenVikingSnapshot(nextSnapshot));
  setError(null);
}

function cloneSnapshot(snapshot: RepresentativeSetupSnapshot): RepresentativeSetupSnapshot {
  return {
    ...snapshot,
    languages: [...snapshot.languages],
    contract: {
      freeReplyLimit: snapshot.contract.freeReplyLimit,
      freeScope: [...snapshot.contract.freeScope],
      paywalledIntents: [...snapshot.contract.paywalledIntents],
      handoffWindowHours: snapshot.contract.handoffWindowHours,
    },
    pricing: snapshot.pricing.map((plan) => ({ ...plan })),
    knowledgePack: {
      identitySummary: snapshot.knowledgePack.identitySummary,
      faq: snapshot.knowledgePack.faq.map((item) => ({ ...item })),
      materials: snapshot.knowledgePack.materials.map((item) => ({ ...item })),
      policies: snapshot.knowledgePack.policies.map((item) => ({ ...item })),
    },
  };
}

function cloneOpenVikingSnapshot(
  snapshot: RepresentativeOpenVikingSnapshot,
): RepresentativeOpenVikingSnapshot {
  return {
    representativeSlug: snapshot.representativeSlug,
    enabled: snapshot.enabled,
    agentId: snapshot.agentId,
    ...(snapshot.agentIdOverride ? { agentIdOverride: snapshot.agentIdOverride } : {}),
    autoRecall: snapshot.autoRecall,
    autoCapture: snapshot.autoCapture,
    captureMode: snapshot.captureMode,
    recallLimit: snapshot.recallLimit,
    recallScoreThreshold: snapshot.recallScoreThreshold,
    targetUri: snapshot.targetUri,
    resourceSyncEnabled: snapshot.resourceSyncEnabled,
    ...(snapshot.lastSyncAt ? { lastSyncAt: snapshot.lastSyncAt } : {}),
    lastSyncStatus: snapshot.lastSyncStatus,
    lastSyncItemCount: snapshot.lastSyncItemCount,
    ...(snapshot.lastSyncError ? { lastSyncError: snapshot.lastSyncError } : {}),
    health: {
      status: snapshot.health.status,
      detail: snapshot.health.detail,
      mode: snapshot.health.mode,
      baseUrl: snapshot.health.baseUrl,
      ...(snapshot.health.consoleUrl ? { consoleUrl: snapshot.health.consoleUrl } : {}),
    },
  };
}

function parseCommaSeparatedList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toggleIntent(
  current: InquiryIntent[],
  value: InquiryIntent,
  checked: boolean,
): InquiryIntent[] {
  if (checked) {
    return current.includes(value) ? current : [...current, value];
  }

  return current.filter((entry) => entry !== value);
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
