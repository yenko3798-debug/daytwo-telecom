import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const upsertSchema = z.object({
  settings: z
    .array(
      z.object({
        key: z.string().min(2).max(120),
        value: z.any(),
        description: z.string().max(200).optional(),
      })
    )
    .min(1),
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

  const settings = await prisma.systemSetting.findMany({
    orderBy: { key: "asc" },
  });
  return NextResponse.json({ settings });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ensureAdmin(session.role)) return forbidden();

  try {
    const body = upsertSchema.parse(await req.json());
    const tasks = body.settings.map((setting) =>
      prisma.systemSetting.upsert({
        where: { key: setting.key },
        update: {
          value: setting.value,
          description: setting.description ?? null,
          updatedById: session.sub,
        },
        create: {
          key: setting.key,
          value: setting.value,
          description: setting.description ?? null,
          updatedById: session.sub,
        },
      })
    );

    const results = await prisma.$transaction(tasks);
    return NextResponse.json({ settings: results });
  } catch (error: any) {
    if (error?.issues?.[0]?.message) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update settings" }, { status: 400 });
  }
}
