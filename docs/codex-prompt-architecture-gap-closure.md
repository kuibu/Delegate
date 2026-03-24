# Codex Prompt: Architecture Gap Closure Matrix

You are working in `/Users/a/repos/Delegate`.

This document turns the current architecture-gap review into:

1. a concrete implementation matrix
2. a recommended execution order
3. ready-to-paste Codex prompts for the next rounds of vibe coding

The intent is to help Codex work from the repo's actual state, not from the aspirational end-state alone.

## Current repo truth

Delegate already has a meaningful middle state:

- Telegram-native public representative runtime
- deterministic FAQ / intake / handoff flow
- OpenViking-backed public-safe memory layer
- ClawHub-backed skill discovery and provenance
- governed compute plane with approvals, artifacts, and dual-ledger seed
- owner dashboard control plane

Delegate does **not** yet have the full target stack described in the architecture decisions doc. In particular:

- no direct OpenAI Responses runtime for representative replies
- no Anthropic secondary model lane
- no Playwright/CDP browser lane
- no native Claude/OpenAI computer-use lane
- no Temporal orchestration
- no remote MCP execution path
- no scoped subagents
- no org-managed permission layer

Treat the matrix below as source of truth for "what is done vs. what is still next".

## Implementation matrix

| # | Area | Current status | What is already in repo | Next step | Why it is not fully done yet | Priority |
|---|------|----------------|-------------------------|-----------|------------------------------|----------|
| 1 | Model access layer | Not started | Public runtime is still deterministic; OpenViking provider config exists, but it is not the representative reply runtime | Add `OpenAI Responses API` as primary runtime, Anthropic/Claude as secondary lane, with narrow provider abstraction and cost tracking | Trust/billing/compute foundation was prioritized before multi-model orchestration | P0 |
| 2 | General compute plane | Partial, strong foundation | Docker-isolated broker, capability policy, approval flow, artifact persistence, dual-ledger debit path, Telegram `/compute` entry | Turn logical `ComputeSession` into a real reusable lease model or runner abstraction, then prepare microVM upgrade path | Current implementation uses `docker run --rm` per execution because it was the fastest safe way to close approval/artifact/billing loops | P0 |
| 3 | Browser / computer use | Partial, intentionally minimal | A governed `browser` capability exists, but it currently behaves like an isolated fetch lane, not a real browser automation stack | Add `Playwright/CDP` deterministic lane first, then native Claude/OpenAI computer-use lane behind approvals | `V2.5` browser-heavy execution was intentionally deferred; current implementation only proves governance and billing | P0 |
| 4 | Permission system | Partial | `allow / ask / deny`, capability rules, path/domain/cost/paid-plan gates, dashboard-editable compute defaults | Add managed policy layers, richer resource scopes, channel/plan-tier conditions, and future org/team policy overlays | The product is still single-owner / single-representative first; no org/IAM model exists yet | P1 |
| 5 | Hooks and audit | Partial | Fixed audit events, approval events, artifact events, ledger events, OpenViking recall/commit traces | Extract an explicit lifecycle hook bus for `PreToolUse`, `PostToolUse`, `SessionEnd`, `PreHandoff`, and retention/memory filtering | Hard-coded lifecycle interception came first to make behavior safe before adding programmability | P1 |
| 6 | Subagents / multi-agent | Not started | Structured collectors and compute broker exist, but there are no scoped subagents | Introduce explicit `triage-agent`, `compute-agent`, `browser-agent`, `quote-agent`, and `handoff-agent` with isolated budgets and tool scopes | This belongs to the next networked phase, not the current Founder Representative wedge | P2 |
| 7 | Context management | Partial | Postgres truth + OpenViking recall/commit + artifact store + ephemeral compute state are present | Build a real prompt assembler with static prefix, working context, context editing, token accounting, and selective long-term recall | There is no primary LLM reply runtime yet, so advanced context shaping is not wired into generation | P1 |
| 8 | Files and artifacts | Partial, strong | Object storage, retention, representative/contact/session attribution, detail/download APIs, dashboard artifact viewer | Expand beyond stdout/stderr into screenshots, generated docs, archives, pinned artifacts, and unified material/file workflows | Compute outputs were the smallest high-value slice to ship first | P1 |
| 9 | Memory | Partial, strong | Public-safe OpenViking memory, filtering, provenance, recall traces, commit traces, separation from artifacts and Postgres truth | Add memory promotion rules, stronger safety classification, and tool-like memory access semantics for the future model runtime | The current design intentionally keeps memory conservative and bounded until the model layer is in place | P1 |
| 10 | MCP and capability transport | Partial | ClawHub discovery/provenance and internal capability services exist | Add remote MCP execution with allowlists, provenance, policy binding, and approval defaults | Third-party execution inside a public runtime is being deferred until internal capability paths are stable | P1 |
| 11 | Billing | Partial, strong seed | Wallet, sponsor pool, conversation compute budget, compute/storage ledger, Telegram Stars plans | Add model cost accounting, browser/minutes/egress accounting, MCP cost accounting, and a productized `Compute Pass` | Internal compute/storage accounting landed before model/browser/MCP cost layers existed | P1 |
| 12 | Final target stack | Partial overall | OpenViking, Postgres, object storage, Docker compute, capability policy, owner dashboard are live | Close rows `1, 3, 5, 7, 10, 11` and then add Temporal + secrets manager | The repo is at an intentional middle state: `public representative + governed compute`, not the full end-state | Reference |

## Key files by area

Use these as the main anchors for future implementation:

- Model/runtime today:
  - `apps/bot/src/index.ts`
  - `apps/bot/src/representative-config.ts`
  - `packages/runtime/src/structured-collector.ts`
