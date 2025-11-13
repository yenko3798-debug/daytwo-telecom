import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { UserRole } from "@prisma/client";

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  role: z.enum(["user", "admin", "superadmin"]).optional(),
});

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function ensureAdmin(role: string | undefined) {
  return role === "admin" || role === "superadmin";
}

function toRole(value: string) {
  if (value === "admin") return UserRole.ADMIN;
  if (value === "superadmin") return UserRole.SUPERADMIN;
  return UserRole.USER;
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
    if (body.name) data.name = body.name;
    if (body.role) data.role = toRole(body.role);

    const user = await prisma.user.update({
      where: { id: params.id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        balanceCents: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      user: {
        ...user,
        role: user.role.toLowerCase(),
      },
    });
  } catch (error: any) {
    if (error?.issues?.[0]?.message) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update user" }, { status: 400 });
  }
}
