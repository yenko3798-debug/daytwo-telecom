import { WebhookChannelType } from "@prisma/client";

function maskDiscord(webhook: string | null) {
  if (!webhook) return null;
  try {
    const parsed = new URL(webhook);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const suffix = parts.length ? parts[parts.length - 1] : "";
    const hint = suffix.length > 4 ? suffix.slice(-4) : suffix;
    return `${parsed.origin}/…${hint}`;
  } catch {
    return "discord-webhook";
  }
}

function maskBotToken(token: string | null) {
  if (!token) return null;
  const suffix = token.slice(-4);
  return `…${suffix}`;
}

export function serializeEndpoint(endpoint: {
  id: string;
  type: WebhookChannelType;
  label: string | null;
  enabled: boolean;
  createdAt: Date;
  discordWebhook: string | null;
  telegramBotToken: string | null;
  telegramChatId: string | null;
}) {
  return {
    id: endpoint.id,
    type: endpoint.type.toLowerCase(),
    label: endpoint.label,
    enabled: endpoint.enabled,
    createdAt: endpoint.createdAt,
    discordPreview: endpoint.type === WebhookChannelType.DISCORD ? maskDiscord(endpoint.discordWebhook) : null,
    telegramChatId: endpoint.type === WebhookChannelType.TELEGRAM ? endpoint.telegramChatId : null,
    telegramTokenHint:
      endpoint.type === WebhookChannelType.TELEGRAM ? maskBotToken(endpoint.telegramBotToken) : null,
  };
}
