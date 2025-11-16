import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'

export function Layout({ children }) {
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-[#f4f2ed] text-zinc-900 transition-colors duration-300 dark:bg-[#05070c] dark:text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-[-18rem] hidden h-[38rem] w-[38rem] rounded-full bg-emerald-400/30 blur-[140px] sm:block dark:bg-emerald-500/25" />
        <div className="absolute right-[-14rem] top-[20%] h-[28rem] w-[28rem] rounded-full bg-cyan-400/20 blur-[120px] dark:bg-cyan-500/20" />
        <div className="absolute bottom-[-16rem] left-[-8rem] h-[32rem] w-[32rem] rounded-full bg-violet-400/25 blur-[150px] dark:bg-violet-500/25" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.55),transparent_65%)] dark:bg-[radial-gradient(circle_at_top,rgba(30,41,59,0.45),transparent_65%)]" />
        <div className="absolute inset-0 opacity-[0.05] [background:linear-gradient(120deg,rgba(15,23,42,0.75)_1px,transparent_1px),linear-gradient(300deg,rgba(15,23,42,0.55)_1px,transparent_1px)] [background-size:80px_80px] dark:opacity-[0.08]" />
      </div>
      <Header />
      <main className="relative z-10 flex-1 pt-24">{children}</main>
      <Footer />
    </div>
  )
}
