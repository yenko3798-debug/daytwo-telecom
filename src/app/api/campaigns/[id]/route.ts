import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CampaignStatus } from "@prisma/client";

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(240).optional(),
  callerId: z.string().min(8).max(32).optional(),
  callsPerMinute: z.number().int().min(1).max(600).optional(),
  maxConcurrentCalls: z.number().int().min(1).max(200).optional(),
  ringTimeoutSeconds: z.number().int().min(10).max(120).optional(),
  metadata: z.record(z.any()).optional(),
  answeringMachineDetection: z.boolean().optional(),
  voicemailRetryLimit: z.number().int().min(0).max(5).optional(),
});

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function ensureAdmin(role: string | undefined) {
  return role === "admin" || role === "superadmin";
}

async function loadCampaign(id: string) {
  return prisma.campaign.findUnique({
    where: { id },
    include: {
      route: { select: { id: true, name: true, provider: true } },
      callFlow: { select: { id: true, name: true } },
    },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const isAdmin = ensureAdmin(session.role);
  const campaign = await loadCampaign(params.id);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAdmin && campaign.userId !== session.sub) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({
    campaign: {
      ...campaign,
      status: campaign.status.toLowerCase(),
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const isAdmin = ensureAdmin(session.role);
  const campaign = await loadCampaign(params.id);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAdmin && campaign.userId !== session.sub) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (campaign.status === CampaignStatus.RUNNING) {
    return NextResponse.json({ error: "Stop or pause campaign before editing" }, { status: 409 });
  }

  try {
    const body = updateSchema.parse(await req.json());
    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        name: body.name ?? campaign.name,
        description: body.description ?? campaign.description,
        callerId: body.callerId ?? campaign.callerId,
        callsPerMinute: body.callsPerMinute ?? campaign.callsPerMinute,
        maxConcurrentCalls:
          body.maxConcurrentCalls ?? campaign.maxConcurrentCalls,
        ringTimeoutSeconds:
          body.ringTimeoutSeconds ?? campaign.ringTimeoutSeconds,
        metadata: body.metadata ?? campaign.metadata,
        answeringMachineDetection:
          body.answeringMachineDetection ?? campaign.answeringMachineDetection,
        voicemailRetryLimit:
          body.voicemailRetryLimit ?? campaign.voicemailRetryLimit,
      },
      include: {
        route: { select: { id: true, name: true, provider: true } },
        callFlow: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      campaign: {
        ...updated,
        status: updated.status.toLowerCase(),
      },
    });
  } catch (error: any) {
    if (error?.issues?.[0]?.message) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update campaign" }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const isAdmin = ensureAdmin(session.role);
  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, status: true },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAdmin && campaign.userId !== session.sub) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (campaign.status === CampaignStatus.RUNNING) {
    return NextResponse.json({ error: "Stop campaign before deleting" }, { status: 409 });
  }

  await prisma.campaign.delete({
    where: { id: params.id },
  });
  return NextResponse.json({ ok: true });
}
