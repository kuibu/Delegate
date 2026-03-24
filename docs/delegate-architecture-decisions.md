# Delegate Architecture Decisions

## Status

Directional architecture decisions captured on 2026-03-24. This document updates the product-level target state for Delegate's next phase. It does not claim that all of these decisions are implemented in code today.

## Core shift

Delegate is no longer aiming for "public bot with bounded workflows only." The target state is:

- a Telegram-native public representative plane
- a default-isolated compute plane backed by Docker or VMs
- a control plane for policy, billing, handoff, and audit
- a memory plane that separates public-safe context from transactional state

The product boundary still matters:

- the representative is public-facing
- compute must be isolated by default
- owner secrets and private workspace state must stay out of representative memory
- high-impact actions still require policy and approval

## One-line model

```text
Representative Plane -> Capability Gate -> Isolated Compute Plane -> Audit + Billing + Memory Filters
```

## Adopt / Reject / Replace / Later

| Area | Adopt | Reject | Replace with | Later |
| --- | --- | --- | --- | --- |
| Model access | OpenClaw-style provider abstraction, auth normalization, cooldown, and fallback | OpenClaw-style "support every possible auth path" sprawl in the public product path | OpenAI Responses API as the primary runtime; Anthropic as secondary for compute-heavy lanes | Add more providers only when a concrete owner segment needs them |
| Compute plane | OpenClaw's sandbox mindset and tool taxonomy | Host-first execution, optional sandboxing, `elevated`-style host escape hatches for representative traffic | Docker per session by default; stronger isolation with microVMs where needed | Capability marketplace across remote compute pools |
| Browser / computer use | OpenClaw's browser/node split and policy framing | A single generic browser wrapper as the only browser strategy | Dual browser stack: Playwright/CDP for deterministic flows, OpenAI/Anthropic native computer-use lanes for ambiguous UI tasks | Multi-browser pools and domain-specialized browser agents |
| Tool permissions | OpenClaw allow/deny matrices; Claude Code-style permission ergonomics | Prompt-only guardrails and coarse binary allowlists | A policy engine with `allow`, `ask`, `deny`, and org-managed defaults | Customer-specific policy packs and signed capability templates |
| Hooks / lifecycle | Claude Code hooks model | Pure after-the-fact logs | Interceptable lifecycle hooks around tool use, handoff, memory commit, and billing | Customer webhooks and programmable automations |
| Workflow orchestration | Session stickiness and failure-aware routing | One giant agent loop owning all business state | Typed workflow handlers now; Temporal for long-running business flows | Localized LangGraph subflows when agentic interrupts add real value |
| Context and memory | OpenClaw continuity mindset; Claude prompt caching, context editing, and memory-tool principles | Mixing transcript, artifacts, and owner-private memory in one store | Postgres for truth, OpenViking for public-safe long-term context, artifact storage for raw outputs, ephemeral compute state for sandbox-local files | Memory promotion policies learned from owner feedback |
| Files and artifacts | Claude Files API product pattern | Storing large artifacts inside conversation transcript or long-term memory | Object storage + metadata + retention policies + summary extraction | Searchable artifact catalogs per representative |
| Capability transport | OpenClaw discovery thinking; Anthropic MCP direction | Arbitrary plugin code running inside representative runtime | Internal capability services plus remote MCP servers with explicit policy and provenance | External skill marketplace with signed trust tiers |
| Billing | OpenClaw usage visibility; Anthropic's separate compute-meter mindset | Treating token cost as the user-facing product price | Dual ledger: user credits/packs externally, model + compute + browser + storage cost internally | Dynamic margin-aware pricing and sponsor automation |
| Multi-agent | Claude Code subagent boundary model | OpenClaw-style persona multiplication without hard boundaries | Explicit subagents with scoped context, scoped tools, and scoped budgets | Full agent network routing and capability graph |

## Recommended stack

### 1. Representative plane

- Telegram gateway for private chat, mention/reply, and deep links
- public representative profile, knowledge pack, pricing, and handoff policy
- deterministic first-response workflows for FAQ, intake, quote, schedule, and paid unlock prompts

### 2. Compute plane

- sandbox-by-default capability runner
- `exec`, `read`, `write`, `process`, and `browser` provided through isolated sessions
- Docker per session to start
- microVMs for stronger isolation when owners need higher assurance

### 3. Browser stack

- Playwright/CDP lane for stable structured browser tasks
- native computer-use lane for fuzzy UI tasks
- isolated browser sessions with per-session cookies, downloads, and artifacts

### 4. Policy and approval plane

- `allow`: low-risk actions run automatically
- `ask`: sensitive actions require approval
- `deny`: forbidden actions never run
- managed org defaults that representatives cannot silently override

### 5. Workflow plane

- typed TypeScript workflow handlers for today's core product paths
- Temporal for retries, compensations, SLA windows, reminders, and asynchronous completion
- model reasoning used for routing, summarization, and parameter filling, not as the only source of workflow truth

### 6. Memory and state

