import { ReactNode } from 'react'
import clsx from 'clsx'

type PageFrameProps = {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  bleed?: boolean
}

export function PageFrame({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
  bleed,
}: PageFrameProps) {
  return (
    <div
      className={clsx(
        'relative mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8',
        bleed && 'max-w-none px-0 sm:px-0 lg:px-0',
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-[2.75rem] bg-white/70 px-6 py-10 shadow-[0_30px_70px_rgba(15,23,42,0.16)] ring-1 ring-white/60 backdrop-blur-2xl transition duration-500 dark:bg-white/10 dark:ring-white/10 sm:px-10 lg:px-14">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-12 h-64 w-64 rounded-full bg-emerald-400/20 blur-[100px] dark:bg-emerald-500/20" />
          <div className="absolute -bottom-40 right-0 h-72 w-72 rounded-full bg-sky-400/20 blur-[140px] dark:bg-sky-500/25" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.8),transparent_65%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_65%)]" />
        </div>
        <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            {eyebrow ? (
              <div className="inline-flex items-center rounded-full border border-white/60 bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:border-white/15 dark:bg-white/10 dark:text-zinc-300">
                {eyebrow}
              </div>
            ) : null}
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-3 text-base text-zinc-600 dark:text-zinc-300">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-3">{actions}</div>
          ) : null}
        </div>
      </div>
      <div className="relative z-10 mt-10 space-y-6">{children}</div>
    </div>
  )
}

type MotionCardProps = {
  children: ReactNode
  className?: string
  tone?: 'emerald' | 'violet' | 'amber' | 'sky' | 'neutral'
  delay?: number
}

const glowMap: Record<NonNullable<MotionCardProps['tone']>, string> = {
  emerald: 'from-emerald-500/20 via-emerald-400/10 to-transparent',
  violet: 'from-violet-500/15 via-violet-400/10 to-transparent',
  amber: 'from-amber-400/20 via-amber-300/10 to-transparent',
  sky: 'from-sky-400/20 via-sky-300/10 to-transparent',
  neutral: 'from-white/70 via-white/25 to-transparent dark:from-white/10 dark:via-white/5',
}

export function MotionCard({
  children,
  className,
  tone = 'neutral',
  delay = 0,
}: MotionCardProps) {
  return (
    <div
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
      className={clsx(
        'group relative overflow-hidden rounded-[2rem] border border-white/50 bg-white/70 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.15)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_30px_75px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-white/10 dark:shadow-[0_22px_50px_rgba(3,7,18,0.55)]',
        className,
      )}
    >
      <span
        className={clsx(
          'pointer-events-none absolute inset-0 translate-y-4 opacity-0 transition duration-500 group-hover:translate-y-0 group-hover:opacity-100',
          'bg-gradient-to-br',
          glowMap[tone],
        )}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

type ShimmerTileProps = {
  className?: string
}

export function ShimmerTile({ className }: ShimmerTileProps) {
  return (
    <div
      className={clsx(
        'lux-shimmer overflow-hidden rounded-2xl bg-white/50 dark:bg-white/10',
        className,
      )}
    />
  )
}

type ShimmerRowsProps = {
  rows?: number
  className?: string
}

export function ShimmerRows({ rows = 4, className }: ShimmerRowsProps) {
  return (
    <div className={clsx('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <ShimmerTile key={index} className="h-3 rounded-full" />
      ))}
    </div>
  )
}
