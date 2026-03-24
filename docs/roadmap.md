# Delegate Roadmap

This roadmap reflects two truths at once:

- Delegate still needs to win the narrow founder-representative wedge on Telegram.
- Delegate is now targeting an isolated compute plane behind that public interface, not just bounded FAQ workflows.

The sequence below is ordered to protect the product thesis first, then add general compute without collapsing the trust boundary.

## V1: Public Representative Core

Goal: prove that a stranger can understand the representative in 10 seconds and get value in one private chat session.

Build:

- one representative
- private chat entry
- public representative page
- FAQ answering
- material delivery
- free usage contract
- `Pass` purchase trigger
- owner inbox for human handoff
- OpenViking-backed public-safe memory

Success:

- owner can publish in 15 minutes
- most common inbound questions are handled without the owner
- first paid unlock happens without custom explanation
- memory improves replies without leaking owner-private context

## V1.5: Deep Service and Group Mode

Goal: turn Telegram into a real inbound channel that can qualify, route, and convert more than one-off FAQ traffic.

Build:

- mention/reply group mode
- group-to-private-chat routing
- source attribution on leads
- sponsor pool messaging
- structured intake forms
- quote request collector
- scheduling intent collector
- paid priority routing
- "should the owner take this?" summary

Success:

- group mentions convert into private chat continuations
- repeat paid usage emerges
- owner dashboard shows clear follow-up priorities
- no noisy unsolicited replies in groups

## V2: Isolated Compute Plane

Goal: let representatives safely use general compute without turning the public product into a host-level assistant.

Build:

- capability gate with `allow / ask / deny`
- session-scoped compute leases
- Docker-per-session sandbox for `exec / read / write / process`
- artifact storage for logs, files, screenshots, and outputs
- dual ledger accounting for model + compute + browser cost
- audit trail for all compute actions

Success:

- representatives can complete scoped general-compute tasks without host access
- owners can see what ran, why it ran, what it cost, and what files were produced
- sensitive actions are intercepted instead of silently executed

## V2.5: Browser and Native Computer Use

Goal: add browser execution as a governed product surface instead of a generic automation hack.

Build:

- deterministic browser lane with Playwright/CDP
- native computer-use lane for ambiguous UI tasks
- isolated browser sessions with per-session cookies and download scope
- domain and action policy controls
- approval flow for destructive or authenticated actions

Success:

- representative can complete browser-heavy tasks with visible safety boundaries
- owner can approve risky actions before execution
- browser artifacts are searchable and auditable

## V3: Durable Workflows and Capability Network

Goal: move from isolated tasks to reliable multi-step service delivery.

Build:

- Temporal-backed long-running workflows
- retries, compensations, SLA timers, and follow-up automations
- capability services and remote MCP servers
- signed trust tiers and provenance for installed capabilities
- scoped subagents for triage, browser, compute, and handoff

Success:

- long-running tasks survive restarts and partial failures
- capability execution is composable without arbitrary plugin code in the representative runtime
- multiple specialized agents can cooperate without sharing unlimited context or tools

## V4: Optimization and Network Layer

Goal: improve conversion, trust, and operating leverage while preparing for a broader agent network.

Build:

- FAQ gap analytics
- source-level conversion analysis
- compute and browser margin analytics
- richer intake templates by representative type
- memory promotion policies based on owner feedback
- cross-representative capability graph and marketplace experiments

Success:

- more paid continuations per inbound contact
- fewer low-value manual handoffs
- clearer operating playbook for each representative template
- viable path from public representative product to broader capability network
