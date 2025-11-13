import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CallStatus } from "@prisma/client";

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

  const calls = await prisma.callSession.findMany({
    where: {
      status: { in: [CallStatus.PLACING, CallStatus.RINGING, CallStatus.ANSWERED] },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      campaign: {
        select: { id: true, name: true },
      },
      lead: {
        select: { phoneNumber: true, normalizedNumber: true },
      },
    },
  });

  return NextResponse.json({
    calls: calls.map((call) => ({
      id: call.id,
      status: call.status.toLowerCase(),
      callerId: call.callerId,
      dialedNumber: call.dialedNumber,
      campaign: call.campaign,
      lead: call.lead,
      createdAt: call.createdAt,
      metadata: call.metadata,
    })),
  });
}
