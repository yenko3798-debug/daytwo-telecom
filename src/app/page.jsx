"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Container } from "@/components/Container";

// inline icons
const Icon = {
  ArrowRight: (p)=> (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
  ),
  Sparkle: (p)=> (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M12 3l2.5 5 5 2.5-5 2.5L12 18l-2.5-5-5-2.5 5-2.5L12 3z"/></svg>
  ),
  Shield: (p)=> (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M12 2l7 4v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-4z"/></svg>
  ),
  Zap: (p)=> (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>
  ),
  Phone: (p)=> (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M22 16.92V21a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 12.8 19.79 19.79 0 010 4.18 2 2 0 012 2h4.09A2 2 0 018 3.72c.13.5.31 1 .54 1.47a2 2 0 01-.45 2.18L6 9a16 16 0 007 7l1.64-2.09a2 2 0 012.18-.45c.49.23.98.41 1.5.54A2 2 0 0121.92 16z"/></svg>
  ),
  Chart: (p)=> (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><rect x="3" y="12" width="4" height="8" rx="1"/><rect x="10" y="8" width="4" height="12" rx="1"/><rect x="17" y="4" width="4" height="16" rx="1"/></svg>
  ),
  Lock: (p)=> (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
  )
};

export default function LandingPage(){
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[radial-gradient(1400px_600px_at_0%_-10%,rgba(16,185,129,0.18),transparent),radial-gradient(900px_500px_at_100%_110%,rgba(124,58,237,0.14),transparent)]">
      {/* grid + orbs */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:60px_60px]"></div>
      <motion.div initial={{opacity:0,scale:.95}} animate={{opacity:.5,scale:1}} transition={{duration:1.2}} className="pointer-events-none absolute -left-24 -top-28 h-[32rem] w-[32rem] rounded-full bg-emerald-400/20 blur-3xl"/>
      <motion.div initial={{opacity:0,scale:.95}} animate={{opacity:.5,scale:1}} transition={{duration:1.2, delay:.1}} className="pointer-events-none absolute -right-24 bottom-[-12rem] h-[28rem] w-[28rem] rounded-full bg-violet-500/20 blur-3xl"/>

      {/* nav */}
      <header className="relative z-10">
        <Container>
          <div className="flex items-center justify-between py-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-500">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/15 ring-1 ring-emerald-400/30"><Icon.Phone className="h-3.5 w-3.5"/></span>
              AURA Telecom
            </div>
            <div className="flex items-center gap-2">
              <Link href="/auth" className="rounded-lg px-3 py-1.5 text-sm text-zinc-700 ring-1 ring-zinc-900/10 transition hover:bg-zinc-900/5 dark:text-zinc-200 dark:ring-white/10 dark:hover:bg-white/10">Sign in</Link>
              <Link href="/auth" className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white shadow ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/90">
                Get started <Icon.ArrowRight className="h-4 w-4"/>
              </Link>
            </div>
          </div>
        </Container>
      </header>

      {/* hero */}
      <Container>
        <section className="relative z-10 mx-auto max-w-7xl pb-20 pt-10 sm:pt-16">
          <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.6}} className="mx-auto max-w-3xl text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-1 text-xs font-semibold text-emerald-600 ring-1 ring-zinc-900/10 backdrop-blur dark:bg-zinc-900/60 dark:text-emerald-400 dark:ring-white/10">
              <Icon.Sparkle className="h-4 w-4"/> The best way to run telecom campaigns.
            </div>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-6xl">
              Run <span className="bg-gradient-to-r from-emerald-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent">telecom campaigns</span> at luxury‑grade speed
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-balance text-sm text-zinc-600 dark:text-zinc-300">
              Upload leads, throttle CPS, capture DTMF, preview flows, and track results in a single elegant dashboard.
              Top up securely and start calling in minutes.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/auth" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow ring-1 ring-emerald-500/30 transition hover:-translate-y-0.5 hover:bg-emerald-500/90">
                Launch dashboard <Icon.ArrowRight className="h-4 w-4"/>
              </Link>
              <Link href="/pricing" className="rounded-xl px-5 py-2 text-sm text-zinc-700 ring-1 ring-zinc-900/10 transition hover:bg-zinc-900/5 dark:text-zinc-200 dark:ring-white/10 dark:hover:bg-white/10">
                View pricing
              </Link>
            </div>
          </motion.div>

          {/* product mock */}
          <motion.div initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{delay:.1, duration:.6}}
            className="mt-12 overflow-hidden rounded-3xl border border-white/10 bg-white/70 shadow-2xl ring-1 ring-zinc-900/10 backdrop-blur dark:bg-zinc-900/60 dark:ring-white/10">
            <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
              <div className="p-6 sm:p-8">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">The all‑in‑one telecom studio</h3>
                <ul className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                  <li className="flex items-start gap-3"><span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/15 ring-1 ring-emerald-400/30"><Icon.Zap className="h-3.5 w-3.5 text-emerald-500"/></span> Campaign runner with CPS presets and de‑dup lead parser</li>
                  <li className="flex items-start gap-3"><span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md bg-violet-500/15 ring-1 ring-violet-400/30"><Icon.Chart className="h-3.5 w-3.5 text-violet-500"/></span> Live status board with DTMF filtering and CSV export</li>
                  <li className="flex items-start gap-3"><span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/15 ring-1 ring-emerald-400/30"><Icon.Phone className="h-3.5 w-3.5 text-emerald-500"/></span> Flow builder: Play/TTS → Gather DTMF → Play/TTS → End</li>
                  <li className="flex items-start gap-3"><span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md bg-zinc-900/10 ring-1 ring-white/20"><Icon.Lock className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-200"/></span> Gorgeous auth and seamless top‑ups</li>
                </ul>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/campaigns" className="rounded-xl bg-zinc-900/90 px-4 py-2 text-sm font-medium text-white shadow ring-1 ring-white/10 transition hover:-translate-y-0.5 dark:bg-white/10">
                    Open Campaigns
                  </Link>
                  <Link href="/flows" className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-900 ring-1 ring-zinc-900/10 transition hover:-translate-y-0.5 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-white/10">
                    Open Flow Builder
                  </Link>
                </div>
              </div>
              <div className="relative hidden min-h-[320px] items-center justify-center overflow-hidden md:flex">
                <div className="absolute inset-0 bg-[radial-gradient(500px_180px_at_60%_40%,rgba(16,185,129,0.2),transparent)]"/>
                <div className="absolute inset-0 bg-[radial-gradient(480px_240px_at_30%_80%,rgba(124,58,237,0.18),transparent)]"/>
                <div className="relative m-8 h-[280px] w-[480px] rounded-2xl border border-white/10 bg-zinc-900/80 shadow-2xl ring-1 ring-white/10">
                  <div className="flex h-9 items-center gap-1 border-b border-white/10 px-3 text-[11px] text-zinc-400">
                    <div className="flex gap-1.5 pr-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70"/>
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70"/>
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70"/>
                    </div>
                    <span>AURA Studio</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 p-3">
                    <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                      <div className="text-[11px] text-zinc-400">CPS</div>
                      <div className="mt-1 text-xl font-semibold text-white">12</div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800"><div className="h-full w-1/2 bg-emerald-400/80"/></div>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                      <div className="text-[11px] text-zinc-400">DTMF</div>
                      <div className="mt-1 text-xl font-semibold text-white">37%</div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800"><div className="h-full w-1/3 bg-violet-400/80"/></div>
                    </div>
                    <div className="col-span-2 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                      <div className="text-[11px] text-zinc-400">Live feed</div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-zinc-300">
                        <div className="rounded-md bg-zinc-800/70 px-2 py-1">+1212••• → +1929••• • answered</div>
                        <div className="rounded-md bg-zinc-800/70 px-2 py-1">+1718••• → +1510••• • voicemail</div>
                        <div className="rounded-md bg-zinc-800/70 px-2 py-1">+1302••• → +1786••• • ringing</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>
      </Container>

      {/* logos */}
      <section className="relative z-10 border-t border-white/10 bg-white/70 py-10 backdrop-blur dark:bg-zinc-900/50">
        <Container>
          <div className="grid grid-cols-2 items-center gap-6 opacity-70 sm:grid-cols-4">
            {['Security‑first','Carrier‑grade','HIPAA‑aware','SOC‑friendly'].map((t,i)=> (
              <div key={i} className="text-center text-xs font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">{t}</div>
            ))}
          </div>
        </Container>
      </section>

      {/* features grid */}
      <section className="relative z-10 py-16">
        <Container>
          <div className="mx-auto max-w-5xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Everything you need to launch</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-300">From top ups to IVR logic to live analytics, AURA gives you the full toolkit with enterprise‑grade UI and powerful features.</p>
          </div>
          <div className="mx-auto mt-8 grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {title:'Instant auth',desc:'Google/GitHub or email/password with 2FA‑ready flows.',icon:<Icon.Lock className="h-4 w-4"/>},
              {title:'Smart top ups',desc:'Crypto‑style UI for seamless payments and receipts.',icon:<Icon.Sparkle className="h-4 w-4"/>},
              {title:'Campaign runner',desc:'CPS presets, deduped leads, and smooth dispatch.',icon:<Icon.Zap className="h-4 w-4"/>},
              {title:'Flow builder',desc:'Play/TTS → Gather DTMF → Play/TTS → End.',icon:<Icon.Phone className="h-4 w-4"/>},
              {title:'Live analytics',desc:'ASR, conversion, spend; filter by DTMF.',icon:<Icon.Chart className="h-4 w-4"/>},
              {title:'Compliance‑minded',desc:'DNC hygiene, audit logs, webhooks.',icon:<Icon.Shield className="h-4 w-4"/>},
            ].map((f,i)=> (
              <div key={i} className="group rounded-2xl bg-white/70 p-4 ring-1 ring-zinc-900/10 backdrop-blur transition hover:-translate-y-0.5 hover:ring-emerald-400/30 dark:bg-zinc-900/60 dark:ring-white/10">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">{f.icon}<span className="text-sm font-semibold">{f.title}</span></div>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{f.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="relative z-10 pb-20">
        <Container>
          <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-500/20 via-violet-500/20 to-emerald-500/20 p-6 ring-1 ring-white/20 backdrop-blur">
            <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Ready to launch your next campaign?</h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Create an account and be inside the dashboard in under a minute.</p>
              </div>
              <div className="flex items-center gap-2 md:justify-end">
                <Link href="/auth" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow ring-1 ring-emerald-500/30 transition hover:-translate-y-0.5 hover:bg-emerald-500/90">
                  Sign up free <Icon.ArrowRight className="h-4 w-4"/>
                </Link>
                <Link href="/campaigns" className="rounded-xl px-4 py-2 text-sm text-zinc-700 ring-1 ring-zinc-900/10 transition hover:-translate-y-0.5 hover:bg-zinc-900/5 dark:text-zinc-200 dark:ring-white/10 dark:hover:bg-white/10">See live status</Link>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* footer */}
      <footer className="relative z-10 border-t border-white/10 py-8 text-center text-xs text-zinc-500">
        <Container>
          © {new Date().getFullYear()} AURA Telecom • <Link className="underline hover:text-zinc-700" href="/auth">Sign in</Link>
        </Container>
      </footer>
    </div>
  );
}
