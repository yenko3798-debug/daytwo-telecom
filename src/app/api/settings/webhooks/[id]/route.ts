import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { serializeEndpoint } from "../helpers";

const updateSchema = z
  .object({
    label: z.string().min(1).max(120).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "No changes provided",
  });

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = updateSchema.parse(await req.json());
    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: { id: params.id },
    });
    if (!endpoint) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (endpoint.userId !== session.sub) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data: any = {};
    if (body.label !== undefined) {
      data.label = body.label.trim().length > 0 ? body.label.trim() : null;
    }
    if (body.enabled !== undefined) {
      data.enabled = body.enabled;
    }

    const updated = await prisma.webhookEndpoint.update({
      where: { id: endpoint.id },
      data,
    });

    return NextResponse.json({ endpoint: serializeEndpoint(updated) });
  } catch (error: any) {
    if (error?.issues?.[0]?.message) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update webhook" }, { status: 400 });
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const endpoint = await prisma.webhookEndpoint.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true },
  });
  if (!endpoint) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (endpoint.userId !== session.sub) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.webhookEndpoint.delete({
    where: { id: endpoint.id },
  });

  return NextResponse.json({ ok: true });
}
