import type { OpenVikingRecallItem } from "./types";

export function buildDelegateSessionKey(params: {
  representativeSlug: string;
  chatId: string | number;
  contactId: string;
}): string {
  return `delegate:tg:${params.representativeSlug}:${String(params.chatId)}:${params.contactId}`;
}

export function buildAssistantMessageParts(
  messageText: string,
  recalled: OpenVikingRecallItem[],
): Array<Record<string, unknown>> {
  const parts: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: messageText,
    },
  ];

  for (const item of recalled) {
    parts.push({
      type: "context",
      uri: item.uri,
      context_type: item.contextType,
      abstract: item.overview ?? item.abstract,
    });
  }

  return parts;
}
