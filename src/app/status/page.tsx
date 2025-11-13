"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Container } from "@/components/Container";

// --- inline icons (no external deps) ---
const Icon = {
  Dot: (p)=> (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><circle cx="12" cy="12" r="6"/></svg>),
  ArrowUp: (p)=> (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>),
  ArrowDown: (p)=> (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>),
  Download: (p)=> (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>),
  Refresh: (p)=> (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M20 11a8 8 0 10-3 6.3"/><path d="M20 4v6h-6"/></svg>),
};

// --- tiny sparkline ---
function Spark({data=[3,5,4,7,6,9,8,10], className="w-full h-10", stroke="currentColor"}){
  const w=200, h=40; const max = Math.max(...data, 1); const min = Math.min(...data, 0);
  const scaleX = (i)=> (i/(data.length-1))*w; const scaleY = (v)=> h - ((v-min)/(max-min||1))*h;
  const d = data.map((v,i)=> `${i?"L":"M"}${scaleX(i)},${scaleY(v)}`).join(" ");
  const last = data[data.length-1]; const prev = data[data.length-2] ?? last; const up = last>=prev;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none">
      <path d={d} fill="none" stroke={stroke} strokeWidth="2"/>
      <circle cx={scaleX(data.length-1)} cy={scaleY(last)} r="3" fill={stroke}/>
      <title>{up?"Trending up":"Trending down"}</title>
    </svg>
  );
}

// --- mock global feed (swap to your API/SSE) ---
function useGlobalMock(){
  const [t, setT] = useState(0);
  const [rows, setRows] = useState(()=> seed());
  useEffect(()=>{ const id = setInterval(()=>{ setRows(r=>tick(r)); setT(x=>x+1); }, 1600); return ()=>clearInterval(id); }, []);
  return [rows, t];
}

function seed(){
  const out = [];
  for(let i=0;i<64;i++){
    out.push(one());
  }
  return out;
}

function one(){
  const statuses = ["queued","ringing","answered","voicemail","no-answer","busy","failed","completed"];
  const callers = ["+12125550123","+13025550123","+17185550123"]; 
  const callee = "+1"+String(Math.floor(1e9 + Math.random()*9e9));
  const st = statuses[Math.floor(Math.random()*statuses.length)];
  const dtmf = Math.random()<0.22 ? randomDTMF() : null;
  return { id: `G-${Math.random().toString(36).slice(2,8)}`,
    time: Date.now()-Math.floor(Math.random()*1000*120),
    caller: callers[Math.floor(Math.random()*callers.length)],
    callee, status: st,
    duration: ["answered","voicemail","completed"].includes(st) ? Math.floor(Math.random()*180)+8 : 0,
    cost: +(Math.random()*0.09+0.01).toFixed(4),
    dtmf };
}

function tick(prev){
  // rotate + add a fresh row to simulate streaming
  const next = [...prev];
  next.shift();
  next.push(one());
  return next;
}

function randomDTMF(){
  const keys=["1","2","3","4","5","6","7","8","9","0","*","#"]; const len = 1+Math.floor(Math.random()*4);
  let s=""; for(let i=0;i<len;i++){ s += keys[Math.floor(Math.random()*keys.length)]; } return s;
}

function cn(...a){ return a.filter(Boolean).join(" "); }

