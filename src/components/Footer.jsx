export function Footer() {
  return (
    <footer className="relative z-10 px-4 pb-10 pt-16 sm:px-6 lg:px-10">
      <div className="mx-auto w-full max-w-6xl rounded-[2.5rem] border border-white/10 bg-white/5 px-6 py-6 text-sm text-[var(--lux-muted)] shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:px-10 sm:py-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[1.15rem] bg-gradient-to-br from-[#4EF0B0] via-[#41cda8] to-[#a587ff] text-sm font-semibold text-slate-950 shadow-[0_18px_38px_rgba(78,240,176,0.45)]">
              Y
            </span>
            <div>
              <p className="text-sm font-semibold text-white">Foe Telecom</p>
              <p className="text-xs text-[var(--lux-muted)]">Luxury automation for outbound voice</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium uppercase tracking-[0.28em]">
            <a href="mailto:studio@foe.dev" className="transition hover:text-white">
              Contact
            </a>
            <a href="/tos" className="transition hover:text-white">
              Terms
            </a>
            <a href="/privacy" className="transition hover:text-white">
              Privacy
            </a>
            <span className="text-[var(--lux-muted)]">
              © {new Date().getFullYear()} Foe
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
