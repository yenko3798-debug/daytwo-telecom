"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { PageFrame, MotionCard, ShimmerTile, ShimmerRows } from "@/components/ui/LuxuryPrimitives";
import { usePageLoading } from "@/hooks/usePageLoading";
import { useLiveMetrics } from "@/hooks/useLiveMetrics";
import type { LiveMetrics } from "@/hooks/useLiveMetrics";

/* ---------------- minimal icons ---------------- */
const I = {
    Arrow: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>),
    Zap: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" /></svg>),
    Phone: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M22 16.92V21a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 12.8 19.79 19.79 0 010 4.18 2 2 0 012 2h4.09A2 2 0 018 3.72c.13.5.31 1 .54 1.47a2 2 0 01-.45 2.18L6 9a16 16 0 007 7l1.64-2.09a2 2 0 012.18-.45c.49.23.98.41 1.5.54A2 2 0 0121.92 16z" /></svg>),
    Chart: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><rect x="3" y="12" width="4" height="8" rx="1" /><rect x="10" y="8" width="4" height="12" rx="1" /><rect x="17" y="4" width="4" height="16" rx="1" /></svg>),
    Dollar: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M12 1v22" /><path d="M17 5.5a4.5 4.5 0 00-4.5-4.5H9a4 4 0 000 8h6a4 4 0 010 8H7.5A4.5 4.5 0 013 12.5" /></svg>),
    Play: (p) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M8 5v14l11-7-11-7z" /></svg>),
    Wand: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M15 4l5 5M2 22l8-8" /><path d="M18 2l4 4" /><path d="M3 10l1 1" /></svg>),
    Settings: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V22a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06A2 2 0 013.27 17.9l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H2a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06A2 2 0 013.27 3.27l.06.06a1.65 1.65 0 001.82.33 1.65 1.65 0 001-1.51V2a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06A2 2 0 0120.73 6.1l-.06.06a1.65 1.65 0 00-.33 1.82 1.65 1.65 0 001.51 1H22a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>),
};

/* ---------------- tiny sparkline ---------------- */
function Spark({ data = [3, 5, 4, 7, 6, 9, 8, 10], className = "w-full h-10", stroke = "currentColor" }) {
    const w = 200, h = 40; const max = Math.max(...data, 1); const min = Math.min(...data, 0);
    const scaleX = (i) => (i / (data.length - 1)) * w; const scaleY = (v) => h - ((v - min) / (max - min || 1)) * h;
    const d = data.map((v, i) => `${i ? "L" : "M"}${scaleX(i)},${scaleY(v)}`).join(" ");
    const last = data[data.length - 1];
    return (
        <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none">
            <path d={d} fill="none" stroke={stroke} strokeWidth="2" />
            <circle cx={scaleX(data.length - 1)} cy={scaleY(last)} r="3" fill={stroke} />
        </svg>
    );
}

/* ---------------- typewriter effect ---------------- */
function useTypewriter(words = ["campaigns", "top ups", "call flows", "analytics"], speed = 90, hold = 1200) {
    const [idx, setIdx] = useState(0); const [out, setOut] = useState(""); const [del, setDel] = useState(false);
    useEffect(() => {
        const w = words[idx % words.length];
        let t;
        if (!del) {
            if (out.length < w.length) { t = setTimeout(() => setOut(w.slice(0, out.length + 1)), speed); }
            else { t = setTimeout(() => setDel(true), hold); }
        } else {
            if (out.length > 0) { t = setTimeout(() => setOut(w.slice(0, out.length - 1)), 40); }
            else { setDel(false); setIdx(i => i + 1); }
        }
        return () => clearTimeout(t);
    }, [out, del, idx, words, speed, hold]);
    return out;
}

