import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { applyTopUpStatus } from "@/lib/topup";

function getIpnSecret() {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) throw new Error("NOWPAYMENTS_IPN_SECRET is not configured");
  return secret;
}

function verifySignature(rawBody: string, signature: string) {
  const secret = getIpnSecret();
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature.trim().toLowerCase(), "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

function safeString(value: any) {
  if (value === null || value === undefined) return null;
  return String(value);
}

export async function POST(req: Request) {
  try {
    const signature = req.headers.get("x-nowpayments-sig");
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const rawBody = await req.text();
    if (!rawBody) {
      return NextResponse.json({ error: "Empty payload" }, { status: 400 });
    }

    if (!verifySignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const orderId = payload?.order_id ?? payload?.orderId;
    const status =
      safeString(payload?.payment_status)?.toLowerCase() ??
      safeString(payload?.invoice_status)?.toLowerCase() ??
      safeString(payload?.status)?.toLowerCase();

    if (!orderId || !status) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await applyTopUpStatus({
      orderId,
      status,
      payAmount: safeString(payload?.pay_amount),
      payCurrency: safeString(payload?.pay_currency)?.toLowerCase() ?? null,
      payAddress: safeString(payload?.pay_address),
      paymentId: safeString(payload?.payment_id),
      ipnPayload: payload,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const message = error?.message ?? "Unable to process webhook";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
