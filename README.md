# Delegate

Delegate is a Telegram-native public representative system. It is built for founders, advisors, creators, recruiters, and other inbound-heavy operators who need a safe, always-on business-facing representative instead of a private assistant clone.

This repository starts with the narrowest useful wedge:

- Telegram only
- founder representative only
- public knowledge only
- bounded skills only
- human handoff and paid continuation built in

## What is in the repo right now

- A monorepo foundation for three separate web surfaces plus a Telegram bot runtime
- An isolated compute-plane foundation with a dedicated broker, capability policy package, and artifact storage topology
- Shared domain models for representatives, contracts, plans, handoff, and action gates
- ClawHub-backed skill registry primitives for future representative skill packs
- OpenViking-backed public memory and context retrieval plumbing
- A deterministic policy engine that decides whether to answer, collect intake, hand off, or charge
- An OpenAI Responses-backed answer lane with deterministic fallback when model credentials are missing or calls fail
- A Telegram `/compute` lane that can create sandboxed sessions, run `exec / read / write / process / browser` requests, and surface approval outcomes back to chat
- An engine-aware workflow runner that processes approval expiry and owner follow-up as the first durable workflow slice
- Three distinct Next.js surfaces: a marketing site, a public representative app, and an owner dashboard
- Telegram Stars invoice handling that writes back into conversations, wallet state, and owner inbox
- A Prisma schema, initial Postgres migration, and deterministic demo seed for the core product entities

## Why this architecture

The core product decision is that the representative is its own public runtime, not a filtered window into the owner's private workspace. That means:

- no private memory access
- no direct host filesystem access
- no owner account automation
- general-purpose `exec / read / write / process / browser` only through an isolated compute plane
- only public knowledge and explicitly allowed skills
- external skill registries must be source-auditable and non-privileged by default

This repo encodes that boundary in both docs and code through the `Action Gate` policy layer.

## Workspace layout

```text
apps/
  bot/          Telegram runtime powered by grammY
  compute-broker/ Isolated compute session broker (Phase A)
  reps/         Public representative pages
  site/         Marketing website
  web/          Owner dashboard control plane
  workflow-runner/ Durable timer and follow-up workflow service
packages/
  artifacts/    Artifact object-key and retention helpers
  capability-policy/ Capability gate evaluation primitives
  compute-protocol/ Typed compute broker payloads and schemas
  domain/       Shared schemas and demo representative data
  openviking/   Typed OpenViking client, URI rules, and safety filters
  registry/     External skill registry clients (ClawHub first)
  runtime/      Inquiry classification and action-gate policy engine
  web-data/     Shared dashboard/public-page data access helpers
  web-ui/       Shared design system and control-plane UI primitives
  workflows/    Shared workflow kinds, inputs, and scheduling helpers
docs/
  architecture.md
  codex-prompt-architecture-gap-closure.md
  delegate-architecture-decisions.md
  openclaw-adoption.md
  openviking-integration.md
  roadmap.md
prisma/
  schema.prisma
```

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm docker:up
pnpm typecheck
pnpm test
pnpm registry:search:clawhub "qualification"
```

`pnpm docker:up` now boots the whole local stack with Docker Compose:

- `postgres`
- `migrate`
- `site`
- `dashboard`
- `reps`
- `compute-broker`
- `workflow-runner`
- `artifact-store`
- `artifact-store-init`
- `openviking`
- `openviking-console`
- `bot` when `TELEGRAM_BOT_TOKEN` is set in your shell or `.env`

Local URLs:

- website: `http://localhost:3000`
- dashboard: `http://localhost:3001/dashboard?view=overview`
- representative app: `http://localhost:3002/reps/lin-founder-rep`
- compute broker: `http://localhost:4010/health`
- workflow runner: `http://localhost:4020/health`
- Temporal gRPC (optional profile): `localhost:7233`
- Temporal UI (optional profile): `http://localhost:8233`
- artifact store API: `http://localhost:9000`
- artifact store console: `http://localhost:9001`
- OpenViking API: `http://localhost:1933`
- OpenViking console docs: `http://localhost:8020/docs`

Representative-side compute examples in Telegram private chat:

```text
/compute pwd
/compute read README.md
/compute write notes/demo.txt ::: hello from delegate
/compute browser https://example.com
```

Native computer-use preparation now builds on the retained browser session lane. To surface a ready handoff state for future OpenAI / Claude computer-use loops, set one or both of:

- `COMPUTE_NATIVE_OPENAI_MODEL`
- `COMPUTE_NATIVE_ANTHROPIC_MODEL`

and the matching provider credentials:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

If these are unset, Delegate still keeps Playwright browser sessions, screenshots, and page JSON, but the dashboard will correctly show that native computer-use is not ready yet.

For real OpenViking ingestion / recall / memory extraction, set either `OPENAI_API_KEY` or `ARK_API_KEY` before starting the stack. If model credentials are missing, Delegate still starts the OpenViking service for local development, but representative sync and memory capture stay safely blocked instead of attempting real writes with fake credentials.

For representative reply generation through OpenAI Responses with optional Anthropic fallback, set:

- `DELEGATE_MODEL_ENABLED=true`
- `DELEGATE_MODEL_PROVIDER=openai`
- `DELEGATE_MODEL_FALLBACK_PROVIDER=anthropic`
- `DELEGATE_OPENAI_MODEL=gpt-5-mini`
- `DELEGATE_ANTHROPIC_MODEL=claude-sonnet-4-5`
- `DELEGATE_MODEL_MAX_INPUT_TOKENS=2400`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

