<p align="center">
  <img src="./docs/assets/delegate-hero.png" alt="Delegate 首图，展示金融、法务、医疗和创作者场景" width="100%" />
</p>

<p align="center">
  <a href="./README.zh-CN.md"><img alt="中文" src="https://img.shields.io/badge/中文-2563EB?style=for-the-badge" /></a>
  <a href="./README.md"><img alt="English" src="https://img.shields.io/badge/English-111827?style=for-the-badge" /></a>
</p>

# Delegate

把 Delegate 想成一个“AI 接待前台”。

当别人通过 Telegram、WhatsApp、飞书等渠道来找你时，Delegate 会先让你的 AI 分身完成第一轮接待：

- 能回答的，先回答
- 该收费的，先收费
- 需要你拍板的，先请示你
- 需要人工接手的，再转给你

它的目标不是替代你，而是先把高频、标准化、可定价的对话接住，让你只在真正需要亲自出面的时刻介入。

Delegate 是一个 Telegram 原生的公共代表系统。它面向 founder、advisor、creator、recruiter 以及其他 inbound 很重的操盘者，提供的不是一个“私人助理分身”，而是一个安全、常在线、对外工作的业务代表。

这个仓库先从最窄、但已经有实际价值的切口开始：

- 只做 Telegram
- 只做 founder representative
- 只使用公开知识
- 只允许边界明确的技能
- 内建人工接管与付费续聊

## 当前仓库里有什么

- 一个 monorepo 基础，包含三个独立的 Web 端和一个 Telegram bot runtime
- 一个隔离的 compute plane 基础，带独立 broker、capability policy 包，以及 artifact 存储拓扑
- 代表、contract、plan、handoff 和 action gate 的共享领域模型
- 以 ClawHub 为底座的技能注册表原语，供后续 representative skill pack 使用
- 以 OpenViking 为底座的公开记忆与上下文检索管线
- 一个确定性的策略引擎，用来决定是直接回答、收集 intake、转人工，还是进入收费流程
- 一个基于 OpenAI Responses 的回答通道，并在模型凭证缺失或调用失败时提供确定性的回退
- 一个 Telegram `/compute` 通道，可创建沙箱 session，运行 `exec / read / write / process / browser` 请求，并把审批结果回传到聊天里
- 一个感知 workflow engine 的工作流运行器，先落地 approval 过期处理和 owner follow-up
- 三个独立的 Next.js 页面：营销站点、公开 representative 应用和 owner dashboard
- Telegram Stars 发票处理，结果会回写到会话、钱包状态和 owner inbox
- 一份 Prisma schema、首个 Postgres migration，以及核心产品实体的确定性 demo seed

## 为什么是这个架构

这个产品最核心的决策是：representative 应该拥有自己的公开运行时，而不是 owner 私人工作区的一个过滤窗口。这意味着：

- 不访问私有记忆
- 不直接访问宿主机文件系统
- 不自动化 owner 账号
- 通用的 `exec / read / write / process / browser` 只能通过隔离 compute plane 执行
- 只允许公开知识和显式授权的技能
- 外部技能注册表默认必须可审计源码，且不带特权

这个仓库通过 `Action Gate` 策略层，在文档和代码里同时把这条边界编码下来。

## 工作区结构

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

## 快速开始

```bash
pnpm install
cp .env.example .env
pnpm docker:up
pnpm typecheck
pnpm test
pnpm registry:search:clawhub "qualification"
```

`pnpm docker:up` 现在会通过 Docker Compose 启动整套本地栈：

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
- 当 shell 或 `.env` 里设置了 `TELEGRAM_BOT_TOKEN` 时，也会启动 `bot`

本地地址：

- website: `http://localhost:3000`
- dashboard: `http://localhost:3001/dashboard?view=overview`
- representative app: `http://localhost:3002/reps/lin-founder-rep`
- compute broker: `http://localhost:4010/health`
- workflow runner: `http://localhost:4020/health`
- Temporal gRPC（可选 profile）: `localhost:7233`
- Temporal UI（可选 profile）: `http://localhost:8233`
- artifact store API: `http://localhost:9000`
- artifact store console: `http://localhost:9001`
- OpenViking API: `http://localhost:1933`
- OpenViking console docs: `http://localhost:8020/docs`

在 Telegram 私聊里可以这样测试 representative 侧 compute：

```text
/compute pwd
/compute read README.md
/compute write notes/demo.txt ::: hello from delegate
/compute browser https://example.com
```

当前的 native computer-use 准备工作是建立在保留的浏览器 session 通道之上的。为了给未来的 OpenAI / Claude computer-use loop 暴露出一个“可以接管”的状态，请设置以下一个或两个变量：

- `COMPUTE_NATIVE_OPENAI_MODEL`
- `COMPUTE_NATIVE_ANTHROPIC_MODEL`

同时设置对应 provider 的凭证：

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

如果这些变量未设置，Delegate 仍然会保留 Playwright 浏览器 session、截图和页面 JSON，但 dashboard 会正确显示 native computer-use 还没有准备好。

如果你要启用真实的 OpenViking ingestion / recall / memory extraction，请在启动整套栈之前设置 `OPENAI_API_KEY` 或 `ARK_API_KEY`。如果模型凭证缺失，Delegate 仍会为本地开发启动 OpenViking 服务，但 representative sync 和 memory capture 会被安全地阻止，而不是拿着伪造凭证去尝试真实写入。

如果你要启用通过 OpenAI Responses 生成 representative 回复，并在需要时回退到 Anthropic，请设置：

