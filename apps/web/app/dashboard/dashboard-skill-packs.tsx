"use client";

import type { FormEvent } from "react";
import { useEffect, useState, useTransition } from "react";

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

  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Skill Packs</p>
          <h2>从 ClawHub 发现技能包，再按代表边界启用</h2>
        </div>
        <p className="section-copy">
          这里只安装来源和元数据，不执行远程代码。每个 pack 都需要显式启用，才会进入代表运行时。
        </p>
      </div>

      {snapshot ? (
        <div className="panel dashboard-summary">
          <div>
            <p className="panel-title">Representative</p>
            <h3>{snapshot.representative.displayName}</h3>
            <p>{snapshot.representative.roleSummary}</p>
          </div>
          <div className="chip-row">
            <span className="chip">{snapshot.skillPacks.length} packs tracked</span>
            <span className="chip chip-safe">
              {groupActivationLabels[snapshot.representative.groupActivation]}
            </span>
            <span className="chip">
              {snapshot.representative.humanInLoop ? "human in loop" : "ai only"}
            </span>
          </div>
        </div>
      ) : null}

      {message ? <div className="status-banner status-success">{message}</div> : null}
      {error ? <div className="status-banner status-error">{error}</div> : null}

      <div className="table-grid">
        <article className="table-card">
          <h3>Installed on This Representative</h3>
          <div className="row-list">
            {snapshot?.skillPacks.length ? (
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
                  <div className="button-row">
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
        </article>

        <article className="table-card">
          <h3>Discover on ClawHub</h3>
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
                  <div className="button-row">
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
        </article>
      </div>
    </section>
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