export default function StartPage() {
    const hello = useMemo(() => (typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get("u") || "Daytwo") : "Daytwo"), []);
    const word = useTypewriter();
    const { loading: introLoading } = usePageLoading(680);
    const { data: metrics, loading: metricsLoading } = useLiveMetrics({ scope: "me", intervalMs: 5000 });
    const loading = introLoading || metricsLoading;
    const feed = useMemo(() => metrics?.feed ?? [], [metrics]);
    const totalCalls = metrics?.calls.total ?? 0;
    const answered = metrics?.calls.answered ?? 0;
    const dtmfCount = metrics?.calls.dtmf ?? 0;
    const asr = Math.round((answered / Math.max(totalCalls, 1)) * 100);
    const conv = Math.round((dtmfCount / Math.max(totalCalls, 1)) * 100);
    const cps = metrics?.cps ?? 0;
    const spend = ((metrics?.calls.costCents ?? 0) / 100).toFixed(2);
    const sparkA = useMemo(() => buildSpark(feed, "duration"), [feed]);
    const sparkB = useMemo(() => buildSpark(feed, "dtmf"), [feed]);

    const headline = (
        <span className="inline-flex items-center rounded-md bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-600 ring-1 ring-emerald-500/30">
            {word || ""}
        </span>
    );

    const actions = (
        <div className="flex items-center gap-2">
            <Link href="/campaigns" className="rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(13,148,136,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_42px_rgba(13,148,136,0.45)]">
                New campaign
            </Link>
            <Link href="/topup" className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-[var(--lux-muted)] transition hover:-translate-y-0.5 hover:bg-white/10">
                Top up
            </Link>
        </div>
    );

    return (
        <PageFrame
            eyebrow="Dashboard"
            title={`Hello, ${hello}`}
            description={
                <span className="text-sm text-zinc-600 dark:text-zinc-300">
                    Let’s launch {headline}
                    <span className="ml-1 inline-block animate-pulse align-middle text-emerald-500">▌</span>
                </span>
            }
            actions={actions}
        >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <DashboardStat
                    title="Answered (ASR)"
                    value={`${answered.toLocaleString()} • ${asr}%`}
                    loading={loading}
                    tone="emerald"
                >
                    <Spark data={sparkA} className="h-8 w-full" />
                </DashboardStat>
                <DashboardStat
                    title="DTMF conversion"
                    value={`${dtmfCount.toLocaleString()} • ${conv}%`}
                    loading={loading}
                    tone="violet"
                >
                    <Spark data={sparkB} className="h-8 w-full" />
                </DashboardStat>
                <DashboardStat title="Current CPS" value={cps.toFixed(2)} loading={loading} />
                <DashboardStat title="Total spend" value={`$${spend}`} loading={loading} tone="amber" />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                <MotionCard tone="neutral" className="space-y-4 p-6 lg:col-span-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Quick actions</div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">Everything in one place</div>
                        </div>
                    </div>
                    {loading ? (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <ShimmerTile key={index} className="h-24 rounded-2xl" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <Action href="/campaigns" title="Run campaign" icon={<I.Play className="h-4 w-4" />}>
                                Upload leads and dispatch with CPS control
                            </Action>
                            <Action href="/flows" title="Flow builder" icon={<I.Wand className="h-4 w-4" />}>
                                Play/TTS → DTMF → Play/TTS → End
                            </Action>
                            <Action href="/topup" title="Top up" icon={<I.Dollar className="h-4 w-4" />}>
                                $275 per 1,000 calls
                            </Action>
                            <Action href="/status" title="Global status" icon={<I.Chart className="h-4 w-4" />}>
                                Public realtime overview
                            </Action>
                        </div>
                    )}
                    <MotionCard tone="neutral" className="p-5">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recent activity</div>
                            <Link href="/campaigns/status" className="text-xs font-semibold text-emerald-600 transition hover:text-emerald-500 dark:text-emerald-400">
                                Open feed
                            </Link>
                        </div>
                        <ActivityList items={feed.slice(0, 12)} loading={loading} />
                    </MotionCard>
                </MotionCard>

                <MotionCard tone="emerald" className="space-y-4 p-6 text-emerald-300">
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold tracking-wide text-emerald-100">System health</span>
                        <span className="text-[10px] uppercase tracking-[0.28em] text-emerald-300/70">
                            Live • {metrics ? new Date(metrics.timestamp).toLocaleTimeString() : "--"}
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                        <StatusPill label="Active campaigns" value={metrics?.campaigns.running ?? 0} />
                        <StatusPill label="Active calls" value={metrics?.activeCalls ?? 0} />
                        <StatusPill label="DTMF hits" value={dtmfCount} tone="amber" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-2xl bg-black/30 p-3 ring-1 ring-emerald-400/20">
                            <div className="text-[10px] text-emerald-300/70">ASR trend</div>
                            <Spark data={sparkA} className="h-10 w-full" />
                        </div>
                        <div className="rounded-2xl bg-black/30 p-3 ring-1 ring-emerald-400/20">
                            <div className="text-[10px] text-emerald-300/70">DTMF trend</div>
                            <Spark data={sparkB} className="h-10 w-full" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-300/70">
                        <div className="flex flex-col gap-1">
                            <span className="font-semibold text-emerald-200/90">Dialed vs connected</span>
                            <span>
                                {(metrics?.leads.dialed ?? 0).toLocaleString()} / {(metrics?.leads.connected ?? 0).toLocaleString()}
                            </span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="font-semibold text-emerald-200/90">CPS & spend</span>
                            <span>
                                {cps.toFixed(2)} cps • ${spend}
                            </span>
                        </div>
                    </div>
                </MotionCard>

                <MotionCard tone="neutral" className="space-y-3 p-6">
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Tips</div>
                    <TipsList loading={loading} />
                </MotionCard>
            </div>
        </PageFrame>
    );
}

function DashboardStat({
    title,
    value,
    children,
    tone = "neutral",
    loading,
}: {
    title: string;
    value: React.ReactNode;
    children?: React.ReactNode;
    tone?: "emerald" | "violet" | "amber" | "neutral";
    loading?: boolean;
}) {
    return (
        <MotionCard tone={tone} className="p-5 sm:p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                {title}
            </div>
            {loading ? (
                <div className="mt-3 space-y-3">
                    <ShimmerTile className="h-8 rounded-xl" />
                    {children ? <ShimmerTile className="h-6 rounded-xl" /> : null}
                </div>
            ) : (
                <>
                    <div className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">{value}</div>
                    {children}
                </>
            )}
        </MotionCard>
    );
}

