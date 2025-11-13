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
      <body className="min-h-screen bg-[#f4f2ed] font-sans text-zinc-900 antialiased transition-colors duration-300 dark:bg-[#05070c] dark:text-zinc-100">
        <Providers>
          <Layout>{children}</Layout>
        </Providers>
      </body>
    </html>
  )
}
