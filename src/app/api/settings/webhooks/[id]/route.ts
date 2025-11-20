import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const patchSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  active: z.boolean().optional(),
});

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  try {
    const body = patchSchema.parse(await req.json());
    const existing = await prisma.notificationWebhook.findFirst({
      where: { id: params.id, userId: session.sub },
    });
    if (!existing) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }
    const updated = await prisma.notificationWebhook.update({
      where: { id: params.id },
      data: body,
    });
    return NextResponse.json({ webhook: updated });
  } catch (error: any) {
    if (error?.issues?.[0]?.message) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update webhook" }, { status: 400 });
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const existing = await prisma.notificationWebhook.findFirst({
    where: { id: params.id, userId: session.sub },
  });
  if (!existing) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }
  await prisma.notificationWebhook.delete({
    where: { id: params.id },
  });
  return NextResponse.json({ ok: true });
}
