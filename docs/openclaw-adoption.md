# OpenClaw Adoption Notes

Reference analyzed: [`openclaw/openclaw` tag `v2026.3.22-beta.1`](https://github.com/openclaw/openclaw/tree/v2026.3.22-beta.1)

## What OpenClaw is technically

OpenClaw is a large TypeScript monorepo built around a host gateway plus channel integrations, agent runtimes, skills, plugins, and optional native/mobile apps.

Observed stack highlights:

- `pnpm` workspace monorepo
- TypeScript + Node.js runtime
- `vitest` for tests
- `oxlint` + `oxfmt` for lint/format
- `lit` for the web UI layer
- `express` and `hono` in gateway/server code
- native iOS/Android/macOS companion apps
- a plugin SDK with many subpath exports

Key source references:

- Root stack and scripts: <https://github.com/openclaw/openclaw/blob/v2026.3.22-beta.1/package.json>
- Workspace layout: <https://github.com/openclaw/openclaw/blob/v2026.3.22-beta.1/pnpm-workspace.yaml>
- Skills CLI: <https://github.com/openclaw/openclaw/blob/v2026.3.22-beta.1/src/cli/skills-cli.ts>
- ClawHub client: <https://github.com/openclaw/openclaw/blob/v2026.3.22-beta.1/src/infra/clawhub.ts>
- ClawHub skill installer/origin tracking: <https://github.com/openclaw/openclaw/blob/v2026.3.22-beta.1/src/agents/skills-clawhub.ts>
- Mention gating: <https://github.com/openclaw/openclaw/blob/v2026.3.22-beta.1/src/channels/mention-gating.ts>

## What we should absorb

### 1. ClawHub as a minimal skill registry

OpenClaw treats ClawHub as a public registry with:

- search
- install
- update
- source metadata persistence
- compatibility metadata

For Delegate, the valuable part is not generic plugin execution. The valuable part is the registry pattern:

- public skill discovery
- explicit source attribution
- versioned installs
- update tracking

### 2. Group activation should be policy, not ad hoc logic

OpenClaw models mention gating explicitly. That is directly relevant to our Telegram group plan.

Delegate should keep:

- `mention_only`
- `reply_or_mention`
- maybe `always` only for tightly controlled environments

and never silently default to ambient group listening.

### 3. Skills should carry install provenance

OpenClaw stores origin and lock metadata for ClawHub-installed skills. That makes updates and audits predictable.

Delegate should mirror the idea in app-level data:

- source = builtin / owner upload / clawhub
- slug
- installed version
- verification tier
- installed at

## What we should not absorb

### 1. Multi-channel-first architecture

OpenClaw is deliberately wide. Delegate is deliberately narrow.

We should not import:

- channel-agnostic abstractions before Telegram depth is proven
- plugin execution surfaces that widen the public runtime trust boundary
- host-level tool access patterns

### 2. General plugin execution in the public runtime

OpenClaw supports skills plus code plugins. Delegate should only adopt the registry/discovery habit for now, not the plugin execution model.

Our representative runtime is public-facing and must remain close to zero-risk with respect to:

- private memory
- filesystem access
- shell access
- owner account access

## Decision

Adopt now:

- ClawHub search/detail client
- skill source metadata in domain + database
- explicit Telegram group activation policy

Defer:

- remote archive install and unpack
- plugin execution
- generic multi-channel abstractions

## Why this is the right cut

EUREKA: the thing worth copying from OpenClaw is not the breadth of its runtime. It is the discipline around provenance, gating, and skill distribution. For Delegate, importing those habits without importing the execution surface gives us leverage without breaking the trust model.
