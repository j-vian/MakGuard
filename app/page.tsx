'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Shield, Search, Cpu, Flag, Zap } from 'lucide-react'
import { ScanResult, ScamReport } from '@/lib/types'
import { supabase } from '@/lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

type ActiveTab = 'scanner' | 'shield' | 'report'
type ValueType = 'phone' | 'account' | 'url'
type ThreatType =
  | 'bank_impersonation'
  | 'investment_scam'
  | 'phishing'
  | 'government_impersonation'
  | 'other'

type ScannerMessage =
  | { id: string; ts: string; role: 'system'; content: string; level?: 'info' | 'success' | 'warning' }
  | { id: string; ts: string; role: 'user'; content: string }
  | { id: string; ts: string; role: 'assistant'; kind: 'scan'; result: ScanResult }
  | { id: string; ts: string; role: 'assistant'; kind: 'error'; content: string }

type ReportMessage =
  | { id: string; ts: string; role: 'system'; content: string; level?: 'info' | 'success' | 'warning' }
  | {
      id: string
      ts: string
      role: 'confirmation'
      value: string
      threatType: ThreatType
      valueType: ValueType
    }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const THREAT_LABELS: Record<ThreatType, string> = {
  bank_impersonation: 'Bank Impersonation',
  investment_scam: 'Investment Scam',
  phishing: 'Phishing',
  government_impersonation: 'Gov. Impersonation',
  other: 'Other',
}

