import Link from 'next/link'
import { Shield, Puzzle, Zap, Eye, ChevronRight, Download } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 overflow-y-auto">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-48 -left-48 w-[500px] h-[500px] rounded-full bg-purple-900/10 blur-3xl" />
        <div className="absolute top-1/3 right-0 w-[600px] h-[600px] rounded-full bg-indigo-900/10 blur-3xl" />
        <div className="absolute -bottom-32 left-1/4 w-[400px] h-[400px] rounded-full bg-purple-900/5 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-neutral-800/50 bg-neutral-950/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
              <Shield className="w-4 h-4 text-purple-400" />
            </div>
            <span className="font-bold text-white tracking-tight">MakGuard</span>
          </div>
          <Link
            href="/dashboard"
            className="text-xs font-mono text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
          >
            Open Dashboard
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <section className="text-center mb-16 sm:mb-24">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-mono mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Passive protection for Malaysia
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-6 leading-tight">
            Stop scams before
            <br />
            <span className="text-purple-400">you click or transfer</span>
          </h1>
          <p className="text-neutral-400 text-lg sm:text-xl max-w-2xl mx-auto mb-8 leading-relaxed">
            MakGuard watches web pages and emails in the background, detects Malaysian financial
            scams with AI, and alerts you clearly — without blocking what you need to do.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/makguard-extension.zip"
              download="makguard-extension.zip"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Install Extension
            </a>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-neutral-700 hover:border-neutral-600 text-neutral-300 hover:text-white font-medium transition-colors"
            >
              Try Manual Scanner
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        <section className="grid sm:grid-cols-3 gap-6 mb-16 sm:mb-24">
          {[
            {
              icon: Puzzle,
              title: 'Install once',
              desc: 'Add the MakGuard extension to Chrome or Edge. Enable protection with a single toggle.',
            },
            {
              icon: Eye,
              title: 'Browse normally',
              desc: 'MakGuard watches every site and Gmail — scanning in the background only when suspicious patterns appear.',
            },
            {
              icon: Zap,
              title: 'Get alerted',
              desc: 'High-risk scams trigger a red urgent banner and badge — dismissible, never a blocking popup.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-neutral-800/50 bg-neutral-900/40 backdrop-blur-md p-6"
            >
              <div className="w-10 h-10 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center mb-4">
                <item.icon className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">{item.title}</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </section>

        <section id="install" className="rounded-2xl border border-neutral-800/50 bg-neutral-900/40 backdrop-blur-md p-6 sm:p-8 mb-12">
          <h2 className="text-2xl font-bold text-white mb-2">Install the extension</h2>
          <p className="text-neutral-400 mb-6">
            Download the extension zip below — no repo clone needed. After merging to main, the
            latest zip is rebuilt automatically on{' '}
            <a
              href="https://makguard.vercel.app"
              className="text-purple-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              makguard.vercel.app
            </a>
            .
          </p>
          <a
            href="/makguard-extension.zip"
            download="makguard-extension.zip"
            className="inline-flex items-center gap-2 mb-6 px-5 py-2.5 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Download makguard-extension.zip
          </a>
          <ol className="space-y-4 text-sm text-neutral-300">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600/30 text-purple-300 text-xs font-mono flex items-center justify-center">
                1
              </span>
              <span>
                Download and <strong className="text-white">unzip</strong> the file above.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600/30 text-purple-300 text-xs font-mono flex items-center justify-center">
                2
              </span>
              <span>
                Open{' '}
                <code className="text-purple-300 bg-neutral-800 px-1.5 py-0.5 rounded">
                  chrome://extensions
                </code>{' '}
                in Chrome or Edge and enable <strong className="text-white">Developer mode</strong>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600/30 text-purple-300 text-xs font-mono flex items-center justify-center">
                3
              </span>
              <span>
                Click <strong className="text-white">Load unpacked</strong> and select the{' '}
                <strong className="text-white">unzipped folder</strong> (must contain{' '}
                <code className="text-purple-300 bg-neutral-800 px-1.5 py-0.5 rounded">
                  manifest.json
                </code>
                ).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600/30 text-purple-300 text-xs font-mono flex items-center justify-center">
                4
              </span>
              <span>
                Click the MakGuard icon and ensure protection is{' '}
                <strong className="text-emerald-400">ON</strong>. Reload the extension after updates.
              </span>
            </li>
          </ol>
          <div className="mt-6 p-4 rounded-xl bg-neutral-950/60 border border-neutral-800/50">
            <p className="text-xs font-mono text-neutral-500 mb-1">Demo scam page</p>
            <a
              href="https://makguard.vercel.app/demo/scam.html"
              className="text-sm text-purple-400 hover:underline break-all"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://makguard.vercel.app/demo/scam.html
            </a>
            <p className="text-xs text-neutral-500 mt-2">
              Visit this page with the extension enabled to see a passive scam alert. Also try
              opening a mock phishing email in Gmail Web.
            </p>
          </div>
        </section>

        <section className="text-center pb-12">
          <p className="text-neutral-500 text-sm font-mono mb-4">
            Call Guard: join Meet or Teams in Chrome, click Start listening on the in-meeting panel.
            Also: manual scanner, transfer shield & community reporting
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 font-medium transition-colors"
          >
            Go to Cyber Defense Terminal
            <ChevronRight className="w-4 h-4" />
          </Link>
        </section>
      </main>
    </div>
  )
}
