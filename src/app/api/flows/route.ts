import { NextResponse } from "next/server";
import { z } from "zod";
import { FlowDefinitionSchema, summarizeFlow } from "@/lib/flows";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const createSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(200).optional(),
  definition: FlowDefinitionSchema,
});

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function ensureAdmin(role: string | undefined) {
  return role === "admin" || role === "superadmin";
}

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const isAdmin = ensureAdmin(session.role);
  const flows = await prisma.callFlow.findMany({
    where: isAdmin
      ? {}
      : {
          OR: [{ userId: session.sub }, { isSystem: true }],
        },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ flows });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const body = createSchema.parse(await req.json());
    const flow = await prisma.callFlow.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        definition: body.definition,
        userId: session.sub,
        isSystem: false,
        metadata: {
          summary: summarizeFlow(body.definition),
        },
      },
    });

    return NextResponse.json({ flow }, { status: 201 });
  } catch (error: any) {
    if (error?.issues?.[0]?.message) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create flow" }, { status: 400 });
  }
}
