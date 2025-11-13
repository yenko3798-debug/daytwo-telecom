import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  provider: z.string().min(2).max(120).optional(),
  domain: z.string().min(2).max(200).optional(),
  outboundUri: z.string().min(2).max(256).nullable().optional(),
  trunkPrefix: z.string().max(32).nullable().optional(),
  callerIdFormat: z.string().max(64).nullable().optional(),
  maxChannels: z.number().int().min(1).max(1000).optional(),
  concurrencyLimit: z.number().int().min(1).max(500).nullable().optional(),
  costPerMinuteCents: z.number().int().min(0).max(100000).nullable().optional(),
  status: z.enum(["active", "inactive", "maintenance"]).optional(),
  isPublic: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function ensureAdmin(role: string | undefined) {
  return role === "admin" || role === "superadmin";
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ensureAdmin(session.role)) return forbidden();

  try {
    const body = updateSchema.parse(await req.json());
    const data: any = {};
    Object.assign(data, body);
    if ("metadata" in body) data.metadata = body.metadata ?? null;
    if ("outboundUri" in body) data.outboundUri = body.outboundUri ?? null;
    if ("trunkPrefix" in body) data.trunkPrefix = body.trunkPrefix ?? null;
    if ("callerIdFormat" in body) data.callerIdFormat = body.callerIdFormat ?? null;
    if ("concurrencyLimit" in body) data.concurrencyLimit = body.concurrencyLimit ?? null;
    if ("costPerMinuteCents" in body) data.costPerMinuteCents = body.costPerMinuteCents ?? null;
    if ("status" in body) {
      data.status = body.status === "active"
        ? "ACTIVE"
        : body.status === "inactive"
        ? "INACTIVE"
        : "MAINTENANCE";
    }

    const route = await prisma.sipRoute.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json({ route: { ...route, status: route.status.toLowerCase() } });
  } catch (error: any) {
    if (error?.issues?.[0]?.message) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update route" }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ensureAdmin(session.role)) return forbidden();

  const campaigns = await prisma.campaign.count({
    where: { routeId: params.id },
  });
  if (campaigns > 0) {
    return NextResponse.json(
      { error: "Route is associated with existing campaigns" },
      { status: 409 }
    );
  }

  await prisma.sipRoute.delete({
    where: { id: params.id },
  });
  return NextResponse.json({ ok: true });
}
