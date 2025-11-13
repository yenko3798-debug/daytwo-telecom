import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CampaignStatus, CallStatus } from "@prisma/client";

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function ensureAdmin(role: string | undefined) {
  return role === "admin" || role === "superadmin";
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ensureAdmin(session.role)) return forbidden();

  const [userCount, campaignStats, leadCount, activeCalls, adjustments] =
    await Promise.all([
      prisma.user.count(),
      prisma.campaign.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.campaignLead.count(),
      prisma.callSession.count({
        where: {
          status: { in: [CallStatus.PLACING, CallStatus.RINGING, CallStatus.ANSWERED] },
        },
      }),
      prisma.balanceAdjustment.aggregate({
        _sum: { amountCents: true },
      }),
    ]);

  const campaignSummary = {
    total: campaignStats.reduce((acc, item) => acc + item._count._all, 0),
    running:
      campaignStats.find((x) => x.status === CampaignStatus.RUNNING)?._count._all ?? 0,
    paused:
      campaignStats.find((x) => x.status === CampaignStatus.PAUSED)?._count._all ?? 0,
    completed:
      campaignStats.find((x) => x.status === CampaignStatus.COMPLETED)?._count._all ?? 0,
  };

  return NextResponse.json({
    users: userCount,
    campaigns: campaignSummary,
    leads: leadCount,
    activeCalls,
    volumeCents: adjustments._sum.amountCents ?? 0,
  });
}
