import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { UserRole } from "@prisma/client";

const createSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128),
  role: z.enum(["user", "admin", "superadmin"]).optional(),
  balanceCents: z.number().int().min(0).max(10_000_000).optional(),
});

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function ensureAdmin(role: string | undefined) {
  return role === "admin" || role === "superadmin";
}

function mapRole(value: string | undefined) {
  if (value === "admin") return UserRole.ADMIN;
  if (value === "superadmin") return UserRole.SUPERADMIN;
  return UserRole.USER;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ensureAdmin(session.role)) return forbidden();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      balanceCents: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    users: users.map((user) => ({
      ...user,
      role: user.role.toLowerCase(),
    })),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ensureAdmin(session.role)) return forbidden();

  try {
    const body = createSchema.parse(await req.json());
    const existing = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash,
        balanceCents: body.balanceCents ?? 0,
        role: mapRole(body.role),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        balanceCents: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { user: { ...user, role: user.role.toLowerCase() } },
      { status: 201 }
    );
  } catch (error: any) {
    if (error?.issues?.[0]?.message) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create user" }, { status: 400 });
  }
}
