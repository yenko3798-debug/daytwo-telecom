import { AdjustmentSource, AdjustmentType, Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const creditStatuses = new Set(["finished"]);
const finalStatuses = new Set(["finished", "failed", "expired", "refunded", "partially_paid"]);

export function isFinalTopUpStatus(status: string) {
  return finalStatuses.has(status.toLowerCase());
}

export function shouldCreditForStatus(status: string) {
  return creditStatuses.has(status.toLowerCase());
}

type StatusOptions = {
  orderId: string;
  status: string;
  payAmount?: string | null;
  payCurrency?: string | null;
  payAddress?: string | null;
  paymentId?: string | null;
  ipnPayload?: Prisma.JsonValue;
  nowpayInvoice?: Prisma.JsonValue;
};

export async function applyTopUpStatus(options: StatusOptions) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.topUpInvoice.findUnique({
      where: { orderId: options.orderId },
    });

    if (!existing) return null;

    const normalizedStatus = options.status.toLowerCase();

    const data: Prisma.TopUpInvoiceUpdateInput = {
      status: normalizedStatus,
    };

      if (options.payAmount !== undefined) data.payAmount = options.payAmount;
      if (options.payCurrency !== undefined)
        data.payCurrency = options.payCurrency ? options.payCurrency.toLowerCase() : null;
      if (options.payAddress !== undefined)
        data.payAddress = options.payAddress ? String(options.payAddress) : null;
      if (options.paymentId !== undefined) data.paymentId = options.paymentId;
      if (options.ipnPayload !== undefined) data.lastIpn = options.ipnPayload;
      if (options.nowpayInvoice !== undefined) data.nowpayInvoice = options.nowpayInvoice;

      const shouldCredit = shouldCreditForStatus(normalizedStatus) && !existing.settledAt;
      if (shouldCredit) {
        const adjustment = await tx.balanceAdjustment.create({
          data: {
            userId: existing.userId,
            createdById: null,
            amountCents: existing.amountCents,
            type: AdjustmentType.CREDIT,
            source: AdjustmentSource.TOPUP,
            reason: `Top-up ${existing.orderId}`,
            referenceId: existing.id,
          },
        });
        data.settledAt = new Date();
        data.balanceAdjustment = { connect: { id: adjustment.id } };
        await tx.user.update({
          where: { id: existing.userId },
          data: { balanceCents: { increment: existing.amountCents } },
        });
      }

    const updated = await tx.topUpInvoice.update({
      where: { orderId: options.orderId },
      data,
    });

    return { updated, credited: shouldCredit };
  });
}
