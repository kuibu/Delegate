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
- A deterministic policy engine that decides whether to answer, collect intake, hand off, or charge
- A public representative page and dashboard stub in Next.js
- A Prisma schema for the core product entities

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
  registry/     External skill registry clients (ClawHub first)
  runtime/      Inquiry classification and action-gate policy engine
docs/
  architecture.md
  openclaw-adoption.md
  roadmap.md
prisma/
  schema.prisma
```

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm typecheck
pnpm test
pnpm registry:search:clawhub "qualification"
pnpm dev:web
pnpm dev:bot
```

## Current MVP slice

The first implemented slice is `Founder Representative / private chat / FAQ + intake + paid continuation`. It already models:

- public representative profile
- public knowledge pack
- free vs paid continuation
- collaboration and pricing intake
- human handoff routing
- explicit deny / ask-first / allow action gating

The next delivery slices are documented in [docs/roadmap.md](./docs/roadmap.md).
