import type { ReactNode } from "react";

export function DashboardPanelFrame({
  eyebrow,
  title,
  summary,
  children,
  id,
  className,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section
      className={className ? `section dashboard-panel-shell ${className}` : "section dashboard-panel-shell"}
      id={id}
    >
      <div className="dashboard-panel-intro">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <p className="section-copy">{summary}</p>
      </div>
      {children}
    </section>
  );
}

export function DashboardSignalStrip({
  cards,
}: {
  cards: Array<{
    label: string;
    value: string;
    detail: string;
    tone?: "default" | "safe" | "accent";
  }>;
}) {
  return (
    <div className="dashboard-signal-strip">
      {cards.map((card) => (
        <article
          className={
            card.tone === "safe"
              ? "dashboard-signal-card dashboard-signal-card-safe"
              : card.tone === "accent"
                ? "dashboard-signal-card dashboard-signal-card-accent"
                : "dashboard-signal-card"
          }
          key={`${card.label}:${card.value}`}
        >
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <p>{card.detail}</p>
        </article>
      ))}
    </div>
  );
}

export function DashboardSurfaceGrid({
  children,
  columns = 2,
}: {
  children: ReactNode;
  columns?: 1 | 2 | 3;
}) {
  return (
    <div
      className={
        columns === 3
          ? "dashboard-surface-grid dashboard-surface-grid-three"
          : columns === 1
            ? "dashboard-surface-grid dashboard-surface-grid-single"
            : "dashboard-surface-grid"
      }
    >
      {children}
    </div>
  );
}

export function DashboardSurface({
  eyebrow,
  title,
  meta,
  children,
  tone = "default",
  className,
}: {
  eyebrow: string;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  tone?: "default" | "accent";
  className?: string;
}) {
  return (
    <article
      className={
        `${tone === "accent" ? "dashboard-surface dashboard-surface-accent" : "dashboard-surface"}${className ? ` ${className}` : ""}`
      }
    >
      <div className="dashboard-surface-header">
        <div>
          <p className="panel-title">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
        {meta ? <div className="dashboard-surface-meta">{meta}</div> : null}
      </div>
      {children}
    </article>
  );
}
