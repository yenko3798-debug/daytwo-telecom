import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { WebhookChannelType } from "@prisma/client";
import { serializeEndpoint } from "./helpers";

const createSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("discord"),
    label: z.string().min(1).max(120).optional(),
    webhookUrl: z.string().url(),
  }),
  z.object({
    type: z.literal("telegram"),
    label: z.string().min(1).max(120).optional(),
    botToken: z.string().min(20).max(200),
    chatId: z.string().min(1).max(100),
  }),
]);

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { userId: session.sub },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    endpoints: endpoints.map(serializeEndpoint),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = createSchema.parse(await req.json());
    const data =
      payload.type === "discord"
        ? {
            type: WebhookChannelType.DISCORD,
            label: payload.label ?? null,
            discordWebhook: payload.webhookUrl.trim(),
          }
        : {
            type: WebhookChannelType.TELEGRAM,
            label: payload.label ?? null,
            telegramBotToken: payload.botToken.trim(),
            telegramChatId: payload.chatId.trim(),
          };

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        userId: session.sub,
        enabled: true,
        ...data,
      },
    });

    return NextResponse.json({ endpoint: serializeEndpoint(endpoint) }, { status: 201 });
  } catch (error: any) {
    if (error?.issues?.[0]?.message) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to save webhook" }, { status: 400 });
  }
}
