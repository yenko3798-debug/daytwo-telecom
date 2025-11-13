"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Container } from "@/components/Container";

const Icon = {
  Check: (p)=> (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M20 6L9 17l-5-5"/></svg>),
  Arrow: (p)=> (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>),
  Sparkle: (p)=> (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M12 3l2.5 5 5 2.5-5 2.5L12 18l-2.5-5-5-2.5 5-2.5L12 3z"/></svg>),
};

const features = [
  "Press‑1 IVR flows (Play/TTS → DTMF → Play/TTS → End)",
  "CPS throttling with presets",
  "Lead parser with E.164 normalization",
  "DTMF analytics & CSV exports",
  "Dark‑mode, glass UI",
  "Webhook & recording ready",
];

export default function PricingPage(){
  const [annual, setAnnual] = useState(true);

  const callsPrice = 275; // per 1000
  const discount = 0.15; // 15% annual credit bonus

  const unit = annual ? Math.round(callsPrice * (1 - discount)) : callsPrice;
  const caption = annual ? `Annual credit: ${(discount*100)|0}% bonus` : "Pay as you go";

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[radial-gradient(1400px_600px_at_0%_-10%,rgba(16,185,129,0.18),transparent),radial-gradient(900px_500px_at_100%_110%,rgba(124,58,237,0.14),transparent)]">
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:60px_60px]"></div>

      <Container>
        {/* header */}
        <div className="mx-auto max-w-4xl py-12 text-center">
          <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}>
            <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-1 text-xs font-semibold text-emerald-600 ring-1 ring-zinc-900/10 backdrop-blur dark:bg-zinc-900/60 dark:text-emerald-400 dark:ring-white/10">
              <Icon.Sparkle className="h-4 w-4"/> Transparent pricing
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">Simple pricing for serious calling</h1>
            <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-300">Only pay for what you send. Credit never expires. Switch coins at Top Up any time.</p>
          </motion.div>

          {/* toggle */}
          <div className="mt-6 inline-flex items-center gap-3 rounded-full bg-white/60 p-1 ring-1 ring-zinc-900/10 backdrop-blur dark:bg-zinc-900/60 dark:ring-white/10">
            <button onClick={()=>setAnnual(false)} className={`rounded-full px-3 py-1 text-xs ${!annual? 'bg-emerald-500 text-white' : 'text-zinc-700 hover:bg-zinc-900/5 dark:text-zinc-200 dark:hover:bg-white/10'}`}>Pay as you go</button>
            <button onClick={()=>setAnnual(true)} className={`rounded-full px-3 py-1 text-xs ${annual? 'bg-emerald-500 text-white' : 'text-zinc-700 hover:bg-zinc-900/5 dark:text-zinc-200 dark:hover:bg-white/10'}`}>Annual bonus</button>
          </div>
          <div className="mt-2 text-[11px] text-zinc-500">{caption}</div>
        </div>

        {/* tiers */}
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 pb-14 md:grid-cols-3">
          <Tier
            title="Starter"
            price={`$${unit}`}
            unit="/ 1,000 calls"
            highlight={false}
            cta={<>
              <Link href="/topup" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/90">Top up <Icon.Arrow className="h-4 w-4"/></Link>
              <Link href="/auth" className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm ring-1 ring-zinc-900/10 transition hover:bg-zinc-900/5 dark:ring-white/10 dark:hover:bg-white/10">Create account</Link>
            </>}
            items={features.slice(0,4)}
          />
          <Tier
            title="Pro"
            price={`$${unit*5}`}
            unit="/ 5,000 calls bundle"
            highlight
            badge={annual? `${(discount*100)|0}% bonus credit` : "Most popular"}
            caption="Priority routes • Auto‑retry • Webhooks"
            cta={<>
              <Link href="/topup" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/90">Get Pro <Icon.Arrow className="h-4 w-4"/></Link>
              <Link href="/auth" className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm ring-1 ring-zinc-900/10 transition hover:bg-zinc-900/5 dark:ring-white/10 dark:hover:bg-white/10">Sign in</Link>
            </>}
            items={[...features, "Priority support", "Custom caller ID pools"]}
          />
          <Tier
            title="Enterprise"
            price="Talk to us"
            unit="Custom routes & SLAs"
            highlight={false}
            caption="Dedicated infra • Compliance reviews • SSO/SAML"
            cta={<>
              <Link href="/auth" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900/90 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:bg-zinc-900">Contact sales <Icon.Arrow className="h-4 w-4"/></Link>
              <Link href="/terms" className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm ring-1 ring-zinc-900/10 transition hover:bg-zinc-900/5 dark:ring-white/10 dark:hover:bg-white/10">View terms</Link>
            </>}
            items={[...features, "SIP trunk integrations", "Dedicated support channel", "Signed BAA (HIPAA‑aware)"]}
          />
        </div>

        {/* comparison strip */}
        <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-white/70 p-5 ring-1 ring-zinc-900/10 backdrop-blur dark:bg-zinc-900/60 dark:ring-white/10">
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <Compare label="CPS limit" starter="10" pro="30" enterprise="Custom"/>
            <Compare label="DTMF analytics" starter="Yes" pro="Advanced" enterprise="Advanced"/>
            <Compare label="Retry logic" starter="—" pro="Yes" enterprise="Yes"/>
            <Compare label="Support" starter="Community" pro="Priority" enterprise="Dedicated"/>
          </div>
        </div>

        {/* FAQ */}
        <div className="mx-auto max-w-5xl py-12">
          <h3 className="text-center text-xl font-semibold text-zinc-900 dark:text-zinc-100">Pricing FAQ</h3>
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Faq q="How do top ups work?" a="You purchase call credits. We bill per connected route; unused credit rolls over and never expires."/>
            <Faq q="What counts as a call?" a="Each outbound attempt that reaches the carrier. Final bill reflects route, duration, and outcome."/>
            <Faq q="Do you support multiple coins?" a="Yes—switch assets in Top Up and your dashboard updates in real time."/>
            <Faq q="Refunds?" a="Credits are non‑refundable except where required by law. See Terms for details."/>
          </div>
        </div>
      </Container>

      {/* footer cta */}
      <div className="border-t border-white/10 bg-white/60 py-10 backdrop-blur dark:bg-zinc-900/60">
        <Container>
          <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
            <div>
              <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Ready to start?</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-300">Create your account or top up and launch your campaign in minutes.</div>
            </div>
            <div className="flex gap-2">
              <Link href="/auth" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/90">Create account <Icon.Arrow className="h-4 w-4"/></Link>
              <Link href="/topup" className="rounded-xl px-4 py-2 text-sm ring-1 ring-zinc-900/10 transition hover:bg-zinc-900/5 dark:ring-white/10 dark:hover:bg-white/10">Top up now</Link>
            </div>
          </div>
        </Container>
      </div>
    </div>
  );
}

