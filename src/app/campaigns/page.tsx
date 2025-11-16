"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PageFrame, MotionCard, ShimmerTile } from "@/components/ui/LuxuryPrimitives";
import { usePageLoading } from "@/hooks/usePageLoading";
import { useLiveMetrics } from "@/hooks/useLiveMetrics";
import type { LiveMetrics } from "@/hooks/useLiveMetrics";

const Icons = {
  Refresh: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M20 12a8 8 0 10-3 6.3" />
      <path d="M20 4v6h-6" />
    </svg>
  ),
  Download: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  ),
  Search: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  ),
  Dot: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <circle cx="12" cy="12" r="6" />
    </svg>
  ),
};

const STATUS = ["placing", "ringing", "answered", "completed", "failed", "hungup", "cancelled"] as const;

type CallRow = {
  id: string;
  status: string;
  callerId: string | null;
  dialedNumber: string | null;
  durationSeconds: number | null;
  costCents: number | null;
  dtmf: string | null;
  createdAt: string;
  campaign: { id: string; name: string };
  lead: {
    phoneNumber: string | null;
    normalizedNumber?: string | null;
    rawLine: string | null;
  } | null;
};

function classNames(...a: Array<string | false | undefined>) {
  return a.filter(Boolean).join(" ");
}

export default function CampaignStatusPage() {
    const { loading: introLoading } = usePageLoading(720);
    const { data: metrics, loading: metricsLoading } = useLiveMetrics({ scope: "me", intervalMs: 5000 });
    const [calls, setCalls] = useState<CallRow[]>([]);
    const [loadingCalls, setLoadingCalls] = useState(true);
    const [q, setQ] = useState("");
    const [status, setStatus] = useState<string | "all">("all");
    const [dtmfOnly, setDtmfOnly] = useState(false);
    const [dtmfDigit, setDtmfDigit] = useState<string | null>(null);
    const loading = introLoading || metricsLoading || loadingCalls;

    useEffect(() => {
      let active = true;
      setLoadingCalls(true);
      async function load() {
        try {
          const params = new URLSearchParams();
          if (status !== "all") params.set("status", status.toUpperCase());
          if (dtmfOnly) params.set("dtmfOnly", "true");
          if (dtmfDigit) params.set("dtmf", dtmfDigit);
          if (q.trim()) params.set("q", q.trim());
          const res = await fetch(`/api/calls/live?${params.toString()}`, { cache: "no-store" });
          if (!res.ok) throw new Error("Unable to load calls");
          const data = await res.json();
          if (active) {
            setCalls(data.calls ?? []);
            setLoadingCalls(false);
          }
        } catch {
          if (active) {
            setLoadingCalls(false);
          }
        }
      }
      load();
      const timer = setInterval(load, 5000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [status, dtmfOnly, dtmfDigit, q]);

    const filtered = useMemo(() => {
      return calls.filter((r) => {
        if (q && !(`${r.dialedNumber ?? ""} ${r.callerId ?? ""} ${r.id}`.toLowerCase().includes(q.toLowerCase()))) return false;
        if (status !== "all" && r.status !== status) return false;
        if (dtmfOnly && !r.dtmf) return false;
        if (dtmfDigit && !r.dtmf?.startsWith(dtmfDigit)) return false;
        return true;
      });
    }, [calls, q, status, dtmfOnly, dtmfDigit]);

    const stats = useMemo(() => {
      const total = metrics?.calls.total ?? 0;
      const answered = metrics?.calls.answered ?? 0;
      const dtmf = metrics?.calls.dtmf ?? 0;
      const spend = ((metrics?.calls.costCents ?? 0) / 100).toFixed(2);
      return { total, answered, dtmf, spend: +spend };
    }, [metrics]);

    function exportCsv() {
      const header = ["id", "time", "caller", "callee", "status", "duration", "cost", "dtmf", "raw_line"].join(",");
      const body = filtered
        .map((r) =>
          [
            r.id,
            new Date(r.createdAt).toISOString(),
            r.callerId ?? "",
            r.dialedNumber ?? "",
            r.status,
            r.durationSeconds ?? 0,
            ((r.costCents ?? 0) / 100).toFixed(4),
            r.dtmf ?? "",
            (r.lead?.rawLine ?? "").replace(/,/g, " "),
          ].join(","),
        )
        .join("\n");
      const blob = new Blob([header + "\n" + body], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "campaign-status.csv";
      a.click();
      URL.revokeObjectURL(url);
    }

    const statusChips = [
      { key: "all", label: "All" },
      { key: "placing", label: "Placing" },
      { key: "ringing", label: "Ringing" },
      { key: "answered", label: "Answered" },
      { key: "completed", label: "Completed" },
      { key: "failed", label: "Failed" },
      { key: "hungup", label: "Hung up" },
      { key: "cancelled", label: "Cancelled" },
    ];

  const exportAction = (
    <button
      onClick={exportCsv}
      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(13,148,136,0.32)] transition hover:shadow-[0_22px_40px_rgba(13,148,136,0.45)]"
    >
      <Icons.Download className="h-4 w-4" />
      Export CSV
    </button>
  );

  return (
    <PageFrame
      eyebrow="Operations"
      title="Campaign command center"
      description="Track every outbound call with live status, DTMF capture and spend telemetry."
      actions={exportAction}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Total calls" value={stats.total.toLocaleString()} loading={loading} />
        <Stat
          title="Answered rate"
          value={stats.answered.toLocaleString()}
          subtitle={`${Math.round((stats.answered / Math.max(stats.total, 1)) * 100)}% ASR`}
          tone="emerald"
          loading={loading}
        />
        <Stat
          title="DTMF captured"
          value={stats.dtmf.toLocaleString()}
          subtitle={`${Math.round((stats.dtmf / Math.max(stats.total, 1)) * 100)}% conversion`}
          tone="violet"
          loading={loading}
        />
        <Stat
          title="Spend"
          value={`$${stats.spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          tone="amber"
          loading={loading}
        />
      </div>

      <MotionCard tone="neutral" className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative">
              <Icons.Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search ID, caller or callee"
                className="w-full rounded-full border border-white/50 bg-white/70 py-2 pl-9 pr-3 text-sm text-zinc-700 shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {statusChips.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setStatus(c.key as typeof status)}
                  className={classNames(
                    "rounded-full px-3 py-1 text-xs font-medium transition",
                    status === c.key
                      ? "bg-emerald-500/20 text-emerald-600 ring-2 ring-emerald-400/50 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "bg-white/60 text-zinc-600 hover:bg-white dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <label className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-xs font-medium text-zinc-600 ring-1 ring-white/55 transition hover:bg-white dark:bg-white/10 dark:text-zinc-300 dark:ring-white/10">
            <input
              type="checkbox"
              checked={dtmfOnly}
              onChange={(e) => setDtmfOnly(e.target.checked)}
              className="h-4 w-4 accent-emerald-500"
            />
            DTMF only
          </label>
            <button
              onClick={() => setDtmfDigit((prev) => (prev === "1" ? null : "1"))}
              className={classNames(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium ring-1 transition",
                dtmfDigit === "1"
                  ? "bg-emerald-500/20 text-emerald-600 ring-emerald-400/50 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "bg-white/70 text-zinc-600 ring-white/55 hover:bg-white dark:bg-white/5 dark:text-zinc-300 dark:ring-white/10",
              )}
            >
              {dtmfDigit === "1" ? "Clear \"1\"" : "Pressed 1"}
            </button>
        </div>

        {loading ? (
          <div className="mt-6 space-y-3">
            {Array.from({ length: 10 }).map((_, index) => (
              <ShimmerTile key={index} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-3xl border border-white/45 bg-white/70 shadow-inner backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="max-h-[520px] overflow-auto">
              <table className="min-w-full divide-y divide-white/60 text-sm dark:divide-white/10">
                  <thead className="bg-white/70 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:bg-white/5 dark:text-zinc-400">
                  <tr>
                    <th className="px-5 py-4 text-left">Time</th>
                    <th className="px-5 py-4 text-left">ID</th>
                    <th className="px-5 py-4 text-left">Caller → Callee</th>
                    <th className="px-5 py-4 text-left">Status</th>
                    <th className="px-5 py-4 text-left">Duration</th>
                    <th className="px-5 py-4 text-left">DTMF</th>
                      <th className="px-5 py-4 text-left">Lead input</th>
                    <th className="px-5 py-4 text-left">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/40 bg-white/50 dark:divide-white/5 dark:bg-transparent">
                  <AnimatePresence initial={false}>
                    {filtered.map((r) => (
                      <motion.tr
                        key={r.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.25 }}
                        className="transition hover:bg-white dark:hover:bg-white/5"
                      >
                          <td className="px-5 py-4 whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                            {new Date(r.createdAt).toLocaleTimeString()}
                          </td>
                        <td className="px-5 py-4 font-mono text-xs text-zinc-600 dark:text-zinc-300">{r.id}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                              <span className="font-semibold text-zinc-800 dark:text-zinc-100">{r.callerId ?? "Unknown"}</span>
                            <span className="text-zinc-400">→</span>
                              <span className="text-zinc-600 dark:text-zinc-200">{r.dialedNumber ?? "Unknown"}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge value={r.status} />
                        </td>
                          <td className="px-5 py-4 tabular-nums text-zinc-600 dark:text-zinc-200">
                            {r.durationSeconds ? `${r.durationSeconds}s` : "—"}
                          </td>
                          <td className="px-5 py-4 font-mono text-xs text-zinc-500 dark:text-zinc-300">{r.dtmf || ""}</td>
                          <td className="px-5 py-4 text-xs text-zinc-500 dark:text-zinc-300">
                            {r.lead?.rawLine ? (
                              <span title={r.lead.rawLine} className="line-clamp-2 max-w-xs">
                                {r.lead.rawLine}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-5 py-4 tabular-nums text-zinc-700 dark:text-zinc-100">
                            ${((r.costCents ?? 0) / 100).toFixed(4)}
                          </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            Showing {loading ? "—" : filtered.length.toLocaleString()} of {calls.length.toLocaleString()} calls
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-500 dark:text-emerald-300">
            <Icons.Refresh className="h-3.5 w-3.5" />
            Live
          </span>
        </div>
      </MotionCard>
    </PageFrame>
  );
}

function StatusBadge({ value }: { value: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    placing: { label: "Placing", cls: "bg-white text-zinc-600 ring-white/60 dark:bg-white/10 dark:text-zinc-200 dark:ring-white/10" },
    ringing: {
      label: "Ringing",
      cls: "bg-emerald-500/15 text-emerald-600 ring-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30",
    },
    answered: {
      label: "Answered",
      cls: "bg-sky-500/15 text-sky-600 ring-sky-400/40 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/30",
    },
    failed: {
      label: "Failed",
      cls: "bg-rose-500/15 text-rose-600 ring-rose-400/40 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/30",
    },
    completed: {
      label: "Completed",
      cls: "bg-teal-500/15 text-teal-600 ring-teal-400/40 dark:bg-teal-500/15 dark:text-teal-300 dark:ring-teal-400/30",
    },
    hungup: {
      label: "Hung up",
      cls: "bg-orange-500/15 text-orange-600 ring-orange-400/40 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-400/30",
    },
    cancelled: {
      label: "Cancelled",
      cls: "bg-zinc-500/15 text-zinc-200 ring-zinc-400/30 dark:bg-zinc-500/15 dark:text-zinc-200",
    },
  };
  const m = map[value] || map.placing;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${m.cls}`}>
      <Icons.Dot className="h-1.5 w-1.5" />
      {m.label}
    </span>
  );
}

type StatProps = {
  title: string;
  value: string;
  subtitle?: string;
  tone?: "emerald" | "violet" | "amber" | "sky" | "neutral";
  loading?: boolean;
};

function Stat({ title, value, subtitle, tone = "neutral", loading }: StatProps) {
  return (
    <MotionCard tone={tone} className="p-5 sm:p-6">
      <div className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">{title}</div>
      {loading ? (
        <div className="mt-4 space-y-3">
          <ShimmerTile className="h-6 rounded-xl" />
          {subtitle ? <ShimmerTile className="h-3 w-1/2 rounded-full" /> : null}
        </div>
      ) : (
        <>
          <div className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-white">{value}</div>
          {subtitle ? <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</div> : null}
        </>
      )}
    </MotionCard>
  );
}
