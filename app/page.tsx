'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScanResult } from '@/lib/types'

const getRiskColor = (score: number) => {
  if (score <= 30) return 'text-green-400'
  if (score <= 60) return 'text-yellow-400'
  if (score <= 85) return 'text-orange-400'
  return 'text-red-400'
}

const getRiskBg = (score: number) => {
  if (score <= 30) return 'bg-green-950 border-green-800'
  if (score <= 60) return 'bg-yellow-950 border-yellow-800'
  if (score <= 85) return 'bg-orange-950 border-orange-800'
  return 'bg-red-950 border-red-800'
}

const getRiskLabel = (score: number) => {
  if (score <= 30) return 'Safe'
  if (score <= 60) return 'Suspicious'
  if (score <= 85) return 'Likely Scam'
  return 'Definite Scam'
}

const getRiskEmoji = (score: number) => {
  if (score <= 30) return '✅'
  if (score <= 60) return '⚠️'
  if (score <= 85) return '🚨'
  return '🛑'
}

export default function ScannerPage() {
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleScan = async () => {
    if (!message.trim()) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Something went wrong')
        return
      }

      setResult(data)
    } catch {
      setError('Failed to connect. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setMessage('')
    setResult(null)
    setError('')
  }

  return (
    <div className="p-4 space-y-4">
      <div className="pt-6 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🛡️</span>
          <h1 className="text-xl font-bold text-white">MakGuard AI</h1>
        </div>
        <p className="text-slate-400 text-sm">
          Paste a suspicious message to check if it is a scam
        </p>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">Scam Message Scanner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Paste suspicious SMS, WhatsApp message, or email content here..."
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 min-h-36 resize-none text-sm"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              onClick={handleScan}
              disabled={loading || !message.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analyzing...
                </span>
              ) : (
                'Analyze Message'
              )}
            </Button>
            {(message || result) && (
              <Button
                onClick={handleClear}
                variant="outline"
                className="border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="bg-red-950 border-red-800">
          <CardContent className="pt-4 pb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className={`border ${getRiskBg(result.score)}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Analysis Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center justify-center w-20 h-20 rounded-2xl bg-slate-800 border border-slate-700">
                <span className="text-2xl">{getRiskEmoji(result.score)}</span>
                <span className={`text-xl font-bold ${getRiskColor(result.score)}`}>
                  {result.score}
                </span>
                <span className="text-slate-500 text-xs">/ 100</span>
              </div>
              <div className="flex-1">
                <p className={`text-lg font-bold ${getRiskColor(result.score)}`}>
                  {getRiskLabel(result.score)}
                </p>
                <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      result.score <= 30 ? 'bg-green-500' :
                      result.score <= 60 ? 'bg-yellow-500' :
                      result.score <= 85 ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${result.score}%` }}
                  />
                </div>
              </div>
            </div>

            {result.flags.length > 0 && (
              <div>
                <p className="text-slate-400 text-xs mb-2 uppercase tracking-wide">Detected threats</p>
                <div className="flex flex-wrap gap-2">
                  {result.flags.map((tag) => (
                    <Badge
                      key={tag}
                      className="bg-red-900 text-red-300 border-red-800 text-xs"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-slate-400 text-xs mb-2 uppercase tracking-wide">Recommendation</p>
              <div className="bg-slate-800 rounded-xl p-3">
                <p className="text-slate-300 text-sm leading-relaxed">{result.recommendation}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}