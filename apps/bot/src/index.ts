import "dotenv/config";

import { demoRepresentative, type PlanTier } from "@delegate/domain";
import { Channel } from "@prisma/client";
import {
  advanceStructuredCollector,
  beginStructuredCollector,
  createConversationPlan,
  formatStructuredCollectorPrompt,
  formatStructuredCollectorSummary,
  renderReplyPreview,
  resolveTelegramGroupHandling,
  shouldStartStructuredCollector,
  type ConversationPlan,
  type StructuredCollectorState,
} from "@delegate/runtime";
import { Bot, InlineKeyboard } from "grammy";

import {
  clearStructuredCollectorState,
  confirmInvoicePayment,
  createPlanInvoice,
  getActiveRepresentativeSlugForChat,
  getConversationContext,
  markInvoiceDeliveryFailed,
  maybeCreateHandoffRequest,
  recordInboundTurn,
  recordOutboundReply,
  setActiveRepresentativeForChat,
  setStructuredCollectorState,
  submitStructuredCollector,
  updateStructuredCollectorState,
  validatePendingInvoice,
} from "./runtime-store";
import { getRepresentativeRuntimeConfig } from "./representative-config";
import {
  captureTurnToOpenViking,
  recallOpenVikingContext,
  storeCollectorMemory,
  storePaymentMemory,
} from "./openviking-runtime";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.log("TELEGRAM_BOT_TOKEN is missing. Copy .env.example to .env and set your bot token.");
  process.exit(0);
}

const bot = new Bot(token);
const me = await bot.api.getMe();

await bot.api.setMyCommands([
  { command: "start", description: "Introduce the representative" },
  { command: "plans", description: "Show Free / Pass / Deep Help / Sponsor" },
  { command: "buy", description: "Buy Pass / Deep Help / Sponsor in Telegram Stars" },
  { command: "paysupport", description: "Explain payment and refund support" },
]);

bot.command("start", async (ctx) => {
  if (!ctx.from) {
    await ctx.reply("当前无法识别你的 Telegram 身份，请稍后重试。");
    return;
  }

  const defaultRepresentativeSlug = process.env.DEMO_REP_SLUG || demoRepresentative.slug;
  const payload = ctx.match?.trim();
  const startPayload = parseStartPayload(payload, defaultRepresentativeSlug);
  let activeRepresentativeSlug = startPayload.representativeSlug;

  if (ctx.chat.type === "private") {
    try {
      activeRepresentativeSlug = await setActiveRepresentativeForChat({
        telegramChatId: ctx.chat.id,
        telegramUserId: ctx.from.id,
        representativeSlug: startPayload.representativeSlug,
      });
    } catch (error) {
      console.warn("Unable to switch representative session:", error);
      activeRepresentativeSlug = defaultRepresentativeSlug;
    }
  }

  const representative = await getRepresentativeRuntimeConfig(activeRepresentativeSlug);

  if (startPayload.purchaseTier && ctx.chat.type === "private") {
    await ctx.reply(
      `当前入口已切换到 ${representative.name}，正在为你打开 ${formatPlanName(startPayload.purchaseTier)}。`,
    );
    await sendPlanInvoice(ctx, startPayload.purchaseTier, activeRepresentativeSlug);
    return;
  }

  const payloadNote =
    payload && activeRepresentativeSlug !== defaultRepresentativeSlug
      ? `当前正在和 ${representative.name} 对话。这个会话会继续沿用该代表的公开知识与收费规则。`
      : "你进入的是默认 Founder Representative 演示入口。";

  await ctx.reply(
    [
      representative.name,
      representative.tagline,
      payloadNote,
      `免费规则：前 ${representative.contract.freeReplyLimit} 条回复适合基础问答与资料领取。`,
      "我可以回答 FAQ、发资料、收集合作与报价信息，并在必要时发起人工转接。",
      "你也可以随时用 /plans 或 /buy pass 来触发 Telegram Stars 续用。",
    ].join("\n\n"),
    {
      reply_markup: buildPlansKeyboard(),
    },
  );
});

