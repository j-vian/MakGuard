'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

type ValueType = 'phone' | 'account' | 'url'
type ThreatType = 'bank_impersonation' | 'investment_scam' | 'phishing' | 'government_impersonation' | 'other'

export default function ReportPage() {
  const [targetValue, setTargetValue] = useState('')
  const [valueType, setValueType] = useState<ValueType>('phone')
  const [threatType, setThreatType] = useState<ThreatType>('bank_impersonation')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!targetValue.trim()) return
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_value: targetValue,
          value_type: valueType,
          threat_type: threatType,
          reporter_notes: notes
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Something went wrong')
        return
      }

      setSuccess(true)
      setTargetValue('')
      setNotes('')

    } catch {
      setError('Failed to submit report. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="p-4">
        <div className="pt-6 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🚩</span>
            <h1 className="text-xl font-bold text-white">Report Scam</h1>
          </div>
        </div>
        <Card className="bg-green-950 border-green-800 mt-4">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center text-center space-y-3">
              <span className="text-5xl">🙏</span>
              <p className="text-green-400 text-lg font-bold">Report Submitted</p>
              <p className="text-slate-300 text-sm leading-relaxed">
                Thank you for keeping Malaysia safe. Your report has been recorded and will help protect other users.
              </p>
              <Button
                onClick={() => setSuccess(false)}
                className="mt-2 bg-green-700 hover:bg-green-600 text-white"
              >
                Report Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="pt-6 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🚩</span>
          <h1 className="text-xl font-bold text-white">Report Scam</h1>
        </div>
        <p className="text-slate-400 text-sm">
          Help protect others by reporting scam numbers and links
        </p>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">Submit a Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-slate-400 text-xs uppercase tracking-wide mb-2 block">
              Type of report
            </Label>
            <div className="flex gap-2">
              {(['phone', 'account', 'url'] as ValueType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setValueType(type)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors capitalize ${
                    valueType === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-slate-400 text-xs uppercase tracking-wide mb-2 block">
              {valueType === 'phone' ? 'Phone number' :
               valueType === 'account' ? 'Account number' : 'Website URL'}
            </Label>
            <Input
              placeholder={
                valueType === 'phone' ? 'e.g. 0111234567' :
                valueType === 'account' ? 'e.g. 1120045678' :
                'e.g. fake-maybank-login.com'
              }
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
            />
          </div>

          <div>
            <Label className="text-slate-400 text-xs uppercase tracking-wide mb-2 block">
              Scam type
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['bank_impersonation', 'Bank Impersonation'],
                ['investment_scam', 'Investment Scam'],
                ['phishing', 'Phishing'],
                ['government_impersonation', 'Gov. Impersonation'],
                ['other', 'Other']
              ] as [ThreatType, string][]).map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => setThreatType(type)}
                  className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors text-left ${
                    threatType === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-slate-400 text-xs uppercase tracking-wide mb-2 block">
              Additional notes (optional)
            </Label>
            <Textarea
              placeholder="Describe what happened..."
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 min-h-24 resize-none text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={loading || !targetValue.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </span>
            ) : (
              'Submit Report'
            )}
          </Button>
        </CardContent>
      </Card>

      <p className="text-slate-600 text-xs text-center pb-4">
        Reports are reviewed and help protect the Malaysian community
      </p>
    </div>
  )
}