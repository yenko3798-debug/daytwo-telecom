import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'

export function Layout({ children }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-transparent text-[var(--lux-foreground)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-[0.08] [background:radial-gradient(circle_at_top,rgba(255,255,255,0.65),transparent_70%)]" />
        <div className="absolute inset-0 opacity-[0.06] [background:linear-gradient(140deg,rgba(255,255,255,0.35)_1px,transparent_1px),linear-gradient(320deg,rgba(255,255,255,0.25)_1px,transparent_1px)] [background-size:90px_90px]" />
      </div>
      <Header />
      <main className="relative z-10 flex-1 px-4 pb-16 pt-24 sm:px-6 lg:px-10">{children}</main>
      <Footer />
    </div>
  )
}
