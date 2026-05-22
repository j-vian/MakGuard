import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import BottomNav from '@/components/BottomNav'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MakGuard AI',
  description: "Malaysia's AI-powered scam shield",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${geist.className} bg-slate-950 text-white`}>
        <div className="max-w-md mx-auto min-h-screen flex flex-col relative">
          <main className="flex-1 pb-20">
            {children}
          </main>
          <BottomNav />
        </div>
      </body>
    </html>
  )
}