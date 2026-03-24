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

## 12 Codex prompts

Use **one prompt at a time**. The recommended order above still applies.

### Prompt 1: Model access layer

```text
You are Codex working inside /Users/a/repos/Delegate.

Implement the model runtime foundation for Delegate's public representative.

Current repo state:
- Telegram representative runtime exists
- FAQ/intake/handoff/compute flows are deterministic
- OpenViking memory exists
- compute approvals, artifacts, and billing exist
- there is no real OpenAI Responses runtime for representative replies yet
- there is no Anthropic secondary lane yet

Goal:
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
```

### Prompt 2: General compute plane

```text
You are Codex working inside /Users/a/repos/Delegate.

Upgrade Delegate's compute plane from per-execution `docker run --rm` into a more explicit reusable session/lease model without widening trust boundaries.

Current repo state:
- compute broker exists
- approvals, artifacts, and billing exist
- compute sessions are modeled in Prisma
- actual execution still launches one ephemeral Docker container per tool execution

Goal:
Move closer to a real compute-lease architecture while preserving today's safety and API behavior.

Implement end to end:
1. formalize session lease lifecycle in the broker
2. separate session management from execution management
3. add runner abstraction so Docker is the first backend and microVM can be added later
4. preserve policy, approval, billing, and artifact semantics
5. document the session/lease model

Constraints:
- no host execution for representative traffic
- no regression in current `exec / read / write / process / browser` flows
- keep Docker as the default backend for now
- do not add microVM as a hard dependency in this slice
```

### Prompt 3: Browser / computer use

```text
You are Codex working inside /Users/a/repos/Delegate.

Replace the current minimal browser capability with a real governed browser stack.

Current repo state:
- compute broker exists
- approvals, artifacts, and billing exist
- browser capability is currently a sandboxed fetch-style lane
- this is not sufficient for the intended Delegate architecture

Goal:
Implement a dual browser strategy foundation:
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

### Prompt 4: Permission system

```text
You are Codex working inside /Users/a/repos/Delegate.

Upgrade Delegate's capability permission system from representative-level defaults into a richer managed policy engine.

Current repo state:
- allow / ask / deny exists
- capability, path, domain, cost, and paid-plan rules exist
- representative-level compute defaults are editable in dashboard
- there is no managed/org-level policy layer yet

Goal:
Add the next layer of policy sophistication without making the product team-heavy before it is ready.

Implement end to end:
1. add managed policy concepts to the schema and runtime
2. support override precedence between managed defaults and representative settings
3. extend policy evaluation to include more explicit resource scope and plan/channel conditions
4. expose the right read-only / editable state in dashboard
5. add tests for precedence and deny behavior

Constraints:
- keep the public representative trust model strict
- representative-local settings must not be able to bypass managed deny rules
- do not introduce full team/IAM complexity beyond what this slice needs
```

### Prompt 5: Hooks and audit

```text
You are Codex working inside /Users/a/repos/Delegate.

Turn Delegate's hard-coded lifecycle interception points into an explicit hook system for compute, handoff, memory, and billing.

Current repo state:
- audit events already exist
- approvals, artifacts, and billing create event records
- OpenViking recall and commit traces exist
- there is no first-class lifecycle hook bus

Goal:
Implement an internal hook framework that can intercept and observe representative runtime events.

Implement end to end:
1. define hook phases such as:
   - PreToolUse
   - PostToolUse
   - SessionEnd
   - PreHandoff
   - MemoryCommit
   - BillingRecorded
2. wire compute broker and runtime paths through the hook layer
3. preserve current behavior by implementing default built-in hooks
4. document hook contracts and ordering
5. add tests proving hooks can block, annotate, and audit

Constraints:
- do not expose arbitrary user-authored hooks yet
- do not change business outcomes unless hook logic explicitly says so
- keep performance overhead small
```

### Prompt 6: Subagents / multi-agent

```text
You are Codex working inside /Users/a/repos/Delegate.

Introduce the first scoped subagent structure for Delegate without turning the product into an unbounded multi-agent playground.

Current repo state:
- structured collectors exist
- compute broker exists
- there are no explicit subagents with scoped tools, context, and budgets

Goal:
Add internal subagent boundaries for the public representative runtime.

Implement end to end:
1. define a minimal subagent abstraction
2. create initial subagents such as:
   - triage-agent
   - compute-agent
   - quote-agent
   - handoff-agent
3. scope each subagent's context and allowed capabilities
4. route the existing runtime through these abstractions where justified
5. add docs and tests for isolation boundaries

Constraints:
- do not create multiple anthropomorphic chat personas
- subagents are execution boundaries, not marketing personas
- keep trust, budget, and capability scopes explicit
```

### Prompt 7: Context management

```text
You are Codex working inside /Users/a/repos/Delegate.

Implement the next-generation context assembly layer for Delegate's public representative runtime.

Current repo state:
- Postgres stores workflow truth
- OpenViking stores public-safe long-term context
- compute artifacts live in object storage
- there is no explicit prompt assembler with static prefix, working context, and context editing

