import type { GroupActivation } from "@delegate/domain";

export type TelegramGroupHandlingParams = {
  chatType: "private" | "group" | "supergroup" | "channel";
  activation: GroupActivation;
  wasMentioned: boolean;
  isReplyToRepresentative: boolean;
  hasAuthorizedControlCommand?: boolean;
};

export type TelegramGroupHandlingResult = {
  shouldHandle: boolean;
  reason: "private_chat" | "mentioned" | "reply" | "always" | "owner_command" | "ignored";
};

export function resolveTelegramGroupHandling(
  params: TelegramGroupHandlingParams,
): TelegramGroupHandlingResult {
  if (params.chatType === "private") {
    return {
      shouldHandle: true,
      reason: "private_chat",
    };
  }

  if (params.hasAuthorizedControlCommand) {
    return {
      shouldHandle: true,
      reason: "owner_command",
    };
  }

  if (params.activation === "always") {
    return {
      shouldHandle: true,
      reason: "always",
    };
  }

  if (params.wasMentioned) {
    return {
      shouldHandle: true,
      reason: "mentioned",
    };
  }

  if (params.activation === "reply_or_mention" && params.isReplyToRepresentative) {
    return {
      shouldHandle: true,
      reason: "reply",
    };
  }

  return {
    shouldHandle: false,
    reason: "ignored",
  };
}
