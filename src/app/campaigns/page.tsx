"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PageFrame, MotionCard, ShimmerTile } from "@/components/ui/LuxuryPrimitives";
import { usePageLoading } from "@/hooks/usePageLoading";

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

const STATUS = ["queued", "ringing", "answered", "voicemail", "no-answer", "busy", "failed", "completed"] as const;

function useMockCalls() {
  const [rows, setRows] = useState(() => seed());
  useEffect(() => {
    const t = setInterval(() => {
      setRows((prev) => tick(prev));
    }, 1500);
    return () => clearInterval(t);
  }, []);
  return rows;
}

function seed() {
  const callers = ["+12125550123", "+13025550123", "+17185550123"];
  const callees = ["+19293702263", "+13043144276", "+15105551234", "+17865550123", "+14435550123", "+18005550123"];
  const s: Array<{
    id: string;
    time: number;
    caller: string;
    callee: string;
    status: string;
    duration: number;
    cost: number;
    dtmf: string | null;
    recordingUrl: string | null;
  }> = [];
  for (let i = 0; i < 64; i++) {
    const start = Date.now() - Math.floor(Math.random() * 1000 * 60 * 30);
    const st = ["queued", "ringing", "answered", "voicemail", "no-answer"][Math.floor(Math.random() * 5)];
    const dtmf = Math.random() < 0.25 ? randomDTMF() : null;
    s.push({
      id: `CF-${(100000 + i).toString(36)}`,
      time: start,
      caller: callers[Math.floor(Math.random() * callers.length)],
      callee: callees[Math.floor(Math.random() * callees.length)],
      status: st,
      duration: st === "answered" || st === "voicemail" ? Math.floor(Math.random() * 240) + 10 : 0,
      cost: +(Math.random() * 0.09 + 0.01).toFixed(4),
      dtmf,
      recordingUrl: Math.random() < 0.3 ? "#" : null,
    });
  }
  return s;
}

function tick(prev: ReturnType<typeof seed>) {
  return prev.map((r) => {
    if (Math.random() > 0.1) return r;
    const advance: Record<string, string> = {
      queued: "ringing",
      ringing: Math.random() < 0.5 ? "no-answer" : Math.random() < 0.5 ? "answered" : "voicemail",
      answered: "completed",
      voicemail: "completed",
      "no-answer": "completed",
    };
    const next = advance[r.status] || r.status;
    return {
      ...r,
      status: next,
      duration: next === "completed" ? r.duration : r.duration + (Math.random() * 6 || 0),
      dtmf: r.dtmf || (next === "answered" && Math.random() < 0.15 ? randomDTMF() : null),
    };
  });
}

function randomDTMF() {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "*", "#"];
  const len = 1 + Math.floor(Math.random() * 4);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += keys[Math.floor(Math.random() * keys.length)];
  }
  return out;
}

function classNames(...a: Array<string | false | undefined>) {
  return a.filter(Boolean).join(" ");
}

export default function CampaignStatusPage() {
  const rows = useMockCalls();
  const { loading } = usePageLoading(720);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string | "all">("all");
  const [dtmfOnly, setDtmfOnly] = useState(false);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (q && !(`${r.callee} ${r.caller} ${r.id}`.toLowerCase().includes(q.toLowerCase()))) return false;
      if (status !== "all" && r.status !== status) return false;
      if (dtmfOnly && !r.dtmf) return false;
      return true;
    });
  }, [rows, q, status, dtmfOnly]);

  const stats = useMemo(() => {
    const total = rows.length;
    const answered = rows.filter((r) => r.status === "answered" || (r.status === "completed" && r.duration > 0)).length;
    const dtmf = rows.filter((r) => !!r.dtmf).length;
    const spend = rows.reduce((s, r) => s + r.cost, 0);
    return { total, answered, dtmf, spend: +spend.toFixed(2) };
  }, [rows]);

  function exportCsv() {
    const header = ["id", "time", "caller", "callee", "status", "duration", "cost", "dtmf"].join(",");
    const body = filtered
      .map((r) =>
        [r.id, new Date(r.time).toISOString(), r.caller, r.callee, r.status, r.duration, r.cost, r.dtmf || ""].join(","),
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
    { key: "queued", label: "Queued" },
    { key: "ringing", label: "Ringing" },
    { key: "answered", label: "Answered" },
    { key: "voicemail", label: "Voicemail" },
    { key: "no-answer", label: "No Answer" },
    { key: "busy", label: "Busy" },
    { key: "failed", label: "Failed" },
    { key: "completed", label: "Completed" },
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
        <Stat title="Spend" value={`$${stats.spend.toLocaleString()}`} tone="amber" loading={loading} />
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
                          {new Date(r.time).toLocaleTimeString()}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-zinc-600 dark:text-zinc-300">{r.id}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-zinc-800 dark:text-zinc-100">{r.caller}</span>
                            <span className="text-zinc-400">→</span>
                            <span className="text-zinc-600 dark:text-zinc-200">{r.callee}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge value={r.status} />
                        </td>
                        <td className="px-5 py-4 tabular-nums text-zinc-600 dark:text-zinc-200">
                          {r.duration ? `${r.duration}s` : "—"}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-zinc-500 dark:text-zinc-300">{r.dtmf || ""}</td>
                        <td className="px-5 py-4 tabular-nums text-zinc-700 dark:text-zinc-100">
                          ${r.cost.toFixed(4)}
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
            Showing {loading ? "—" : filtered.length.toLocaleString()} of {rows.length.toLocaleString()} calls
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
    queued: { label: "Queued", cls: "bg-white text-zinc-600 ring-white/60 dark:bg-white/10 dark:text-zinc-200 dark:ring-white/10" },
    ringing: {
      label: "Ringing",
      cls: "bg-emerald-500/15 text-emerald-600 ring-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30",
    },
    answered: {
      label: "Answered",
      cls: "bg-sky-500/15 text-sky-600 ring-sky-400/40 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/30",
    },
    voicemail: {
      label: "Voicemail",
      cls: "bg-violet-500/15 text-violet-600 ring-violet-400/40 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-400/30",
    },
    "no-answer": {
      label: "No answer",
      cls: "bg-amber-500/15 text-amber-700 ring-amber-400/40 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/30",
    },
    busy: {
      label: "Busy",
      cls: "bg-orange-500/15 text-orange-600 ring-orange-400/40 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-400/30",
    },
    failed: {
      label: "Failed",
      cls: "bg-rose-500/15 text-rose-600 ring-rose-400/40 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/30",
    },
    completed: {
      label: "Completed",
      cls: "bg-teal-500/15 text-teal-600 ring-teal-400/40 dark:bg-teal-500/15 dark:text-teal-300 dark:ring-teal-400/30",
    },
  };
  const m = map[value] || map.queued;
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
