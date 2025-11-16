import { Providers } from '@/app/providers'
import { Layout } from '@/components/Layout'

import '@/styles/tailwind.css'

export const metadata = {
  title: {
    template: '%s - @Foe',
    default:
      'Yenko | @Foe | @n2 - Software designer, Roblox systems developer',
  },
  description:
    'I’m Yenko, a software designer based in the USA.',
  alternates: {
    types: {
      'application/rss+xml': `${process.env.NEXT_PUBLIC_SITE_URL}/feed.xml`,
    },
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-screen bg-gradient-to-b from-[#f9f6f1] via-[#f2ece3] to-[#ebe3d8] font-sans text-[#1f2431] antialiased transition-colors duration-300 dark:from-[#040609] dark:via-[#060910] dark:to-[#0a111a] dark:text-slate-100">
        <Providers>
          <Layout>{children}</Layout>
        </Providers>
      </body>
    </html>
  )
}
