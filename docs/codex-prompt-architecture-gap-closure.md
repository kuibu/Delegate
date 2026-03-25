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
- OpenAI Responses-backed reply generation with deterministic fallback
- OpenViking-backed public-safe memory layer
- ClawHub-backed skill discovery and provenance
- Playwright-backed deterministic browser lane with screenshot/json artifacts and dashboard preview
- governed compute plane with reusable leases, approvals, artifacts, and richer dual-ledger accounting
- lifecycle hook bus for model, handoff, and compute audit points
- owner dashboard control plane

Delegate does **not** yet have the full target stack described in the architecture decisions doc. In particular:

- no Anthropic secondary model lane
- no native Claude/OpenAI computer-use lane
- no Temporal orchestration
- no scoped subagents
- no org/customer-managed permission layer

Treat the matrix below as source of truth for "what is done vs. what is still next".

## Fresh review constraint

Before starting the next major slice, preserve this already-fixed review finding as an active constraint:

- compute authorization must remain conversation-scoped
- `contact.isPaid` is CRM/account state, not a compute plan-tier grant
- `activePlanTier` for governed compute should come from the current conversation unlock state such as `passUnlockedAt` and `deepHelpUnlockedAt`, or from an explicitly scoped entitlement record

This matters because every future capability lane must inherit the same conversation-scoped authorization semantics. Do not regress back to sticky contact-level plan grants.

## Implementation matrix

| # | Area | Current status | What is already in repo | Next step | Why it is not fully done yet | Priority |
|---|------|----------------|-------------------------|-----------|------------------------------|----------|
| 1 | Model access layer | Partial, foundation landed | Public runtime now has an `OpenAI Responses` answer lane, structured context assembly, usage ledger hooks, and deterministic fallback | Add Anthropic/Claude as the secondary lane, sharpen provider cooldown/fallback, and harden model cost accounting | The repo intentionally shipped the smallest trustworthy model path before adding a second provider lane | P1 |
| 2 | General compute plane | Partial, strong foundation | Docker-isolated broker, reusable compute leases, capability policy, approval flow, artifact persistence, richer debit path, Telegram `/compute` entry | Keep the reusable lease model, then prepare runner abstraction hardening and microVM upgrade path | Docker-backed leases are now real, but the runner stack is still single-backend and not microVM-ready yet | P1 |
| 3 | Browser / computer use | Partial, richer lane landed | A governed `browser` capability now runs through an isolated Playwright lane with approval, artifacts, screenshot/json outputs, and dashboard preview support | Add richer browser session management, multi-step browser workflows, and native Claude/OpenAI computer-use lanes behind approvals | The current slice proves governed browser execution and artifact UX, but not the higher-level native computer-use stack yet | P1 |
| 4 | Permission system | Partial, managed overlays landed | `allow / ask / deny`, capability rules, path/domain/cost/paid-plan gates, dashboard-editable compute defaults, managed overlay profiles with channel / plan-tier conditions, and conversation-scoped compute entitlements | Add richer resource scopes, customer/org policy overlays, and broader approval-aware capability binding across future transports | The product still has no org/IAM layer, and policy is still representative-centric rather than customer/org managed | P1 |
| 5 | Hooks and audit | Partial, explicit bus landed | Lifecycle hook bus now exists for `PreToolUse`, `PostToolUse`, `SessionEnd`, `PreHandoff`, and model reply/context audit points | Expand hooks into retention, memory filtering, billing budget gates, and owner-facing webhookable summaries | The first hook slice focused on making lifecycle boundaries explicit before adding programmable policies | P1 |
| 6 | Subagents / multi-agent | Not started | Structured collectors and compute broker exist, but there are no scoped subagents | Introduce explicit `triage-agent`, `compute-agent`, `browser-agent`, `quote-agent`, and `handoff-agent` with isolated budgets and tool scopes | This belongs to the next networked phase, not the current Founder Representative wedge | P2 |
| 7 | Context management | Partial, structured assembler landed | Postgres truth + OpenViking recall/commit + artifact store + ephemeral compute state are present, and the model lane now assembles contract/snapshot/collector/recent-turn/recall segments with token estimates | Add richer context editing, tool-result compaction, and adaptive recall/token budgeting | Advanced pruning is still heuristic and there is no Claude-style context editing or token-aware multi-provider stack yet | P1 |
| 8 | Files and artifacts | Partial, strong | Object storage, retention, representative/contact/session attribution, detail/download APIs, dashboard artifact viewer, pinned artifacts, download tracking, and artifact egress ledger entries | Expand beyond stdout/stderr into screenshots, generated docs, archives, richer filtering, and unified material/file workflows | Compute outputs and artifact governance shipped first; broader deliverable/file ergonomics are still ahead | P1 |
| 9 | Memory | Partial, strong | Public-safe OpenViking memory, filtering, provenance, recall traces, commit traces, separation from artifacts and Postgres truth | Add memory promotion rules, stronger safety classification, and tool-like memory access semantics for the future model runtime | The current design intentionally keeps memory conservative and bounded until the model layer is in place | P1 |
| 10 | MCP and capability transport | Partial, first remote path landed | ClawHub discovery/provenance, internal capability services, remote MCP execution, allowlists, provenance, policy binding, and approval defaults exist | Expand transport coverage, richer provenance, retry semantics, and stronger dashboard/approval ergonomics for remote capability execution | The first safe MCP path is in place, but it is still a narrow `streamable_http` lane without broader transport/runtime management | P1 |
| 11 | Billing | Partial, stronger foundation | Wallet, sponsor pool, conversation compute budget, compute/storage/egress ledger, Telegram Stars plans, and split usage-vs-debit execution billing | Add model cost accounting, browser/minutes accounting, MCP cost accounting, and a productized `Compute Pass` | Internal compute/storage/egress accounting landed before model/browser/MCP cost layers existed | P1 |
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

