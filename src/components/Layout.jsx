import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'

export function Layout({ children }) {
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden text-[#1e232f] transition-colors duration-300 dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-[-14rem] hidden h-[36rem] w-[36rem] rounded-full bg-amber-200/40 blur-[160px] sm:block dark:bg-amber-500/15" />
        <div className="absolute right-[-10rem] top-[25%] h-[30rem] w-[30rem] rounded-full bg-rose-200/35 blur-[150px] dark:bg-rose-500/10" />
        <div className="absolute bottom-[-18rem] left-[10%] h-[28rem] w-[28rem] rounded-full bg-blue-200/35 blur-[180px] dark:bg-sky-500/15" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.65),transparent_65%)] dark:bg-[radial-gradient(circle_at_top,rgba(28,34,46,0.75),transparent_65%)]" />
        <div className="absolute inset-0 opacity-[0.07] [background:linear-gradient(120deg,rgba(15,23,42,0.5)_1px,transparent_1px),linear-gradient(290deg,rgba(15,23,42,0.35)_1px,transparent_1px)] [background-size:90px_90px] dark:opacity-[0.08]" />
      </div>
      <Header />
      <main className="relative z-10 flex-1 py-16 sm:py-18 lg:py-20">{children}</main>
      <Footer />
    </div>
  )
}