If both providers are unavailable, the Telegram bot falls back to the existing deterministic reply previews instead of failing the conversation.

Internal model-cost accounting is configurable per provider via:

- `DELEGATE_OPENAI_INPUT_COST_USD_PER_1M_TOKENS`
- `DELEGATE_OPENAI_OUTPUT_COST_USD_PER_1M_TOKENS`
- `DELEGATE_ANTHROPIC_INPUT_COST_USD_PER_1M_TOKENS`
- `DELEGATE_ANTHROPIC_OUTPUT_COST_USD_PER_1M_TOKENS`

These values feed the internal `MODEL_USAGE` ledger. Keep them aligned with your current provider pricing if you want non-zero model COGS in the dashboard and audit trail.

The current model lane also ships a structured context assembler and lifecycle traces:

- representative contract + snapshot segments
- active collector state and recent-turn working context
- OpenViking recall trimmed by input budget
- lifecycle hook traces for model context assembly, model reply completion, handoff preparation, tool preflight, tool completion, and session termination

The first durable workflow slice is also live:

- approval requests can expire automatically after their timeout window
- owner handoff requests can enqueue timed follow-up reminders
- workflow truth stays in Postgres and is surfaced in the dashboard overview
- workflow runs now carry engine metadata so the local runner and a future Temporal worker can share the same enqueue boundary
- workflow runs can now dispatch through a real Temporal worker bridge when the Temporal profile is enabled

To keep local development safe, Delegate still defaults to the built-in runner:

- `WORKFLOW_ENGINE=local_runner`

If you want to prepare for a future Temporal worker without breaking local behavior, set:

- `WORKFLOW_ENGINE=temporal`
- `WORKFLOW_TEMPORAL_ADDRESS`
- `WORKFLOW_TEMPORAL_NAMESPACE`
- `WORKFLOW_TEMPORAL_TASK_QUEUE`

If the Temporal fields are incomplete, Delegate now falls back to the local runner instead of silently enqueueing unserviceable jobs.

If you want to run the local Temporal profile end to end, use:

```bash
pnpm docker:up:temporal
```

That command boots:

- `temporal-db-init`
- `temporal`
- `temporal-ui`
- `temporal-namespace-init`
- `workflow-runner` with `WORKFLOW_ENGINE=temporal`

Once it is up, `http://localhost:4020/health` should report:

- `engine: "temporal"`
- `temporalReady: true`
- `temporalBridgeState.status: "running"`

If you only want the database container for local non-Docker app development, use:

```bash
pnpm docker:up:db
pnpm db:setup
pnpm dev:site
pnpm dev:dashboard
pnpm dev:reps
pnpm dev:bot
```

Useful Docker commands:

```bash
pnpm docker:ps
pnpm docker:logs
pnpm docker:down
```

## Current MVP slice

The first implemented slice is `Founder Representative / private chat / FAQ + intake + paid continuation`. It already models:

- public representative profile
- public knowledge pack
- free vs paid continuation
- collaboration and pricing intake
- human handoff routing
- owner inbox status flow
- Telegram Stars invoice creation + payment confirmation persistence
- explicit deny / ask-first / allow action gating
- representative-scoped OpenViking sync, recall traces, commit traces, and safe memory previews

The next delivery slices are documented in [docs/roadmap.md](./docs/roadmap.md).

## OpenViking env vars

Common settings:

- `OPENVIKING_ENABLED`
- `OPENVIKING_BASE_URL`
- `OPENVIKING_API_KEY`
- `OPENVIKING_ROOT_API_KEY`
- `OPENVIKING_TIMEOUT_MS`
- `OPENVIKING_CONSOLE_URL`
- `OPENVIKING_AGENT_ID_PREFIX`
- `OPENVIKING_RESOURCE_SYNC_ENABLED`
- `OPENVIKING_AUTO_RECALL_DEFAULT`
- `OPENVIKING_AUTO_CAPTURE_DEFAULT`

Provider settings:

- OpenAI path: `OPENVIKING_PROVIDER=openai`, `OPENAI_API_KEY`, optional `OPENAI_BASE_URL`
- Volcengine path: `OPENVIKING_PROVIDER=volcengine`, `ARK_API_KEY`, optional `ARK_API_BASE`

More detail lives in [docs/openviking-integration.md](./docs/openviking-integration.md).

The forward-looking architecture decisions, including the isolated compute plane and capability-gate direction, live in [docs/delegate-architecture-decisions.md](./docs/delegate-architecture-decisions.md).
The concrete Phase A compute-plane delivery checklist lives in [docs/v2-isolated-compute-plane-plan.md](./docs/v2-isolated-compute-plane-plan.md).
The implementation matrix and ready-to-paste Codex prompts for closing the remaining architecture gaps live in [docs/codex-prompt-architecture-gap-closure.md](./docs/codex-prompt-architecture-gap-closure.md).

The current governed compute slice now ships:

- `exec / read / write / process / browser`
- Docker-isolated execution
- Playwright-backed deterministic browser lane
- policy-driven `allow / ask / deny`
- Delegate-managed policy overlays with channel / plan-tier conditions
- approval creation and resolution for risky requests
- stdout/stderr artifact persistence to MinIO
- owner dashboard compute lane with session, approval, artifact, and ledger visibility
- Telegram `/compute` integration for representative-facing compute requests
