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
  activeView,
  initialRepresentatives,
}: {
  activeSlug: string;
  activeView: "overview" | "setup" | "skills" | "memory";
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
        router.push(`/dashboard?rep=${created.slug}&view=setup`);
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
    <section className="dashboard-rail-stack">
      <div className="dashboard-rail-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h2>代表、切换、发布</h2>
        </div>
        <p className="section-copy">左侧只负责选择工作区，右侧才是当前任务页。</p>
      </div>

      {message ? <div className="status-banner status-success">{message}</div> : null}
      {error ? <div className="status-banner status-error">{error}</div> : null}

      <article className="dashboard-rail-card">
        <div className="setup-section-header">
          <div>
            <h3>Create representative</h3>
            <p>创建后直接进入 setup，不用在超长页面里重新找入口。</p>
          </div>
          <span className="chip">Telegram only</span>
        </div>

        <form className="setup-stack" onSubmit={handleSubmit}>
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

          <div className="button-row button-row-stretch">
            <button className="button-primary button-block" disabled={isPending} type="submit">
              {isPending ? "Creating..." : "Create and open setup"}
            </button>
          </div>
        </form>
      </article>

      <article className="dashboard-rail-card">
        <div className="setup-section-header">
          <div>
            <h3>Published representatives</h3>
            <p>切换代表时保留当前 tab，不打断当前工作流。</p>
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

                <div className="button-row button-row-stretch">
                  <Link
                    className={isActive ? "button-primary button-block" : "button-secondary button-block"}
                    href={`/dashboard?rep=${representative.slug}&view=${activeView}`}
                  >
                    {isActive ? "Current workspace" : "Open workspace"}
                  </Link>
                  <Link className="button-secondary button-block" href={`/reps/${representative.slug}`}>
                    Public page
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </article>
    </section>
  );
}
