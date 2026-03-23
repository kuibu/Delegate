import "dotenv/config";

import { demoRepresentative } from "@delegate/domain";
import {
  createConversationPlan,
  renderReplyPreview,
  resolveTelegramGroupHandling,
} from "@delegate/runtime";
import { Bot } from "grammy";

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
]);

bot.command("start", async (ctx) => {
  const payload = ctx.match?.trim() || process.env.DEMO_REP_SLUG || demoRepresentative.slug;
  const payloadNote =
    payload === demoRepresentative.slug
      ? "你进入的是默认 Founder Representative 演示入口。"
      : `已收到 deep link 参数：${payload}`;

  await ctx.reply(
    [
      `${demoRepresentative.name}`,
      demoRepresentative.tagline,
      payloadNote,
      `免费规则：前 ${demoRepresentative.contract.freeReplyLimit} 条回复适合基础问答与资料领取。`,
      "我可以回答 FAQ、发资料、收集合作与报价信息，并在必要时发起人工转接。",
    ].join("\n\n"),
  );
});

bot.command("plans", async (ctx) => {
  await ctx.reply(
    demoRepresentative.pricing
      .map(
        (plan) =>
          `${plan.name} · ${plan.stars} Stars\n${plan.summary}\nIncluded replies: ${plan.includedReplies}`,
      )
      .join("\n\n"),
  );
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
  const plan = createConversationPlan({
    text: text.length > 0 ? text : rawText,
    channel: isPrivate ? "private_chat" : isReplyToBot ? "group_reply" : "group_mention",
    representative: demoRepresentative,
    usage: {
      freeRepliesUsed: 0,
      passUnlocked: false,
      deepHelpUnlocked: false,
    },
  });

  await ctx.reply(renderReplyPreview(demoRepresentative, plan));
});

bot.catch((error) => {
  console.error("Telegram bot error:", error.error);
});

console.log(`Starting Delegate bot as @${me.username ?? "unknown"}...`);
await bot.start();

function stripBotMention(text: string, username: string | undefined): string {
  if (!username) {
    return text;
  }

  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`@${escaped}`, "ig"), "").trim();
}
