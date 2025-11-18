"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PageFrame, MotionCard, ShimmerTile } from "@/components/ui/LuxuryPrimitives";
import { usePageLoading } from "@/hooks/usePageLoading";

const Icon = {
  Check: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  Arrow: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  ),
  Sparkle: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M12 3l2.5 5 5 2.5-5 2.5L12 18l-2.5-5-5-2.5 5-2.5L12 3z" />
    </svg>
  ),
};

const features = [
  "Press-1 IVR flows (Play/TTS → DTMF → Play/TTS → End)",
  "CPS throttling with presets",
  "Lead parser with E.164 normalization",
  "DTMF analytics & CSV exports",
  "Dark-mode, glass UI",
  "Webhook & recording ready",
];

const faqs = [
  {
    question: "How does the subscription model work?",
    answer: "Subscribe monthly or yearly to unlock discounted rates per 1,000 calls. Your subscription gives you access to better rates on a refillable balance that never expires.",
  },
  {
    question: "Can we mix different coins?",
    answer: "Yes. You can top up with any supported coin, swap in Top Up, or bridge balances between wallets.",
  },
  {
    question: "Do you handle compliance?",
    answer: "You control campaign compliance. We provide tools for scrubbing, rate limiting and audit exports.",
  },
];

type TierConfig = {
  title: string;
  price: string;
  unit: string;
  items: string[];
  highlight?: boolean;
  badge?: string;
  caption?: string;
  cta: React.ReactNode;
};

export default function PricingPage() {
  const [yearly, setYearly] = useState(false);
  const { loading } = usePageLoading(600);

  const caption = yearly ? "Save 2 months with yearly billing" : "Billed monthly";

  const tiers: TierConfig[] = [
    {
      title: "Lite",
      price: yearly ? "$5,000" : "$500",
      unit: yearly ? "/year" : "/month",
      caption: "$150 per 1,000 calls",
      cta: (
        <Link
          href="/topup"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(13,148,136,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_40px_rgba(13,148,136,0.45)]"
        >
          Get Lite <Icon.Arrow className="h-4 w-4" />
        </Link>
      ),
      items: features.slice(0, 4),
    },
    {
      title: "Premium",
      price: yearly ? "$20,000" : "$2,000",
      unit: yearly ? "/year" : "/month",
      highlight: true,
      badge: "Most popular",
      caption: "$100 per 1,000 calls",
      cta: (
        <Link
          href="/topup"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(13,148,136,0.4)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_48px_rgba(13,148,136,0.5)]"
        >
          Get Premium <Icon.Arrow className="h-4 w-4" />
        </Link>
      ),
      items: [...features, "Priority support", "Custom caller ID pools"],
    },
    {
      title: "Enterprise",
      price: yearly ? "$50,000" : "$5,000",
      unit: yearly ? "/year" : "/month",
      caption: "$80 per 1,000 calls",
      cta: (
        <Link
          href="/topup"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(13,148,136,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_40px_rgba(13,148,136,0.45)]"
        >
          Get Enterprise <Icon.Arrow className="h-4 w-4" />
        </Link>
      ),
      items: [...features, "Dedicated success engineer", "Multi-region delivery", "Custom billing", "Multi-account support"],
    },
  ];

  return (
    <PageFrame
      eyebrow="Pricing"
      title="Subscription plans with volume discounts"
      description="Subscribe to unlock better rates per 1,000 calls. Top up your refillable balance any time with any supported coin."
      actions={
        <div className="inline-flex items-center gap-3 rounded-full border border-white/60 bg-white/80 p-1 text-xs shadow-sm dark:border-white/10 dark:bg-white/5">
          <button
            onClick={() => setYearly(false)}
            className={`rounded-full px-3 py-1 font-semibold transition ${
              !yearly ? "bg-emerald-500 text-white shadow-sm" : "text-zinc-700 hover:bg-white/70 dark:text-zinc-200 dark:hover:bg-white/10"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setYearly(true)}
            className={`rounded-full px-3 py-1 font-semibold transition ${
              yearly ? "bg-emerald-500 text-white shadow-sm" : "text-zinc-700 hover:bg-white/70 dark:text-zinc-200 dark:hover:bg-white/10"
            }`}
          >
            Yearly
          </button>
        </div>
      }
    >
      <div className="text-center text-[11px] text-zinc-500 dark:text-zinc-400">{caption}</div>
      {loading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <ShimmerTile key={index} className="h-96 rounded-[2.5rem]" />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {tiers.map((tier) => (
            <Tier key={tier.title} {...tier} />
          ))}
        </div>
      )}

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <MotionCard tone="neutral" className="p-6">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Frequently asked</div>
          <FAQ />
        </MotionCard>
        <MotionCard tone="emerald" className="p-6 text-emerald-200">
          <div className="text-sm font-semibold text-emerald-100">Need a custom plan?</div>
          <p className="mt-2 text-sm text-emerald-200/80">
            We blend premium carriers with smart retries. Tell us your volume and compliance requirements and we will tailor a subscription and route for you.
          </p>
          <Link
            href="/status"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/30 transition hover:-translate-y-0.5 hover:bg-white/30"
          >
            View status <Icon.Arrow className="h-4 w-4" />
          </Link>
        </MotionCard>
      </div>
    </PageFrame>
  );
}

function Tier({ title, price, unit, items, highlight, badge, caption, cta }: TierConfig) {
  return (
    <MotionCard tone={highlight ? "emerald" : "neutral"} className="flex h-full flex-col p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-300">{unit}</div>
        </div>
        {badge ? (
          <span className="rounded-full bg-white/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-600 ring-1 ring-white/60 dark:bg-white/10 dark:text-emerald-300 dark:ring-white/10">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="mt-4 text-3xl font-semibold text-zinc-900 dark:text-white">{price}</div>
      {caption ? <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-300">{caption}</div> : null}
      <ul className="mt-4 flex-1 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
              <Icon.Check className="h-3 w-3" />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4">{cta}</div>
    </MotionCard>
  );
}

function FAQ() {
  return (
    <div className="space-y-4 text-left">
      {faqs.map((faq) => (
        <details key={faq.question} className="group rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm transition dark:border-white/10 dark:bg-white/5">
          <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-900 transition group-open:text-emerald-600 dark:text-zinc-100 dark:group-open:text-emerald-400">
            {faq.question}
          </summary>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{faq.answer}</p>
        </details>
      ))}
    </div>
  );
}
