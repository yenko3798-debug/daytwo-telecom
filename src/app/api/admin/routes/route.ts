import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { syncAsteriskTrunk } from "@/lib/asteriskBridge";
import { getSession } from "@/lib/auth";

const createSchema = z.object({
  name: z.string().min(2).max(80),
  provider: z.string().min(2).max(120),
  domain: z.string().min(2).max(200),
  authUsername: z.string().min(1).max(80).optional().nullable(),
  authPassword: z.string().min(1).max(120).optional().nullable(),
  outboundUri: z.string().min(2).max(256).optional().nullable(),
  trunkPrefix: z.string().max(32).optional().nullable(),
  callerIdFormat: z.string().max(64).optional().nullable(),
  maxChannels: z.number().int().min(1).max(1000).optional(),
  concurrencyLimit: z.number().int().min(1).max(500).optional().nullable(),
    costPerMinuteCents: z.number().int().min(0).max(100000).optional().nullable(),
  isPublic: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

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

  const routesRaw = await prisma.sipRoute.findMany({
    orderBy: { createdAt: "desc" },
  });
  const routes = routesRaw.map((route) => ({
    ...route,
    status: route.status.toLowerCase(),
  }));
  return NextResponse.json({ routes });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ensureAdmin(session.role)) return forbidden();

  try {
    const body = createSchema.parse(await req.json());
    const route = await prisma.sipRoute.create({
      data: {
        name: body.name,
        provider: body.provider,
        domain: body.domain,
        authUsername: body.authUsername ?? null,
        authPassword: body.authPassword ?? null,
        outboundUri: body.outboundUri ?? null,
        trunkPrefix: body.trunkPrefix ?? null,
        callerIdFormat: body.callerIdFormat ?? null,
        maxChannels: body.maxChannels ?? 50,
        concurrencyLimit: body.concurrencyLimit ?? null,
          costPerMinuteCents: body.costPerMinuteCents ?? 0,
        isPublic: body.isPublic ?? true,
        metadata: body.metadata ?? null,
        createdById: session.sub,
      },
    });
    try {
      await syncAsteriskTrunk(route);
    } catch (error: any) {
      await prisma.sipRoute.delete({ where: { id: route.id } }).catch(() => {});
      return NextResponse.json(
        { error: error?.message ?? "Unable to sync route with dialer" },
        { status: 502 }
      );
    }
    return NextResponse.json({ route: { ...route, status: route.status.toLowerCase() } }, { status: 201 });
  } catch (error: any) {
    if (error?.issues?.[0]?.message) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
