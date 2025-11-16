export function Footer() {
  return (
    <footer className="relative z-10 px-4 pb-10 pt-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl overflow-hidden rounded-[2.75rem] bg-white/65 px-6 py-6 text-sm text-zinc-500 shadow-[0_18px_40px_rgba(15,23,42,0.08)] ring-1 ring-zinc-900/10 backdrop-blur-xl dark:bg-[#0c0f16]/75 dark:text-zinc-400 dark:ring-white/10 md:px-10 md:py-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[1.15rem] bg-gradient-to-br from-emerald-400 via-emerald-500 to-sky-500 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(16,185,129,0.35)]">
              Y
            </span>
            <div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                Foe Telecom
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Luxury automation for outbound voice
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
            <a href="mailto:studio@foe.dev" className="transition hover:text-emerald-500 dark:hover:text-emerald-400">
              Contact
            </a>
            <a href="/tos" className="transition hover:text-emerald-500 dark:hover:text-emerald-400">
              Terms
            </a>
            <a href="/privacy" className="transition hover:text-emerald-500 dark:hover:text-emerald-400">
              Privacy
            </a>
            <span className="text-zinc-300 dark:text-zinc-600">Copyright {new Date().getFullYear()} Foe</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
