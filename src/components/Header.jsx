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
      className="group relative flex items-center gap-3 rounded-full pr-3"
    >
      <span className="grid h-11 w-11 place-items-center rounded-[1.25rem] overflow-hidden bg-gradient-to-br from-emerald-400 via-emerald-500 to-sky-500 shadow-[0_20px_36px_rgba(16,185,129,0.4)] transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_26px_48px_rgba(16,185,129,0.5)]">
        <img src="/images/aura.png" alt="AURA" className="h-full w-full object-cover" />
      </span>
      <span className="flex flex-col">
        <span className="text-xs font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">
          AURA
        </span>
        <span className="text-base font-semibold text-zinc-900 dark:text-white">
          Telecom
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
        'relative inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 text-zinc-800 shadow-sm ring-1 ring-zinc-900/10 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_34px_rgba(148,163,184,0.28)] dark:bg-white/10 dark:text-zinc-100 dark:ring-white/10',
        className,
      )}
    >
      <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white via-white to-transparent opacity-70 dark:hidden" />
      <span className="absolute inset-0 hidden rounded-2xl bg-gradient-to-br from-white/15 via-white/5 to-transparent opacity-80 dark:block" />
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
      <nav className="hidden items-center gap-1 rounded-full bg-white/50 p-1 shadow-inner ring-1 ring-zinc-900/10 backdrop-blur-md dark:bg-white/10 dark:ring-white/10 md:flex">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'relative inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200',
                active
                  ? 'text-zinc-900 dark:text-white'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white',
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                  className="absolute inset-0 rounded-full bg-white/90 shadow-lg ring-1 ring-zinc-900/10 dark:bg-white/10 dark:ring-white/10"
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
      <PopoverButton className="inline-flex items-center rounded-full bg-white/70 px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm ring-1 ring-zinc-900/10 backdrop-blur transition duration-200 hover:bg-white dark:bg-white/10 dark:text-zinc-100 dark:ring-white/10">
        Menu
      </PopoverButton>
      <PopoverBackdrop className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm duration-200 data-closed:opacity-0" />
      <PopoverPanel className="fixed inset-x-4 top-28 z-50 origin-top rounded-3xl bg-[#f8f6f1]/95 p-4 shadow-2xl ring-1 ring-zinc-900/10 transition duration-200 data-closed:-translate-y-3 data-closed:opacity-0 dark:bg-[#0b0d13]/95 dark:ring-white/10">
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
                    ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-900/10 dark:bg-white/10 dark:text-white dark:ring-white/10'
                    : 'bg-white/55 text-zinc-600 hover:bg-white dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10',
                )}
              >
                <span>{item.label}</span>
                {active && (
                  <span className="text-xs font-medium uppercase tracking-wide text-emerald-500">
                    Active
                  </span>
                )}
              </Link>
            )
          })}
          <Link
            href="/auth/login"
            className="mt-2 inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_32px_rgba(13,148,136,0.38)] transition hover:shadow-[0_24px_40px_rgba(13,148,136,0.46)]"
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
      <div className="absolute inset-x-0 top-0 z-[-1] h-32 bg-gradient-to-b from-[#f4f2ed] via-[#f4f2ed]/75 to-transparent dark:from-[#05070c] dark:via-[#05070c]/75" />
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between rounded-[2.75rem] bg-white/70 px-4 py-3 shadow-[0_24px_60px_rgba(15,23,42,0.14)] ring-1 ring-zinc-900/10 backdrop-blur-xl dark:bg-[#0c0f16]/80 dark:ring-white/10 md:px-6 md:py-4">
        <BrandMark />
          <DesktopNav pathname={pathname} isAdmin={isAdmin} />
        <div className="flex items-center gap-2 md:gap-3">
          <ThemeToggle />
          <Link
            href="/auth/login"
            className="hidden items-center rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(13,148,136,0.35)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_38px_rgba(13,148,136,0.45)] md:inline-flex"
          >
            Account
          </Link>
            <MobileNav pathname={pathname} isAdmin={isAdmin} />
        </div>
      </div>
    </header>
  )
}
