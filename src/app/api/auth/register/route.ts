import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createSessionCookie } from "@/lib/auth";

const RegisterBody = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email("Invalid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long"),
});

export async function POST(req: Request) {
  try {
    const raw = await req.json();
    const { name, email, password } = RegisterBody.parse(raw);

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const role = email === "admin@auratelecom.com" ? UserRole.ADMIN : UserRole.USER;

    const user = await prisma.user.create({
      data: { name, email, passwordHash, balanceCents: 0, role },
      select: { id: true, name: true, email: true, role: true },
    });

    await createSessionCookie({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role.toLowerCase(),
    });

    return NextResponse.json(
      { user: { ...user, role: user.role.toLowerCase() } },
      { status: 201 }
    );
  } catch (err: any) {
    if (err?.issues?.[0]?.message) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