1. `P1-D` Richer browser session management and native computer-use preparation
2. `P1-E` Model billing expansion and provider secondary lane hardening
3. `P2-A` Scoped subagents
4. `P2-B` Temporal and broader agent-network infrastructure

Why this order:

- Row `2` is now strong enough that browser/native computer-use can deepen on top of a real lease/session substrate
- Row `11` now has a better base, so the next billing work should focus on model/browser/MCP cost layers instead of storage-only seed accounting
- Row `3` is the next natural product-facing step after reusable leases and artifact governance landed
- Row `6` should still wait until compute, billing, and capability boundaries are more stable

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
- browser capability now runs through an isolated Playwright lane
- screenshot/json artifacts and dashboard preview support exist
- this is still not sufficient for the intended Delegate architecture

Goal:
Implement a dual browser strategy foundation:
- Playwright/CDP deterministic lane first
- keep the interface ready for future native Claude/OpenAI computer-use lanes

Implement end to end:
1. browser-runner service or browser lane inside compute broker
2. session-scoped browser isolation
3. build on screenshot/download artifact persistence
4. approval gating for authenticated/destructive flows
5. deepen dashboard visibility for browser artifacts and browser session state
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
- stdout/stderr/json artifacts are persisted
- detail and download APIs exist
- dashboard artifact viewer exists
- pinned artifacts and download tracking exist

Goal:
Expand the artifact system from governed compute outputs into a broader representative file/output layer.

Implement end to end:
1. support additional artifact kinds such as:
   - screenshot
   - json
   - generated document
   - archive
2. improve metadata and retention handling
3. build on pinned artifacts or owner-preserved artifacts with better workflows
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

### Prompt 10: MCP and capability transport hardening

```text
You are Codex working inside /Users/a/repos/Delegate.

Harden and extend Delegate's MCP-oriented capability transport layer.

Current repo state:
- ClawHub discovery and provenance exist
- internal capability services exist
- remote MCP execution exists through the compute broker
- managed compute policy overlays exist
- compute authorization is already conversation-scoped and must stay that way

Goal:
Deepen the safe remote capability transport layer aligned with MCP direction, without allowing arbitrary third-party code into the public runtime.

Implement end to end:
1. expand transport/runtime coverage where it improves safety or operator value
2. strengthen provenance, retries, and failure classification for MCP calls
3. keep approval defaults and managed overlays authoritative for every remote capability invocation
4. maintain the conversation-scoped compute entitlement boundary with regression coverage
5. improve dashboard visibility for MCP bindings, approvals, and remote execution traces

Constraints:
- no arbitrary plugin execution inside the representative runtime
- default to approval for remote capability execution
- maintain allowlisted resource/tool scope
- do not regress to sticky `contact.isPaid -> pass` behavior
- preserve Delegate's public/private trust boundary and conversation-level product semantics
```

### Prompt 11: Billing

```text
You are Codex working inside /Users/a/repos/Delegate.

Expand Delegate's dual-ledger system so it covers the full architecture, not just compute/storage seed costs.

Current repo state:
- wallet, sponsor pool, and Telegram Stars plans exist
- compute, storage, and artifact-egress usage accounting exist
- execution billing now splits usage records from debit records
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
