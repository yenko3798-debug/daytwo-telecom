import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CallStatus, Prisma } from "@prisma/client";

function rawLineFromMetadata(metadata: Prisma.JsonValue | null) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const raw = (metadata as Record<string, any>).rawLine;
  return typeof raw === "string" ? raw : null;
}

const CACHE_TTL_MS = 2000;
type CallsCacheEntry = {
  expires: number;
  data: any | null;
  promise?: Promise<any>;
};
const callsCache = new Map<string, CallsCacheEntry>();

function cacheKey(userId: string, search: string) {
  return `${userId}:${search}`;
}

async function fetchCalls(where: Prisma.CallSessionWhereInput, limit: number) {
  const calls = await prisma.callSession.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
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
  });
  return calls.map((call) => ({
    id: call.id,
    status: call.status.toLowerCase(),
    callerId: call.callerId,
    dialedNumber: call.dialedNumber,
    durationSeconds: call.durationSeconds,
    costCents: call.costCents,
    dtmf: call.dtmf,
    createdAt: call.createdAt,
    campaign: call.campaign,
    lead: call.lead
      ? {
          phoneNumber: call.lead.phoneNumber,
          normalizedNumber: call.lead.normalizedNumber,
          rawLine: rawLineFromMetadata(call.lead.metadata),
        }
      : null,
    voicemailDetected: call.voicemailDetected,
    voicemailConfidence: call.voicemailConfidence,
    voicemailReason: call.voicemailReason,
    voicemailTranscript: call.voicemailTranscript,
  }));
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "120", 10), 1), 200);
  const status = url.searchParams.get("status");
  const campaignId = url.searchParams.get("campaignId");
  const q = url.searchParams.get("q")?.trim();
  const dtmfOnly = url.searchParams.get("dtmfOnly") === "true";
  const dtmfDigit = url.searchParams.get("dtmf")?.trim();

  const where: Prisma.CallSessionWhereInput = {
    campaign: {
      userId: session.sub,
    },
  };

  if (campaignId) {
    where.campaignId = campaignId;
  }
  if (status && status.toUpperCase() in CallStatus) {
    where.status = status.toUpperCase() as CallStatus;
  }
  if (dtmfDigit) {
    where.dtmf = { startsWith: dtmfDigit };
  } else if (dtmfOnly) {
    where.dtmf = { not: null };
  }
  if (q) {
    where.OR = [
      { id: { contains: q, mode: "insensitive" } },
      { dialedNumber: { contains: q, mode: "insensitive" } },
      { callerId: { contains: q, mode: "insensitive" } },
      {
        lead: {
          phoneNumber: { contains: q, mode: "insensitive" },
        },
      },
    ];
  }

  const key = cacheKey(session.sub, url.searchParams.toString());
  const now = Date.now();
  const cached = callsCache.get(key);
  if (cached && cached.expires > now && cached.data) {
    return NextResponse.json({ calls: cached.data });
  }
  if (cached?.promise) {
    try {
      const data = await cached.promise;
      return NextResponse.json({ calls: data });
    } catch (error: any) {
      return NextResponse.json({ error: error?.message ?? "Unable to load calls" }, { status: 500 });
    }
  }
  const promise = fetchCalls(where, limit)
    .then((data) => {
      callsCache.set(key, { expires: Date.now() + CACHE_TTL_MS, data });
      return data;
    })
    .catch((error) => {
      callsCache.delete(key);
      throw error;
    });
  callsCache.set(key, { expires: 0, data: cached?.data ?? null, promise });
  try {
    const data = await promise;
    return NextResponse.json({ calls: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unable to load calls" }, { status: 500 });
  }
}