- `DELEGATE_MODEL_ENABLED=true`
- `DELEGATE_MODEL_PROVIDER=openai`
- `DELEGATE_MODEL_FALLBACK_PROVIDER=anthropic`
- `DELEGATE_OPENAI_MODEL=gpt-5-mini`
- `DELEGATE_ANTHROPIC_MODEL=claude-sonnet-4-5`
- `DELEGATE_MODEL_MAX_INPUT_TOKENS=2400`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

如果两个 provider 都不可用，Telegram bot 会回退到现有的确定性 reply preview，而不是让整段对话直接失败。

内部模型成本核算可以按 provider 分别配置：

- `DELEGATE_OPENAI_INPUT_COST_USD_PER_1M_TOKENS`
- `DELEGATE_OPENAI_OUTPUT_COST_USD_PER_1M_TOKENS`
- `DELEGATE_ANTHROPIC_INPUT_COST_USD_PER_1M_TOKENS`
- `DELEGATE_ANTHROPIC_OUTPUT_COST_USD_PER_1M_TOKENS`

这些值会写入内部的 `MODEL_USAGE` ledger。如果你希望 dashboard 和审计轨迹里出现非零模型 COGS，请让它们和你当前 provider 的实际价格保持一致。

当前模型通道还包含一个结构化 context assembler 和一组生命周期 trace：

- representative contract + snapshot segments
- active collector state and recent-turn working context
- OpenViking recall trimmed by input budget
- lifecycle hook traces for model context assembly, model reply completion, handoff preparation, tool preflight, tool completion, and session termination

第一段 durable workflow 也已经落地：

- approval request 会在超时窗口后自动过期
- owner handoff request 可以排队发送定时 follow-up reminder
- workflow 的真实状态保存在 Postgres 中，并显示在 dashboard overview
- workflow run 现在会携带 engine metadata，因此本地 runner 和未来的 Temporal worker 可以共享同一个 enqueue 边界
- 当 Temporal profile 开启时，workflow run 现在也可以通过真实的 Temporal worker bridge 分发执行

为了让本地开发保持安全，Delegate 仍默认使用内建 runner：

- `WORKFLOW_ENGINE=local_runner`

如果你想提前为未来的 Temporal worker 做准备，同时不破坏本地行为，请设置：

- `WORKFLOW_ENGINE=temporal`
- `WORKFLOW_TEMPORAL_ADDRESS`
- `WORKFLOW_TEMPORAL_NAMESPACE`
- `WORKFLOW_TEMPORAL_TASK_QUEUE`

如果 Temporal 相关字段没有配全，Delegate 现在会回退到本地 runner，而不是静默地把任务塞进一个没人处理的队列。

如果你想本地把 Temporal profile 从头到尾跑起来，请使用：

```bash
pnpm docker:up:temporal
```

这个命令会启动：

- `temporal-db-init`
- `temporal`
- `temporal-ui`
- `temporal-namespace-init`
- `workflow-runner`，并设置 `WORKFLOW_ENGINE=temporal`

启动完成后，`http://localhost:4020/health` 应该返回：

- `engine: "temporal"`
- `temporalReady: true`
- `temporalBridgeState.status: "running"`

如果你只想在本地非 Docker 的应用开发里启动数据库容器，请使用：

```bash
pnpm docker:up:db
pnpm db:setup
pnpm dev:site
pnpm dev:dashboard
pnpm dev:reps
pnpm dev:bot
```

常用 Docker 命令：

```bash
pnpm docker:ps
pnpm docker:logs
pnpm docker:down
```

## 当前 MVP 范围

第一段已经实现的切片是 `Founder Representative / private chat / FAQ + intake + paid continuation`。它已经覆盖：

- 公开 representative 档案
- 公开知识包
- 免费与付费续聊
- 协作与报价 intake
- 人工接管路由
- owner inbox 状态流转
- Telegram Stars 发票创建与付款确认持久化
- 显式的 deny / ask-first / allow action gate
- 以 representative 为作用域的 OpenViking 同步、recall trace、commit trace，以及安全的 memory preview

下一批交付切片记录在 [docs/roadmap.md](./docs/roadmap.md)。

## OpenViking 环境变量

通用配置：

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

Provider 配置：

- OpenAI 路径：`OPENVIKING_PROVIDER=openai`、`OPENAI_API_KEY`，可选 `OPENAI_BASE_URL`
- Volcengine 路径：`OPENVIKING_PROVIDER=volcengine`、`ARK_API_KEY`，可选 `ARK_API_BASE`

更多细节见 [docs/openviking-integration.md](./docs/openviking-integration.md)。

更偏前瞻的架构决策，包括隔离 compute plane 和 capability gate 的方向，见 [docs/delegate-architecture-decisions.md](./docs/delegate-architecture-decisions.md)。
Phase A compute plane 的具体交付清单见 [docs/v2-isolated-compute-plane-plan.md](./docs/v2-isolated-compute-plane-plan.md)。
用于补齐剩余架构缺口的 implementation matrix 和可直接粘贴使用的 Codex prompts 见 [docs/codex-prompt-architecture-gap-closure.md](./docs/codex-prompt-architecture-gap-closure.md)。

当前受治理的 compute 切片已经提供：

- `exec / read / write / process / browser`
- Docker 隔离执行
- 基于 Playwright 的确定性浏览器通道
- 由策略驱动的 `allow / ask / deny`
- 带 channel / plan-tier 条件的 Delegate 管理型策略覆盖
- 面向高风险请求的 approval 创建与处理
- stdout/stderr artifact 持久化到 MinIO
- owner dashboard 中可见的 compute 通道，能查看 session、approval、artifact 和 ledger
- 面向 representative compute 请求的 Telegram `/compute` 集成