- Compute plane:
  - `apps/compute-broker/src/index.ts`
  - `apps/compute-broker/src/executions.ts`
  - `apps/compute-broker/src/runner.ts`
  - `apps/compute-broker/src/billing.ts`
  - `apps/compute-broker/src/policy.ts`
- Memory/context:
  - `apps/bot/src/openviking-runtime.ts`
  - `packages/openviking/src/client.ts`
  - `packages/openviking/src/filter.ts`
- Skill/capability discovery:
  - `packages/registry/src/clawhub.ts`
- Dashboard/control plane:
  - `apps/web/app/dashboard/dashboard-compute.tsx`
  - `apps/web/app/dashboard/dashboard-representative-setup.tsx`
  - `packages/web-data/src/compute.ts`
- Data model:
  - `prisma/schema.prisma`

## Recommended execution order

Do **not** try to close all 12 rows in one pass.

Recommended order:

1. `P0-A` Model runtime foundation
2. `P0-B` Real browser/computer-use lane
3. `P1-A` Hook bus + richer context assembly
4. `P1-B` MCP transport + managed policy layers
5. `P1-C` Richer billing and file/artifact productization
6. `P2` Scoped subagents
7. `P2+` Temporal and broader agent-network infrastructure

Why this order:

- Rows `1 + 7 + 11` unlock the missing model-runtime backbone
- Row `3` removes the biggest mismatch between the desired architecture and the current "browser" implementation
- Rows `5 + 10` are easier to do correctly after model/runtime and browser lanes are real
- Row `6` should wait until the lower layers are stable

## Codex prompt rules

Use English prompts for Codex execution stability, but keep user-facing summaries and docs in concise English or Chinese as appropriate.

Every Codex run should follow these rules:

- preserve Delegate's public/private trust boundary
- do not introduce host execution for representative traffic
- do not add arbitrary third-party plugin code into the public runtime
- keep Postgres as transactional truth
- keep OpenViking as public-safe long-term context, not business-state truth
- keep object storage as the raw artifact layer
- prefer staged delivery over a giant rewrite
- finish each selected slice end-to-end: schema, runtime, API, dashboard, tests, docs, verification

## Recommended next prompt

This is the highest-leverage next Codex prompt.

```text
You are Codex working inside /Users/a/repos/Delegate.

Your task is to implement the next highest-leverage architecture slice for Delegate:

P0-A: Model runtime foundation for the public representative.

Current repo state:
- Telegram representative runtime exists
- FAQ/intake/handoff/compute flows are deterministic
- OpenViking memory exists
- compute approvals, artifacts, and billing exist
- there is no real OpenAI Responses runtime for representative replies yet
- there is no Anthropic secondary lane yet

Your goal:
Add a narrow, production-minded model access layer that uses:
- OpenAI Responses API as the primary runtime
- Anthropic / Claude as a secondary lane only where clearly justified

Do not build a giant multi-provider compatibility framework.
Do not turn Delegate into a private-assistant runtime.

Implement end to end:
1. provider abstraction with only the minimum supported providers
2. representative reply generation path using OpenAI Responses API
3. structured context assembly:
   - static representative prefix
   - current working context
   - OpenViking recall
   - current collector/tool state
4. basic token / usage accounting hooks into the internal ledger
5. safe fallbacks when model credentials are missing or provider calls fail
6. docs and verification

Important constraints:
- keep Telegram-only
- keep compute behind the existing broker
- do not widen trust boundaries
- keep deterministic collector and paywall flows authoritative
- use the model for routing/synthesis/clarification, not for business-state truth
- use apply_patch for edits

Key files:
- apps/bot/src/index.ts
- apps/bot/src/runtime-store.ts
- apps/bot/src/openviking-runtime.ts
- packages/runtime/src/structured-collector.ts
- prisma/schema.prisma
- docs/delegate-architecture-decisions.md

Acceptance criteria:
- representative replies can run through OpenAI Responses
- context assembly is explicit and bounded
- model failures fall back safely
- internal usage can be recorded for future margin analysis
- pnpm typecheck, pnpm test, pnpm build, and Docker startup still pass
```

## Follow-up prompt after that

Once the model runtime foundation lands, the next Codex run should target `P0-B`:

```text
You are Codex working inside /Users/a/repos/Delegate.

Your task is to replace the current minimal browser capability with a real governed browser stack.

Current repo state:
- compute broker exists
- approvals, artifacts, and billing exist
- browser capability is currently just a sandboxed fetch-style lane
- this is not sufficient for the intended Delegate architecture

Goal:
Implement a dual browser strategy:
- Playwright/CDP deterministic lane first
- keep the interface ready for future native Claude/OpenAI computer-use lanes

Implement end to end:
1. browser-runner service or browser lane inside compute broker
2. session-scoped browser isolation
3. screenshot/download artifact persistence
4. approval gating for authenticated/destructive flows
5. dashboard visibility for browser artifacts
6. docs and verification

Constraints:
- no host browser access
- no shared cookies across representatives
- no silent destructive browser actions
- preserve existing compute approvals and ledger behavior
```

## What Codex should not do

Do not ask Codex to:

- "implement all 12 rows at once"
- "rewrite the whole runtime"
- "add every possible provider"
- "turn ClawHub into direct third-party code execution"
- "mix artifacts into long-term memory"
- "add team/org permissions before the representative-level trust model is stable"

## Success condition for this document

A future Codex run should be able to read this file, choose the next priority slice, and implement it against the repo's actual current state without first re-deriving the architecture gap analysis from scratch.