- Postgres for contacts, conversations, invoices, handoffs, wallets, analytics, and policy decisions
- OpenViking for public-safe long-term context and representative patterns
- object storage for raw screenshots, logs, files, and generated outputs
- ephemeral sandbox state that is destroyed or retained under explicit policy

### 7. Capability transport

- internal capability services for first-party tools
- remote MCP servers for approved external capabilities
- provenance and trust tier metadata stored for every installed capability

## Claude-inspired decisions worth explicitly borrowing

### Permission ergonomics

Borrow from Claude Code:

- `allow / ask / deny`
- managed settings
- explicit directory and resource scope
- strong default-deny handling for sensitive paths and domains

Reference:

- <https://docs.anthropic.com/en/docs/claude-code/settings>
- <https://docs.anthropic.com/s/claude-code-security>
- <https://docs.anthropic.com/en/docs/claude-code/team>

### Hooks

Borrow from Claude Code hooks:

- pre-tool intercepts
- post-tool cleanup and summarization
- task/session completion hooks

Delegate should use these for:

- approval interception
- cost budget checks
- artifact retention decisions
- memory filtering
- owner-facing audit summaries

Reference:

- <https://code.claude.com/docs/en/hooks>

### Subagents

Borrow from Claude Code subagents:

- scoped context
- scoped tools
- scoped prompts
- scoped budgets

Delegate should apply this to:

- triage agent
- compute agent
- browser agent
- quote agent
- handoff summarizer

Reference:

- <https://docs.anthropic.com/en/docs/claude-code/sub-agents>

### Context management

Borrow from Claude API:

- prompt caching for stable representative prefixes
- context editing for pruning stale tool results
- fine-grained tool streaming for responsive live status
- memory-tool philosophy that long-term memory is not the same as transcript

References:

- <https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching>
- <https://platform.claude.com/docs/en/build-with-claude/context-editing>
- <https://platform.claude.com/docs/en/agents-and-tools/tool-use/fine-grained-tool-streaming>
- <https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool>

### Compute as a first-class meter

Borrow from Anthropic's code-execution product design:

- compute is distinct from token generation
- files in and files out are first-class
- sessions and outputs have their own lifecycle

Delegate should mirror that idea with:

- compute-minute accounting
- browser-minute accounting
- artifact accounting
- user-facing compute-inclusive product packs

Reference:

- <https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool>

## What Delegate should explicitly not copy from OpenClaw

### Do not copy host-first execution

OpenClaw's runtime is powerful, but Delegate should not let representative traffic run directly on the owner's host machine. Representative-triggered compute must start inside a sandbox.

### Do not copy monolithic runtime ownership of business state

OpenClaw's agent loop is the heart of a private runtime. Delegate's business truth should remain in explicit workflow and database state, especially for billing, handoff, and priorities.

### Do not copy local-profile-centric secret handling as the product default

That pattern is reasonable for a personal assistant. It is not the right default for a public representative network.

### Do not copy arbitrary plugin execution inside the public runtime

Discovery and provenance are useful. Executable authority should live in isolated capability services instead.

## Immediate build order

1. Formalize the `capability gate` schema with `allow / ask / deny`.
2. Introduce session-scoped compute leases for `exec / read / write / process / browser`.
3. Add artifact storage and retention policy.
4. Add Temporal for long-running handoff and owner follow-up flows.
5. Split browser execution into deterministic and native computer-use lanes.
6. Add Claude-style hooks around tool execution and memory commit.

The phased implementation sequence that maps these decisions onto product delivery lives in [docs/roadmap.md](./roadmap.md).

## Sources

- OpenClaw model providers: <https://docs.openclaw.ai/concepts/model-providers>
- OpenClaw failover: <https://docs.openclaw.ai/concepts/model-failover>
- OpenClaw tools: <https://docs.openclaw.ai/tools>
- OpenClaw sandboxing: <https://docs.openclaw.ai/gateway/sandboxing>
- OpenClaw usage tracking: <https://docs.openclaw.ai/concepts/usage-tracking>
- Anthropic MCP announcement: <https://www.anthropic.com/news/model-context-protocol>
- Anthropic agent capabilities announcement: <https://claude.com/blog/agent-capabilities-api>
- Claude computer use: <https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool>
- Claude code execution: <https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool>
- Claude files: <https://platform.claude.com/docs/en/build-with-claude/files>
- Claude prompt caching: <https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching>
- Claude context editing: <https://platform.claude.com/docs/en/build-with-claude/context-editing>
- Claude fine-grained tool streaming: <https://platform.claude.com/docs/en/agents-and-tools/tool-use/fine-grained-tool-streaming>
- Claude memory tool: <https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool>
- Claude Code settings: <https://docs.anthropic.com/en/docs/claude-code/settings>
- Claude Code security: <https://docs.anthropic.com/s/claude-code-security>
- Claude Code team / IAM: <https://docs.anthropic.com/en/docs/claude-code/team>
- Claude Code hooks: <https://code.claude.com/docs/en/hooks>
- Claude Code subagents: <https://docs.anthropic.com/en/docs/claude-code/sub-agents>
- Temporal docs: <https://docs.temporal.io/>
