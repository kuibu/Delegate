import "dotenv/config";

import { demoRepresentative, type PlanTier } from "@delegate/domain";
import { Channel } from "@prisma/client";
import {
  createConversationPlan,
  renderReplyPreview,
  resolveTelegramGroupHandling,
  type ConversationPlan,
} from "@delegate/runtime";
import { Bot, InlineKeyboard } from "grammy";

import {
  confirmInvoicePayment,
  createPlanInvoice,
  getConversationContext,
  markInvoiceDeliveryFailed,
  maybeCreateHandoffRequest,
  recordInboundTurn,
  recordOutboundReply,
  validatePendingInvoice,
} from "./runtime-store";

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
  const payload = ctx.match?.trim() || process.env.DEMO_REP_SLUG || demoRepresentative.slug;
  const purchaseTier = parseStartPurchasePayload(payload);

  if (purchaseTier && ctx.chat.type === "private") {
    await sendPlanInvoice(ctx, purchaseTier);
    return;
  }

  const payloadNote =
    payload === demoRepresentative.slug
      ? "你进入的是默认 Founder Representative 演示入口。"
      : `已收到 deep link 参数：${payload}`;

  await ctx.reply(
    [
      demoRepresentative.name,
      demoRepresentative.tagline,
      payloadNote,
      `免费规则：前 ${demoRepresentative.contract.freeReplyLimit} 条回复适合基础问答与资料领取。`,
      "我可以回答 FAQ、发资料、收集合作与报价信息，并在必要时发起人工转接。",
      "你也可以随时用 /plans 或 /buy pass 来触发 Telegram Stars 续用。",
    ].join("\n\n"),
    {
      reply_markup: buildPlansKeyboard(),
    },
  );
});

bot.command("plans", async (ctx) => {
  await sendPlansMessage(ctx);
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
  await sendPlansMessage(ctx);
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

    await ctx.reply(
      [
        `已确认 ${confirmed.planName} 付款，收到 ${confirmed.starsAmount} Stars。`,
        "你的会话深度已经解锁；如果需要我继续做需求采集、报价梳理或升级转人工，直接继续发消息就可以。",
      ].join("\n\n"),
    );
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

  const groupHandling = resolveTelegramGroupHandling({
    chatType: ctx.chat.type,
    activation: demoRepresentative.groupActivation,
    wasMentioned: mentionsBot,
    isReplyToRepresentative: isReplyToBot,
  });

  if (!groupHandling.shouldHandle) {
    return;
  }

  const text = stripBotMention(rawText, me.username);
  const representativeSlug = process.env.DEMO_REP_SLUG || demoRepresentative.slug;
  const channel = mapMessageToChannel(ctx.chat.type, isReplyToBot);

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
    text: text.length > 0 ? text : rawText,
    channel: isPrivate ? "private_chat" : isReplyToBot ? "group_reply" : "group_mention",
    representative: demoRepresentative,
    usage:
      conversationContext?.usage ?? {
        freeRepliesUsed: 0,
        passUnlocked: false,
        deepHelpUnlocked: false,
      },
  });

  if (conversationContext) {
    await recordInboundTurn({
      context: conversationContext,
      plan,
      text: text.length > 0 ? text : rawText,
    });
  }

  const handoff = conversationContext
    ? await maybeCreateHandoffRequest({
        context: conversationContext,
        plan,
        text: text.length > 0 ? text : rawText,
      })
    : null;

  const replyText = [
    renderReplyPreview(demoRepresentative, plan),
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
  }
});

bot.catch((error) => {
  console.error("Telegram bot error:", error.error);
});

console.log(`Starting Delegate bot as @${me.username ?? "unknown"}...`);
await bot.start();

async function sendPlansMessage(ctx: any) {
  await ctx.reply(
    demoRepresentative.pricing
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

async function sendPlanInvoice(ctx: any, tier: PlanTier) {
  let invoice:
    | Awaited<ReturnType<typeof createPlanInvoice>>
    | undefined;

  try {
    const context = await getConversationContext(process.env.DEMO_REP_SLUG || demoRepresentative.slug, {
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
        start_parameter: `buy-${tier.replace("_", "-")}`,
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

function parseStartPurchasePayload(payload: string): PlanTier | null {
  const normalized = payload.trim().toLowerCase();
  if (!normalized.startsWith("buy-")) {
    return null;
  }

  return parseTierToken(normalized.slice(4));
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
