import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CampaignStatus, CallStatus } from "@prisma/client";

function maskNumber(value: string | null, enabled: boolean) {
  if (!value) return null;
  if (!enabled) return value;
  return value.replace(/.(?=.{4})/g, "•");
}

type ScopeType = "me" | "public" | "admin";

const CACHE_TTL_MS = 3000;
type MetricsCacheEntry = {
  expires: number;
  data: any | null;
  promise?: Promise<any>;
};
const metricsCache = new Map<string, MetricsCacheEntry>();

function cacheKey(scope: ScopeType, userId: string | null, rangeHours: number) {
  return `${scope}:${userId ?? "global"}:${rangeHours}`;
}

async function computeMetrics(
  campaignWhere: Parameters<typeof prisma.campaign.groupBy>[0]["where"],
  callWhere: Parameters<typeof prisma.callSession.count>[0]["where"],
  since: Date,
  sinceMinute: Date,
  shouldMask: boolean,
  scope: ScopeType,
  rangeHours: number
) {
  const [
    campaignStats,
    callTotal,
    callAnswered,
    callFailed,
    callDtmf,
    callCost,
    activeCalls,
    cpsWindowCount,
    leadTotals,
    dtmfSamples,
    feed,
  ] = await prisma.$transaction([
    prisma.campaign.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: campaignWhere,
    }),
    prisma.callSession.count({
      where: {
        ...callWhere,
        createdAt: { gte: since },
      },
    }),
    prisma.callSession.count({
      where: {
        ...callWhere,
        createdAt: { gte: since },
        status: { in: [CallStatus.ANSWERED, CallStatus.COMPLETED] },
      },
    }),
    prisma.callSession.count({
      where: {
        ...callWhere,
        createdAt: { gte: since },
        status: CallStatus.FAILED,
      },
    }),
    prisma.callSession.count({
      where: {
        ...callWhere,
        createdAt: { gte: since },
        dtmf: { not: null },
      },
    }),
    prisma.callSession.aggregate({
      where: {
        ...callWhere,
        createdAt: { gte: since },
      },
      _sum: { costCents: true },
    }),
    prisma.callSession.count({
      where: {
        ...callWhere,
        status: { in: [CallStatus.PLACING, CallStatus.RINGING, CallStatus.ANSWERED] },
      },
    }),
    prisma.callSession.count({
      where: {
        ...callWhere,
        createdAt: { gte: sinceMinute },
      },
    }),
    prisma.campaign.aggregate({
      where: campaignWhere,
      _sum: {
        totalLeads: true,
        dialedCount: true,
        connectedCount: true,
        dtmfCount: true,
      },
    }),
    prisma.callSession.findMany({
      where: {
        ...callWhere,
        createdAt: { gte: since },
        dtmf: { not: null },
      },
      select: { dtmf: true },
    }),
    prisma.callSession.findMany({
      where: {
        ...callWhere,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        campaign: { select: { id: true, name: true } },
        lead: {
          select: {
            phoneNumber: true,
            normalizedNumber: true,
            metadata: true,
          },
        },
      },
    }),
  ]);

  const campaignSummary = {
    total: campaignStats.reduce((acc, curr) => acc + curr._count._all, 0),
    running: campaignStats.find((x) => x.status === CampaignStatus.RUNNING)?._count._all ?? 0,
    paused: campaignStats.find((x) => x.status === CampaignStatus.PAUSED)?._count._all ?? 0,
    completed: campaignStats.find((x) => x.status === CampaignStatus.COMPLETED)?._count._all ?? 0,
  };

  const dtmfBreakdown = dtmfSamples.reduce<Record<string, number>>((acc, entry) => {
    if (entry.dtmf) {
      const key = entry.dtmf.trim()[0];
      if (key) acc[key] = (acc[key] ?? 0) + 1;
    }
    return acc;
  }, {});

  const feedItems = feed.map((call) => {
    const leadMeta =
      call.lead?.metadata && typeof call.lead.metadata === "object" && !Array.isArray(call.lead.metadata)
        ? (call.lead.metadata as Record<string, any>)
        : null;
    const rawLine = typeof leadMeta?.rawLine === "string" ? leadMeta.rawLine : null;
    return {
      id: call.id,
      status: call.status.toLowerCase(),
      callerId: maskNumber(call.callerId, shouldMask),
      dialedNumber: maskNumber(call.dialedNumber, shouldMask),
      dtmf: call.dtmf,
      durationSeconds: call.durationSeconds,
      costCents: call.costCents,
      createdAt: call.createdAt,
      campaign: call.campaign,
      lead: {
        phoneNumber: maskNumber(call.lead?.phoneNumber ?? null, shouldMask),
        normalizedNumber: maskNumber(call.lead?.normalizedNumber ?? null, shouldMask),
        rawLine: shouldMask ? null : rawLine,
      },
    };
  });

  return {
    timestamp: new Date().toISOString(),
    scope,
    rangeHours,
    campaigns: campaignSummary,
    calls: {
      total: callTotal,
      answered: callAnswered,
      failed: callFailed,
      dtmf: callDtmf,
      costCents: callCost._sum.costCents ?? 0,
    },
    leads: {
      total: leadTotals._sum.totalLeads ?? 0,
      dialed: leadTotals._sum.dialedCount ?? 0,
      connected: leadTotals._sum.connectedCount ?? 0,
      dtmf: leadTotals._sum.dtmfCount ?? 0,
    },
    activeCalls,
    cps: +(cpsWindowCount / 60).toFixed(2),
    dtmfBreakdown: Object.entries(dtmfBreakdown)
      .map(([digit, count]) => ({ digit, count }))
      .sort((a, b) => b.count - a.count),
    feed: feedItems,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const scope = (url.searchParams.get("scope") as ScopeType) ?? "me";
  const rangeHours = Math.min(Math.max(parseInt(url.searchParams.get("range") ?? "24", 10), 1), 168);
  const since = dayjs().subtract(rangeHours, "hour").toDate();
  const sinceMinute = dayjs().subtract(1, "minute").toDate();

  let userId: string | null = null;
  let requireAuth = scope !== "public";
  let requireAdmin = scope === "admin";

  if (requireAuth) {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (requireAdmin) {
      const role = session.role;
      if (role !== "admin" && role !== "superadmin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      userId = session.sub;
    }
  }

  const campaignWhere = userId ? { userId } : undefined;
  const callWhere = userId ? { campaign: { userId } } : undefined;

  const shouldMask = scope === "public";
  const key = cacheKey(scope, userId, rangeHours);
  const now = Date.now();
  const cached = metricsCache.get(key);
  if (cached && cached.expires > now && cached.data) {
    return NextResponse.json(cached.data);
  }
  if (cached?.promise) {
    try {
      const data = await cached.promise;
      return NextResponse.json(data);
    } catch (error: any) {
      return NextResponse.json({ error: error?.message ?? "Unable to load metrics" }, { status: 500 });
    }
  }
  const promise = computeMetrics(campaignWhere, callWhere, since, sinceMinute, shouldMask, scope, rangeHours)
    .then((data) => {
      metricsCache.set(key, { expires: Date.now() + CACHE_TTL_MS, data });
      return data;
    })
    .catch((error) => {
      metricsCache.delete(key);
      throw error;
    });
  metricsCache.set(key, { expires: 0, data: cached?.data ?? null, promise });
  try {
    const data = await promise;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unable to load metrics" }, { status: 500 });
  }
}
