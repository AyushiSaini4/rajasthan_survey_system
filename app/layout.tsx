import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'Rajasthan Infrastructure Survey',
  description:
    'Special Needs Infrastructure Survey System — 1,250 locations across Rajasthan, India.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'RJ Survey',
  },
}

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // Prevent zoom on form inputs on mobile
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const isDev = process.env.NODE_ENV === 'development'

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/*
          In development, proactively unregister any service worker left over from
          a previous build. The next-pwa SW caches CSS bundles; a stale cached
          bundle stops Tailwind utility classes from applying (new classes not in
          the old bundle). Unregistering forces the browser to re-fetch fresh
          assets on the next load. This has no effect in production.
        */}
        {isDev && (
          <script
            dangerouslySetInnerHTML={{
              __html: `if('serviceWorker'in navigator){navigator.serviceWorker.getRegistrations().then(function(r){r.forEach(function(sw){sw.unregister();});})}`,
            }}
          />
        )}
        {children}
      </body>
    </html>
  )
}
