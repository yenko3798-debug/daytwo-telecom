import { NotificationWebhook, WebhookProvider } from "@prisma/client";
import { prisma } from "./prisma";

type DtmfPayload = {
  userId: string;
  campaignId: string;
  campaignName: string;
  sessionId: string;
  leadId: string;
  callerId: string;
  dialedNumber: string;
  digits: string;
  leadLine?: string | null;
};

type DiscordConfig = {
  webhookUrl?: string;
};

type TelegramConfig = {
  botToken?: string;
  chatId?: string;
};

function normalizeLine(raw: string | null | undefined) {
  if (!raw) return null;
  return raw.trim();
}

function buildMessage(payload: DtmfPayload) {
  const target = `${payload.callerId || "Unknown"} → ${payload.dialedNumber || "Unknown"}`;
  const base = `DTMF ${payload.digits} • ${target}`;
  const line = normalizeLine(payload.leadLine);
  if (!line) return `${base}`;
  return `${base}\nLine: ${line}`;
}

async function deliverDiscord(config: DiscordConfig, message: string) {
  const url = config.webhookUrl?.trim();
  if (!url) throw new Error("Missing Discord webhook URL");
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: message }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Discord webhook failed (${response.status}): ${text}`);
  }
}

async function deliverTelegram(config: TelegramConfig, message: string) {
  const token = config.botToken?.trim();
  const chatId = config.chatId?.trim();
  if (!token || !chatId) throw new Error("Missing Telegram configuration");
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Telegram webhook failed (${response.status}): ${text}`);
  }
}

async function deliverWebhook(hook: NotificationWebhook, message: string) {
  if (hook.provider === WebhookProvider.DISCORD) {
    return deliverDiscord((hook.config as DiscordConfig) ?? {}, message);
  }
  if (hook.provider === WebhookProvider.TELEGRAM) {
    return deliverTelegram((hook.config as TelegramConfig) ?? {}, message);
  }
}

export async function notifyDtmfWebhooks(payload: DtmfPayload) {
  const hooks = await prisma.notificationWebhook.findMany({
    where: { userId: payload.userId, active: true },
  });
  if (!hooks.length) return;
  const message = buildMessage(payload);
  const results = await Promise.allSettled(hooks.map((hook) => deliverWebhook(hook, message)));
  const succeeded: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      succeeded.push(hooks[index].id);
    }
  });
  if (succeeded.length) {
    await prisma.notificationWebhook.updateMany({
      where: { id: { in: succeeded } },
      data: { lastFiredAt: new Date() },
    });
  }
}
