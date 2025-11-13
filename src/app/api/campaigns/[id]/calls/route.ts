import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CallStatus } from "@prisma/client";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function ensureAdmin(role: string | undefined) {
  return role === "admin" || role === "superadmin";
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

  const where: any = { campaignId: params.id };
  if (status && status.toUpperCase() in CallStatus) {
    where.status = status.toUpperCase();
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
  });

  const hasMore = calls.length > limit;
  const items = hasMore ? calls.slice(0, -1) : calls;

  return NextResponse.json({
    calls: items.map((call) => ({
      ...call,
      status: call.status.toLowerCase(),
    })),
    nextCursor: hasMore ? items[items.length - 1]?.id : null,
  });
}
