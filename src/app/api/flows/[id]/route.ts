import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(200).optional(),
  definition: z.any().optional(),
});

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function ensureAdmin(role: string | undefined) {
  return role === "admin" || role === "superadmin";
}

async function ensureAccess(flowId: string, userId: string, isAdmin: boolean) {
  const flow = await prisma.callFlow.findUnique({
    where: { id: flowId },
  });
  if (!flow) return null;
  if (isAdmin) return flow;
  if (flow.isSystem) return flow;
  if (flow.userId === userId) return flow;
  return undefined;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const flow = await ensureAccess(params.id, session.sub, ensureAdmin(session.role));
  if (flow === undefined) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (flow === null) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ flow });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const isAdmin = ensureAdmin(session.role);
  const flow = await ensureAccess(params.id, session.sub, isAdmin);
  if (flow === undefined) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (flow === null) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (flow.isSystem && !isAdmin) {
    return NextResponse.json({ error: "System flows cannot be edited" }, { status: 403 });
  }

  try {
    const body = updateSchema.parse(await req.json());
    const updated = await prisma.callFlow.update({
      where: { id: params.id },
      data: {
        name: body.name ?? flow.name,
        description: body.description ?? flow.description,
        definition: body.definition ?? flow.definition,
      },
    });
    return NextResponse.json({ flow: updated });
  } catch (error: any) {
    if (error?.issues?.[0]?.message) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update flow" }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const isAdmin = ensureAdmin(session.role);
  const flow = await ensureAccess(params.id, session.sub, isAdmin);
  if (flow === undefined) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (flow === null) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (flow.isSystem) {
    return NextResponse.json({ error: "System flows cannot be removed" }, { status: 403 });
  }

  await prisma.callFlow.delete({
    where: { id: params.id },
  });
  return NextResponse.json({ ok: true });
}
