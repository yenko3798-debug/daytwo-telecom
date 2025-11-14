import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function ensureAdmin(role: string | undefined) {
  return role === "admin" || role === "superadmin";
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const isAdmin = ensureAdmin(session.role);
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "active";
  const includePrivate = url.searchParams.get("visibility") === "mine";

  const where: any = {};
  if (!isAdmin) {
    where.OR = [
      { isPublic: true },
      { createdById: session.sub },
    ];
  }
  if (!isAdmin && !includePrivate) {
    where.status = "ACTIVE";
  } else if (status && status !== "all") {
    const normalized = status.toUpperCase();
    if (["ACTIVE", "INACTIVE", "MAINTENANCE"].includes(normalized)) {
      where.status = normalized;
    }
  }

  const routes = await prisma.sipRoute.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      provider: true,
      domain: true,
      authUsername: true,
      authPassword: true,
      outboundUri: true,
      trunkPrefix: true,
      callerIdFormat: true,
      maxChannels: true,
      concurrencyLimit: true,
      costPerMinuteCents: true,
      status: true,
      isPublic: true,
      metadata: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const sanitized = routes.map((route) => {
    const canSeeCredentials = isAdmin || route.createdById === session.sub;
    return {
      id: route.id,
      name: route.name,
      provider: route.provider,
      domain: route.domain,
      authUsername: canSeeCredentials ? route.authUsername : null,
      hasAuthPassword: canSeeCredentials ? Boolean(route.authPassword) : Boolean(route.authUsername && route.authPassword),
      outboundUri: route.outboundUri,
      trunkPrefix: route.trunkPrefix,
      callerIdFormat: route.callerIdFormat,
      maxChannels: route.maxChannels,
      concurrencyLimit: route.concurrencyLimit,
      costPerMinuteCents: route.costPerMinuteCents,
      status: route.status.toLowerCase(),
      isPublic: route.isPublic,
      metadata: route.metadata,
      createdAt: route.createdAt,
      updatedAt: route.updatedAt,
      authenticationRequired: Boolean(route.authUsername || route.authPassword),
    };
  });

  return NextResponse.json({ routes: sanitized });
}