Goal:
Build a real context-management layer suitable for OpenAI Responses-based runtime.

Implement end to end:
1. define context layers:
   - static cached prefix
   - working context
   - tool/collector context
   - OpenViking long-term recall
2. build a context assembler in code
3. add lightweight context editing / trimming rules
4. add token accounting hooks for observability
5. document how artifacts and memory are intentionally kept separate

Constraints:
- do not treat transcript accumulation as the only context strategy
- do not mix raw artifacts into long-term memory
- keep public-safe boundaries explicit
```

### Prompt 8: Files and artifacts

```text
You are Codex working inside /Users/a/repos/Delegate.

Upgrade Delegate's artifact layer from stdout/stderr-centric storage into a broader file and deliverable system.

Current repo state:
- object storage exists
- stdout/stderr artifacts are persisted
- detail and download APIs exist
- dashboard artifact viewer exists

Goal:
Expand the artifact system toward a real representative file/output layer.

Implement end to end:
1. support additional artifact kinds such as:
   - screenshot
   - json
   - generated document
   - archive
2. improve metadata and retention handling
3. support pinned artifacts or owner-preserved artifacts
4. improve dashboard browsing/filtering/downloading
5. document how public materials vs compute outputs are distinguished

Constraints:
- keep object storage as the raw artifact layer
- do not move large artifacts into Postgres
- do not auto-promote raw files into memory
```

### Prompt 9: Memory

```text
You are Codex working inside /Users/a/repos/Delegate.

Strengthen Delegate's memory layer while preserving strict public-safety boundaries.

Current repo state:
- OpenViking integration exists
- public-safe filtering exists
- recall and commit traces exist
- memory is conservative and does not yet have strong promotion policies

Goal:
Turn the current memory layer into a more deliberate long-term context system.

Implement end to end:
1. define memory promotion rules from runtime events into OpenViking
2. improve safety classification before writes
3. distinguish clearly between:
   - resource memory
   - contact memory
   - representative agent patterns
4. add better owner-side visibility into what memory was promoted and why
5. add tests for memory leakage and unsafe-promotion prevention

Constraints:
- never store owner-private context
- never auto-promote raw compute output
- preserve representative/contact scoping
```

### Prompt 10: MCP and capability transport

```text
You are Codex working inside /Users/a/repos/Delegate.

Add the first real MCP-oriented capability transport layer to Delegate.

Current repo state:
- ClawHub discovery and provenance exist
- internal capability services exist
- there is no remote MCP execution path yet

Goal:
Add a safe remote capability transport layer aligned with MCP direction, without allowing arbitrary third-party code into the public runtime.

Implement end to end:
1. define MCP-capable capability metadata
2. add a remote MCP client/service path for approved capabilities
3. bind MCP capability execution to existing policy and approval layers
4. record provenance and audit for MCP calls
5. expose safe MCP-related visibility in dashboard

Constraints:
- no arbitrary plugin execution inside the representative runtime
- default to approval for remote capability execution
- maintain allowlisted resource/tool scope
```

### Prompt 11: Billing

```text
You are Codex working inside /Users/a/repos/Delegate.

Expand Delegate's dual-ledger system so it covers the full architecture, not just compute/storage seed costs.

Current repo state:
- wallet, sponsor pool, and Telegram Stars plans exist
- compute and storage debit entries exist
- conversation compute budget exists
- there is no model-cost accounting layer yet
- there is no productized Compute Pass yet

Goal:
Make billing match the intended product/economics architecture.

Implement end to end:
1. add internal accounting categories for:
   - model usage
   - compute minutes
   - browser minutes
   - storage bytes / egress
   - MCP/connector costs
2. preserve the external product model:
   - Free
   - Pass
   - Deep Help
   - Sponsor
   - add Compute Pass if justified
3. surface internal cost visibility for owners/admin analysis
4. add tests for debit order and fallback funding sources

Constraints:
- do not expose raw token pricing as the public product model
- keep sponsor pool and owner wallet semantics intact
- keep conversation-level compute budgets first-class
```

### Prompt 12: Final target stack convergence

```text
You are Codex working inside /Users/a/repos/Delegate.

Implement the next convergence slice that moves Delegate closer to the intended final architecture:
- public representative interface
- governed compute plane
- model runtime
- memory layer
- capability transport
- durable workflow backbone

Current repo state:
- public representative runtime exists
- governed compute exists
- OpenViking exists
- artifact layer exists
- model runtime, MCP transport, and Temporal are still incomplete or absent

Goal:
Close the highest-leverage remaining integration gaps after the lower-level slices are landed.

Implement a carefully scoped convergence pass that:
1. integrates the active model runtime with context assembly and billing
2. integrates the active browser/capability transport with policy and dashboard surfaces
3. adds Temporal-backed long-running workflow handling where it clearly replaces ad hoc logic
4. prepares the secrets/config boundary for future Vault/Infisical-style secret management
5. updates docs to reflect the new integrated architecture

Constraints:
- do not rewrite the whole system
- only integrate what the repo already has foundations for
- preserve Telegram-first product focus
- preserve strict public/private trust boundaries
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
