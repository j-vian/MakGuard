'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Shield, Search, AlertTriangle, Activity,
  Terminal, Cpu, Globe, Lock,
  CheckCircle, XCircle, Flag, Zap, Database, Wifi,
  Radio, BarChart3,
} from 'lucide-react'
import { ScanResult, ShieldResult } from '@/lib/types'

// ─── Types ───────────────────────────────────────────────────────────────────

type ActiveTab = 'scanner' | 'shield' | 'report'
type ValueType = 'phone' | 'account' | 'url'
type ThreatType =
  | 'bank_impersonation'
  | 'investment_scam'
  | 'phishing'
  | 'government_impersonation'
  | 'other'

type LogEntry =
  | { id: string; ts: string; kind: 'scan'; result: ScanResult; input: string }
  | { id: string; ts: string; kind: 'shield'; result: ShieldResult; query: string; queryType: ValueType }
  | { id: string; ts: string; kind: 'report'; value: string; threatType: ThreatType; valueType: ValueType }
  | { id: string; ts: string; kind: 'system'; message: string; level: 'info' | 'success' | 'warning' }

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

function riskLabel(score: number) {
  if (score <= 30) return 'SECURE — NO THREAT DETECTED'
  if (score <= 60) return 'SUSPICIOUS — MODERATE RISK'
  if (score <= 85) return 'HIGH RISK — LIKELY SCAM'
  return 'CRITICAL THREAT DETECTED'
}

function riskIndex(score: number) {
  if (score <= 30) return 'LOW RISK INDEX'
  if (score <= 60) return 'MODERATE THREAT INDEX'
  if (score <= 85) return 'HIGH THREAT INDEX'
  return 'CRITICAL THREAT INDEX'
}

// ─── Log Entry Cards ──────────────────────────────────────────────────────────

