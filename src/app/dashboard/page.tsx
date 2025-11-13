"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { PageFrame, MotionCard, ShimmerTile, ShimmerRows } from "@/components/ui/LuxuryPrimitives";
import { usePageLoading } from "@/hooks/usePageLoading";

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
    }, [out, del, idx]);
    return out;
}

/* ---------------- mock stats (swap for API) ---------------- */
function useMockStats() {
    const [t, setT] = useState(0);
    useEffect(() => { const id = setInterval(() => setT(x => x + 1), 1200); return () => clearInterval(id); }, []);
    const asr = 41 + ((t * 3) % 7); // 41..47
    const conv = 31 + (t % 5);    // 31..35
    const cps = 8 + (t % 10);     // animated cps
    const spend = (1234.56 + t * 0.37).toFixed(2);
    return { asr, conv, cps, spend, t };
}

export default function StartPage() {
    const hello = useMemo(() => (typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get("u") || "Daytwo") : "Daytwo"), []);
    const word = useTypewriter();
    const { asr, conv, cps, spend, t } = useMockStats();
    const sparkA = useMemo(() => roll(32, 12, 5), [t]);
    const sparkB = useMemo(() => roll(32, 7, 3), [t]);
    const { loading } = usePageLoading(680);

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
            <Link href="/topup" className="rounded-full px-4 py-2 text-sm font-semibold text-zinc-700 ring-1 ring-white/50 transition hover:-translate-y-0.5 hover:bg-white dark:text-zinc-200 dark:ring-white/10 dark:hover:bg-white/10">
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
                <DashboardStat title="Answered (ASR)" value={`${asr}%`} loading={loading} tone="emerald">
                    <Spark data={sparkA} className="h-8 w-full" />
                </DashboardStat>
                <DashboardStat title="DTMF conversion" value={`${conv}%`} loading={loading} tone="violet">
                    <Spark data={sparkB} className="h-8 w-full" />
                </DashboardStat>
                <DashboardStat title="Current CPS" value={String(cps)} loading={loading} />
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
                        {loading ? (
                            <div className="space-y-2">
                                {Array.from({ length: 5 }).map((_, index) => (
                                    <ShimmerTile key={index} className="h-10 rounded-xl" />
                                ))}
                            </div>
                        ) : (
                            <ActivityList />
                        )}
                    </MotionCard>
                </MotionCard>

                <MotionCard tone="emerald" className="space-y-4 p-6 text-emerald-300">
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold tracking-wide text-emerald-100">System health</span>
                        <span className="text-[10px] uppercase tracking-[0.28em] text-emerald-300/70">Live</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                        <StatusPill label="Routes" value="Good" />
                        <StatusPill label="Latency" value="Low" />
                        <StatusPill label="Errors" value="0.4%" tone="amber" />
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
                        <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Healthy routes
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                            Minor retries
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
            className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/75 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur transition hover:-translate-y-1 hover:shadow-[0_24px_52px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_18px_35px_rgba(3,7,18,0.55)]"
        >
            <span className="absolute inset-0 bg-gradient-to-br from-emerald-200/20 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100 dark:from-emerald-500/20" />
            <div className="relative z-10 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/15 ring-1 ring-emerald-400/30">
                    {icon}
                </span>
                <span className="text-sm font-semibold">{title}</span>
            </div>
            <p className="relative z-10 mt-1 text-xs text-zinc-600 dark:text-zinc-300">{children}</p>
            <div className="relative z-10 mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 opacity-0 transition group-hover:opacity-100 dark:text-emerald-400">
                Open <I.Arrow className="h-3 w-3" />
            </div>
        </Link>
    );
}

function StatusPill({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" }) {
    const palette =
        tone === "amber"
            ? "bg-amber-500/15 text-amber-300 ring-amber-400/30"
            : "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30";
    return (
        <div className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold ring-1 ${palette}`}>
            <span className="text-emerald-200/80">{label}</span>
            <span>{value}</span>
        </div>
    );
}

function ActivityList() {
    const [rows, setRows] = useState(() => seed());
    useEffect(() => { const id = setInterval(() => setRows(r => [one(), ...r.slice(0, 9)]), 1800); return () => clearInterval(id); }, []);
    return (
        <div className="divide-y divide-zinc-900/10 dark:divide-white/10">
            <AnimatePresence initial={false}>
                {rows.map(r => (
                    <motion.div key={r.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex items-center justify-between gap-3 py-2">
                        <div className="text-sm"><span className="font-medium text-zinc-900 dark:text-zinc-100">{r.caller}</span> → <span className="text-zinc-700 dark:text-zinc-200">{r.callee}</span> <span className="text-zinc-500">• {r.status}</span></div>
                        <div className="text-xs text-zinc-500">{new Date(r.time).toLocaleTimeString()}</div>
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

/* ---- tiny feed helpers ---- */
function seed() { const a = []; for (let i = 0; i < 10; i++) a.push(one()); return a; }
function one() {
    const statuses = ["answered", "voicemail", "no-answer", "busy", "failed", "completed"]; const callers = ["+12125550123", "+13025550123", "+17185550123"]; const callee = "+1" + String(Math.floor(1e9 + Math.random() * 9e9));
    return { id: Math.random().toString(36).slice(2, 8), time: Date.now() - Math.floor(Math.random() * 1000 * 60), caller: callers[Math.floor(Math.random() * callers.length)], callee, status: statuses[Math.floor(Math.random() * statuses.length)] };
}

function roll(n = 24, base = 10, jitter = 4) { const a = []; let v = base; for (let i = 0; i < n; i++) { v = Math.max(1, v + (Math.random() * jitter * 2 - jitter)); a.push(+v.toFixed(1)); } return a; }
