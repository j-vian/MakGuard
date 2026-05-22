'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScanResult } from '@/lib/types'

export default function Home() {
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
      setError('Failed to connect to the scan API')
    } finally {
      setLoading(false)
    }
  }

  const getRiskColor = (score: number) => {
    if (score <= 30) return 'bg-green-500'
    if (score <= 60) return 'bg-yellow-500'
    if (score <= 85) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const getRiskLabel = (score: number) => {
    if (score <= 30) return 'Safe'
    if (score <= 60) return 'Suspicious'
    if (score <= 85) return 'Likely Scam'
    return 'Definite Scam'
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 max-w-md mx-auto">
      <div className="pt-8 pb-4">
        <h1 className="text-2xl font-bold text-blue-400">MakGuard AI</h1>
        <p className="text-slate-400 text-sm mt-1">
          Malaysia's scam shield — paste a suspicious message below
        </p>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-base">Scam Message Scanner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Paste suspicious SMS or WhatsApp message here..."
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 min-h-32"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <Button
            onClick={handleScan}
            disabled={loading || !message.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Analyzing...' : 'Analyze Message'}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="mt-4 bg-red-950 border-red-800">
          <CardContent className="pt-4">
            <p className="text-red-400 text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="mt-4 bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-base">Analysis Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${getRiskColor(result.risk_score)}`}>
                <span className="text-white font-bold text-lg">{result.risk_score}</span>
              </div>
              <div>
                <p className="text-white font-medium">{getRiskLabel(result.risk_score)}</p>
                <p className="text-slate-400 text-sm">Confidence: {result.confidence}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {result.threat_tags.map((tag) => (
                <Badge key={tag} variant="destructive" className="text-xs">
                  {tag.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>

            <div className="bg-slate-800 rounded-lg p-3">
              <p className="text-slate-300 text-sm leading-relaxed">{result.explanation}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  )
}