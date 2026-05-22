import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MakGuard AI — Cyber Defense Terminal',
  description: "Malaysia's AI-powered scam detection & cyber defense hub",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${geist.className} bg-neutral-950 text-white antialiased`}>
        {children}
      </body>
    </html>
  )
}