export default function GlobalStatus(){
  const [rows, t] = useGlobalMock();
  const [range, setRange] = useState("24h"); // 24h | 7d | 30d
  const [dtmfOnly, setDtmfOnly] = useState(false);

  // aggregate (pretend these are global counters)
  const metrics = useMemo(()=>{
    const total = rows.length * 120; // pretend window
    const answered = Math.round(total * 0.41 + (t%17));
    const dtmf = Math.round(answered * 0.36 + (t%13));
    const asr = Math.round((answered/Math.max(total,1))*100);
    const conv = Math.round((dtmf/Math.max(total,1))*100);
    const spend = (total * 0.032).toFixed(2);
    const cps = Math.max(1, (t%30));
    const active = 3 + (t%4);
    return {total, answered, dtmf, asr, conv, spend, cps, active};
  }, [rows, t]);

  const display = useMemo(()=> rows.filter(r=> dtmfOnly? !!r.dtmf : true ), [rows, dtmfOnly]);

  // simple spark data
  const sparkA = useMemo(()=> roll(32, 12, 5), [t]);
  const sparkB = useMemo(()=> roll(32, 7, 3), [t]);

  function exportCsv(){
    const header = ["time","id","caller","callee","status","duration","cost","dtmf"].join(",");
    const body = display.map(r=> [new Date(r.time).toISOString(), r.id, r.caller, r.callee, r.status, r.duration, r.cost, r.dtmf||""]).join("\n");
    const blob = new Blob([header+"\n"+body], {type:"text/csv"});
    const url = URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="global-status.csv"; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[radial-gradient(1400px_600px_at_0%_-10%,rgba(16,185,129,0.18),transparent),radial-gradient(900px_500px_at_100%_110%,rgba(124,58,237,0.14),transparent)]">
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:60px_60px]"></div>

      <Container>
        <div className="mx-auto w-full max-w-7xl py-10">
          {/* header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Global status</h1>
              <p className="text-xs text-zinc-500">Public real‑time overview of calls, conversion and throughput.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-xs ring-1 ring-zinc-900/10 transition hover:bg-white dark:bg-zinc-900/60 dark:ring-white/10 dark:hover:bg-zinc-900"><Icon.Download className="h-4 w-4"/> Export CSV</button>
              <a href="/auth" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/90">Sign in</a>
            </div>
          </div>

          {/* metric cards */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric title="Total calls" value={n(metrics.total)} trend={+sparkA.at(-1) - +sparkA.at(-2)}>
              <Spark data={sparkA} className="h-8 w-full"/>
            </Metric>
            <Metric title="Answered (ASR)" value={`${n(metrics.answered)} • ${metrics.asr}%`} tone="emerald">
              <Spark data={sparkB} className="h-8 w-full"/>
            </Metric>
            <Metric title="DTMF captured" value={`${n(metrics.dtmf)} • ${metrics.conv}%`} tone="violet"/>
            <Metric title="Spend" value={`$${metrics.spend}`} tone="amber"/>
          </div>

          {/* switches & filters */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-xl bg-white/70 px-2 py-1 text-xs ring-1 ring-zinc-900/10 backdrop-blur dark:bg-zinc-900/60 dark:ring-white/10">
              <span className="text-zinc-500">Range</span>
              {(["24h","7d","30d"]).map((r)=> (
                <button key={r} onClick={()=>setRange(r)} className={cn("rounded-full px-2 py-0.5", range===r?"bg-emerald-500 text-white":"hover:bg-zinc-900/5 dark:hover:bg-white/10")}>{r}</button>
              ))}
            </div>
            <label className="ml-auto inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white/70 px-3 py-1.5 text-xs ring-1 ring-zinc-900/10 dark:bg-zinc-900/60 dark:ring-white/10">
              <input type="checkbox" checked={dtmfOnly} onChange={(e)=>setDtmfOnly(e.target.checked)} className="accent-emerald-500"/>
              DTMF only
            </label>
          </div>

          {/* live list */}
          <div className="overflow-hidden rounded-2xl ring-1 ring-zinc-900/10 dark:ring-white/10">
            <div className="max-h-[520px] overflow-auto">
              <table className="min-w-full divide-y divide-zinc-900/10 dark:divide-white/10">
                <thead className="bg-zinc-50/70 dark:bg-zinc-900/30">
                  <tr className="text-left text-xs text-zinc-500">
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Caller → Callee</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Dur</th>
                    <th className="px-4 py-3">DTMF</th>
                    <th className="px-4 py-3">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/5 dark:divide-white/5 text-sm">
                  <AnimatePresence initial={false}>
                    {display.map((r)=> (
                      <motion.tr key={r.id} layout initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="hover:bg-zinc-900/2.5 dark:hover:bg-white/5">
                        <td className="px-4 py-2 whitespace-nowrap text-zinc-500">{new Date(r.time).toLocaleTimeString()}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.caller}</span>
                            <span className="text-zinc-500">→</span>
                            <span className="text-zinc-700 dark:text-zinc-200">{r.callee}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2"><Badge value={r.status}/></td>
                        <td className="px-4 py-2 tabular-nums text-zinc-700 dark:text-zinc-200">{r.duration ? `${r.duration}s` : "—"}</td>
                        <td className="px-4 py-2 font-mono text-xs">{r.dtmf || ""}</td>
                        <td className="px-4 py-2 tabular-nums">${r.cost.toFixed(4)}</td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-3 text-xs text-zinc-500">Public feed • Showing {display.length} of {rows.length} events • Active campaigns: {metrics.active} • Current CPS: {metrics.cps}</p>
        </div>
      </Container>
    </div>
  );
}

function Metric({title, value, children, tone, trend}:{title:string, value:React.ReactNode, children?:React.ReactNode, tone?:"emerald"|"violet"|"amber", trend?:number}){
  const ring = tone === "emerald" ? "ring-emerald-400/30" : tone === "violet" ? "ring-violet-400/30" : tone === "amber" ? "ring-amber-400/30" : "ring-zinc-900/10";
  const up = (trend ?? 1) >= 0;
  return (
    <div className={`rounded-2xl bg-white/70 p-4 ring-1 backdrop-blur-sm dark:bg-zinc-900/60 ${ring}`}>
      <div className="text-xs text-zinc-500">{title}</div>
      <div className="mt-1 flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ring-1", up?"text-emerald-600 ring-emerald-500/30 bg-emerald-500/10":"text-rose-600 ring-rose-500/30 bg-rose-500/10")}>{up? <Icon.ArrowUp className="h-3 w-3"/> : <Icon.ArrowDown className="h-3 w-3"/>}{up?"up":"down"}</span>
      </div>
      {children}
    </div>
  );
}

function Badge({value}:{value:string}){
  const map = {
    queued: "bg-zinc-500/15 text-zinc-600 ring-zinc-500/30",
    ringing: "bg-sky-500/15 text-sky-600 ring-sky-500/30",
    answered: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30",
    voicemail: "bg-violet-500/15 text-violet-600 ring-violet-500/30",
    "no-answer": "bg-amber-500/15 text-amber-700 ring-amber-500/30",
    busy: "bg-orange-500/15 text-orange-600 ring-orange-500/30",
    failed: "bg-rose-500/15 text-rose-600 ring-rose-500/30",
    completed: "bg-teal-500/15 text-teal-600 ring-teal-500/30",
  };
  const cls = map[value] || map.queued;
  return <span className={"inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] ring-1 "+cls}><Icon.Dot className="h-1.5 w-1.5"/>{value}</span>
}

function n(x){
  return new Intl.NumberFormat().format(x);
}

function roll(n=24, base=10, jitter=4){
  const a=[]; let v=base; for(let i=0;i<n;i++){ v = Math.max(1, v + (Math.random()*jitter*2 - jitter)); a.push(+v.toFixed(1)); } return a;
}
