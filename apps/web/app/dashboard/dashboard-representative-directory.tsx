"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState, useTransition } from "react";

type RepresentativeDirectoryItem = {
  id: string;
  slug: string;
  ownerName: string;
  name: string;
  tagline: string;
  updatedAt: string;
};

export function DashboardRepresentativeDirectory({
  activeSlug,
  initialRepresentatives,
}: {
  activeSlug: string;
  initialRepresentatives: RepresentativeDirectoryItem[];
}) {
  const router = useRouter();
  const [representatives, setRepresentatives] = useState(initialRepresentatives);
  const [ownerName, setOwnerName] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [slug, setSlug] = useState("");
  const [tagline, setTagline] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/dashboard/representatives", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ownerName,
            representativeName,
            slug,
            tagline,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Failed to create representative.");
        }

        const created = (await response.json()) as {
          id: string;
          slug: string;
          ownerName: string;
          name: string;
          tagline: string;
        };

        const nextList = [
          {
            id: created.id,
            slug: created.slug,
            ownerName: created.ownerName,
            name: created.name,
            tagline: created.tagline,
            updatedAt: new Date().toISOString(),
          },
          ...representatives.filter((item) => item.slug !== created.slug),
        ];

        setRepresentatives(nextList);
        setOwnerName("");
        setRepresentativeName("");
        setSlug("");
        setTagline("");
        setMessage(`Representative ${created.name} created.`);
        router.push(`/dashboard?rep=${created.slug}`);
        router.refresh();
      })().catch((nextError: unknown) => {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to create representative.",
        );
      });
    });
  }

  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Representative Directory</p>
          <h2>先创建代表，再进入配置与运营</h2>
        </div>
        <p className="section-copy">
          这里的目标是 15 分钟内发布一个 Telegram Founder Representative，而不是继续围着 demo 配置打转。
        </p>
      </div>

      {message ? <div className="status-banner status-success">{message}</div> : null}
      {error ? <div className="status-banner status-error">{error}</div> : null}

      <div className="card-grid two-up">
        <article className="table-card">
          <div className="setup-section-header">
            <div>
              <h3>Create representative</h3>
              <p>创建后会自动带上 Founder 模板、四档定价、公开边界和基础 skill packs。</p>
            </div>
            <span className="chip">Telegram only</span>
          </div>

          <form className="setup-stack" onSubmit={handleSubmit}>
            <div className="compact-grid">
              <label className="field-stack">
                <span>Owner name</span>
                <input
                  className="text-input"
                  onChange={(event) => setOwnerName(event.target.value)}
                  placeholder="Lin"
                  value={ownerName}
                />
              </label>

              <label className="field-stack">
                <span>Representative name</span>
                <input
                  className="text-input"
                  onChange={(event) => setRepresentativeName(event.target.value)}
                  placeholder="Lin 的 Telegram 对外代表"
                  value={representativeName}
                />
              </label>

              <label className="field-stack">
                <span>Slug</span>
                <input
                  className="text-input"
                  onChange={(event) => setSlug(event.target.value)}
                  placeholder="lin-founder-rep"
                  value={slug}
                />
              </label>

              <label className="field-stack">
                <span>Tagline</span>
                <input
                  className="text-input"
                  onChange={(event) => setTagline(event.target.value)}
                  placeholder="用公开知识回答问题、筛选合作线索、收集需求，并在需要时转真人。"
                  value={tagline}
                />
              </label>
            </div>

            <div className="button-row">
              <button className="button-primary" disabled={isPending} type="submit">
                {isPending ? "Creating..." : "Create representative"}
              </button>
            </div>
          </form>
        </article>

        <article className="table-card">
          <div className="setup-section-header">
            <div>
              <h3>Published representatives</h3>
              <p>选择一个代表继续编辑 setup、owner inbox、skill packs 和公开资料页。</p>
            </div>
            <span className="chip">{representatives.length} reps</span>
          </div>

          <div className="directory-list">
            {representatives.map((representative) => {
              const isActive = representative.slug === activeSlug;

              return (
                <article
                  className={isActive ? "directory-card directory-card-active" : "directory-card"}
                  key={representative.id}
                >
                  <div>
                    <p className="panel-title">{representative.ownerName}</p>
                    <h3>{representative.name}</h3>
                    <p>{representative.tagline}</p>
                  </div>

                  <div className="button-row">
                    <Link className={isActive ? "button-primary" : "button-secondary"} href={`/dashboard?rep=${representative.slug}`}>
                      {isActive ? "Editing" : "Open dashboard"}
                    </Link>
                    <Link className="button-secondary" href={`/reps/${representative.slug}`}>
                      Public page
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </article>
      </div>
    </section>
  );
}
