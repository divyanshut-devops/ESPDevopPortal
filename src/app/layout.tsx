import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { IBM_Plex_Sans, JetBrains_Mono } from 'next/font/google'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import '../index.css'
import { Providers } from './providers'

const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sans-face',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-mono-face',
})

export const metadata: Metadata = {
  title: 'ESP DevOps Portal',
  description: 'Manage projects, secrets, and APIs in one ESP workspace.',
  manifest: '/manifest.webmanifest',
  applicationName: 'ESP DevOps',
  appleWebApp: {
    capable: true,
    title: 'ESP DevOps',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b1220',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable}`}
      data-theme="dark"
      data-bs-theme="dark"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
