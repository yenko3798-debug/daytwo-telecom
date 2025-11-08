import Link from 'next/link'
import clsx from 'clsx'

const variantStyles = {
  primary:
    'bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400 font-semibold text-slate-950 hover:from-emerald-400 hover:via-emerald-300 hover:to-cyan-300 active:from-emerald-500 active:via-emerald-400 active:to-cyan-400 active:text-slate-900/80 dark:text-slate-950',
  secondary:
    'bg-slate-900/80 font-medium text-slate-100 hover:bg-slate-800 active:bg-slate-900 active:text-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:active:bg-slate-800 dark:active:text-slate-100/80',
}


export function Button({ variant = 'primary', className, ...props }) {
  className = clsx(
    'inline-flex items-center gap-2 justify-center rounded-md py-2 px-3 text-sm outline-offset-2 transition active:transition-none',
    variantStyles[variant],
    className,
  )

  return typeof props.href === 'undefined' ? (
    <button className={className} {...props} />
  ) : (
    <Link className={className} {...props} />
  )
}
