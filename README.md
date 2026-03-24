# Delegate

Delegate is a Telegram-native public representative system. It is built for founders, advisors, creators, recruiters, and other inbound-heavy operators who need a safe, always-on business-facing representative instead of a private assistant clone.

This repository starts with the narrowest useful wedge:

- Telegram only
- founder representative only
- public knowledge only
- bounded skills only
- human handoff and paid continuation built in

## What is in the repo right now

- A monorepo foundation for a web control plane and a Telegram bot runtime
- Shared domain models for representatives, contracts, plans, handoff, and action gates
- ClawHub-backed skill registry primitives for future representative skill packs
- OpenViking-backed public memory and context retrieval plumbing
- A deterministic policy engine that decides whether to answer, collect intake, hand off, or charge
- A public representative page and an owner dashboard with inbox + billing snapshots
- Telegram Stars invoice handling that writes back into conversations, wallet state, and owner inbox
- A Prisma schema, initial Postgres migration, and deterministic demo seed for the core product entities

## Why this architecture

The core product decision is that the representative is its own public runtime, not a filtered window into the owner's private workspace. That means:

- no private memory access
- no local filesystem access
- no owner account automation
- no arbitrary tool execution
- only public knowledge and explicitly allowed skills
- external skill registries must be source-auditable and non-privileged by default

This repo encodes that boundary in both docs and code through the `Action Gate` policy layer.

## Workspace layout

```text
apps/
  bot/          Telegram runtime powered by grammY
  web/          Public representative page + owner dashboard shell
packages/
  domain/       Shared schemas and demo representative data
  openviking/   Typed OpenViking client, URI rules, and safety filters
  registry/     External skill registry clients (ClawHub first)
  runtime/      Inquiry classification and action-gate policy engine
docs/
  architecture.md
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
- `web`
- `openviking`
- `openviking-console`
- `bot` when `TELEGRAM_BOT_TOKEN` is set in your shell or `.env`

Local URLs:

- app: `http://localhost:3000`
- OpenViking API: `http://localhost:1933`
- OpenViking console docs: `http://localhost:8020/docs`

For real OpenViking ingestion / recall / memory extraction, set either `OPENAI_API_KEY` or `ARK_API_KEY` before starting the stack. If model credentials are missing, Delegate still starts the OpenViking service for local development, but representative sync and memory capture stay safely blocked instead of attempting real writes with fake credentials.

If you only want the database container for local non-Docker app development, use:

```bash
pnpm docker:up:db
pnpm db:setup
pnpm dev:web
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
