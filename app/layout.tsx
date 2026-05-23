import type { Metadata } from 'next'
import { JetBrains_Mono, Sora } from 'next/font/google'
import BottomNav from '@/components/BottomNav'
import './globals.css'

const sora = Sora({ subsets: ['latin'], variable: '--font-sora' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' })

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
      <body className={`${sora.variable} ${jetbrainsMono.variable} bg-slate-950 text-white font-sans`}>
        <div className="max-w-[420px] mx-auto min-h-screen flex flex-col relative">
          <main className="flex-1 pb-20">
            {children}
          </main>
          <BottomNav />
        </div>
      </body>
    </html>
  )
}