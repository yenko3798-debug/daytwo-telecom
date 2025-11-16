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
      className="group relative flex items-center gap-3 rounded-full pr-3 text-sm font-semibold text-[var(--lux-foreground)]"
    >
      <span className="grid h-11 w-11 place-items-center rounded-[1.25rem] bg-gradient-to-br from-[#4EF0B0] via-[#41cda8] to-[#a587ff] text-lg font-semibold text-slate-950 shadow-[0_25px_55px_rgba(78,240,176,0.5)] transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_35px_70px_rgba(78,240,176,0.55)]">
        Y
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-[0.4em] text-[var(--lux-muted)]">
          Yenko
        </span>
        <span className="text-base font-semibold text-white">
          Foe Telecom
        </span>
      </span>
    </Link>
  )
}

function ThemeToggle({ className }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      aria-label={mounted ? `Switch to ${nextTheme} theme` : 'Toggle theme'}
      className={clsx(
        'relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:-translate-y-0.5 hover:bg-white/10',
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
      <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 text-[var(--lux-muted)] backdrop-blur-xl md:flex">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'relative inline-flex items-center rounded-full px-4 py-2 text-sm transition-colors',
                active ? 'text-white' : 'text-[var(--lux-muted)] hover:text-white',
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                  className="absolute inset-0 rounded-full bg-white/10 shadow-lg ring-1 ring-white/10"
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
      <PopoverButton className="glass-pill inline-flex items-center rounded-full px-3 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-white/15">
        Menu
      </PopoverButton>
      <PopoverBackdrop className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm duration-200 data-closed:opacity-0" />
      <PopoverPanel className="fixed inset-x-4 top-28 z-50 origin-top rounded-3xl border border-white/10 bg-[var(--lux-surface)] p-4 text-sm text-white shadow-2xl transition duration-200 data-closed:-translate-y-3 data-closed:opacity-0">
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
                  'flex items-center justify-between rounded-2xl px-4 py-3 transition',
                  active
                    ? 'bg-white/10 text-white ring-1 ring-white/20'
                    : 'bg-white/5 text-[var(--lux-muted)] hover:text-white',
                )}
              >
                <span>{item.label}</span>
                {active && <span className="text-xs uppercase tracking-wide text-[#4EF0B0]">Live</span>}
              </Link>
            )
          })}
          <Link
            href="/auth/login"
            className="mt-2 inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#4EF0B0] via-[#46d9d1] to-[#a586ff] px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_32px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5"
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <path d="M12 17a5 5 0 1 0-5-5 5 5 0 0 0 5 5Z" />
      <path d="M12 3v1.5M12 19.5V21M4.5 12H3M21 12h-1.5M5.636 5.636l1.06 1.06M17.304 17.304l1.06 1.06M17.304 6.696l1.06-1.06M5.636 18.364l1.06-1.06" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
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
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center px-3 py-4 sm:px-6">
      <div className="pointer-events-auto glass-panel flex w-full max-w-6xl items-center justify-between rounded-[2.5rem] border-white/15 px-4 py-3 text-sm sm:px-8">
        <BrandMark />
        <DesktopNav pathname={pathname} isAdmin={isAdmin} />
        <div className="flex items-center gap-2 md:gap-3">
          <ThemeToggle className="hidden md:inline-flex" />
          <Link
            href="/auth/login"
            className="hidden items-center rounded-full bg-gradient-to-r from-[#4EF0B0] via-[#46d9d1] to-[#a586ff] px-4 py-2 text-xs font-semibold text-slate-950 shadow-[0_20px_40px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5 md:inline-flex"
          >
            Open dashboard
          </Link>
          <MobileNav pathname={pathname} isAdmin={isAdmin} />
        </div>
      </div>
    </header>
  )
}
