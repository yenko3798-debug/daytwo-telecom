"use server";

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNowPaymentsInvoice, getNowPaymentsInvoice } from "@/lib/nowpayments";
import { applyTopUpStatus, isFinalTopUpStatus } from "@/lib/topup";

const networks = ["ethereum", "solana", "bitcoin", "usdc"] as const;
type Network = (typeof networks)[number];

const payCurrencyMap: Record<Network, string> = {
  ethereum: "eth",
  solana: "sol",
  bitcoin: "btc",
  usdc: "usdc",
};

const displayNameMap: Record<Network, string> = {
  ethereum: "Ethereum",
  solana: "Solana",
  bitcoin: "Bitcoin",
  usdc: "USDC",
};

const CreateInvoiceBody = z.object({
  packs: z.number().int().min(1).max(20),
  network: z.enum(networks),
});

const packPriceUsd = 275;

function requireAppUrl() {
  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new Error("APP_URL is not configured");
  return appUrl.replace(/\/+$/, "");
}

function serializeInvoice(entry: any) {
  const status = entry.status ? String(entry.status).toLowerCase() : "pending";
  const payCurrency = entry.payCurrency ? String(entry.payCurrency).toLowerCase() : null;
  const payAmount = entry.payAmount ? String(entry.payAmount) : null;
  const payAddress = entry.payAddress ? String(entry.payAddress) : null;
  return {
    orderId: entry.orderId,
    invoiceId: entry.invoiceId,
    status,
    amountCents: entry.amountCents,
    amountUsd: entry.amountCents / 100,
    payCurrency,
    payAmount,
    payAddress,
    invoiceUrl: entry.invoiceUrl,
    settledAt: entry.settledAt ? entry.settledAt.toISOString() : null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = CreateInvoiceBody.parse(await req.json());
    const priceAmount = parsed.packs * packPriceUsd;
    const amountCents = Math.round(priceAmount * 100);
    const orderId = `tp_${randomUUID()}`;
    const appUrl = requireAppUrl();

    const invoice = await createNowPaymentsInvoice({
      priceAmount,
      priceCurrency: "usd",
      payCurrency: payCurrencyMap[parsed.network],
      orderId,
      orderDescription: `${parsed.packs * 1000} call package`,
      ipnCallbackUrl: `${appUrl}/api/webhooks/nowpayments`,
      successUrl: `${appUrl}/topup?status=success&orderId=${orderId}`,
      cancelUrl: `${appUrl}/topup?status=cancelled&orderId=${orderId}`,
      isFixedRate: true,
    });

    const created = await prisma.topUpInvoice.create({
      data: {
        userId: session.sub,
        orderId,
        invoiceId: invoice.id,
        amountCents,
        payCurrency: invoice.pay_currency ?? payCurrencyMap[parsed.network],
        payAmount: invoice.pay_amount ?? null,
        payAddress: invoice.pay_address ?? null,
        status: (invoice.status ?? "pending").toLowerCase(),
        invoiceUrl: invoice.invoice_url,
        nowpayInvoice: invoice,
      },
    });

    return NextResponse.json({
      invoice: {
        ...serializeInvoice(created),
        priceAmount,
        network: parsed.network,
        networkLabel: displayNameMap[parsed.network],
      },
    });
  } catch (error: any) {
    const message = error?.message ?? "Failed to create invoice";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId");
    const sync = url.searchParams.get("sync") === "true";
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 0, 1), 50) : 20;

    if (orderId) {
      const existing = await prisma.topUpInvoice.findFirst({
        where: { orderId, userId: session.sub },
      });

      if (!existing) {
        return NextResponse.json({ invoice: null }, { status: 404 });
      }

      let current = existing;

      if (sync && !isFinalTopUpStatus(existing.status)) {
        const remote = await getNowPaymentsInvoice(existing.invoiceId);
        const applied = await applyTopUpStatus({
          orderId: existing.orderId,
          status: remote.status,
          payAmount: remote.pay_amount ?? existing.payAmount,
          payCurrency: remote.pay_currency ?? existing.payCurrency,
          payAddress: remote.pay_address ?? existing.payAddress,
          nowpayInvoice: remote,
        });

        if (applied?.updated) {
          current = applied.updated;
        } else {
          current = await prisma.topUpInvoice.findUniqueOrThrow({
            where: { orderId: existing.orderId },
          });
        }
      }

      return NextResponse.json({ invoice: serializeInvoice(current) });
    }

    const invoices = await prisma.topUpInvoice.findMany({
      where: { userId: session.sub },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ invoices: invoices.map(serializeInvoice) });
  } catch (error: any) {
    const message = error?.message ?? "Failed to fetch invoices";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
