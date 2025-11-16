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
          'relative mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-10',
          bleed && 'max-w-none px-0 sm:px-0 lg:px-0',
          className,
        )}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="glass-panel relative overflow-hidden rounded-[2.75rem] border-white/15 px-6 py-10 text-[var(--lux-foreground)] sm:px-10 lg:px-14"
        >
          <div className="pointer-events-none absolute inset-0 opacity-[0.4]">
            <div className="absolute -top-32 left-12 h-64 w-64 rounded-full bg-[#4EF0B0]/25 blur-[120px]" />
            <div className="absolute -bottom-40 right-0 h-72 w-72 rounded-full bg-[#a586ff]/25 blur-[140px]" />
            <div className="absolute inset-0 opacity-[0.25] [background:linear-gradient(120deg,rgba(255,255,255,0.35)_1px,transparent_1px),linear-gradient(300deg,rgba(255,255,255,0.25)_1px,transparent_1px)] [background-size:80px_80px]" />
          </div>
          <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              {eyebrow ? (
                <div className="glass-pill inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--lux-muted)]">
                  {eyebrow}
                </div>
              ) : null}
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {title}
              </h1>
              {description ? (
                <p className="mt-3 text-base text-[var(--lux-muted)]">
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
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: 'easeOut', delay }}
      whileHover={{ y: -8 }}
      className={clsx(
        'group relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-white/5 p-6 text-[var(--lux-foreground)] shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl transition-all duration-300 hover:border-white/20',
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
