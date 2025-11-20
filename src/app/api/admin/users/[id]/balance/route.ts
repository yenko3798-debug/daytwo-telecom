import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { AdjustmentSource, AdjustmentType } from "@prisma/client";

const bodySchema = z.object({
  amountCents: z.number().int().min(1).max(10_000_000),
  type: z.enum(["credit", "debit"]),
  reason: z.string().max(200).optional(),
  referenceId: z.string().max(120).optional(),
  metadata: z.record(z.any()).optional(),
});

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function ensureAdmin(role: string | undefined) {
  return role === "admin" || role === "superadmin";
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ensureAdmin(session.role)) return forbidden();

  const { id } = await context.params;

  try {
    const body = bodySchema.parse(await req.json());
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id },
        select: { id: true, balanceCents: true },
      });
      if (!user) {
        throw new Error("User not found");
      }
      const amount = body.amountCents;
      if (body.type === "debit" && user.balanceCents < amount) {
        throw new Error("Insufficient balance");
      }

      const adjustment = await tx.balanceAdjustment.create({
        data: {
          userId: user.id,
          createdById: session.sub,
          amountCents: amount,
          type: body.type === "credit" ? AdjustmentType.CREDIT : AdjustmentType.DEBIT,
          source: AdjustmentSource.ADMIN,
          reason: body.reason ?? null,
          referenceId: body.referenceId ?? null,
          metadata: body.metadata ?? null,
        },
      });

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          balanceCents:
            body.type === "credit"
              ? { increment: amount }
              : { decrement: amount },
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          balanceCents: true,
        },
      });

      return { adjustment, user: updatedUser };
    });

    return NextResponse.json({
      adjustment: result.adjustment,
      user: {
        ...result.user,
        role: result.user.role.toLowerCase(),
      },
    });
  } catch (error: any) {
    if (error?.message === "User not found") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (error?.message === "Insufficient balance") {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 409 });
    }
    if (error?.issues?.[0]?.message) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to adjust balance" }, { status: 400 });
  }
}
