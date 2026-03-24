"use client";

import type { FormEvent } from "react";
import { useEffect, useState, useTransition } from "react";

import {
  DashboardPanelFrame,
  DashboardSignalStrip,
  DashboardSurface,
  DashboardSurfaceGrid,
} from "../ui/control-plane";

type DashboardSkillPack = {
  linkId: string;
  id: string;
  slug: string;
  displayName: string;
  source: "builtin" | "owner_upload" | "clawhub";
  summary: string;
  version?: string;
  sourceUrl?: string;
  ownerHandle?: string;
  verificationTier?: string;
  capabilityTags: string[];
  executesCode: boolean;
  enabled: boolean;
  installStatus: "available" | "installed" | "update_available";
  installedAt?: string;
};

type DashboardSnapshot = {
  representative: {
    slug: string;
    displayName: string;
    roleSummary: string;
    groupActivation: "mention_only" | "reply_or_mention" | "always";
    humanInLoop: boolean;
    publicMode: boolean;
  };
  skillPacks: DashboardSkillPack[];
};

type SearchResponse = {
  results: Array<Omit<DashboardSkillPack, "linkId" | "enabled" | "installStatus" | "installedAt"> & {
    enabled: boolean;
    installStatus: "available" | "installed" | "update_available";
  }>;
};

const groupActivationLabels = {
  mention_only: "仅 mention",
  reply_or_mention: "reply 或 mention",
  always: "始终响应",
} as const;

