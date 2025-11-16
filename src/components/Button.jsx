import Link from 'next/link'
import clsx from 'clsx'

const variantStyles = {
  primary:
    'bg-amber-400 font-semibold text-[#1f2533] shadow-[0_14px_30px_rgba(249,201,143,0.45)] hover:bg-amber-300 focus-visible:outline-amber-400 active:bg-amber-400/90 dark:bg-amber-300 dark:text-[#1b2130] dark:hover:bg-amber-200',
  secondary:
    'bg-white/80 font-medium text-[#1f2533] shadow-sm ring-1 ring-white/60 hover:bg-white focus-visible:outline-amber-200 dark:bg-white/5 dark:text-white dark:ring-white/15 dark:hover:bg-white/10',
}


export function Button({ variant = 'primary', className, ...props }) {
    className = clsx(
      'inline-flex items-center gap-2 justify-center rounded-xl px-4 py-2 text-sm outline-offset-2 transition active:transition-none',
      variantStyles[variant],
      className,
    )

  return typeof props.href === 'undefined' ? (
    <button className={className} {...props} />
  ) : (
    <Link className={className} {...props} />
  )
}