function Action({ href, title, icon, children }) {
    return (
        <Link
            href={href}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 text-[var(--lux-foreground)] shadow-[0_18px_45px_rgba(0,0,0,0.4)] backdrop-blur-2xl transition hover:-translate-y-1 hover:border-white/20"
        >
            <span className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
            <div className="relative z-10 flex items-center gap-2 text-emerald-300">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/15 ring-1 ring-emerald-400/30">
                    {icon}
                </span>
                <span className="text-sm font-semibold">{title}</span>
            </div>
            <p className="relative z-10 mt-1 text-xs text-[var(--lux-muted)]">{children}</p>
            <div className="relative z-10 mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 opacity-0 transition group-hover:opacity-100">
                Open <I.Arrow className="h-3 w-3" />
            </div>
        </Link>
    );
}

function StatusPill({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "emerald" | "amber" }) {
    const palette =
        tone === "amber"
            ? "bg-amber-500/15 text-amber-200 ring-amber-400/30"
            : "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30";
    return (
        <div className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold ring-1 ${palette}`}>
            <span className="text-white/80">{label}</span>
            <span>{value}</span>
        </div>
    );
}

function ActivityList({ items, loading }: { items: LiveMetrics["feed"]; loading?: boolean }) {
    const rows = items?.slice(0, 10) ?? [];
    if (loading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                    <ShimmerTile key={index} className="h-10 rounded-xl" />
                ))}
            </div>
        );
    }
    if (!rows.length) {
        return <div className="text-sm text-zinc-500 dark:text-zinc-400">No live calls yet. Launch a campaign to populate this feed.</div>;
    }
    return (
        <div className="divide-y divide-white/10">
            <AnimatePresence initial={false}>
                {rows.map((r) => (
                    <motion.div
                        key={r.id}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="flex flex-col gap-1 py-2"
                    >
                        <div className="flex flex-wrap items-center gap-2 text-sm text-white">
                            <span className="font-medium text-white">{r.callerId ?? "Unknown"}</span>
                            <span className="text-[var(--lux-muted)]">→</span>
                            <span className="text-white/80">{r.dialedNumber ?? "—"}</span>
                            <StatusBadge value={r.status} />
                            {r.dtmf ? (
                                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] text-emerald-200">
                                    DTMF {r.dtmf}
                                </span>
                            ) : null}
                        </div>
                        <div className="flex justify-between text-xs text-[var(--lux-muted)]">
                            <span>{new Date(r.createdAt).toLocaleTimeString()} • {r.campaign.name}</span>
                            {r.lead?.rawLine ? <span className="truncate text-right" title={r.lead.rawLine}>{r.lead.rawLine}</span> : null}
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}

function TipsList({ loading }: { loading?: boolean }) {
    if (loading) {
        return <ShimmerRows rows={3} />;
    }
    return (
        <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
            <li>Validate DTMF before logging to avoid ghost tones.</li>
            <li>Warm up caller IDs; rotate every 250 calls.</li>
            <li>Scrub leads against DNC and honor opt-outs.</li>
        </ul>
    );
}

function StatusBadge({ value }: { value: string }) {
    const map: Record<string, { label: string; cls: string }> = {
        placing: { label: "Placing", cls: "bg-white text-zinc-600 ring-white/60 dark:bg-white/10 dark:text-zinc-200 dark:ring-white/10" },
        ringing: { label: "Ringing", cls: "bg-emerald-500/15 text-emerald-600 ring-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-300" },
        answered: { label: "Answered", cls: "bg-sky-500/15 text-sky-600 ring-sky-400/40 dark:text-sky-300" },
        completed: { label: "Completed", cls: "bg-teal-500/15 text-teal-600 ring-teal-400/40 dark:text-teal-300" },
        failed: { label: "Failed", cls: "bg-rose-500/15 text-rose-600 ring-rose-400/40 dark:text-rose-300" },
        hungup: { label: "Hung up", cls: "bg-orange-500/15 text-orange-600 ring-orange-400/40 dark:text-orange-300" },
        cancelled: { label: "Cancelled", cls: "bg-zinc-500/15 text-zinc-200 ring-zinc-400/30 dark:bg-zinc-500/15 dark:text-zinc-200" },
    };
    const badge = map[value] || map.placing;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${badge.cls}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {badge.label}
        </span>
    );
}

function buildSpark(feed: LiveMetrics["feed"] | undefined, mode: "duration" | "dtmf") {
    if (!feed || feed.length < 4) {
        return roll(32, mode === "duration" ? 12 : 7, 4);
    }
    const values = feed.slice(0, 32).map((item) => {
        if (mode === "duration") {
            return Math.max(1, item.durationSeconds || 1);
        }
        if (item.dtmf) {
            return Math.max(1, item.dtmf.length * 6);
        }
        return 1;
    });
    return values;
}

function roll(n = 24, base = 10, jitter = 4) {
    const a: number[] = [];
    let v = base;
    for (let i = 0; i < n; i++) {
        v = Math.max(1, v + (Math.random() * jitter * 2 - jitter));
        a.push(+v.toFixed(1));
    }
    return a;
}
