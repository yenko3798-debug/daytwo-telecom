import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CallStatus, Prisma } from "@prisma/client";

function rawLineFromMetadata(metadata: Prisma.JsonValue | null) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const raw = (metadata as Record<string, any>).rawLine;
  return typeof raw === "string" ? raw : null;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "200", 10), 1), 500);
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
            voicemailStatus: true,
            voicemailRetries: true,
          },
        },
      },
  });

    return NextResponse.json({
      calls: calls.map((call) => ({
        id: call.id,
        status: call.status.toLowerCase(),
        callerId: call.callerId,
        dialedNumber: call.dialedNumber,
        durationSeconds: call.durationSeconds,
        costCents: call.costCents,
        dtmf: call.dtmf,
        createdAt: call.createdAt,
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
    });
}