bot.command("plans", async (ctx) => {
  const representativeSlug = await resolveRepresentativeSlugForChat(
    ctx.chat.type,
    ctx.chat.id,
  );
  const representative = await getRepresentativeRuntimeConfig(representativeSlug);
  await sendPlansMessage(ctx, representative);
});

bot.command("buy", async (ctx) => {
  const tier = parseTierToken(ctx.match?.trim());
  if (!tier) {
    await ctx.reply("用法：/buy pass 或 /buy deep_help 或 /buy sponsor");
    return;
  }

  if (ctx.chat.type !== "private") {
    await ctx.reply("Stars invoice 建议在 bot 私聊里完成。请先私聊我，再发送 /buy。");
    return;
  }

  await sendPlanInvoice(ctx, tier);
});

bot.command("paysupport", async (ctx) => {
  await ctx.reply(
    [
      "Telegram Stars 支付完成后，我会自动把 invoice、解锁状态和 owner wallet 同步进系统。",
      "如果你需要退款或人工协助，请直接说明发票背景，我会把请求送进 ask-first / owner inbox 流程。",
    ].join("\n\n"),
  );
});

bot.callbackQuery(/^buy:(pass|deep_help|sponsor)$/i, async (ctx) => {
  await ctx.answerCallbackQuery();

  if (ctx.chat?.type !== "private") {
    await ctx.reply("请先在 bot 私聊里完成支付。");
    return;
  }

  const tier = parseTierToken(ctx.match[1]);
  if (!tier) {
    await ctx.reply("无法识别要购买的计划。");
    return;
  }

  await sendPlanInvoice(ctx, tier);
});

bot.callbackQuery("plans:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  const representativeSlug = await resolveRepresentativeSlugForChat(
    ctx.chat?.type ?? "private",
    ctx.chat?.id ?? ctx.from.id,
  );
  const representative = await getRepresentativeRuntimeConfig(representativeSlug);
  await sendPlansMessage(ctx, representative);
});

bot.on("pre_checkout_query", async (ctx) => {
  try {
    await validatePendingInvoice(
      ctx.preCheckoutQuery.invoice_payload,
      ctx.preCheckoutQuery.from.id,
    );
    await ctx.answerPreCheckoutQuery(true);
  } catch (error) {
    await ctx.answerPreCheckoutQuery(
      false,
      error instanceof Error ? error.message : "This invoice is no longer available.",
    );
  }
});

bot.on("message:successful_payment", async (ctx) => {
  const payment = ctx.message.successful_payment;

  try {
    const confirmed = await confirmInvoicePayment({
      invoicePayload: payment.invoice_payload,
      totalAmount: payment.total_amount,
      telegramPaymentChargeId: payment.telegram_payment_charge_id,
      ...(payment.provider_payment_charge_id
        ? { providerPaymentChargeId: payment.provider_payment_charge_id }
        : {}),
    });

    const replyText = [
      `已确认 ${confirmed.planName} 付款，收到 ${confirmed.starsAmount} Stars。`,
      "你的会话深度已经解锁；如果需要我继续做需求采集、报价梳理或升级转人工，直接继续发消息就可以。",
    ].join("\n\n");

    await ctx.reply(replyText);

    const context = await getConversationContext(confirmed.representativeSlug, {
      telegramUserId: ctx.from.id,
      ...(ctx.from.username ? { username: ctx.from.username } : {}),
      ...buildDisplayName(ctx.from.first_name, ctx.from.last_name),
      chatId: ctx.chat.id,
      channel: Channel.PRIVATE_CHAT,
    });

    await storePaymentMemory({
      context,
      planName: confirmed.planName,
      starsAmount: confirmed.starsAmount,
    });
    await captureTurnToOpenViking({
      context,
      chatId: ctx.chat.id,
      userText: `Payment confirmed for ${confirmed.planName}.`,
      assistantText: replyText,
      recalled: [],
      reason: "payment_confirmed",
      usedSkill: {
        uri: "delegate://skills/payment-confirmation",
        input: { planType: confirmed.planType },
        output: replyText,
        success: true,
      },
    });
  } catch (error) {
    await ctx.reply(
      error instanceof Error
        ? error.message
        : "付款已收到，但写入系统时出现问题。请发送 /paysupport。",
    );
  }
});