export function DashboardSkillPacks({
  representativeSlug,
}: {
  representativeSlug: string;
}) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [results, setResults] = useState<SearchResponse["results"]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void Promise.all([refreshSnapshot(representativeSlug, setSnapshot, setError), loadResults("")]).catch(
      (nextError: unknown) => {
        setError(nextError instanceof Error ? nextError.message : "Failed to load dashboard data.");
      },
    );
  }, [representativeSlug]);

  const enabledCount = snapshot?.skillPacks.filter((skillPack) => skillPack.enabled).length ?? 0;
  const builtinCount =
    snapshot?.skillPacks.filter((skillPack) => skillPack.source === "builtin").length ?? 0;
  const clawHubCount =
    snapshot?.skillPacks.filter((skillPack) => skillPack.source === "clawhub").length ?? 0;
  const signalCards = snapshot
    ? [
        {
          label: "Tracked packs",
          value: `${snapshot.skillPacks.length}`,
          detail: "当前代表已经纳入治理范围的技能包总数。",
          tone: "accent" as const,
        },
        {
          label: "Enabled",
          value: `${enabledCount}`,
          detail: "这些 pack 才真正进入代表运行时。",
          tone: "safe" as const,
        },
        {
          label: "ClawHub",
          value: `${clawHubCount}`,
          detail: "来自 ClawHub 的扩展来源，需要显式启用。",
        },
        {
          label: "Search results",
          value: `${results.length}`,
          detail: "当前搜索面板返回的可安装候选。",
        },
      ]
    : [];

  async function loadResults(nextQuery: string) {
    const searchParams = new URLSearchParams();
    if (nextQuery.trim()) {
      searchParams.set("query", nextQuery.trim());
    }

    const response = await fetch(`/api/registry/clawhub/skills?${searchParams.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(await extractError(response));
    }

    const payload = (await response.json()) as SearchResponse;
    setResults(payload.results);
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    startTransition(() => {
      void loadResults(query).catch((nextError: unknown) => {
        setError(nextError instanceof Error ? nextError.message : "Failed to search ClawHub.");
      });
    });
  }

  function handleInstall(skillPackSlug: string) {
    setBusyKey(`install:${skillPackSlug}`);
    setMessage(null);
    setError(null);
    startTransition(() => {
      void (async () => {
        const response = await fetch(
          `/api/dashboard/representatives/${representativeSlug}/skill-packs`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ skillPackSlug }),
          },
        );
        if (!response.ok) {
          throw new Error(await extractError(response));
        }

        await Promise.all([
          refreshSnapshot(representativeSlug, setSnapshot, setError),
          loadResults(query),
        ]);
        setMessage(`Installed ${skillPackSlug} for ${representativeSlug}.`);
      })()
        .catch((nextError: unknown) => {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Failed to install the selected skill pack.",
          );
        })
        .finally(() => {
          setBusyKey(null);
        });
    });
  }

  function handleToggle(linkId: string, nextEnabled: boolean, label: string) {
    setBusyKey(`toggle:${linkId}`);
    setMessage(null);
    setError(null);
    startTransition(() => {
      void (async () => {
        const response = await fetch(
          `/api/dashboard/representatives/${representativeSlug}/skill-packs/${linkId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ enabled: nextEnabled }),
          },
        );

        if (!response.ok) {
          throw new Error(await extractError(response));
        }

        await refreshSnapshot(representativeSlug, setSnapshot, setError);
        setMessage(`${nextEnabled ? "Enabled" : "Disabled"} ${label}.`);
      })()
        .catch((nextError: unknown) => {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Failed to update representative skill pack state.",
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
          <p className="panel-title">Loading skills</p>
          <h3>正在读取代表已安装的 skill packs 和 ClawHub 搜索结果。</h3>
          <p>完成后会先展示当前代表已追踪的 pack，再给出扩展入口。</p>
        </article>
      </section>
    );
  }

  return (
    <DashboardPanelFrame
      eyebrow="Skill Packs"
      summary="这里只安装来源和元数据，不执行远程代码。每个 pack 都需要显式启用，才会进入代表运行时。"
      title="从 ClawHub 发现技能包，再按代表边界启用"
    >
      <div className="dashboard-panel-hero">
        <article className="dashboard-highlight-card dashboard-highlight-card-primary">
          <p className="panel-title">Representative boundary</p>
          <h3>{snapshot.representative.displayName}</h3>
          <p>{snapshot.representative.roleSummary}</p>
          <div className="chip-row">
            <span className="chip">{snapshot.skillPacks.length} packs tracked</span>
            <span className="chip chip-safe">
              {groupActivationLabels[snapshot.representative.groupActivation]}
            </span>
            <span className="chip">
              {snapshot.representative.humanInLoop ? "human in loop" : "ai only"}
            </span>
          </div>
        </article>

        <DashboardSignalStrip cards={signalCards} />
      </div>

      {message ? <div className="status-banner status-success">{message}</div> : null}
      {error ? <div className="status-banner status-error">{error}</div> : null}

      <DashboardSignalStrip
        cards={[
          {
            label: "Built in",
            value: `${builtinCount}`,
            detail: "内建能力包，默认更稳定更可控。",
          },
          {
            label: "Group activation",
            value: groupActivationLabels[snapshot.representative.groupActivation],
            detail: "群组里默认采用的谨慎触发策略。",
            tone: "safe" as const,
          },
          {
            label: "Public mode",
            value: snapshot.representative.publicMode ? "Public" : "Private",
            detail: "是否以公开代表模式对外开放。",
          },
          {
            label: "Human loop",
            value: snapshot.representative.humanInLoop ? "Enabled" : "Off",
            detail: "高价值升级是否可以转入人工接手。",
            tone: snapshot.representative.humanInLoop ? ("safe" as const) : "default",
          },
        ]}
      />

      <DashboardSurfaceGrid>
        <DashboardSurface
          eyebrow="Current workspace"
          meta={<span className="chip chip-safe">{enabledCount} enabled</span>}
          title="Installed on this representative"
        >
          <div className="row-list">
            {snapshot.skillPacks.length ? (
              snapshot.skillPacks.map((skillPack) => (
                <div className="skill-row" key={skillPack.linkId}>
                  <div>
                    <strong>{skillPack.displayName}</strong>
                    <p>{skillPack.summary}</p>
                    <div className="chip-row">
                      <span className="chip">{skillPack.source}</span>
                      <span className="chip">{skillPack.installStatus}</span>
                      {skillPack.version ? <span className="chip">v{skillPack.version}</span> : null}
                      {skillPack.verificationTier ? (
                        <span className="chip chip-safe">{skillPack.verificationTier}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="button-row button-row-stretch">
                    {skillPack.sourceUrl ? (
                      <a className="button-secondary" href={skillPack.sourceUrl} target="_blank" rel="noreferrer">
                        View source
                      </a>
                    ) : null}
                    <button
                      className={skillPack.enabled ? "button-secondary" : "button-primary"}
                      disabled={isPending || busyKey === `toggle:${skillPack.linkId}`}
                      onClick={() =>
                        handleToggle(skillPack.linkId, !skillPack.enabled, skillPack.displayName)
                      }
                      type="button"
                    >
                      {busyKey === `toggle:${skillPack.linkId}`
                        ? "Saving..."
                        : skillPack.enabled
                          ? "Disable"
                          : "Enable"}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">No tracked skill packs yet.</p>
            )}
          </div>
        </DashboardSurface>

        <DashboardSurface
          eyebrow="Expansion"
          meta={<span className="chip">{results.length} results</span>}
          title="Discover on ClawHub"
        >

          <form className="search-form" onSubmit={handleSearchSubmit}>
            <input
              className="text-input"
              name="query"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search representative skill packs"
              value={query}
            />
            <button className="button-primary" disabled={isPending} type="submit">
              {isPending ? "Searching..." : "Search"}
            </button>
          </form>

          <div className="row-list">
            {results.map((result) => {
              const alreadyTracked = snapshot?.skillPacks.some(
                (skillPack) =>
                  skillPack.source === result.source && skillPack.slug === result.slug,
              );

              return (
                <div className="skill-row" key={`${result.source}:${result.slug}`}>
                  <div>
                    <strong>{result.displayName}</strong>
                    <p>{result.summary}</p>
                    <div className="chip-row">
                      <span className="chip">{result.source}</span>
                      {result.version ? <span className="chip">v{result.version}</span> : null}
                      {result.ownerHandle ? <span className="chip">@{result.ownerHandle}</span> : null}
                    </div>
                  </div>
                  <div className="button-row button-row-stretch">
                    {result.sourceUrl ? (
                      <a className="button-secondary" href={result.sourceUrl} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    ) : null}
                    <button
                      className="button-primary"
                      disabled={
                        isPending || alreadyTracked || busyKey === `install:${result.slug}`
                      }
                      onClick={() => handleInstall(result.slug)}
                      type="button"
                    >
                      {alreadyTracked
                        ? "Tracked"
                        : busyKey === `install:${result.slug}`
                          ? "Installing..."
                          : "Install"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </DashboardSurface>
      </DashboardSurfaceGrid>
    </DashboardPanelFrame>
  );
}

async function refreshSnapshot(
  representativeSlug: string,
  setSnapshot: (value: DashboardSnapshot) => void,
  setError: (value: string | null) => void,
) {
  const response = await fetch(`/api/dashboard/representatives/${representativeSlug}/skill-packs`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await extractError(response));
  }

  const payload = (await response.json()) as DashboardSnapshot;
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
