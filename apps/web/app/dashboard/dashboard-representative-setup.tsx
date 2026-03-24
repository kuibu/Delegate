"use client";

import type { FormEvent } from "react";
import { useEffect, useState, useTransition } from "react";

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

export function DashboardRepresentativeSetup({
  representativeSlug,
}: {
  representativeSlug: string;
}) {
  const [snapshot, setSnapshot] = useState<RepresentativeSetupSnapshot | null>(null);
  const [draft, setDraft] = useState<RepresentativeSetupSnapshot | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void refreshSetup(representativeSlug, setSnapshot, setDraft, setError);
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

  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Representative Setup</p>
          <h2>让公开资料页和 bot 都读同一份代表配置</h2>
        </div>
        <p className="section-copy">
          当前编辑的是 <strong>{snapshot?.name ?? draft.name}</strong>，保存后公开页和运行时都应该使用这份配置。
        </p>
      </div>

      {message ? <div className="status-banner status-success">{message}</div> : null}
      {error ? <div className="status-banner status-error">{error}</div> : null}

      <form className="setup-stack" onSubmit={handleSubmit}>
        <div className="table-grid">
          <article className="table-card">
            <div className="setup-section-header">
              <div>
                <h3>Basics</h3>
                <p>代表是谁、代表谁、说话风格和群组激活规则。</p>
              </div>
              <div className="chip-row">
                <span className="chip">{groupActivationLabels[draft.groupActivation]}</span>
                <span className="chip">{draft.publicMode ? "public" : "private"}</span>
                <span className="chip">{draft.humanInLoop ? "ai + human" : "ai only"}</span>
              </div>
            </div>

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
          </article>

          <article className="table-card">
            <div className="setup-section-header">
              <div>
                <h3>Conversation Contract</h3>
                <p>免费范围、付费边界和人工评估时窗。</p>
              </div>
            </div>

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
          </article>
        </div>

        <article className="table-card">
          <div className="setup-section-header">
            <div>
              <h3>Pricing Plans</h3>
              <p>坚持四档：Free / Pass / Deep Help / Sponsor。</p>
            </div>
          </div>

          <div className="pricing-editor-grid">
            {draft.pricing.map((plan) => (
              <div className="panel" key={plan.tier}>
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
        </article>

        <article className="table-card">
          <div className="setup-section-header">
            <div>
              <h3>Knowledge Pack</h3>
              <p>让公开知识先于自由发挥，回答和材料都从这里长出来。</p>
            </div>
          </div>

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
        </article>

        <div className="button-row">
          <button className="button-primary" disabled={isPending} type="submit">
            {isPending ? "Saving..." : "Save representative setup"}
          </button>
        </div>
      </form>
    </section>
  );
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
