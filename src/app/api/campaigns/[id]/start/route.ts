import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { startCampaignEngine } from "@/lib/campaignRunner";
import { CampaignStatus, LeadStatus } from "@prisma/client";
import { RATE_PER_LEAD_CENTS } from "@/lib/flows";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function ensureAdmin(role: string | undefined) {
  return role === "admin" || role === "superadmin";
}

export async function POST(
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
  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isAdmin && campaign.userId !== session.sub) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (campaign.status === CampaignStatus.RUNNING) {
    return NextResponse.json({ error: "Campaign already running" }, { status: 409 });
  }

  const [pendingLeads, user] = await Promise.all([
    prisma.campaignLead.count({
      where: {
        campaignId: campaign.id,
        status: { in: [LeadStatus.PENDING, LeadStatus.QUEUED, LeadStatus.DIALING] },
      },
    }),
    prisma.user.findUnique({
      where: { id: campaign.userId },
      select: { balanceCents: true },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "User missing" }, { status: 404 });
  }

  if (pendingLeads === 0) {
    return NextResponse.json({ error: "No leads available to dial" }, { status: 409 });
  }

  const requiredCents = pendingLeads * RATE_PER_LEAD_CENTS;
  if (user.balanceCents < requiredCents) {
    const shortfall = requiredCents - user.balanceCents;
    return NextResponse.json(
      {
        error: "Insufficient balance",
        requiredCents,
        shortfallCents: shortfall,
      },
      { status: 402 }
    );
  }

  await startCampaignEngine(campaign.id);

  return NextResponse.json({ status: "running" });
}