function ScanCard({ entry }: { entry: Extract<LogEntry, { kind: 'scan' }> }) {
  const { result, input, ts } = entry
  return (
    <div className={`rounded-xl border p-4 space-y-4 ${riskBorder(result.risk_score)} ${riskBg(result.risk_score)}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-neutral-500" />
          <span className="text-xs font-mono text-neutral-500 uppercase tracking-widest">
            AI_THREAT_SCANNER · Diagnostic Receipt
          </span>
        </div>
        <span className="text-xs font-mono text-neutral-600">{ts}</span>
      </div>

      <div className="rounded-lg bg-neutral-900/70 border border-neutral-800 px-3 py-2">
        <p className="text-xs text-neutral-600 uppercase tracking-widest mb-1">Input Sample</p>
        <p className="text-sm text-neutral-300 font-mono line-clamp-2">{input}</p>
      </div>

      <div className="flex items-center gap-4">
        <div
          className={`flex flex-col items-center justify-center w-[68px] h-[68px] rounded-xl border flex-shrink-0 bg-neutral-900/80 ${riskBorder(result.risk_score)}`}
        >
          <span className={`text-2xl font-black font-mono leading-none ${riskColor(result.risk_score)}`}>
            {result.risk_score}
          </span>
          <span className="text-neutral-600 text-xs mt-0.5">/100</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold uppercase tracking-widest ${riskColor(result.risk_score)}`}>
            {riskIndex(result.risk_score)}: {result.risk_score}%
          </p>
          <p className="text-base font-semibold text-neutral-100 mt-0.5">{riskLabel(result.risk_score)}</p>
          <div className="mt-2 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${riskBar(result.risk_score)}`}
              style={{ width: `${result.risk_score}%` }}
            />
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-neutral-600 text-xs">Confidence:</span>
            <span
              className={`text-xs font-semibold uppercase ${
                result.confidence === 'high'
                  ? 'text-purple-400'
                  : result.confidence === 'medium'
                  ? 'text-amber-400'
                  : 'text-neutral-400'
              }`}
            >
              {result.confidence}
            </span>
          </div>
        </div>
      </div>

      {result.threat_tags.length > 0 && (
        <div>
          <p className="text-xs text-neutral-600 uppercase tracking-widest mb-2">Behavioral Signatures</p>
          <div className="flex flex-wrap gap-2">
            {result.threat_tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-950/60 text-rose-400 border border-rose-500/20"
              >
                [{tag.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}]
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs text-neutral-600 uppercase tracking-widest mb-2">AI Diagnostic Report</p>
        <div className="rounded-lg bg-neutral-900/80 border border-neutral-800 p-3">
          <p className="text-sm text-neutral-300 leading-relaxed">{result.explanation}</p>
        </div>
      </div>
    </div>
  )
}

function ShieldCard({ entry }: { entry: Extract<LogEntry, { kind: 'shield' }> }) {
  const { result, query, queryType, ts } = entry
  const flagged = result.is_flagged

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 ${
        flagged ? 'border-rose-500/50 bg-rose-950/20' : 'border-emerald-500/30 bg-emerald-950/10'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-neutral-500" />
          <span className="text-xs font-mono text-neutral-500 uppercase tracking-widest">
            TRANSFER_SHIELD · Registry Lookup
          </span>
        </div>
        <span className="text-xs font-mono text-neutral-600">{ts}</span>
      </div>

      <div className="flex items-center gap-3">
        <div
          className={`p-3 rounded-xl border flex-shrink-0 ${
            flagged
              ? 'border-rose-500/30 bg-rose-950/40'
              : 'border-emerald-500/30 bg-emerald-950/20'
          }`}
        >
          {flagged ? (
            <XCircle className="w-7 h-7 text-rose-500" />
          ) : (
            <CheckCircle className="w-7 h-7 text-emerald-400" />
          )}
        </div>
        <div>
          <p className="text-xs text-neutral-500 uppercase font-mono">{queryType}</p>
          <p className="text-lg font-bold font-mono text-neutral-100">{query}</p>
          <p className={`text-sm font-bold mt-0.5 ${flagged ? 'text-rose-500' : 'text-emerald-400'}`}>
            {flagged ? '⚠ FLAGGED IN THREAT REGISTRY' : '✓ CLEAR — ZERO MATCH HISTORY'}
          </p>
        </div>
      </div>

      <div className="rounded-lg bg-neutral-900/60 border border-neutral-800 px-3 py-2">
        <p className="text-sm text-neutral-300">{result.message}</p>
      </div>

      {flagged && (
        <div className="grid grid-cols-3 gap-2">
          {result.report_count > 0 && (
            <div className="rounded-lg bg-rose-950/40 border border-rose-500/20 p-2 text-center">
              <p className="text-rose-500 text-xl font-black font-mono">{result.report_count}</p>
              <p className="text-neutral-600 text-xs">Reports</p>
            </div>
          )}
          {result.threat_type && (
            <div className="rounded-lg bg-neutral-900/60 border border-neutral-800 p-2 text-center col-span-2">
              <p className="text-amber-400 text-xs font-semibold uppercase">
                {result.threat_type.replace(/_/g, ' ')}
              </p>
              <p className="text-neutral-600 text-xs">Threat Classification</p>
            </div>
          )}
          {result.source && (
            <div className="rounded-lg bg-neutral-900/60 border border-neutral-800 p-2 text-center col-span-3">
              <p className="text-neutral-400 text-xs">
                Source:{' '}
                <span className="text-neutral-200 font-semibold capitalize">
                  {result.source.replace(/_/g, ' ')}
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ReportCard({ entry }: { entry: Extract<LogEntry, { kind: 'report' }> }) {
  const { value, threatType, valueType, ts } = entry
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag className="w-3.5 h-3.5 text-neutral-500" />
          <span className="text-xs font-mono text-neutral-500 uppercase tracking-widest">
            COMMUNITY_REPORT · Deployed
          </span>
        </div>
        <span className="text-xs font-mono text-neutral-600">{ts}</span>
      </div>
      <div className="flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-emerald-400">DEPLOYED TO GLOBAL THREAT REGISTRY</p>
          <p className="text-xs text-neutral-500 mt-0.5">
            <span className="text-neutral-400 uppercase font-mono">{valueType}</span>
            {' · '}
            <span className="text-neutral-200 font-mono">{value}</span>
            {' · '}
            <span className="text-amber-400">{THREAT_LABELS[threatType]}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

function SystemLog({ entry }: { entry: Extract<LogEntry, { kind: 'system' }> }) {
  const styles = {
    info: 'text-cyan-400 border-cyan-500/15 bg-cyan-950/10',
    success: 'text-emerald-400 border-emerald-500/15 bg-emerald-950/10',
    warning: 'text-amber-400 border-amber-500/15 bg-amber-950/10',
  }
  return (
    <div className={`rounded-lg border px-4 py-2 flex items-center gap-3 ${styles[entry.level]}`}>
      <Radio className="w-3 h-3 flex-shrink-0" />
      <span className="text-xs font-mono">{entry.message}</span>
      <span className="ml-auto text-xs text-neutral-600 font-mono flex-shrink-0">{entry.ts}</span>
    </div>
  )
}

// ─── Sidebar mock data ────────────────────────────────────────────────────────

const MOCK_BLOCKED = [
  { value: '0123456789', type: 'phone', threat: 'Bank Impersonation', time: '2m ago' },
  { value: 'securelogin-mybank.net', type: 'url', threat: 'Phishing Domain', time: '8m ago' },
  { value: '5512345678', type: 'account', threat: 'Investment Scam', time: '15m ago' },
  { value: '0198765432', type: 'phone', threat: 'Gov. Impersonation', time: '31m ago' },
]

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('scanner')
  const [log, setLog] = useState<LogEntry[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)

  // Populate boot messages client-side only to avoid SSR/hydration timestamp mismatch
  useEffect(() => {
    setLog([
      {
        id: uid(),
        ts: nowTs(),
        kind: 'system',
        message: 'MakGuard Terminal v2.0 — Gemini AI Engine ONLINE · All systems nominal',
        level: 'success',
      },
      {
        id: uid(),
        ts: nowTs(),
        kind: 'system',
        message: 'Supabase Threat Registry connected — 4,217 active threat entries loaded',
        level: 'info',
      },
    ])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scanner state
  const [scanMsg, setScanMsg] = useState('')
  const [scanLoading, setScanLoading] = useState(false)

  // Shield state
  const [shieldVal, setShieldVal] = useState('')
  const [shieldType, setShieldType] = useState<ValueType>('phone')
  const [shieldLoading, setShieldLoading] = useState(false)

  // Report state
  const [repVal, setRepVal] = useState('')
  const [repValType, setRepValType] = useState<ValueType>('phone')
  const [repThreat, setRepThreat] = useState<ThreatType>('bank_impersonation')
  const [repNotes, setRepNotes] = useState('')
  const [repLoading, setRepLoading] = useState(false)

  const push = useCallback((entry: LogEntry) => {
    setLog((prev) => [...prev, entry])
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  // ── API handlers ──────────────────────────────────────────────────────────

  const handleScan = async () => {
    if (!scanMsg.trim() || scanLoading) return
    setScanLoading(true)
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: scanMsg }),
      })
      const data = await res.json()
      if (!res.ok) {
        push({ id: uid(), ts: nowTs(), kind: 'system', message: `Error: ${data.error ?? 'Scan failed'}`, level: 'warning' })
      } else {
        push({ id: uid(), ts: nowTs(), kind: 'scan', result: data, input: scanMsg })
        setScanMsg('')
      }
    } catch {
      push({ id: uid(), ts: nowTs(), kind: 'system', message: 'Connection error — scan could not complete', level: 'warning' })
    } finally {
      setScanLoading(false)
    }
  }

  const handleShield = async () => {
    if (!shieldVal.trim() || shieldLoading) return
    setShieldLoading(true)
    try {
      const res = await fetch('/api/shield', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: shieldVal, value_type: shieldType }),
      })
      const data = await res.json()
      if (!res.ok) {
        push({ id: uid(), ts: nowTs(), kind: 'system', message: `Error: ${data.error ?? 'Lookup failed'}`, level: 'warning' })
      } else {
        push({ id: uid(), ts: nowTs(), kind: 'shield', result: data, query: shieldVal, queryType: shieldType })
        setShieldVal('')
      }
    } catch {
      push({ id: uid(), ts: nowTs(), kind: 'system', message: 'Connection error — shield lookup failed', level: 'warning' })
    } finally {
      setShieldLoading(false)
    }
  }

  const handleReport = async () => {
    if (!repVal.trim() || repLoading) return
    setRepLoading(true)
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_value: repVal,
          value_type: repValType,
          threat_type: repThreat,
          reporter_notes: repNotes,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        push({ id: uid(), ts: nowTs(), kind: 'system', message: `Error: ${data.error ?? 'Report failed'}`, level: 'warning' })
      } else {
        push({ id: uid(), ts: nowTs(), kind: 'report', value: repVal, threatType: repThreat, valueType: repValType })
        setRepVal('')
        setRepNotes('')
      }
    } catch {
      push({ id: uid(), ts: nowTs(), kind: 'system', message: 'Connection error — report could not be submitted', level: 'warning' })
    } finally {
      setRepLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 overflow-hidden">

      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-48 -left-48 w-[500px] h-[500px] rounded-full bg-purple-900/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-purple-900/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full bg-indigo-900/10 blur-3xl" />
      </div>

      {/* ── Top header bar ─────────────────────────────────────────────────── */}
      <header className="relative z-10 border-b border-neutral-800/50 bg-neutral-950/80 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
              <Shield className="w-4 h-4 text-purple-400" />
            </div>
            <span className="font-bold text-white tracking-tight text-base">MakGuard</span>
            <span className="hidden sm:block h-4 w-px bg-neutral-800" />
            <span className="hidden sm:block text-neutral-600 text-xs font-mono">
              AI Cyber Defense Terminal
            </span>
          </div>

          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 font-mono">SYSTEM ONLINE</span>
            </div>
            <div className="hidden md:flex items-center gap-1.5 text-neutral-500">
              <Cpu className="w-3.5 h-3.5" />
              <span className="text-xs font-mono">Gemini 1.5 Pro</span>
            </div>
            <div className="h-4 w-px bg-neutral-800" />
            <span className="text-xs text-neutral-600 font-mono">
              {new Date().toLocaleDateString('en-MY', { dateStyle: 'medium' })}
            </span>
          </div>
        </div>
      </header>

      {/* ── Main workspace ─────────────────────────────────────────────────── */}
      <main
        className="relative z-10 max-w-[1400px] mx-auto p-6 flex gap-5"
        style={{ height: 'calc(100vh - 56px)' }}
      >

        {/* ── LEFT: Unified terminal workspace ─────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 rounded-2xl border border-neutral-800/50 bg-neutral-900/40 backdrop-blur-md overflow-hidden">

          {/* Tab control row */}
          <div className="flex items-center gap-0.5 px-4 pt-3 border-b border-neutral-800/50">
            {(
              [
                { id: 'scanner', label: '🤖 AI Threat Scanner' },
                { id: 'shield', label: '🛡️ Transfer Shield' },
                { id: 'report', label: '📢 Community Report' },
              ] as { id: ActiveTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? 'text-purple-300 border-purple-500 bg-purple-500/5'
                    : 'text-neutral-500 border-transparent hover:text-neutral-300 hover:bg-neutral-800/30'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Terminal stream / log area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {log.map((entry) => {
              if (entry.kind === 'scan') return <ScanCard key={entry.id} entry={entry} />
              if (entry.kind === 'shield') return <ShieldCard key={entry.id} entry={entry} />
              if (entry.kind === 'report') return <ReportCard key={entry.id} entry={entry} />
              return <SystemLog key={entry.id} entry={entry} />
            })}
            <div ref={logEndRef} />
          </div>

          {/* ── Input section (tab-conditional) ───────────────────────────── */}
          <div className="border-t border-neutral-800/50 p-4 bg-neutral-900/50 backdrop-blur-sm">

            {/* TAB 1: AI Threat Scanner */}
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
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-600 font-mono">
                    Ctrl+Enter to submit · Powered by Gemini AI
                  </span>
                  <button
                    onClick={handleScan}
                    disabled={!scanMsg.trim() || scanLoading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all"
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

            {/* TAB 2: Transfer Shield */}
            {activeTab === 'shield' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {(['phone', 'account', 'url'] as ValueType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setShieldType(type)
                        setShieldVal('')
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all border ${
                        shieldType === type
                          ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                          : 'border-neutral-800 text-neutral-500 hover:text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      {type === 'phone' ? 'Phone Number' : type === 'account' ? 'Bank Account' : 'Website URL'}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <input
                    value={shieldVal}
                    onChange={(e) => setShieldVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleShield()
                    }}
                    placeholder={
                      shieldType === 'phone'
                        ? 'e.g. 0111234567'
                        : shieldType === 'account'
                        ? 'e.g. 1120045678'
                        : 'e.g. maybank2u-verify.net'
                    }
                    className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500/50 font-mono transition-colors"
                  />
                  <button
                    onClick={handleShield}
                    disabled={!shieldVal.trim() || shieldLoading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all"
                  >
                    {shieldLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Checking…
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        Query Registry
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: Community Report Registry */}
            {activeTab === 'report' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">

                  {/* Target type pills */}
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

                  {/* Target value input */}
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

                {/* Scam classification grid */}
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

                {/* Notes + submit */}
                <div className="flex gap-3">
                  <input
                    value={repNotes}
                    onChange={(e) => setRepNotes(e.target.value)}
                    placeholder="Additional notes (optional)…"
                    className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-rose-500/50 transition-colors"
                  />
                  <button
                    onClick={handleReport}
                    disabled={!repVal.trim() || repLoading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-700/80 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all whitespace-nowrap"
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
        </div>

        {/* ── RIGHT: Info sidebar ───────────────────────────────────────────── */}
        <div className="w-[288px] flex-shrink-0 flex flex-col gap-4 overflow-y-auto min-h-0">

          {/* Global Threat Level */}
          <div className="rounded-2xl border border-neutral-800/50 bg-neutral-900/40 backdrop-blur-md p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-neutral-500" />
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">
                Global Threat Level
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-amber-400 leading-none">HIGH</span>
                  <span className="text-amber-400/60 text-sm font-mono">↑ 12%</span>
                </div>
                <p className="text-neutral-600 text-xs mt-1">Malaysia Threat Index · May 2026</p>
              </div>
              <div className="ml-auto w-11 h-11 rounded-xl border border-amber-500/30 bg-amber-950/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Bank Scams', value: 78, bar: 'bg-rose-500' },
                { label: 'Phishing', value: 65, bar: 'bg-amber-500' },
                { label: 'Investment Fraud', value: 54, bar: 'bg-orange-500' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="text-neutral-600 text-xs w-[90px]">{item.label}</span>
                  <div className="flex-1 h-1 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.bar}`}
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                  <span className="text-neutral-500 text-xs w-5 text-right font-mono">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Blocked Scams */}
          <div className="rounded-2xl border border-neutral-800/50 bg-neutral-900/40 backdrop-blur-md p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-neutral-500" />
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">
                  Recent Blocks
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-xs text-rose-400 font-mono">LIVE</span>
              </div>
            </div>
            <div className="space-y-0">
              {MOCK_BLOCKED.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 py-2 border-b border-neutral-800/40 last:border-0"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-neutral-200 text-xs font-mono truncate">{item.value}</p>
                    <p className="text-neutral-600 text-xs">{item.threat}</p>
                  </div>
                  <span className="text-neutral-600 text-xs flex-shrink-0 font-mono">{item.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* System Telemetry */}
          <div className="rounded-2xl border border-neutral-800/50 bg-neutral-900/40 backdrop-blur-md p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-neutral-500" />
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">
                System Telemetry
              </span>
            </div>
            <div className="space-y-2.5">
              {(
                [
                  { label: 'Gemini 1.5 Pro Engine', status: 'LIVE', cls: 'text-emerald-400 bg-emerald-950/30 border-emerald-500/20', Icon: Cpu },
                  { label: 'Threat Registry DB', status: 'ONLINE', cls: 'text-emerald-400 bg-emerald-950/30 border-emerald-500/20', Icon: Database },
                  { label: 'Real-time Feed', status: 'ACTIVE', cls: 'text-cyan-400 bg-cyan-950/30 border-cyan-500/20', Icon: Wifi },
                  { label: 'Community Reports', status: 'OPEN', cls: 'text-purple-400 bg-purple-950/30 border-purple-500/20', Icon: BarChart3 },
                ] as { label: string; status: string; cls: string; Icon: React.ComponentType<{ className?: string }> }[]
              ).map(({ label, status, cls, Icon }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-neutral-600" />
                    <span className="text-neutral-500 text-xs">{label}</span>
                  </div>
                  <span className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded border ${cls}`}>
                    {status}
                  </span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-neutral-800/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-neutral-600 text-xs">Threats Blocked Today</span>
                <span className="text-rose-400 font-mono font-bold text-xs">1,247</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-600 text-xs">Registry Entries</span>
                <span className="text-neutral-400 font-mono text-xs">4,217</span>
              </div>
            </div>
          </div>

          {/* Branding footer */}
          <div className="rounded-2xl border border-purple-500/10 bg-purple-900/5 p-4 text-center">
            <Shield className="w-5 h-5 text-purple-400 mx-auto mb-1.5" />
            <p className="text-purple-300 font-semibold text-sm">MakGuard AI</p>
            <p className="text-neutral-600 text-xs mt-0.5">Protecting Malaysia from digital threats</p>
          </div>
        </div>
      </main>
    </div>
  )
}
