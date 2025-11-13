"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { motion, AnimatePresence } from "framer-motion";
import { PageFrame, MotionCard, ShimmerTile } from "@/components/ui/LuxuryPrimitives";

/* ---------- tiny inline icons (no external deps) ---------- */
const Icons = {
  Plus: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Repeat: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M17 1l4 4-4 4" />
      <path d="M3 11V9a6 6 0 016-6h12" />
      <path d="M7 23l-4-4 4-4" />
      <path d="M21 13v2a6 6 0 01-6 6H3" />
    </svg>
  ),
  Link2: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M10 13a5 5 0 007.07 0l1.41-1.41a5 5 0 000-7.07 5 5 0 00-7.07 0L10 6" />
      <path d="M14 11a5 5 0 00-7.07 0L5.5 12.43a5 5 0 000 7.07 5 5 0 007.07 0L14 18" />
    </svg>
  ),
  ArrowUpRight: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M7 17L17 7" />
      <path d="M7 7h10v10" />
    </svg>
  ),
  ArrowDownToLine: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M12 3v12" />
      <path d="M8 11l4 4 4-4" />
      <path d="M5 21h14" />
    </svg>
  ),
  ArrowLeft: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M15 19l-7-7 7-7" />
    </svg>
  ),
  Copy: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  ),
  Qr: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm6-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm10-2h2v2h-2v-2zm-2 2h2v2h-2v-2zm4 2h2v2h-2v-2zm-2 2h2v2h-2v-2z" />
    </svg>
  ),
};

/* ---------- tiny toast ---------- */
function useToast() {
  const [toasts, setToasts] = useState([]);
  const push = (msg) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 1800);
  };
  function View() {
    return (
      <div className="pointer-events-none fixed right-4 top-4 z-[60] flex max-w-sm flex-col items-end space-y-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              className="pointer-events-auto rounded-xl bg-zinc-900/90 px-3 py-2 text-sm text-white shadow-lg ring-1 ring-white/10 backdrop-blur"
            >
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  }
  return { push, View };
}

const networkConfig = {
  ethereum: { label: "Ethereum", icon: "🪙", short: "ETH" },
  bitcoin: { label: "Bitcoin", icon: "₿", short: "BTC" },
  solana: { label: "Solana", icon: "◎", short: "SOL" },
  usdc: { label: "USDC", icon: "⚪", short: "USDC" },
} as const;

type NetworkKey = keyof typeof networkConfig;
const networkIds = Object.keys(networkConfig) as NetworkKey[];

const currencyToNetwork: Record<string, NetworkKey> = {
  eth: "ethereum",
  btc: "bitcoin",
  sol: "solana",
  usdc: "usdc",
};

const statusCopy: Record<string, string> = {
  pending: "Awaiting payment",
  waiting: "Awaiting payment",
  confirming: "Confirming",
  confirmed: "Confirming",
  sending: "Sending",
  finished: "Completed",
  failed: "Failed",
  expired: "Expired",
  refunded: "Refunded",
  partially_paid: "Partially paid",
};

const finalStatuses = new Set(["finished", "failed", "expired", "refunded", "partially_paid"]);

const packPriceUsd = 275;

const statusTone: Record<string, string> = {
  finished: "text-emerald-400",
  confirming: "text-amber-400",
  confirmed: "text-amber-400",
  sending: "text-amber-400",
  waiting: "text-sky-400",
  pending: "text-sky-400",
  partially_paid: "text-amber-400",
  failed: "text-rose-400",
  expired: "text-rose-400",
  refunded: "text-rose-400",
};

/* ---------- UI bits ---------- */
function ActionButton({ label, Icon, onClick }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="group inline-flex cursor-pointer flex-col items-center justify-center rounded-2xl bg-zinc-900/5 px-3 py-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-900/10 transition hover:ring-emerald-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:bg-white/5 dark:text-zinc-100 dark:ring-white/10"
    >
      <span className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-zinc-200 to-zinc-300 text-zinc-800 shadow-sm ring-1 ring-inset ring-white/50 transition group-hover:shadow group-hover:brightness-110 dark:from-zinc-700 dark:to-zinc-800 dark:text-white dark:ring-white/20">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-[11px] font-medium opacity-90">{label}</span>
    </motion.button>
  );
}

