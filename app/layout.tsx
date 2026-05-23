import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MakGuard AI — Malaysia Scam Shield',
  description: "Malaysia's AI-powered passive scam detection — browser extension and cyber defense tools",
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