function nowTs() {
  return new Date().toLocaleTimeString('en-MY', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function uid() {
  return Math.random().toString(36).slice(2)
}

function riskColor(score: number) {
  if (score <= 30) return 'text-emerald-400'
  if (score <= 60) return 'text-amber-400'
  if (score <= 85) return 'text-orange-400'
  return 'text-rose-500'
}

function riskBorder(score: number) {
  if (score <= 30) return 'border-emerald-500/30'
  if (score <= 60) return 'border-amber-500/30'
  if (score <= 85) return 'border-orange-500/30'
  return 'border-rose-500/50'
}

function riskBg(score: number) {
  if (score <= 30) return 'bg-emerald-950/25'
  if (score <= 60) return 'bg-amber-950/25'
  if (score <= 85) return 'bg-orange-950/25'
  return 'bg-rose-950/25'
}

function riskBar(score: number) {
  if (score <= 30) return 'bg-emerald-500'
  if (score <= 60) return 'bg-amber-500'
  if (score <= 85) return 'bg-orange-500'
  return 'bg-rose-500'
}

function formatThreatType(threatType: string) {
  return (
    THREAT_LABELS[threatType as ThreatType] ??
    threatType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  )
}

function formatSource(source: string) {
  if (source === 'pdrm_seed') return 'PDRM'
  if (source === 'nsrc_seed') return 'NSRC'
  if (source === 'community_report') return 'Community'
  return source.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

// ─── Chat UI components ────────────────────────────────────────────────────

function MakGuardPrefix() {
  return (
    <div className="w-6 h-6 rounded-md bg-purple-600/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
      <Shield className="w-3 h-3 text-purple-400" />
    </div>
  )
}

function ScanResultCard({ result }: { result: ScanResult }) {
  return (
    <div
      className={`rounded-xl border p-3 space-y-3 max-w-lg ${riskBorder(result.risk_score)} ${riskBg(result.risk_score)}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex flex-col items-center justify-center w-14 h-14 rounded-lg border flex-shrink-0 bg-neutral-900/80 ${riskBorder(result.risk_score)}`}
        >
          <span className={`text-xl font-black font-mono leading-none ${riskColor(result.risk_score)}`}>
            {result.risk_score}
          </span>
          <span className="text-neutral-600 text-[10px]">/100</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold uppercase tracking-widest ${riskColor(result.risk_score)}`}>
            Risk Score: {result.risk_score}%
          </p>
          <div className="mt-1.5 h-1 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${riskBar(result.risk_score)}`}
              style={{ width: `${result.risk_score}%` }}
            />
          </div>
        </div>
      </div>

      {result.threat_tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {result.threat_tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-950/60 text-rose-400 border border-rose-500/20"
            >
              {tag.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      <p className="text-sm text-neutral-300 leading-relaxed">{result.explanation}</p>
    </div>
  )
}

function ScannerMessageRow({ msg }: { msg: ScannerMessage }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] sm:max-w-[70%] rounded-2xl rounded-tr-sm bg-purple-600/20 border border-purple-500/25 px-4 py-2.5">
          <p className="text-sm text-neutral-100 whitespace-pre-wrap break-words">{msg.content}</p>
          <span className="text-[10px] text-neutral-600 font-mono mt-1 block text-right">{msg.ts}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2.5 items-start">
      <MakGuardPrefix />
      <div className="flex-1 min-w-0 space-y-2">
        {msg.role === 'system' && (
          <p
            className={`text-sm leading-relaxed ${
              msg.level === 'success'
                ? 'text-emerald-400'
                : msg.level === 'warning'
                ? 'text-amber-400'
                : 'text-cyan-400'
            }`}
          >
            {msg.content}
          </p>
        )}
        {msg.role === 'assistant' && msg.kind === 'error' && (
          <p className="text-sm text-amber-400">{msg.content}</p>
        )}
        {msg.role === 'assistant' && msg.kind === 'scan' && <ScanResultCard result={msg.result} />}
        <span className="text-[10px] text-neutral-600 font-mono">{msg.ts}</span>
      </div>
    </div>
  )
}

function ReportMessageRow({ msg }: { msg: ReportMessage }) {
  if (msg.role === 'confirmation') {
    return (
      <div className="flex gap-2.5 items-start">
        <MakGuardPrefix />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-emerald-400 leading-relaxed">
            ✓ Threat deployed to registry:{' '}
            <span className="font-mono text-neutral-200">{msg.value}</span>
            {' — '}
            {THREAT_LABELS[msg.threatType]}
          </p>
          <span className="text-[10px] text-neutral-600 font-mono">{msg.ts}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2.5 items-start">
      <MakGuardPrefix />
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm leading-relaxed ${
            msg.level === 'success'
              ? 'text-emerald-400'
              : msg.level === 'warning'
              ? 'text-amber-400'
              : 'text-cyan-400'
          }`}
        >
          {msg.content}
        </p>
        <span className="text-[10px] text-neutral-600 font-mono">{msg.ts}</span>
      </div>
    </div>
  )
}

// ─── Transfer Shield table ───────────────────────────────────────────────────

function TransferShieldPanel({
  rows,
  loading,
  fetchError,
}: {
  rows: ScamReport[]
  loading: boolean
  fetchError: string | null
}) {
  const [filterType, setFilterType] = useState<ValueType>('phone')
  const [search, setSearch] = useState('')

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (row.value_type !== filterType) return false
      if (q && !row.target_value.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, filterType, search])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-neutral-800/50">
        <div className="flex flex-wrap items-center gap-2">
          {(['phone', 'account', 'url'] as ValueType[]).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all border ${
                filterType === type
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                  : 'border-neutral-800 text-neutral-500 hover:text-neutral-300 hover:border-neutral-700'
              }`}
            >
              {type === 'phone' ? 'Phone Number' : type === 'account' ? 'Bank Account' : 'Website URL'}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-56 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500/50 font-mono transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-neutral-500 text-sm font-mono">
            Loading threat registry…
          </div>
        ) : fetchError ? (
          <div className="flex items-center justify-center h-32 text-amber-400 text-sm font-mono px-4 text-center">
            {fetchError}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-neutral-600 text-sm font-mono">
            No entries match the current filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-neutral-800/60 text-neutral-500 text-xs uppercase tracking-widest font-mono">
                  <th className="text-left px-4 py-3 font-semibold">Value</th>
                  <th className="text-left px-4 py-3 font-semibold">Threat Type</th>
                  <th className="text-right px-4 py-3 font-semibold">Reports</th>
                  <th className="text-left px-4 py-3 font-semibold">Source</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-neutral-800/30 hover:bg-neutral-800/20 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-neutral-200 whitespace-nowrap">
                      {row.target_value}
                    </td>
                    <td className="px-4 py-3 text-neutral-300 whitespace-nowrap">
                      {formatThreatType(row.threat_type)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-neutral-400">
                      {row.report_count}
                    </td>
                    <td className="px-4 py-3 text-neutral-300 whitespace-nowrap">
                      {formatSource(row.source)}
                      {row.is_verified && (
                        <span className="ml-1.5 text-emerald-400" title="Verified">
                          ✓
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-rose-400 font-semibold whitespace-nowrap">
                      🔴 FLAGGED
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && !fetchError && (
        <div className="px-4 py-2 border-t border-neutral-800/40 text-xs text-neutral-600 font-mono">
          {filteredRows.length} of {rows.filter((r) => r.value_type === filterType).length} entries
          {search.trim() ? ` matching "${search.trim()}"` : ''}
        </div>
      )}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('scanner')

  const [scannerMessages, setScannerMessages] = useState<ScannerMessage[]>([])
  const [reportMessages, setReportMessages] = useState<ReportMessage[]>([])
  const scannerEndRef = useRef<HTMLDivElement>(null)
  const reportEndRef = useRef<HTMLDivElement>(null)

  const [shieldRows, setShieldRows] = useState<ScamReport[]>([])
  const [shieldLoading, setShieldLoading] = useState(false)
  const [shieldFetchError, setShieldFetchError] = useState<string | null>(null)
  const shieldFetchedRef = useRef(false)

  const [scanMsg, setScanMsg] = useState('')
  const [scanLoading, setScanLoading] = useState(false)

  const [repVal, setRepVal] = useState('')
  const [repValType, setRepValType] = useState<ValueType>('phone')
  const [repThreat, setRepThreat] = useState<ThreatType>('bank_impersonation')
  const [repNotes, setRepNotes] = useState('')
  const [repLoading, setRepLoading] = useState(false)

  const activeMessages = activeTab === 'scanner' ? scannerMessages : reportMessages
  const activeEndRef = activeTab === 'scanner' ? scannerEndRef : reportEndRef

  useEffect(() => {
    setScannerMessages([
      {
        id: uid(),
        ts: nowTs(),
        role: 'system',
        content: 'AI Threat Scanner ready — paste suspicious SMS, WhatsApp, or email content for analysis.',
        level: 'success',
      },
      {
        id: uid(),
        ts: nowTs(),
        role: 'system',
        content: 'Gemini AI Engine online · Powered by Gemini 2.5 Flash',
        level: 'info',
      },
    ])
    setReportMessages([
      {
        id: uid(),
        ts: nowTs(),
        role: 'system',
        content: 'Community Report module active — submit threats to the global registry.',
        level: 'success',
      },
      {
        id: uid(),
        ts: nowTs(),
        role: 'system',
        content: 'All submissions are reviewed and merged into the Supabase threat registry.',
        level: 'info',
      },
    ])
  }, [])

  useEffect(() => {
    if (activeTab !== 'shield' || shieldFetchedRef.current) return

    const fetchRows = async () => {
      setShieldLoading(true)
      setShieldFetchError(null)
      const { data, error } = await supabase
        .from('scam_reports')
        .select('*')
        .order('report_count', { ascending: false })

      if (error) {
        setShieldFetchError(`Registry load failed: ${error.message}`)
        setShieldRows([])
      } else {
        setShieldRows((data as ScamReport[]) ?? [])
      }
      setShieldLoading(false)
      shieldFetchedRef.current = true
    }

    fetchRows()
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'shield') return
    activeEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages, activeTab, activeEndRef])

  const handleScan = async () => {
    if (!scanMsg.trim() || scanLoading) return
    const input = scanMsg.trim()
    setScanLoading(true)
    setScannerMessages((prev) => [
      ...prev,
      { id: uid(), ts: nowTs(), role: 'user', content: input },
    ])
    setScanMsg('')

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      })
      const data = await res.json()
      if (!res.ok) {
        setScannerMessages((prev) => [
          ...prev,
          {
            id: uid(),
            ts: nowTs(),
            role: 'assistant',
            kind: 'error',
            content: data.error ?? 'Scan failed',
          },
        ])
      } else {
        setScannerMessages((prev) => [
          ...prev,
          { id: uid(), ts: nowTs(), role: 'assistant', kind: 'scan', result: data as ScanResult },
        ])
      }
    } catch {
      setScannerMessages((prev) => [
        ...prev,
        {
          id: uid(),
          ts: nowTs(),
          role: 'assistant',
          kind: 'error',
          content: 'Connection error — scan could not complete',
        },
      ])
    } finally {
      setScanLoading(false)
    }
  }

  const handleReport = async () => {
    if (!repVal.trim() || repLoading) return
    const value = repVal.trim()
    const valueType = repValType
    const threatType = repThreat
    setRepLoading(true)

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_value: value,
          value_type: valueType,
          threat_type: threatType,
          reporter_notes: repNotes,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setReportMessages((prev) => [
          ...prev,
          {
            id: uid(),
            ts: nowTs(),
            role: 'system',
            content: `Error: ${data.error ?? 'Report failed'}`,
            level: 'warning',
          },
        ])
      } else {
        setReportMessages((prev) => [
          ...prev,
          {
            id: uid(),
            ts: nowTs(),
            role: 'confirmation',
            value,
            threatType,
            valueType,
          },
        ])
        setRepVal('')
        setRepNotes('')
        shieldFetchedRef.current = false
      }
    } catch {
      setReportMessages((prev) => [
        ...prev,
        {
          id: uid(),
          ts: nowTs(),
          role: 'system',
          content: 'Connection error — report could not be submitted',
          level: 'warning',
        },
      ])
    } finally {
      setRepLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-48 -left-48 w-[500px] h-[500px] rounded-full bg-purple-900/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-purple-900/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full bg-indigo-900/10 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-neutral-800/50 bg-neutral-950/80 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-purple-400" />
            </div>
            <span className="font-bold text-white tracking-tight text-base">MakGuard</span>
            <span className="hidden sm:block h-4 w-px bg-neutral-800" />
            <span className="hidden sm:block text-neutral-600 text-xs font-mono truncate">
              AI Cyber Defense Terminal
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-5 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 font-mono">SYSTEM ONLINE</span>
            </div>
            <div className="hidden md:flex items-center gap-1.5 text-neutral-500">
              <Cpu className="w-3.5 h-3.5" />
              <span className="text-xs font-mono">Gemini 1.5 Pro</span>
            </div>
            <div className="hidden sm:block h-4 w-px bg-neutral-800" />
            <span className="text-xs text-neutral-600 font-mono">
              {new Date().toLocaleDateString('en-MY', { dateStyle: 'medium' })}
            </span>
          </div>
        </div>
      </header>

      <main
        className="relative z-10 max-w-[1400px] mx-auto p-4 sm:p-6 flex flex-col"
        style={{ height: 'calc(100vh - 56px)' }}
      >
        <div className="flex-1 flex flex-col min-w-0 min-h-0 rounded-2xl border border-neutral-800/50 bg-neutral-900/40 backdrop-blur-md overflow-hidden">
          <div className="flex items-center gap-0.5 px-2 sm:px-4 pt-3 border-b border-neutral-800/50 overflow-x-auto">
            {(
              [
                { id: 'scanner' as const, label: '🤖 AI Threat Scanner' },
                { id: 'shield' as const, label: '🛡️ Transfer Shield' },
                { id: 'report' as const, label: '📢 Community Report' },
              ]
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium rounded-t-lg transition-all border-b-2 -mb-px whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'text-purple-300 border-purple-500 bg-purple-500/5'
                    : 'text-neutral-500 border-transparent hover:text-neutral-300 hover:bg-neutral-800/30'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'shield' ? (
            <TransferShieldPanel
              rows={shieldRows}
              loading={shieldLoading}
              fetchError={shieldFetchError}
            />
          ) : (
            <>
              <div className="flex-1 overflow-y-auto min-h-0 flex flex-col justify-end p-4">
                <div className="space-y-4">
                  {activeTab === 'scanner' &&
                    scannerMessages.map((msg) => (
                      <ScannerMessageRow key={msg.id} msg={msg} />
                    ))}
                  {activeTab === 'report' &&
                    reportMessages.map((msg) => (
                      <ReportMessageRow key={msg.id} msg={msg} />
                    ))}
                  <div ref={activeTab === 'scanner' ? scannerEndRef : reportEndRef} />
                </div>
              </div>

              <div className="border-t border-neutral-800/50 p-4 bg-neutral-900/50 backdrop-blur-sm flex-shrink-0">
                {activeTab === 'scanner' && (
                  <div className="space-y-3">
                    <textarea
                      value={scanMsg}
                      onChange={(e) => setScanMsg(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleScan()
                      }}
                      placeholder="Paste suspicious SMS, WhatsApp, or email content here for AI threat analysis… (Ctrl+Enter to run)"
                      className="w-full h-[88px] bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-purple-500/50 resize-none font-mono transition-colors"
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-xs text-neutral-600 font-mono">
                        Ctrl+Enter to submit · Powered by Gemini AI
                      </span>
                      <button
                        onClick={handleScan}
                        disabled={!scanMsg.trim() || scanLoading}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all"
                      >
                        {scanLoading ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Analyzing…
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4" />
                            Run Threat Analysis
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'report' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <p className="text-xs text-neutral-600 uppercase tracking-widest font-mono">
                          Target Type
                        </p>
                        <div className="flex gap-1.5">
                          {(['phone', 'account', 'url'] as ValueType[]).map((type) => (
                            <button
                              key={type}
                              onClick={() => setRepValType(type)}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all border ${
                                repValType === type
                                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                  : 'border-neutral-800 text-neutral-500 hover:text-neutral-300'
                              }`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-xs text-neutral-600 uppercase tracking-widest font-mono">
                          Target Value
                        </p>
                        <input
                          value={repVal}
                          onChange={(e) => setRepVal(e.target.value)}
                          placeholder={
                            repValType === 'phone'
                              ? 'e.g. 0111234567'
                              : repValType === 'account'
                              ? 'e.g. 1120045678'
                              : 'e.g. fake-maybank.com'
                          }
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-rose-500/50 font-mono transition-colors"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs text-neutral-600 uppercase tracking-widest font-mono">
                        Scam Classification
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            ['bank_impersonation', 'Bank Impersonation'],
                            ['investment_scam', 'Investment Scam'],
                            ['phishing', 'Phishing'],
                            ['government_impersonation', 'Gov. Impersonation'],
                            ['other', 'Other'],
                          ] as [ThreatType, string][]
                        ).map(([type, label]) => (
                          <button
                            key={type}
                            onClick={() => setRepThreat(type)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all border ${
                              repThreat === type
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                : 'border-neutral-800 text-neutral-500 hover:text-neutral-300'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <textarea
                        value={repNotes}
                        onChange={(e) => setRepNotes(e.target.value)}
                        placeholder="Additional notes (optional)…"
                        rows={2}
                        className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-rose-500/50 transition-colors resize-none"
                      />
                      <button
                        onClick={handleReport}
                        disabled={!repVal.trim() || repLoading}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-700/80 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all whitespace-nowrap sm:self-end"
                      >
                        {repLoading ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Deploying…
                          </>
                        ) : (
                          <>
                            <Flag className="w-4 h-4" />
                            Deploy to Threat Registry
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