function Tier({ title, price, unit, caption, items, cta, highlight=false, badge }){
  return (
    <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:.4}}
      className={`relative flex flex-col rounded-3xl bg-white/70 p-5 ring-1 ring-zinc-900/10 backdrop-blur dark:bg-zinc-900/60 dark:ring-white/10 ${highlight? 'shadow-xl ring-emerald-400/30' : ''}`}>
      {badge && <div className="absolute right-4 top-4 rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold text-emerald-600 ring-1 ring-emerald-500/30">{badge}</div>}
      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</div>
      <div className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">{price} <span className="align-middle text-xs font-medium text-zinc-500">{unit}</span></div>
      {caption && <div className="text-xs text-zinc-500">{caption}</div>}
      <ul className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
        {items.map((it,i)=> (
          <li key={i} className="flex items-start gap-2"><span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/15 ring-1 ring-emerald-400/30"><Icon.Check className="h-3.5 w-3.5 text-emerald-600"/></span>{it}</li>
        ))}
      </ul>
      <div className="mt-5 grid grid-cols-1 gap-2">{cta}</div>
    </motion.div>
  );
}

function Compare({label, starter, pro, enterprise}){
  return (
    <div className="rounded-2xl bg-zinc-50/70 p-4 ring-1 ring-zinc-900/10 dark:bg-zinc-900/50 dark:ring-white/10">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-md bg-white/70 px-2 py-1 text-center ring-1 ring-zinc-900/10 dark:bg-zinc-800/60 dark:ring-white/10">{starter}</div>
        <div className="rounded-md bg-white/70 px-2 py-1 text-center ring-1 ring-zinc-900/10 dark:bg-zinc-800/60 dark:ring-white/10">{pro}</div>
        <div className="rounded-md bg-white/70 px-2 py-1 text-center ring-1 ring-zinc-900/10 dark:bg-zinc-800/60 dark:ring-white/10">{enterprise}</div>
      </div>
    </div>
  );
}

function Faq({q,a}){
  const [open,setOpen] = useState(false);
  return (
    <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-zinc-900/10 backdrop-blur dark:bg-zinc-900/60 dark:ring-white/10">
      <button onClick={()=>setOpen(o=>!o)} className="flex w-full items-center justify-between text-left">
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{q}</span>
        <span className="text-xs text-zinc-500">{open? '−' : '+'}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.p initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{a}</motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
