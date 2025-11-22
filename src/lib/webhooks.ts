import { WebhookChannelType } from "@prisma/client";
import { prisma } from "./prisma";

function rawLineFromMetadata(metadata: any) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const value = (metadata as Record<string, any>).rawLine;
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function formatDtmfMessage(params: {
  phone: string;
  digits: string;
  campaign: string;
  rawLine: string | null;
}) {
  const lines = [
    "📟 DTMF reply",
    `${params.phone} pressed ${params.digits}`,
    `Campaign: ${params.campaign}`,
  ];
  if (params.rawLine) {
    lines.push(params.rawLine);
  }
  return lines.join("\n");
}

async function postDiscordWebhook(url: string, content: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    throw new Error(`Discord webhook failed (${response.status})`);
  }
}

async function postTelegramMessage(botToken: string, chatId: string, text: string) {
  const endpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
  if (!response.ok) {
    throw new Error(`Telegram webhook failed (${response.status})`);
  }
}

export async function sendDtmfWebhooks(sessionId: string, digits: string) {
  const session = await prisma.callSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      dialedNumber: true,
      campaign: {
        select: { id: true, name: true, userId: true },
      },
      lead: {
        select: {
          phoneNumber: true,
          normalizedNumber: true,
          metadata: true,
        },
      },
    },
  });

  if (!session || !session.campaign) return;

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      userId: session.campaign.userId,
      enabled: true,
    },
  });
  if (endpoints.length === 0) return;

  const phone =
    session.dialedNumber ??
    session.lead?.normalizedNumber ??
    session.lead?.phoneNumber ??
    "unknown";
  const rawLine = rawLineFromMetadata(session.lead?.metadata ?? null);
  const message = formatDtmfMessage({
    phone,
    digits,
    campaign: session.campaign.name,
    rawLine,
  });

  await Promise.allSettled(
    endpoints.map(async (endpoint) => {
      try {
        if (endpoint.type === WebhookChannelType.DISCORD && endpoint.discordWebhook) {
          await postDiscordWebhook(endpoint.discordWebhook, message);
        } else if (
          endpoint.type === WebhookChannelType.TELEGRAM &&
          endpoint.telegramBotToken &&
          endpoint.telegramChatId
        ) {
          await postTelegramMessage(endpoint.telegramBotToken, endpoint.telegramChatId, message);
        }
      } catch (error) {
        console.error(
          `Webhook delivery failed (${endpoint.type.toLowerCase()}): ${
            (error as Error)?.message ?? error
          }`
        );
      }
    })
  );
}
