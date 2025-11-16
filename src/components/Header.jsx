'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  Popover,
  PopoverBackdrop,
  PopoverButton,
  PopoverPanel,
} from '@headlessui/react'
import { LayoutGroup, motion } from 'framer-motion'
import clsx from 'clsx'

const baseNavItems = [
  { href: '/start', label: 'Start' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/flows', label: 'Flows' },
  { href: '/topup', label: 'Top Up' },
  { href: '/status', label: 'Status' },
  { href: '/pricing', label: 'Pricing' },
]

function BrandMark() {
  return (
    <Link
      href="/"
      className="group relative flex items-center gap-3 rounded-2xl px-1 py-1 transition duration-300 hover:-translate-y-0.5"
    >
      <span className="grid h-11 w-11 place-items-center rounded-[1.35rem] border border-amber-400/60 bg-gradient-to-br from-amber-100 via-amber-200 to-rose-100 text-base font-semibold text-[#6b4524] shadow-[0_20px_36px_rgba(253,230,177,0.55)] dark:border-amber-200/50 dark:bg-gradient-to-br dark:from-amber-300/40 dark:via-amber-200/30 dark:to-rose-300/30 dark:text-amber-100">
        Y
      </span>
      <span className="flex flex-col">
        <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#a38869] dark:text-amber-200/80">
          Foe Studio
        </span>
        <span className="text-lg font-semibold text-[#1e2433] dark:text-white">
          Voice Platform
        </span>
      </span>
    </Link>
  )
}

function ThemeToggle({ className }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type='button'
      onClick={() => setTheme(nextTheme)}
      aria-label={mounted ? `Switch to ${nextTheme} theme` : 'Toggle theme'}
      className={clsx(
        'relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/60 bg-white/80 text-[#1f2533] shadow-[0_12px_24px_rgba(15,23,42,0.12)] transition duration-300 hover:-translate-y-0.5 hover:bg-white dark:border-white/15 dark:bg-white/5 dark:text-white dark:shadow-[0_12px_26px_rgba(0,0,0,0.55)]',
        className,
      )}
    >
      <span className="relative z-10 flex h-5 w-5 items-center justify-center">
        {mounted && resolvedTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </span>
    </button>
  )
}

function DesktopNav({ pathname, isAdmin }) {
  const items = isAdmin ? [...baseNavItems, { href: '/admin', label: 'Admin' }] : baseNavItems
  return (
    <LayoutGroup>
      <nav className="hidden items-center gap-1 rounded-full border border-white/60 bg-white/85 px-1 py-1 text-sm shadow-[0_16px_30px_rgba(15,23,42,0.08)] backdrop-blur md:flex dark:border-white/10 dark:bg-white/5 dark:shadow-[0_20px_36px_rgba(0,0,0,0.65)]">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
          return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'relative inline-flex items-center rounded-full px-4 py-2 font-medium transition-colors duration-200',
                  active
                    ? 'text-[#1f2533] dark:text-white'
                    : 'text-[#5a6478] hover:text-[#202637] dark:text-slate-300 dark:hover:text-white',
                )}
              >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                    className="absolute inset-0 rounded-full bg-white shadow-lg ring-1 ring-black/5 dark:bg-white/10 dark:ring-white/10"
                />
              )}
              <span className="relative z-10">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </LayoutGroup>
  )
}

function MobileNav({ pathname, isAdmin }) {
  const items = isAdmin ? [...baseNavItems, { href: '/admin', label: 'Admin' }] : baseNavItems
  return (
    <Popover className="md:hidden">
      <PopoverButton className="inline-flex items-center rounded-full border border-white/70 bg-white/80 px-3 py-2 text-sm font-semibold text-[#1f2533] shadow-sm backdrop-blur transition duration-200 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white">
        Menu
      </PopoverButton>
      <PopoverBackdrop className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm duration-200 data-closed:opacity-0" />
      <PopoverPanel className="fixed inset-x-4 top-28 z-50 origin-top rounded-3xl border border-white/70 bg-white/90 p-4 text-[#1f2533] shadow-2xl ring-1 ring-black/5 backdrop-blur-xl transition duration-200 data-closed:-translate-y-3 data-closed:opacity-0 dark:border-white/10 dark:bg-[#0b0f18]/95 dark:text-white dark:ring-white/10">
        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href))
            return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'flex items-center justify-between rounded-2xl px-4 py-3 text-base font-semibold transition',
                    active
                      ? 'bg-white shadow ring-1 ring-black/5 dark:bg-white/10 dark:ring-white/10'
                      : 'bg-white/60 text-[#5a6478] hover:bg-white dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10',
                  )}
                >
                <span>{item.label}</span>
                {active && (
                    <span className="text-xs font-medium uppercase tracking-wide text-amber-500">
                    Active
                  </span>
                )}
              </Link>
            )
          })}
          <Link
            href="/auth/login"
            className="mt-2 inline-flex items-center justify-center rounded-2xl bg-amber-400 px-4 py-3 text-sm font-semibold text-[#1f2533] shadow-[0_16px_30px_rgba(249,201,143,0.45)] transition hover:bg-amber-300"
          >
            Account
          </Link>
        </div>
      </PopoverPanel>
    </Popover>
  )
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M12 17a5 5 0 1 0-5-5 5 5 0 0 0 5 5Z" />
      <path d="M12 3v1.5M12 19.5V21M4.5 12H3M21 12h-1.5M5.636 5.636l1.06 1.06M17.304 17.304l1.06 1.06M17.304 6.696l1.06-1.06M5.636 18.364l1.06-1.06" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  )
}

export function Header() {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/me', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const role = data?.user?.role
        if (role === 'admin' || role === 'superadmin') setIsAdmin(true)
      } catch {
        setIsAdmin(false)
      }
    })()
  }, [])

  return (
    <header className="relative z-20 px-4 pt-6 sm:px-6 lg:px-8">
      <div className="absolute inset-x-0 top-0 z-[-1] h-28 bg-gradient-to-b from-transparent via-white/50 to-transparent dark:via-white/5" />
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between rounded-[2.75rem] border border-white/60 bg-white/85 px-4 py-3 text-[#1f2533] shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-3xl dark:border-white/10 dark:bg-[#0b1018]/85 dark:text-white dark:shadow-[0_20px_48px_rgba(0,0,0,0.65)] md:px-6 md:py-4">
        <BrandMark />
        <DesktopNav pathname={pathname} isAdmin={isAdmin} />
        <div className="flex items-center gap-2 md:gap-3">
          <ThemeToggle />
          <Link
            href="/auth/login"
            className="hidden items-center rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-[#1f2533] shadow-[0_14px_30px_rgba(249,201,143,0.45)] transition duration-300 hover:-translate-y-0.5 hover:bg-amber-300 md:inline-flex dark:bg-amber-300 dark:text-[#1b2130] dark:hover:bg-amber-200"
          >
            Account
          </Link>
          <MobileNav pathname={pathname} isAdmin={isAdmin} />
        </div>
      </div>
    </header>
  )
}
