import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CallStatus, Prisma } from "@prisma/client";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function ensureAdmin(role: string | undefined) {
  return role === "admin" || role === "superadmin";
}

function rawLineFromMetadata(metadata: Prisma.JsonValue | null) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const raw = (metadata as Record<string, any>).rawLine;
  return typeof raw === "string" ? raw : null;
}

export async function GET(
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

  const url = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "100", 10), 1), 300);
  const cursor = url.searchParams.get("cursor");
  const status = url.searchParams.get("status");
  const query = url.searchParams.get("q")?.trim();
  const dtmfOnly = url.searchParams.get("dtmfOnly") === "true";
  const dtmfDigit = url.searchParams.get("dtmf")?.trim();

  const where: Prisma.CallSessionWhereInput = { campaignId: params.id };
  if (status && status.toUpperCase() in CallStatus) {
    where.status = status.toUpperCase() as CallStatus;
  }
  if (dtmfDigit) {
    where.dtmf = { startsWith: dtmfDigit };
  } else if (dtmfOnly) {
    where.dtmf = { not: null };
  }
  if (query) {
    where.OR = [
      { id: { contains: query, mode: "insensitive" } },
      { dialedNumber: { contains: query, mode: "insensitive" } },
      { callerId: { contains: query, mode: "insensitive" } },
      {
        lead: {
          phoneNumber: { contains: query, mode: "insensitive" },
        },
      },
    ];
  }

  const calls = await prisma.callSession.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
      include: {
        lead: {
          select: {
            phoneNumber: true,
            normalizedNumber: true,
            metadata: true,
            voicemailStatus: true,
            voicemailRetries: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
  });

  const hasMore = calls.length > limit;
  const items = hasMore ? calls.slice(0, -1) : calls;

  return NextResponse.json({
      calls: items.map((call) => ({
        id: call.id,
        status: call.status.toLowerCase(),
        callerId: call.callerId,
        dialedNumber: call.dialedNumber,
        durationSeconds: call.durationSeconds,
        costCents: call.costCents,
        dtmf: call.dtmf,
        createdAt: call.createdAt,
        metadata: call.metadata,
        voicemailStatus: call.voicemailStatus.toLowerCase(),
        campaign: call.campaign,
        lead: call.lead
          ? {
              phoneNumber: call.lead.phoneNumber,
              normalizedNumber: call.lead.normalizedNumber,
              rawLine: rawLineFromMetadata(call.lead.metadata),
              voicemailStatus: call.lead.voicemailStatus.toLowerCase(),
              voicemailRetries: call.lead.voicemailRetries,
            }
          : null,
      })),
    nextCursor: hasMore ? items[items.length - 1]?.id : null,
  });
}
