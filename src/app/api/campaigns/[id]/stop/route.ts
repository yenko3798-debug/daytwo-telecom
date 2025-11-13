import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { stopCampaignEngine } from "@/lib/campaignRunner";

const bodySchema = z
  .object({
    reason: z.string().max(200).optional(),
  })
  .optional();

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function ensureAdmin(role: string | undefined) {
  return role === "admin" || role === "superadmin";
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const isAdmin = ensureAdmin(session.role);
  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAdmin && campaign.userId !== session.sub) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = bodySchema.parse(await req.json().catch(() => ({})));
  await stopCampaignEngine(campaign.id, body?.reason);
  return NextResponse.json({ status: "stopped" });
}
