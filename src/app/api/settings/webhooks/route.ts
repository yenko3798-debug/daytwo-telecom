import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const discordSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(2).max(80),
  provider: z.literal("discord"),
  webhookUrl: z.string().url(),
  active: z.boolean().optional(),
});

const telegramSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(2).max(80),
  provider: z.literal("telegram"),
  botToken: z.string().min(16),
  chatId: z.string().min(1).max(128),
  active: z.boolean().optional(),
});

const upsertSchema = z.discriminatedUnion("provider", [discordSchema, telegramSchema]);

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  const webhooks = await prisma.notificationWebhook.findMany({
    where: { userId: session.sub },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ webhooks });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  try {
    const body = upsertSchema.parse(await req.json());
    const baseData = {
      name: body.name,
      provider: body.provider,
      active: body.active ?? true,
    };
    const config =
      body.provider === "discord"
        ? { webhookUrl: body.webhookUrl }
        : { botToken: body.botToken, chatId: body.chatId };

    if (body.id) {
      const existing = await prisma.notificationWebhook.findFirst({
        where: { id: body.id, userId: session.sub },
      });
      if (!existing) {
        return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
      }
      const updated = await prisma.notificationWebhook.update({
        where: { id: body.id },
        data: {
          ...baseData,
          config,
        },
      });
      return NextResponse.json({ webhook: updated });
    }

    const created = await prisma.notificationWebhook.create({
      data: {
        ...baseData,
        userId: session.sub,
        config,
      },
    });
    return NextResponse.json({ webhook: created }, { status: 201 });
  } catch (error: any) {
    if (error?.issues?.[0]?.message) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to save webhook" }, { status: 400 });
  }
}