bot.on("message:text", async (ctx) => {
  const rawText = ctx.message.text.trim();

  if (rawText.startsWith("/")) {
    return;
  }

  const isPrivate = ctx.chat.type === "private";
  const isReplyToBot = ctx.message.reply_to_message?.from?.id === me.id;
  const mentionsBot =
    typeof me.username === "string" &&
    rawText.toLowerCase().includes(`@${me.username.toLowerCase()}`);
  const representativeSlug = await resolveRepresentativeSlugForChat(
    ctx.chat.type,
    ctx.chat.id,
  );
  const representative = await getRepresentativeRuntimeConfig(representativeSlug);

  const groupHandling = resolveTelegramGroupHandling({
    chatType: ctx.chat.type,
    activation: representative.groupActivation,
    wasMentioned: mentionsBot,
    isReplyToRepresentative: isReplyToBot,
  });

  if (!groupHandling.shouldHandle) {
    return;
  }

  const text = stripBotMention(rawText, me.username);
  const channel = mapMessageToChannel(ctx.chat.type, isReplyToBot);
  const runtimeChannel =
    isPrivate ? "private_chat" : isReplyToBot ? "group_reply" : "group_mention";
  const normalizedText = text.length > 0 ? text : rawText;

  let conversationContext:
    | Awaited<ReturnType<typeof getConversationContext>>
    | null = null;

  try {
    conversationContext = await getConversationContext(representativeSlug, {
      telegramUserId: ctx.from.id,
      ...(ctx.from.username ? { username: ctx.from.username } : {}),
      ...buildDisplayName(ctx.from.first_name, ctx.from.last_name),
      chatId: ctx.chat.id,
      channel,
    });
  } catch (error) {
    console.warn("Bot persistence unavailable:", error);
  }

  const plan = createConversationPlan({
    text: normalizedText,
    channel: runtimeChannel,
    representative,
    usage:
      conversationContext?.usage ?? {
        freeRepliesUsed: 0,
        passUnlocked: false,
        deepHelpUnlocked: false,
      },
  });

  const recalled = conversationContext
    ? await recallOpenVikingContext({
        context: conversationContext,
        chatId: ctx.chat.id,
        queryText: normalizedText,
        includeL2: plan.intent === "materials",
      })
    : [];

  if (conversationContext?.collectorState) {
    const collectorPlan = buildCollectorConversationPlan(conversationContext.collectorState);

    await recordInboundTurn({
      context: conversationContext,
      plan: collectorPlan,
      text: normalizedText,
    });

    if (isCollectorCancelMessage(normalizedText)) {
      await clearStructuredCollectorState(conversationContext);

      const replyText = [
        representative.name,
        representative.tagline,
        "已停止当前结构化采集。你可以重新描述需求，我会判断是继续 FAQ、重新开始报价采集，还是转人工。",
      ]
        .filter(Boolean)
        .join("\n\n");

      await ctx.reply(replyText);
      await recordOutboundReply({
        context: conversationContext,
        plan: collectorPlan,
        messageText: replyText,
      });
      await captureTurnToOpenViking({
        context: conversationContext,
        chatId: ctx.chat.id,
        userText: normalizedText,
        assistantText: replyText,
        recalled,
        reason: "collector_cancelled",
      });
      return;
    }

    const advanced = advanceStructuredCollector(
      conversationContext.collectorState,
      normalizedText,
    );

    if (!advanced.state) {
      await clearStructuredCollectorState(conversationContext);
      await ctx.reply("当前 intake 状态不可恢复，我已经先结束这轮采集。请重新描述你的需求。");
      return;
    }

    if (!advanced.completed) {
      await updateStructuredCollectorState({
        context: conversationContext,
        collectorState: advanced.state,
      });

      const replyText = [
        representative.name,
        representative.tagline,
        formatStructuredCollectorPrompt(advanced.state),
      ]
        .filter(Boolean)
        .join("\n\n");

      await ctx.reply(replyText, buildPlanReplyOptions(collectorPlan));
      await recordOutboundReply({
        context: conversationContext,
        plan: collectorPlan,
        messageText: replyText,
      });
      await captureTurnToOpenViking({
        context: conversationContext,
        chatId: ctx.chat.id,
        userText: normalizedText,
        assistantText: replyText,
        recalled,
        reason: "collector_step",
        usedSkill: {
          uri: "delegate://skills/structured-collector",
          input: {
            kind: advanced.state.kind,
            stepIndex: advanced.state.stepIndex,
          },
          output: replyText,
          success: true,
        },
      });
      return;
    }

    const submitted = await submitStructuredCollector({
      context: conversationContext,
      collectorState: advanced.state,
    });

    const completionNote =
      advanced.state.kind === "scheduling"
        ? "预约意向已经整理完成。"
        : "报价 / 合作背景已经整理完成。";
    const paidFollowup =
      !conversationContext.contactIsPaid && advanced.state.suggestedPlan
        ? `如果你希望我继续保留更长上下文并优先推进，可以继续解锁 ${formatPlanName(advanced.state.suggestedPlan)}。`
        : "接下来主人会基于这份结构化摘要判断是否亲自接手。";
    const replyText = [
      representative.name,
      representative.tagline,
      completionNote,
      formatStructuredCollectorSummary(advanced.state),
      `已创建 owner inbox 收件项：${submitted.handoffId}`,
      submitted.recommendedOwnerAction,
      paidFollowup,
    ]
      .filter(Boolean)
      .join("\n\n");

    await ctx.reply(replyText, buildPlanReplyOptions(collectorPlan));
    await recordOutboundReply({
      context: conversationContext,
      plan: collectorPlan,
      messageText: replyText,
    });
    await storeCollectorMemory({
      context: conversationContext,
      collectorState: advanced.state,
      summary: submitted.summary,
    });
    await captureTurnToOpenViking({
      context: conversationContext,
      chatId: ctx.chat.id,
      userText: normalizedText,
      assistantText: replyText,
      recalled,
      reason: advanced.state.kind === "scheduling" ? "scheduling_collector_completed" : "quote_collector_completed",
      usedSkill: {
        uri: "delegate://skills/structured-collector",
        input: {
          kind: advanced.state.kind,
          answers: advanced.state.answers,
        },
        output: submitted.summary,
        success: true,
      },
    });
    return;
  }

  if (conversationContext) {
    await recordInboundTurn({
      context: conversationContext,
      plan,
      text: normalizedText,
    });
  }

  if (conversationContext && shouldStartStructuredCollector(plan)) {
    const collector = beginStructuredCollector({
      plan,
      channel: runtimeChannel,
    });

    await setStructuredCollectorState({
      context: conversationContext,
      collectorState: collector,
    });

    const replyText = [
      representative.name,
      representative.tagline,
      formatStructuredCollectorPrompt(collector),
      "如果你想中途结束，直接发送 取消 即可。",
    ]
      .filter(Boolean)
      .join("\n\n");

    const replyMarkup = buildPlanKeyboardForConversation(plan);
    await ctx.reply(replyText, replyMarkup ? { reply_markup: replyMarkup } : {});

    await recordOutboundReply({
      context: conversationContext,
      plan,
      messageText: replyText,
    });
    await captureTurnToOpenViking({
      context: conversationContext,
      chatId: ctx.chat.id,
      userText: normalizedText,
      assistantText: replyText,
      recalled,
      reason: "collector_started",
      usedSkill: {
        uri: "delegate://skills/structured-collector",
        input: {
          kind: collector.kind,
          intent: collector.intent,
        },
        output: replyText,
        success: true,
      },
    });
    return;
  }

  const handoff = conversationContext
    ? await maybeCreateHandoffRequest({
        context: conversationContext,
        plan,
        text: normalizedText,
      })
    : null;

  const replyText = [
    renderReplyPreview(representative, plan),
    handoff ? `已创建 owner inbox 收件项：${handoff.id}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const replyMarkup = buildPlanKeyboardForConversation(plan);
  await ctx.reply(replyText, replyMarkup ? { reply_markup: replyMarkup } : {});

  if (conversationContext) {
    await recordOutboundReply({
      context: conversationContext,
      plan,
      messageText: replyText,
    });
    await captureTurnToOpenViking({
      context: conversationContext,
      chatId: ctx.chat.id,
      userText: normalizedText,
      assistantText: replyText,
      recalled,
      reason: normalizeOpenVikingReason(plan.nextStep),
    });
  }
});

bot.catch((error) => {
  console.error("Telegram bot error:", error.error);
});

console.log(`Starting Delegate bot as @${me.username ?? "unknown"}...`);
await bot.start();

async function sendPlansMessage(ctx: any, representative: Awaited<ReturnType<typeof getRepresentativeRuntimeConfig>>) {
  await ctx.reply(
    representative.pricing
      .map(
        (plan) =>
          `${plan.name} · ${plan.stars} Stars\n${plan.summary}\nIncluded replies: ${plan.includedReplies}`,
      )
      .join("\n\n"),
    {
      reply_markup: buildPlansKeyboard(),
    },
  );
}

async function sendPlanInvoice(ctx: any, tier: PlanTier, preferredRepresentativeSlug?: string) {
  let invoice:
    | Awaited<ReturnType<typeof createPlanInvoice>>
    | undefined;

  try {
    const representativeSlug =
      preferredRepresentativeSlug ??
      (await resolveRepresentativeSlugForChat(
        ctx.chat?.type ?? "private",
        ctx.chat?.id ?? ctx.from.id,
      ));
    const context = await getConversationContext(representativeSlug, {
      telegramUserId: ctx.from.id,
      ...(ctx.from.username ? { username: ctx.from.username } : {}),
      ...buildDisplayName(ctx.from.first_name, ctx.from.last_name),
      chatId: ctx.chat.id,
      channel: Channel.PRIVATE_CHAT,
    });

    invoice = await createPlanInvoice({
      context,
      tier,
    });

    await ctx.replyWithInvoice(
      invoice.title,
      buildInvoiceDescription(tier),
      invoice.payload,
      "XTR",
      [{ label: invoice.title, amount: invoice.starsAmount }],
      {
        start_parameter: buildStartPayloadForPurchase(representativeSlug, tier),
        protect_content: true,
      },
    );
  } catch (error) {
    if (invoice?.invoiceId) {
      await markInvoiceDeliveryFailed(invoice.invoiceId);
    }

    await ctx.reply(
      error instanceof Error
        ? error.message
        : "当前无法创建 Stars invoice，请稍后重试。",
    );
  }
}

function stripBotMention(text: string, username: string | undefined): string {
  if (!username) {
    return text;
  }

  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`@${escaped}`, "ig"), "").trim();
}

function buildPlansKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Buy Pass", "buy:pass")
    .text("Buy Deep Help", "buy:deep_help")
    .row()
    .text("Sponsor", "buy:sponsor");
}

function buildPlanKeyboardForConversation(plan: ConversationPlan): InlineKeyboard | undefined {
  if (plan.nextStep === "offer_paid_unlock" && plan.suggestedPlan) {
    return new InlineKeyboard().text(
      `Unlock ${formatPlanName(plan.suggestedPlan)}`,
      `buy:${plan.suggestedPlan}`,
    );
  }

  if (plan.suggestedPlan) {
    return new InlineKeyboard()
      .text(`Buy ${formatPlanName(plan.suggestedPlan)}`, `buy:${plan.suggestedPlan}`)
      .row()
      .text("See all plans", "plans:show");
  }

  return undefined;
}

function buildPlanReplyOptions(plan: ConversationPlan) {
  const replyMarkup = buildPlanKeyboardForConversation(plan);
  return replyMarkup ? { reply_markup: replyMarkup } : {};
}

function buildInvoiceDescription(tier: PlanTier): string {
  switch (tier) {
    case "deep_help":
      return "Unlock longer context, richer intake, and priority human review where applicable.";
    case "sponsor":
      return "Fund the representative's public credit pool so more inbound users can get free help first.";
    case "pass":
    case "free":
    default:
      return "Unlock a longer paid follow-up conversation for intake, materials, and clearer next steps.";
  }
}

function formatPlanName(tier: PlanTier): string {
  switch (tier) {
    case "deep_help":
      return "Deep Help";
    case "sponsor":
      return "Sponsor";
    case "pass":
    case "free":
    default:
      return "Pass";
  }
}

function parseTierToken(value: string | undefined): PlanTier | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/-/g, "_");
  if (normalized === "pass" || normalized === "deep_help" || normalized === "sponsor") {
    return normalized;
  }

  return null;
}

function parseStartPayload(
  payload: string | undefined,
  defaultRepresentativeSlug: string,
): {
  representativeSlug: string;
  purchaseTier?: PlanTier;
} {
  if (!payload) {
    return {
      representativeSlug: defaultRepresentativeSlug,
    };
  }

  const normalized = payload.trim().toLowerCase();

  if (normalized.startsWith("rep_")) {
    return {
      representativeSlug: normalized.slice(4) || defaultRepresentativeSlug,
    };
  }

  if (normalized.startsWith("buy_")) {
    const [representativeSlug, tierToken] = normalized.slice(4).split("__");
    const purchaseTier = parseTierToken(tierToken);

    return {
      representativeSlug: representativeSlug || defaultRepresentativeSlug,
      ...(purchaseTier ? { purchaseTier } : {}),
    };
  }

  if (normalized.startsWith("buy-")) {
    const purchaseTier = parseTierToken(normalized.slice(4));
    return {
      representativeSlug: defaultRepresentativeSlug,
      ...(purchaseTier ? { purchaseTier } : {}),
    };
  }

  return {
    representativeSlug: normalized,
  };
}

function mapMessageToChannel(chatType: string, isReplyToBot: boolean): Channel {
  if (chatType === "private") {
    return Channel.PRIVATE_CHAT;
  }

  return isReplyToBot ? Channel.GROUP_REPLY : Channel.GROUP_MENTION;
}

function buildDisplayName(
  firstName: string | undefined,
  lastName: string | undefined,
): { displayName?: string } {
  const value = [firstName, lastName].filter(Boolean).join(" ").trim();
  return value ? { displayName: value } : {};
}

function buildCollectorConversationPlan(
  collectorState: StructuredCollectorState,
): ConversationPlan {
  return {
    intent: collectorState.intent,
    audienceRole: "lead",
    action:
      collectorState.kind === "scheduling"
        ? "collect_scheduling_request"
        : "collect_quote_request",
    nextStep: "collect_intake",
    ...(collectorState.suggestedPlan ? { suggestedPlan: collectorState.suggestedPlan } : {}),
    reasons: ["Active structured collector in progress."],
    responseOutline: [formatStructuredCollectorPrompt(collectorState)],
  };
}

function isCollectorCancelMessage(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return normalized === "取消" || normalized === "cancel" || normalized === "stop";
}

async function resolveRepresentativeSlugForChat(
  chatType: string,
  chatId: number | string,
): Promise<string> {
  const defaultRepresentativeSlug = process.env.DEMO_REP_SLUG || demoRepresentative.slug;

  if (chatType !== "private") {
    return defaultRepresentativeSlug;
  }

  try {
    return (await getActiveRepresentativeSlugForChat(chatId)) ?? defaultRepresentativeSlug;
  } catch (error) {
    console.warn("Unable to read representative session:", error);
    return defaultRepresentativeSlug;
  }
}

function buildStartPayloadForPurchase(representativeSlug: string, tier: PlanTier): string {
  return `buy_${representativeSlug}__${tier}`;
}

function normalizeOpenVikingReason(nextStep: ConversationPlan["nextStep"]): string {
  switch (nextStep) {
    case "handoff":
      return "handoff_requested";
    case "ask_owner":
      return "ask_owner";
    case "offer_paid_unlock":
      return "offer_paid_unlock";
    case "collect_intake":
      return "collect_intake";
    case "answer":
    default:
      return "answer_turn";
  }
}
