export function Footer() {
  return (
    <footer className="relative z-10 px-4 pb-10 pt-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl overflow-hidden rounded-[2.75rem] border border-white/60 bg-white/80 px-6 py-6 text-sm text-[#5a6478] shadow-[0_18px_46px_rgba(15,23,42,0.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#0b111a]/85 dark:text-slate-300 dark:shadow-[0_18px_46px_rgba(0,0,0,0.55)] md:px-10 md:py-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[1.2rem] border border-amber-400/60 bg-gradient-to-br from-amber-100 via-amber-200 to-rose-100 text-sm font-semibold text-[#6b4524] shadow-[0_16px_30px_rgba(253,230,177,0.55)] dark:border-amber-200/50 dark:bg-gradient-to-br dark:from-amber-300/40 dark:via-amber-200/30 dark:to-rose-300/30 dark:text-amber-100">
              Y
            </span>
            <div>
              <p className="text-sm font-semibold text-[#1e2433] dark:text-white">
                Foe Telecom
              </p>
              <p className="text-xs text-[#7b8294] dark:text-slate-400">
                Luxury automation for outbound voice
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium uppercase tracking-[0.2em] text-[#9a9fad] dark:text-slate-500">
            <a href="mailto:studio@foe.dev" className="transition hover:text-amber-500 dark:hover:text-amber-400">
              Contact
            </a>
            <a href="/tos" className="transition hover:text-amber-500 dark:hover:text-amber-400">
              Terms
            </a>
            <a href="/privacy" className="transition hover:text-amber-500 dark:hover:text-amber-400">
              Privacy
            </a>
            <span className="text-[#c4c8d3] dark:text-slate-600">
              Copyright {new Date().getFullYear()} Foe
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
