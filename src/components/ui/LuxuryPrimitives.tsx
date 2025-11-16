import { ReactNode } from 'react'
import { motion } from 'framer-motion'
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
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-[2.5rem] border border-white/60 bg-white/85 px-6 py-10 shadow-[0_30px_70px_rgba(15,23,42,0.14)] backdrop-blur-3xl dark:border-white/10 dark:bg-[#0b111a]/85 dark:shadow-[0_30px_70px_rgba(0,0,0,0.65)] sm:px-10 lg:px-14"
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-12 h-64 w-64 rounded-full bg-amber-200/60 blur-[120px] dark:bg-amber-500/20" />
          <div className="absolute -bottom-40 right-0 h-72 w-72 rounded-full bg-rose-200/50 blur-[150px] dark:bg-rose-500/20" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.8),transparent_65%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_65%)]" />
        </div>
        <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            {eyebrow ? (
              <div className="inline-flex items-center rounded-full border border-white/60 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#aa9076] dark:border-white/10 dark:bg-white/5 dark:text-amber-200/80">
                {eyebrow}
              </div>
            ) : null}
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#1d2331] dark:text-white sm:text-4xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-3 text-base text-[#5a6478] dark:text-slate-300">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-3">{actions}</div>
          ) : null}
        </div>
      </motion.div>
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
  emerald: 'from-emerald-400/25 via-emerald-200/10 to-transparent dark:from-emerald-400/20',
  violet: 'from-violet-400/20 via-violet-200/10 to-transparent dark:from-violet-500/20',
  amber: 'from-amber-400/30 via-amber-200/15 to-transparent dark:from-amber-400/25',
  sky: 'from-sky-400/25 via-sky-200/10 to-transparent dark:from-sky-400/20',
  neutral: 'from-white/80 via-white/30 to-transparent dark:from-white/15 dark:via-white/5',
}

export function MotionCard({
  children,
  className,
  tone = 'neutral',
  delay = 0,
}: MotionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: 'easeOut', delay }}
      whileHover={{ y: -8 }}
      className={clsx(
        'group relative overflow-hidden rounded-[2rem] border border-white/60 bg-white/85 p-6 text-[#1f2433] shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-2xl transition-all duration-300 hover:shadow-[0_30px_80px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-[#0d131f]/85 dark:text-white dark:shadow-[0_26px_70px_rgba(0,0,0,0.6)]',
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
    </motion.div>
  )
}

type ShimmerTileProps = {
  className?: string
}

export function ShimmerTile({ className }: ShimmerTileProps) {
  return (
    <div
      className={clsx(
        'lux-shimmer overflow-hidden rounded-2xl bg-white/80 dark:bg-white/5',
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