function TokenRowSkeleton() {
  return (
    <div className="flex items-center justify-between px-2 py-2">
      <div className="flex items-center gap-3">
        <ShimmerTile className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <ShimmerTile className="h-3 w-28 rounded-full" />
          <ShimmerTile className="h-3 w-20 rounded-full" />
        </div>
      </div>
      <ShimmerTile className="h-3 w-16 rounded-full" />
    </div>
  );
}

function TokenRow({ icon, name, value, sub, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className="w-full text-left"
    >
      <div className="flex items-center justify-between rounded-xl px-2 py-2 transition hover:bg-zinc-900/5 dark:hover:bg-white/5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900/5 ring-1 ring-zinc-900/10 dark:bg-white/10 dark:ring-white/10">
            <span className="text-lg">{icon}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{name}</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{sub}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{value}</div>
        </div>
      </div>
    </motion.button>
  );
}

function SectionCard({ title, children, footer, loading, tone }: { title?: string; children: React.ReactNode; footer?: React.ReactNode; loading?: boolean; tone?: "emerald" | "violet" | "neutral"; }) {
  const cardTone = tone === "emerald" ? "emerald" : tone === "violet" ? "violet" : "neutral";
  return (
    <MotionCard tone={cardTone} className="p-5 sm:p-6">
      {title ? (
        <h3 className="mb-3 text-sm font-semibold tracking-tight text-zinc-600 dark:text-zinc-200">
          {title}
        </h3>
      ) : null}
      {loading ? (
        <div className="space-y-3">
          <ShimmerTile className="h-12 rounded-xl" />
          <ShimmerTile className="h-3 w-2/3 rounded-full" />
        </div>
      ) : (
        children
      )}
      {footer ? <div className="mt-4 border-t border-white/50 pt-3 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400">{footer}</div> : null}
    </MotionCard>
  );
}

function AddressRow({ label, address, onShowQr, onCopy }) {
  const hasAddress = Boolean(address);
  const short = hasAddress ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Address pending";
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-900/10 bg-white/60 p-3 transition hover:bg-white/80 dark:border-white/10 dark:bg-zinc-900/40 dark:hover:bg-zinc-900/60">
      <div>
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">{short}</div>
      </div>
      <div className="flex items-center gap-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={hasAddress ? onShowQr : undefined}
          disabled={!hasAddress}
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg ring-1 ring-zinc-900/10 transition hover:bg-zinc-900/5 hover:ring-emerald-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 dark:ring-white/10 dark:hover:bg-white/10"
          aria-label="Show QR"
        >
          <Icons.Qr className="h-4 w-4" />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={hasAddress ? onCopy : undefined}
          disabled={!hasAddress}
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg ring-1 ring-zinc-900/10 transition hover:bg-zinc-900/5 hover:ring-emerald-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 dark:ring-white/10 dark:hover:bg-white/10"
          aria-label="Copy"
        >
          <Icons.Copy className="h-4 w-4" />
        </motion.button>
      </div>
    </div>
  );
}

