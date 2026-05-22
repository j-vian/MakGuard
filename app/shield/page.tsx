'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ShieldResult } from '@/lib/types'

type ValueType = 'phone' | 'account' | 'url'

export default function ShieldPage() {
  const [value, setValue] = useState('')
  const [valueType, setValueType] = useState<ValueType>('phone')
  const [result, setResult] = useState<ShieldResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleVerify = async () => {
    if (!value.trim()) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/shield', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, value_type: valueType })
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
    setValue('')
    setResult(null)
    setError('')
  }

  const placeholders: Record<ValueType, string> = {
    phone: 'e.g. 0111234567',
    account: 'e.g. 1120045678',
    url: 'e.g. maybank2u-verify.net'
  }

  return (
    <div className="p-4 space-y-4">
      <div className="pt-6 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🔍</span>
          <h1 className="text-xl font-bold text-white">Transfer Shield</h1>
        </div>
        <p className="text-slate-400 text-sm">
          Verify a recipient before you transfer money
        </p>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">Check Account or Number</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-slate-400 text-xs uppercase tracking-wide mb-2 block">
              Check type
            </Label>
            <div className="flex gap-2">
              {(['phone', 'account', 'url'] as ValueType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setValueType(type)
                    setValue('')
                    setResult(null)
                  }}
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
              placeholder={placeholders[valueType]}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleVerify}
              disabled={loading || !value.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Checking...
                </span>
              ) : (
                'Verify Now'
              )}
            </Button>
            {(value || result) && (
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
        <Card className={`border ${result.is_flagged ? 'bg-red-950 border-red-800' : 'bg-green-950 border-green-800'}`}>
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <span className="text-5xl">
                {result.is_flagged ? '🚨' : '✅'}
              </span>
              <p className={`text-lg font-bold ${result.is_flagged ? 'text-red-400' : 'text-green-400'}`}>
                {result.is_flagged ? 'Threat Detected' : 'Looks Safe'}
              </p>
              <p className="text-slate-300 text-sm leading-relaxed">
                {result.message}
              </p>
              {result.is_flagged && (
                <div className="w-full bg-slate-900 rounded-xl p-3 mt-2 space-y-2 text-left">
                  {result.threat_type && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Threat type</span>
                      <span className="text-white capitalize">
                        {result.threat_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                  )}
                  {result.report_count > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Times reported</span>
                      <span className="text-red-400 font-bold">{result.report_count}</span>
                    </div>
                  )}
                  {result.source && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Source</span>
                      <span className="text-white capitalize">
                        {result.source.replace(/_/g, ' ')}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}