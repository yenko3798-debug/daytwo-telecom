const BASE_URL = process.env.NOWPAYMENTS_BASE_URL ?? "https://api.nowpayments.io/v1";

export type NowPaymentsInvoice = {
  id: string;
  status: string;
  invoice_url: string;
  created_at: string;
  price_amount: number;
  price_currency: string;
  pay_amount?: string;
  pay_currency?: string;
  pay_address?: string;
  order_id: string;
};

function getApiKey() {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) {
    throw new Error("NOWPAYMENTS_API_KEY is not configured");
  }
  return apiKey;
}

function headers() {
  return {
    "Content-Type": "application/json",
    "x-api-key": getApiKey(),
  };
}

function toErrorMessage(data: any) {
  if (!data) return "Unknown NowPayments error";
  if (typeof data === "string") return data;
  if (data.message) return data.message;
  if (Array.isArray(data.errors)) return data.errors.join(", ");
  return JSON.stringify(data);
}

export async function createNowPaymentsInvoice(input: {
  priceAmount: number;
  priceCurrency: string;
  payCurrency?: string;
  orderId: string;
  orderDescription?: string;
  ipnCallbackUrl: string;
  successUrl?: string;
  cancelUrl?: string;
  isFixedRate?: boolean;
}) {
  const payload: Record<string, any> = {
    price_amount: input.priceAmount,
    price_currency: input.priceCurrency,
    order_id: input.orderId,
    ipn_callback_url: input.ipnCallbackUrl,
  };

  if (input.orderDescription) payload.order_description = input.orderDescription;
  if (input.payCurrency) payload.pay_currency = input.payCurrency;
  if (input.successUrl) payload.success_url = input.successUrl;
  if (input.cancelUrl) payload.cancel_url = input.cancelUrl;
  if (typeof input.isFixedRate === "boolean") payload.is_fixed_rate = input.isFixedRate;

  const res = await fetch(`${BASE_URL}/invoice`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(toErrorMessage(data));
  }

  return data as NowPaymentsInvoice;
}

export async function getNowPaymentsInvoice(invoiceId: string) {
  const res = await fetch(`${BASE_URL}/invoice/${invoiceId}`, {
    method: "GET",
    headers: headers(),
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(toErrorMessage(data));
  }

  return data as NowPaymentsInvoice;
}
