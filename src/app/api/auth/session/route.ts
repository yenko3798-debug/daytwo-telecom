import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ valid: false, user: null }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        balanceCents: true,
      },
    });

    if (!user) {
      return NextResponse.json({ valid: false, user: null }, { status: 401 });
    }

    return NextResponse.json({
      valid: true,
      user: {
        ...user,
        role: user.role.toLowerCase(),
      },
    });
  } catch (error) {
    return NextResponse.json({ valid: false, user: null }, { status: 500 });
  }
}
