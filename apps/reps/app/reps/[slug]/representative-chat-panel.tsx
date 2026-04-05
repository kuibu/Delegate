"use client";

import { useState } from "react";

import type { PlanTier, PricingPlan } from "@delegate/domain";
import type { ModelRuntimeRecentTurn } from "@delegate/model-runtime";
import {
  DashboardPanelFrame,
  DashboardSignalStrip,
  DashboardSurface,
  DashboardSurfaceGrid,
} from "@delegate/web-ui";

import type { PublicChatResponse } from "./public-chat";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  meta?: {
    nextStep?: string;
    suggestedPlan?: PlanTier;
    providerLabel?: string;
  };
};

export function RepresentativeChatPanel(props: {
  representativeSlug: string;
  representativeName: string;
  identitySummary: string;
  pricing: PricingPlan[];
  locale: "zh" | "en";
  freeReplyLimit: number;
}) {
  const t = props.locale === "zh" ? zhCopy : enCopy;
  const [selectedTier, setSelectedTier] = useState<PlanTier>("free");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: t.welcome(props.representativeName, props.identitySummary),
    },
  ]);
  const [lastUsage, setLastUsage] = useState<PublicChatResponse["usage"]>({
    freeRepliesUsed: 0,
    freeRepliesRemaining: props.freeReplyLimit,
    passUnlocked: false,
    deepHelpUnlocked: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePlan =
    props.pricing.find((plan) => plan.tier === selectedTier) ?? props.pricing[0];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message || busy) {
      return;
    }

    const nextUserMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: message,
    };

    const nextMessages = [...messages, nextUserMessage];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/reps/${props.representativeSlug}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          tier: selectedTier,
          recentTurns: toRecentTurns(messages),
        }),
      });

      const payload = (await response.json()) as
        | PublicChatResponse
        | { error?: string };
      if (!response.ok || !("reply" in payload)) {
        throw new Error(
          "error" in payload ? payload.error ?? t.errorGeneric : t.errorGeneric,
        );
      }

      setLastUsage(payload.usage);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: payload.reply.text,
          meta: {
            nextStep: payload.plan.nextStep,
            ...(payload.plan.suggestedPlan
              ? { suggestedPlan: payload.plan.suggestedPlan }
              : {}),
            providerLabel:
              payload.runtime.usedModel && payload.runtime.provider
                ? `${payload.runtime.provider}${payload.runtime.model ? ` · ${payload.runtime.model}` : ""}`
                : t.fallbackLabel,
          },
        },
      ]);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : t.errorGeneric;
      setError(message);
      setMessages((current) => current.filter((entry) => entry.id !== nextUserMessage.id));
      setInput(message === t.errorGeneric ? input : "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardPanelFrame
      eyebrow={t.eyebrow}
      id="chat"
      summary={t.summary}
      title={t.title}
    >
      <DashboardSignalStrip
        cards={[
          {
            label: t.signalActiveTier,
            value: activePlan?.name ?? selectedTier,
            detail: activePlan?.summary ?? t.signalActiveTierDetail,
            tone: "accent",
          },
          {
            label: t.signalFreeReplies,
            value: `${lastUsage.freeRepliesRemaining}`,
            detail: t.signalFreeRepliesDetail(props.freeReplyLimit),
            tone: "safe",
          },
          {
            label: t.signalConversationDepth,
            value: lastUsage.deepHelpUnlocked
              ? t.depthDeep
              : lastUsage.passUnlocked
                ? t.depthPass
                : t.depthFree,
            detail: t.signalConversationDepthDetail,
          },
        ]}
      />

      <DashboardSurfaceGrid>
        <DashboardSurface
          eyebrow={t.tiersEyebrow}
          meta={<span className="chip chip-safe">{t.tiersChip(props.pricing.length)}</span>}
          title={t.tiersTitle}
          tone="accent"
        >
          <div className="representative-chat-tier-grid">
            {props.pricing.map((plan) => {
              const isActive = plan.tier === selectedTier;
              return (
                <button
                  className={
                    isActive
                      ? "representative-chat-tier representative-chat-tier-active"
                      : "representative-chat-tier"
                  }
                  key={plan.tier}
                  onClick={() => setSelectedTier(plan.tier)}
                  type="button"
                >
                  <div className="representative-chat-tier-header">
                    <strong>{plan.name}</strong>
                    <span>{plan.stars} Stars</span>
                  </div>
                  <p>{plan.summary}</p>
                  <div className="chip-row">
                    <span className="chip">{t.repliesChip(plan.includedReplies)}</span>
                    {plan.includesPriorityHandoff ? (
                      <span className="chip chip-safe">{t.priorityChip}</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </DashboardSurface>

        <DashboardSurface
          eyebrow={t.dialogEyebrow}
          meta={<span className="chip">{activePlan?.name ?? selectedTier}</span>}
          title={t.dialogTitle}
        >
          <div className="representative-chat-log">
            {messages.map((message) => (
              <article
                className={
                  message.role === "assistant"
                    ? "representative-chat-message representative-chat-message-assistant"
                    : "representative-chat-message representative-chat-message-user"
                }
                key={message.id}
              >
                <span className="panel-title">
                  {message.role === "assistant" ? props.representativeName : t.youLabel}
                </span>
                <p>{message.text}</p>
                {message.meta ? (
                  <div className="chip-row">
                    {message.meta.nextStep ? (
                      <span className="chip">{message.meta.nextStep}</span>
                    ) : null}
                    {message.meta.suggestedPlan ? (
                      <span className="chip chip-safe">
                        {t.suggestedPlan(message.meta.suggestedPlan)}
                      </span>
                    ) : null}
                    {message.meta.providerLabel ? (
                      <span className="chip">{message.meta.providerLabel}</span>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <form className="representative-chat-form" onSubmit={handleSubmit}>
            <label className="panel-title" htmlFor="representative-chat-input">
              {t.inputLabel}
            </label>
            <textarea
              className="dashboard-textarea representative-chat-textarea"
              id="representative-chat-input"
              onChange={(event) => setInput(event.target.value)}
              placeholder={t.placeholder}
              rows={5}
              value={input}
            />
            <div className="dashboard-form-footer">
              <p className="footer-note">{t.footnote}</p>
              <div className="button-row">
                <button
                  className="button-primary"
                  disabled={busy || input.trim().length === 0}
                  type="submit"
                >
                  {busy ? t.sending : t.send}
                </button>
              </div>
            </div>
          </form>

          {error ? <p className="feedback-error">{error}</p> : null}
        </DashboardSurface>
      </DashboardSurfaceGrid>
    </DashboardPanelFrame>
  );
}

function toRecentTurns(messages: ChatMessage[]): ModelRuntimeRecentTurn[] {
  return messages
    .filter((message) => message.id !== "welcome")
    .map((message) => ({
      direction: message.role === "assistant" ? "outbound" : "inbound",
      messageText: message.text,
      ...(message.meta?.nextStep ? { summary: message.meta.nextStep } : {}),
    }));
}

const zhCopy = {
  eyebrow: "Live Chat",
  summary:
    "先在网页里直接聊，再决定要不要去 Telegram、解锁更深服务，或升级给真人。",
  title: "代表页里直接开始一段真实对话",
  signalActiveTier: "当前档位",
  signalActiveTierDetail: "当前这轮对外服务的深度设置。",
  signalFreeReplies: "剩余免费轮次",
  signalFreeRepliesDetail: (limit: number) => `免费档默认可独立接住前 ${limit} 轮答复。`,
  signalConversationDepth: "服务深度",
  signalConversationDepthDetail: "档位越高，越适合继续追问、做 intake 或进入真人评估。",
  depthFree: "基础问路",
  depthPass: "继续判断",
  depthDeep: "深度服务",
  tiersEyebrow: "Service Tiers",
  tiersChip: (count: number) => `${count} 档`,
  tiersTitle: "四档对外服务，先选今天这轮该怎么接待",
  repliesChip: (count: number) => `${count} replies`,
  priorityChip: "优先转接",
  dialogEyebrow: "Conversation",
  dialogTitle: "网页聊天入口",
  youLabel: "你",
  suggestedPlan: (plan: PlanTier) => `建议升级到 ${plan}`,
  fallbackLabel: "规则回退",
  inputLabel: "想问什么？",
  placeholder:
    "例如：我是一家做 ToB 服务的团队，想让老贾先帮我判断合作方向，应该怎么开始？",
  footnote:
    "这里是公开、安全的代表对话，不会读取私有文件、账号或本地环境。复杂合作和敏感请求会被引导到更高档位或真人处理。",
  sending: "发送中…",
  send: "发送",
  errorGeneric: "聊天请求失败，请稍后再试。",
  welcome: (name: string, summary: string) =>
    `${name} 在这页就可以直接接待你。先说说你是谁、想解决什么，我会先用公开知识和安全边界内的方式回答你。\n\n${summary}`,
};

const enCopy = {
  eyebrow: "Live Chat",
  summary:
    "Start on the page, then decide whether the conversation should stay free, unlock a deeper tier, or escalate to a human.",
  title: "Start a real conversation directly on the representative page",
  signalActiveTier: "Active tier",
  signalActiveTierDetail: "The current service depth for this outward-facing conversation.",
  signalFreeReplies: "Free replies left",
  signalFreeRepliesDetail: (limit: number) =>
    `The free lane can independently absorb the first ${limit} replies.`,
  signalConversationDepth: "Conversation depth",
  signalConversationDepthDetail:
    "Higher tiers are better for continued back-and-forth, intake, and human review.",
  depthFree: "Foundational",
  depthPass: "Extended",
  depthDeep: "Deep service",
  tiersEyebrow: "Service Tiers",
  tiersChip: (count: number) => `${count} lanes`,
  tiersTitle: "Choose the outward-facing service layer before the conversation goes deeper",
  repliesChip: (count: number) => `${count} replies`,
  priorityChip: "priority handoff",
  dialogEyebrow: "Conversation",
  dialogTitle: "Web chat entry point",
  youLabel: "You",
  suggestedPlan: (plan: PlanTier) => `suggested ${plan}`,
  fallbackLabel: "rule fallback",
  inputLabel: "What do you want to ask?",
  placeholder:
    "For example: We run a B2B service team and want Lao Jia to qualify whether a collaboration makes sense before we involve a human.",
  footnote:
    "This is still a public-safe representative lane. It does not access private files, accounts, or local systems. Sensitive requests will be redirected into a higher tier or human review.",
  sending: "Sending…",
  send: "Send",
  errorGeneric: "Chat request failed. Please try again.",
  welcome: (name: string, summary: string) =>
    `${name} can already receive you directly on this page. Start with who you are and what you are trying to solve, and the representative will stay inside public knowledge and safe boundaries.\n\n${summary}`,
};