function QrModal({ open, onClose, address, network = "Ethereum" }) {
  const display = address ?? "Address will appear once the invoice is ready";
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md overflow-hidden rounded-2xl bg-zinc-900 text-zinc-100 shadow-2xl ring-1 ring-white/10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm opacity-80">Scan to Top Up ({network})</div>
              <button
                onClick={onClose}
                className="rounded-lg px-2 py-1 text-xs ring-1 ring-inset ring-white/10 hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="mx-auto mb-4 grid h-64 w-64 place-items-center rounded-xl bg-zinc-800">
                <div className="text-xs opacity-60">
                  {address ? "QR CODE" : "Waiting for deposit address"}
                </div>
            </div>
            <div className="rounded-xl bg-zinc-800 p-3">
              <div className="text-xs opacity-70">Your {network} address</div>
                <div className="truncate text-sm font-mono">{display}</div>
            </div>
            <p className="mt-3 text-xs opacity-60">
              Use this address for top ups on {network} and compatible networks. Transactions may
              take time to confirm.
            </p>
          </motion.div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

/* ---------- Page ---------- */
export default function TopUpPage() {
  const { push, View: Toasts } = useToast();

  const [network, setNetwork] = useState<NetworkKey>("ethereum");
  const [packs, setPacks] = useState(1);
  const [activeTab, setActiveTab] = useState("address");
  const [qrOpen, setQrOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const unmounted = useRef(false);
  useEffect(() => {
    return () => {
      unmounted.current = true;
    };
  }, []);

  const usdFormatter = useMemo(
    () => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
    []
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
      }),
    []
  );

  const formatUsd = useCallback(
    (value: number) => usdFormatter.format(value),
    [usdFormatter]
  );

  const formatDate = useCallback(
    (value: string | null | undefined) => {
      if (!value) return "--";
      try {
        return dateFormatter.format(new Date(value));
      } catch {
        return value;
      }
    },
    [dateFormatter]
  );

  const openInvoice = useCallback((url?: string | null) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const copy = useCallback(
    async (text?: string | null, successMessage?: string) => {
      if (!text) return;
      try {
        await navigator.clipboard?.writeText(text);
        push(successMessage ?? "Copied");
      } catch {
        push("Copy failed");
      }
    },
    [push]
  );

  const fetchUser = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoadingUser(true);
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Unable to load account");
        if (!unmounted.current) setUser(data?.user ?? null);
      } catch (error: any) {
        if (!opts?.silent) push(error?.message ?? "Unable to load account");
      } finally {
        if (!opts?.silent && !unmounted.current) setLoadingUser(false);
      }
    },
    [push]
  );

  const fetchInvoices = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoadingInvoices(true);
      try {
        const res = await fetch("/api/topup/invoices?limit=20", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Unable to load invoices");
        if (!unmounted.current) {
          const list = Array.isArray(data?.invoices) ? data?.invoices : [];
          setInvoices(list);
        }
      } catch (error: any) {
        if (!opts?.silent) push(error?.message ?? "Unable to load invoices");
      } finally {
        if (!opts?.silent && !unmounted.current) setLoadingInvoices(false);
      }
    },
    [push]
  );

  useEffect(() => {
    (async () => {
      await Promise.all([fetchUser(), fetchInvoices()]);
    })();
  }, [fetchUser, fetchInvoices]);

  useEffect(() => {
    if (selectedOrderId) return;
    const firstOpen = invoices.find((item) => !finalStatuses.has(item.status));
    if (firstOpen) setSelectedOrderId(firstOpen.orderId);
  }, [invoices, selectedOrderId]);

  const selectedInvoice = useMemo(() => {
    if (!selectedOrderId) return null;
    return invoices.find((item) => item.orderId === selectedOrderId) ?? null;
  }, [invoices, selectedOrderId]);

  useEffect(() => {
    if (!selectedOrderId) return;
    const current = invoices.find((item) => item.orderId === selectedOrderId);
    if (current && finalStatuses.has(current.status)) return;
    const interval = setInterval(async () => {
      try {
        setSyncing(true);
        const res = await fetch(
          `/api/topup/invoices?orderId=${selectedOrderId}&sync=true`,
          { cache: "no-store" }
        );
        const data = await res.json().catch(() => null);
        if (res.ok && data?.invoice) {
          if (!unmounted.current) {
            setInvoices((prev) => {
              const index = prev.findIndex((item) => item.orderId === data.invoice.orderId);
              if (index >= 0) {
                const next = [...prev];
                next[index] = data.invoice;
                return next;
              }
              return [data.invoice, ...prev];
            });
          }
          if (finalStatuses.has(data.invoice.status)) {
            await fetchUser({ silent: true });
            await fetchInvoices({ silent: true });
            if (!unmounted.current) setSelectedOrderId(null);
          }
        }
      } catch {
      } finally {
        if (!unmounted.current) setSyncing(false);
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [selectedOrderId, invoices, fetchUser, fetchInvoices]);

  const handleCreateInvoice = useCallback(async () => {
    if (creatingInvoice) return;
    setCreatingInvoice(true);
    setActiveTab("address");
    try {
      const res = await fetch("/api/topup/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packs, network }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.invoice) throw new Error(data?.error ?? "Failed to create invoice");
      const invoice = data.invoice;
      if (!unmounted.current) {
        setInvoices((prev) => {
          const filtered = prev.filter((item) => item.orderId !== invoice.orderId);
          return [invoice, ...filtered];
        });
        setSelectedOrderId(invoice.orderId);
      }
      push("Invoice created");
      openInvoice(invoice.invoiceUrl);
    } catch (error: any) {
      push(error?.message ?? "Failed to create invoice");
    } finally {
      if (!unmounted.current) setCreatingInvoice(false);
    }
  }, [creatingInvoice, packs, network, push, openInvoice]);

  const pct = useMemo(() => ((packs - 1) / 19) * 100, [packs]);
  const networkMeta = networkConfig[network];
  const amountUsd = packs * packPriceUsd;
  const amountText = formatUsd(amountUsd);
  const balanceUsd = user ? user.balanceCents / 100 : 0;
  const balanceText = user ? formatUsd(balanceUsd) : loadingUser ? "--" : formatUsd(0);
  const accountName = user?.name ?? user?.email ?? "Account";

  const activeInvoice =
    selectedInvoice ??
    invoices.find((item) => !finalStatuses.has(item.status)) ??
    null;
  const activeCurrency = activeInvoice?.payCurrency
    ? String(activeInvoice.payCurrency).toLowerCase()
    : null;
  const activeNetworkKey =
    (activeCurrency && currencyToNetwork[activeCurrency]) ?? network;
  const activeNetworkMeta = networkConfig[activeNetworkKey];
  const activeStatus = activeInvoice?.status ?? "pending";
  const activeStatusLabel = statusCopy[activeStatus] ?? activeStatus;
  const activeStatusClass = statusTone[activeStatus] ?? "text-sky-400";
  const activeAddress = activeInvoice?.payAddress ?? null;
  const activeInvoiceUrl = activeInvoice?.invoiceUrl ?? null;
  const activeUsdAmount = activeInvoice ? activeInvoice.amountCents / 100 : null;
  const activePayAmount = activeInvoice?.payAmount
    ? [String(activeInvoice.payAmount), activeInvoice?.payCurrency ? String(activeInvoice.payCurrency).toUpperCase() : ""]
        .filter(Boolean)
        .join(" ")
    : null;

  const historyItems = invoices.slice(0, 5);
  const historyLoading = loadingInvoices && historyItems.length === 0;
  const statusLoading = loadingInvoices && !activeInvoice;

  const handlePrimaryAction = useCallback(() => {
    if (activeAddress) {
      setQrOpen(true);
      return;
    }
    if (activeInvoiceUrl) {
      openInvoice(activeInvoiceUrl);
      return;
    }
    handleCreateInvoice();
  }, [activeAddress, activeInvoiceUrl, openInvoice, handleCreateInvoice]);

  const handleShowQr = useCallback(() => {
    if (!activeAddress) {
      if (activeInvoiceUrl) openInvoice(activeInvoiceUrl);
      return;
    }
    setQrOpen(true);
  }, [activeAddress, activeInvoiceUrl, openInvoice]);

  const handleCopyAddress = useCallback(() => {
    copy(activeAddress, "Address copied");
  }, [copy, activeAddress]);

  const handleCopyInvoiceUrl = useCallback(() => {
    copy(activeInvoiceUrl, "Link copied");
  }, [copy, activeInvoiceUrl]);

  const Tab = ({ id, children }: { id: string; children: React.ReactNode }) => (
    <button
      onClick={() => setActiveTab(id)}
      className="relative px-1 pb-3 text-sm text-zinc-500 transition hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:text-zinc-400 dark:hover:text-zinc-200"
    >
      <span className="font-medium">{children}</span>
      <AnimatePresence>
        {activeTab === id && (
          <motion.span
            layoutId="tab-underline"
            className="absolute -bottom-px left-0 right-0 h-0.5 bg-emerald-400"
          />
        )}
      </AnimatePresence>
    </button>
  );

  const heroActions = (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={handlePrimaryAction}
      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(13,148,136,0.35)] transition hover:shadow-[0_22px_42px_rgba(13,148,136,0.45)]"
    >
      <Icons.ArrowDownToLine className="h-4 w-4" />
      {activeInvoiceUrl ? "Open invoice" : "Generate invoice"}
    </motion.button>
  );

  return (
    <PageFrame
      eyebrow="Billing"
      title="Balance studio"
      description="Design multi-chain funding flows, schedule pack purchases and keep wallets in sync with luxe microinteractions."
      actions={heroActions}
    >
      <Toasts />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl bg-gradient-to-b from-zinc-900 to-zinc-800 p-6 text-zinc-100 shadow-lg ring-1 ring-white/10"
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="text-lg font-semibold">{accountName}</div>
              <div className="flex items-center gap-2 opacity-80">
                <span className="text-xs">•••</span>
              </div>
            </div>

            <div className="mb-1 text-xs uppercase tracking-wide text-white/60">
              Available balance
            </div>
            <div className="mb-6 text-3xl font-bold tracking-tight">{balanceText}</div>

            <div className="relative mb-6 grid grid-cols-5 gap-3">
              <div className="pointer-events-none absolute -inset-2 -z-10 rounded-3xl bg-gradient-to-b from-emerald-400/20 via-emerald-400/10 to-transparent" />
              <ActionButton label="Buy" Icon={Icons.Plus} onClick={() => push("Buy flow coming soon")} />
              <ActionButton label="Swap" Icon={Icons.Repeat} onClick={() => push("Swap flow coming soon")} />
              <ActionButton label="Bridge" Icon={Icons.Link2} onClick={() => push("Bridge flow coming soon")} />
              <ActionButton label="Send" Icon={Icons.ArrowUpRight} onClick={() => push("Send flow coming soon")} />
              <ActionButton label="Receive" Icon={Icons.ArrowDownToLine} onClick={handlePrimaryAction} />
            </div>

            <div className="flex gap-3">
              <button className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-inset ring-white/20">
                Crypto
              </button>
              <button className="rounded-full px-3 py-1 text-xs opacity-70 ring-1 ring-inset ring-white/20 hover:bg-white/10">
                Automation
              </button>
              <button className="rounded-full px-3 py-1 text-xs opacity-70 ring-1 ring-inset ring-white/20 hover:bg-white/10">
                Insights
              </button>
            </div>

            <div className="mt-5 space-y-1.5">
              {historyLoading ? (
                <>
                  <TokenRowSkeleton />
                  <TokenRowSkeleton />
                  <TokenRowSkeleton />
                </>
              ) : historyItems.length > 0 ? (
                historyItems.map((invoice) => {
                  const currencyKey =
                    (invoice.payCurrency &&
                      currencyToNetwork[String(invoice.payCurrency).toLowerCase()]) ??
                    "ethereum";
                  const meta = networkConfig[currencyKey as NetworkKey];
                  const label = statusCopy[invoice.status] ?? invoice.status;
                  const created = formatDate(invoice.createdAt);
                  return (
                    <TokenRow
                      key={invoice.orderId}
                      icon={meta.icon}
                      name={`${meta.label}`}
                      value={formatUsd(invoice.amountCents / 100)}
                      sub={`${label} | ${created}`}
                      onClick={() => {
                        setSelectedOrderId(invoice.orderId);
                        if (invoice.invoiceUrl) openInvoice(invoice.invoiceUrl);
                      }}
                    />
                  );
                })
              ) : (
                <div className="rounded-xl border border-white/10 p-4 text-xs text-white/60">
                  No top ups yet. Generate an invoice to get started.
                </div>
              )}
            </div>
          </motion.div>
        </div>

        <div className="lg:col-span-1">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl bg-white/80 p-6 shadow-lg ring-1 ring-zinc-900/10 backdrop-blur-sm dark:bg-zinc-900/70 dark:ring-white/10"
          >
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button className="rounded-full px-3 py-1 text-xs ring-1 ring-inset ring-zinc-900/10 hover:bg-zinc-900/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:ring-white/10 dark:hover:bg-white/10">
                  <Icons.ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Top up balance
                </h2>
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {syncing ? "Syncing status..." : "$275 / 1,000 calls"}
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {networkIds.map((id) => (
                <motion.button
                  key={id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setNetwork(id)}
                  className={
                    "rounded-full px-3 py-1 text-xs ring-1 ring-inset transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 " +
                    (network === id
                      ? "bg-emerald-500/15 text-emerald-500 ring-emerald-400/40"
                      : "text-zinc-500 hover:bg-zinc-900/5 ring-zinc-900/10 dark:ring-white/10 dark:hover:bg-white/10")
                  }
                >
                  {networkConfig[id].label}
                </motion.button>
              ))}
            </div>

            <div className="mb-4 flex gap-6 border-b border-zinc-900/10 text-sm dark:border-white/10">
              <Tab id="address">Address</Tab>
              <Tab id="username">Username</Tab>
            </div>

            {activeTab === "address" ? (
              <div className="space-y-4">
                <SectionCard
                  title={`Your ${activeNetworkMeta.label} instructions`}
                  footer={
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      Use the invoice link to pay via NOWPayments. Balance updates the moment payment is confirmed.
                    </div>
                  }
                >
                  <AddressRow
                    label={`${activeNetworkMeta.label} deposit`}
                    address={activeAddress}
                    onShowQr={handleShowQr}
                    onCopy={handleCopyAddress}
                  />

                  <div className="mt-4 rounded-xl bg-zinc-900/5 p-3 dark:bg-white/5">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span>Top-up amount (×1,000 calls)</span>
                      <span className="font-semibold">
                        {packs}k calls · {amountText}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setPacks((value) => Math.max(1, value - 1))}
                        disabled={creatingInvoice}
                        className="rounded-lg px-2 py-1 ring-1 ring-inset ring-zinc-900/10 transition hover:bg-zinc-900/5 disabled:cursor-not-allowed disabled:opacity-40 dark:ring-white/10 dark:hover:bg-white/10"
                      >
                        -
                      </button>

                      <div className="relative h-3 flex-1 rounded-full bg-zinc-200/30 dark:bg-zinc-800">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-emerald-400/70"
                          style={{ width: `${pct}%` }}
                        />
                        <input
                          type="range"
                          min={1}
                          max={20}
                          value={packs}
                          disabled={creatingInvoice}
                          onChange={(e) => setPacks(Number(e.target.value))}
                          className="absolute inset-0 h-3 w-full cursor-pointer appearance-none bg-transparent accent-emerald-500"
                        />
                        <div
                          className="pointer-events-none absolute -top-8"
                          style={{ left: `calc(${pct}% - 12px)` }}
                        >
                          <div className="rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                            {packs}k
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setPacks((value) => Math.min(20, value + 1))}
                        disabled={creatingInvoice}
                        className="rounded-lg px-2 py-1 ring-1 ring-inset ring-zinc-900/10 transition hover:bg-zinc-900/5 disabled:cursor-not-allowed disabled:opacity-40 dark:ring-white/10 dark:hover:bg-white/10"
                      >
                        +
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {[1, 2, 5, 10].map((n) => (
                        <button
                          key={n}
                          onClick={() => setPacks(n)}
                          disabled={creatingInvoice}
                          className={
                            "rounded-full px-2.5 py-1 ring-1 ring-inset transition " +
                            (packs === n
                              ? "bg-emerald-500/20 text-emerald-400 ring-emerald-400/40"
                              : "text-zinc-500 hover:bg-zinc-900/5 ring-zinc-900/10 dark:ring-white/10 dark:hover:bg-white/10") +
                            (creatingInvoice ? " cursor-not-allowed opacity-40" : "")
                          }
                        >
                          {n}k
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={handleCreateInvoice}
                        disabled={creatingInvoice}
                        className="inline-flex flex-1 items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {creatingInvoice ? "Generating..." : "Generate invoice"}
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => openInvoice(activeInvoiceUrl)}
                        disabled={!activeInvoiceUrl}
                        className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-400/40 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        View invoice
                      </motion.button>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard loading={statusLoading} title="Payment status">
                  {activeInvoice ? (
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500 dark:text-zinc-400">Status</span>
                        <span className={`font-semibold ${activeStatusClass}`}>
                          {activeStatusLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500 dark:text-zinc-400">Order</span>
                        <span className="font-mono text-xs text-zinc-600 dark:text-zinc-200">
                          {activeInvoice.orderId.slice(-12)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500 dark:text-zinc-400">Updated</span>
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">
                          {formatDate(activeInvoice.updatedAt)}
                        </span>
                      </div>
                      {syncing ? (
                        <div className="text-xs text-emerald-500">Syncing status...</div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">
                      Generate an invoice to begin tracking payments in real time.
                    </div>
                  )}
                </SectionCard>
              </div>
            ) : (
              <SectionCard title="Receive by username">
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  Share @yourname so people can top up without an address.
                </div>
              </SectionCard>
            )}
          </motion.div>
        </div>

        <div className="lg:col-span-1">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl bg-zinc-900 p-6 text-zinc-100 shadow-lg ring-1 ring-white/10"
          >
            <div className="rounded-2xl border border-white/10 p-4">
              {statusLoading ? (
                <div className="animate-pulse">
                  <div className="mb-4 h-[220px] rounded-xl bg-zinc-800" />
                  <div className="h-10 rounded bg-zinc-800" />
                </div>
              ) : activeInvoice ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-white/50">Status</div>
                      <div className={`text-base font-semibold ${activeStatusClass}`}>
                        {activeStatusLabel}
                      </div>
                    </div>
                    <div className="text-xs text-white/50">
                      {formatDate(activeInvoice.createdAt)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs uppercase text-white/40">Amount due</div>
                      <div className="font-semibold text-white">
                        {activePayAmount ?? "Pending"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-white/40">USD value</div>
                      <div className="font-semibold text-white">
                        {activeUsdAmount !== null ? formatUsd(activeUsdAmount) : amountText}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => openInvoice(activeInvoiceUrl)}
                      disabled={!activeInvoiceUrl}
                      className="inline-flex flex-1 items-center justify-center rounded-lg bg-white/10 px-3 py-2 text-sm font-medium ring-1 ring-inset ring-white/20 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Open invoice
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleCopyInvoiceUrl}
                      disabled={!activeInvoiceUrl}
                      className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset ring-white/20 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Copy link
                    </motion.button>
                  </div>
                  <div className="rounded-xl bg-zinc-800 p-3 text-xs font-mono break-all">
                    {activeAddress ?? "Address becomes available after opening the invoice."}
                  </div>
                  <p className="text-xs text-white/50">
                    Payment routing is managed by NOWPayments. Keep this tab open to watch status updates roll in automatically.
                  </p>
                </div>
              ) : (
                  <div className="space-y-3 text-sm text-white/60">
                    <p>Generate an invoice to receive crypto top-up instructions.</p>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleCreateInvoice}
                      disabled={creatingInvoice}
                      className="inline-flex items-center justify-center rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-inset ring-white/20 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Create invoice
                    </motion.button>
                  </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      <QrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        address={activeAddress ?? undefined}
        network={activeNetworkMeta.label}
      />
    </PageFrame>
  );
}
