'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'

type View = 'home' | 'monitor' | 'alert' | 'safe' | 'history' | 'settings'

type ScanResult = {
  score: number
  flags: string[]
  recommendation: string
}

type Settings = {
  elderName: string
  guardianPhone: string
  guardianEmail: string
}

type HistoryEntry = {
  id: string
  timestamp: string
  transcript: string
  score: number
  flags: string[]
  recommendation: string
  callerNumber?: string
  verifiedCaller?: boolean
}

const SETTINGS_KEY = 'scamguard.settings'
const HISTORY_KEY = 'scamguard.history'
const ALERT_THRESHOLD = 65
const MASK_THRESHOLD = 40

const VERIFIED_NUMBERS = [
  { number: '1-300-88-5465', org: 'Bank Negara Malaysia' },
  { number: '03-2266-2222', org: 'PDRM (Royal Malaysia Police)' },
  { number: '1-300-88-6688', org: 'Maybank' },
  { number: '1-300-880-900', org: 'CIMB Bank' },
]

const SCAM_SCRIPT =
  'Hello this is Bank Negara. Your account will be blocked in 30 minutes. You must transfer now to avoid arrest. Do not tell your family. Share your OTP and IC number immediately.'

const SAFE_SCRIPT =
  'Hello this is Maybank calling to confirm your new card delivery. Please visit the official website for more details. No action is required from you right now.'

const getRiskLabel = (score: number) => {
  if (score < 35) return 'SAFE'
  if (score < 65) return 'SUSPICIOUS'
  return 'SCAM ALERT'
}

const getRiskColor = (score: number) => {
  if (score < 35) return '#22c55e'
  if (score < 65) return '#f59e0b'
  return '#ef4444'
}

const keywordFallback = (transcript: string): ScanResult => {
  const text = transcript.toLowerCase()
  const rules = [
    { keyword: 'transfer', score: 15, flag: 'Money transfer request' },
    { keyword: 'blocked', score: 12, flag: 'Account threat' },
    { keyword: 'arrest', score: 20, flag: 'Arrest threat' },
    { keyword: 'police', score: 8, flag: 'Authority impersonation' },
    { keyword: 'bank negara', score: 18, flag: 'Fake Bank Negara claim' },
    { keyword: 'immediately', score: 10, flag: 'Urgency pressure' },
    { keyword: 'confidential', score: 12, flag: 'Secrecy demand' },
    { keyword: 'do not tell', score: 18, flag: 'Secrecy demand' },
    { keyword: 'otp', score: 20, flag: 'OTP request' },
    { keyword: 'tac', score: 20, flag: 'TAC code request' },
    { keyword: 'ic number', score: 15, flag: 'Personal data request' },
    { keyword: 'suspend', score: 10, flag: 'Account suspension threat' },
    { keyword: 'macau', score: 25, flag: 'Macau scam pattern' },
    { keyword: 'warrant', score: 20, flag: 'Fake warrant threat' },
  ]

  let score = 0
  const flags: string[] = []

  rules.forEach(({ keyword, score: weight, flag }) => {
    if (text.includes(keyword)) {
      score += weight
      flags.push(flag)
    }
  })

  score = Math.min(score, 95)

  return {
    score,
    flags: Array.from(new Set(flags)),
    recommendation:
      score >= ALERT_THRESHOLD
        ? 'High scam risk. End the call and contact the official number.'
        : score >= 35
          ? 'Suspicious patterns detected. Do not share personal information.'
          : 'No scam indicators detected in current transcript.',
  }
}

export default function ScamGuardPage() {
  const [view, setView] = useState<View>('home')
  const [settings, setSettings] = useState<Settings>({ elderName: '', guardianPhone: '', guardianEmail: '' })
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [callerNumber, setCallerNumber] = useState('')

  const [transcript, setTranscript] = useState('')
  const [partial, setPartial] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<ScanResult>({ score: 0, flags: [], recommendation: '' })
  const [sttMode, setSttMode] = useState<'google' | 'gemini'>('google')
  const [audioSource, setAudioSource] = useState<'mic' | 'tab'>('mic')

  const isListeningRef = useRef(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const chunkTimerRef = useRef<number | null>(null)
  const lastAnalyzedRef = useRef('')
  const demoTimerRef = useRef<number | null>(null)

  const liveWsRef = useRef<WebSocket | null>(null)
  const liveAudioCtxRef = useRef<AudioContext | null>(null)
  const liveSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const liveProcessorRef = useRef<ScriptProcessorNode | null>(null)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const maskStreamRef = useRef<MediaStream | null>(null)
  const maskSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const maskFilterRef = useRef<BiquadFilterNode | null>(null)
  const maskGainRef = useRef<GainNode | null>(null)

  const verifiedCaller = useMemo(() => {
    const cleaned = callerNumber.replace(/\s|-/g, '')
    const entry = VERIFIED_NUMBERS.find((n) => n.number.replace(/\s|-/g, '') === cleaned)
    return entry || null
  }, [callerNumber])

  useEffect(() => {
    const storedSettings = localStorage.getItem(SETTINGS_KEY)
    const storedHistory = localStorage.getItem(HISTORY_KEY)

    if (storedSettings) {
      try {
        const parsed = JSON.parse(storedSettings) as Settings
        setSettings(parsed)
      } catch {
        setSettings({ elderName: '', guardianPhone: '', guardianEmail: '' })
      }
    }

    if (storedHistory) {
      try {
        const parsed = JSON.parse(storedHistory) as HistoryEntry[]
        setHistory(parsed)
      } catch {
        setHistory([])
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  }, [history])

  useEffect(() => {
    if (result.score >= MASK_THRESHOLD && result.score < ALERT_THRESHOLD) {
      activateVoiceMasking()
    } else {
      deactivateVoiceMasking()
    }
  }, [result.score])

  useEffect(() => {
    if (result.score >= ALERT_THRESHOLD) {
      setView('alert')
    }
  }, [result.score])

  useEffect(() => {
    if (view === 'alert' && navigator.vibrate) {
      navigator.vibrate([500, 200, 500])
    }
  }, [view])

  useEffect(() => {
    if (!transcript || transcript.length < 20) return
    if (transcript === lastAnalyzedRef.current) return

    const timer = window.setTimeout(async () => {
      setIsAnalyzing(true)
      lastAnalyzedRef.current = transcript

      try {
        const response = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Scan failed')
        }

        setResult(data)
      } catch {
        setResult(keywordFallback(transcript))
      } finally {
        setIsAnalyzing(false)
      }
    }, 5000)

    return () => window.clearTimeout(timer)
  }, [transcript])

  useEffect(() => () => stopListening(), [])

  const startListening = async () => {
    try {
      let stream: MediaStream

      if (audioSource === 'tab') {
        stream = await navigator.mediaDevices.getDisplayMedia({
          audio: true,
          video: true,
        })
        stream.getVideoTracks().forEach((track) => track.stop())
        stream = new MediaStream(stream.getAudioTracks())
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 48000,
            echoCancellation: true,
            noiseSuppression: true,
          },
        })
      }

      mediaStreamRef.current = stream
      setIsListening(true)
      isListeningRef.current = true
      setTranscript('')
      setPartial('')
      setResult({ score: 0, flags: [], recommendation: '' })
      lastAnalyzedRef.current = ''

      const recordChunk = () => {
        if (!mediaStreamRef.current) return

        const chunks: Blob[] = []
        const recorder = new MediaRecorder(mediaStreamRef.current, {
          mimeType: 'audio/webm;codecs=opus',
        })

        mediaRecorderRef.current = recorder

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data)
        }

        recorder.onstop = async () => {
          if (!chunks.length) return
          const blob = new Blob(chunks, { type: 'audio/webm;codecs=opus' })
          await sendChunkToServer(blob)

          if (isListeningRef.current) {
            recordChunk()
          }
        }

        recorder.start()

        chunkTimerRef.current = window.setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.stop()
          }
        }, 3000)
      }

      recordChunk()
    } catch {
      setIsListening(false)
      isListeningRef.current = false
      setPartial(
        audioSource === 'tab'
          ? 'Tab audio capture failed. Try mic or demo mode.'
          : 'Mic capture failed. Try tab audio or demo mode.'
      )
    }
  }

  const stopListening = () => {
    setIsListening(false)
    isListeningRef.current = false
    stopGeminiLive()
    if (chunkTimerRef.current) {
      window.clearTimeout(chunkTimerRef.current)
      chunkTimerRef.current = null
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
  }

  const startGeminiLive = async () => {
    const wsUrl = process.env.NEXT_PUBLIC_GEMINI_LIVE_WS_URL
    if (!wsUrl) {
      setPartial('Gemini Live URL not configured. Try demo mode.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      setIsListening(true)
      isListeningRef.current = true
      setTranscript('')
      setPartial('Connecting to Gemini Live...')

      const ws = new WebSocket(wsUrl)
      liveWsRef.current = ws

      ws.onopen = () => {
        const setupMessage = {
          setup: {
            model: 'models/gemini-2.5-flash-native-audio',
            generationConfig: { responseModalities: ['TEXT'] },
            systemInstruction: {
              parts: [{ text: 'You are a helpful text assistant responding to audio voice input.' }],
            },
          },
        }
        ws.send(JSON.stringify(setupMessage))
        setPartial('Listening via Gemini Live...')
      }

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          const parts = payload?.serverContent?.modelTurn?.parts || []
          parts.forEach((part: { text?: string }) => {
            if (part.text) {
              setTranscript((prev) => `${prev} ${part.text}`.trim())
            }
          })
        } catch {
          // Ignore parse errors from non-text events
        }
      }

      ws.onerror = () => {
        setPartial('Gemini Live error. Try demo mode.')
      }

      ws.onclose = () => {
        setPartial('Gemini Live disconnected.')
      }

      liveAudioCtxRef.current = new AudioContext({ sampleRate: 16000 })
      liveSourceRef.current = liveAudioCtxRef.current.createMediaStreamSource(stream)
      liveProcessorRef.current = liveAudioCtxRef.current.createScriptProcessor(4096, 1, 1)

      liveProcessorRef.current.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0)
        const pcmBuffer = new Int16Array(input.length)
        for (let i = 0; i < input.length; i += 1) {
          pcmBuffer[i] = Math.max(-1, Math.min(1, input[i])) * 0x7fff
        }

        const bytes = new Uint8Array(pcmBuffer.buffer)
        let binary = ''
        for (let i = 0; i < bytes.length; i += 1) {
          binary += String.fromCharCode(bytes[i])
        }

        const chunkMessage = {
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: 'audio/pcm',
                data: btoa(binary),
              },
            ],
          },
        }

        if (liveWsRef.current?.readyState === WebSocket.OPEN) {
          liveWsRef.current.send(JSON.stringify(chunkMessage))
        }
      }

      liveSourceRef.current.connect(liveProcessorRef.current)
      liveProcessorRef.current.connect(liveAudioCtxRef.current.destination)
    } catch {
      setPartial('Gemini Live unavailable. Try demo mode.')
      stopGeminiLive()
    }
  }

  const stopGeminiLive = () => {
    if (liveProcessorRef.current) {
      liveProcessorRef.current.disconnect()
      liveProcessorRef.current = null
    }
    if (liveSourceRef.current) {
      liveSourceRef.current.disconnect()
      liveSourceRef.current = null
    }
    if (liveAudioCtxRef.current) {
      liveAudioCtxRef.current.close()
      liveAudioCtxRef.current = null
    }
    if (liveWsRef.current) {
      liveWsRef.current.close()
      liveWsRef.current = null
    }
  }

  const sendChunkToServer = async (audioBlob: Blob) => {
    try {
      if (!audioBlob || audioBlob.size === 0) {
        return
      }

      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(new Error('Failed to read audio chunk'))
        reader.onloadend = () => {
          const result = typeof reader.result === 'string' ? reader.result : ''
          const base64 = result.split(',')[1] || ''
          if (!base64) {
            reject(new Error('Empty audio payload'))
            return
          }
          resolve(base64)
        }
        reader.readAsDataURL(audioBlob)
      })

      const response = await fetch('/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64Audio,
          sampleRateHertz: 48000,
          languageCode: 'en-MY',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'STT failed')
      }

      if (data.transcript) {
        setTranscript((prev) => `${prev} ${data.transcript}`.trim())
      }
    } catch {
      setPartial('STT unavailable. Try demo mode.')
    }
  }

  const startDemoMode = (script: string) => {
    stopListening()
    if (demoTimerRef.current) window.clearInterval(demoTimerRef.current)

    setView('monitor')
    setTranscript('')
    setPartial('')
    setIsListening(true)
    isListeningRef.current = true
    setResult({ score: 0, flags: [], recommendation: '' })

    const words = script.split(' ')
    let index = 0

    demoTimerRef.current = window.setInterval(() => {
      if (index < words.length) {
        setTranscript((prev) => `${prev} ${words[index]}`.trim())
        index += 1
      } else {
        if (demoTimerRef.current) window.clearInterval(demoTimerRef.current)
        setIsListening(false)
        isListeningRef.current = false
      }
    }, 280)
  }

  const stopDemoMode = () => {
    if (demoTimerRef.current) window.clearInterval(demoTimerRef.current)
    setIsListening(false)
    isListeningRef.current = false
  }

  const recordHistory = (entry: HistoryEntry) => {
    setHistory((prev) => [entry, ...prev].slice(0, 30))
  }

  const endCall = (nextView?: View) => {
    stopListening()
    stopDemoMode()
    deactivateVoiceMasking()

    if (transcript.trim()) {
      recordHistory({
        id: `${Date.now()}`,
        timestamp: new Date().toLocaleString('en-MY'),
        transcript,
        score: result.score,
        flags: result.flags,
        recommendation: result.recommendation || 'No scam indicators detected.',
        callerNumber,
        verifiedCaller: !!verifiedCaller,
      })
    }

    if (nextView) {
      setView(nextView)
      return
    }

    setView(result.score >= ALERT_THRESHOLD ? 'alert' : 'safe')
  }

  const activateVoiceMasking = async () => {
    if (audioCtxRef.current) return

    try {
      maskStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioCtxRef.current = new AudioContext()

      maskSourceRef.current = audioCtxRef.current.createMediaStreamSource(maskStreamRef.current)
      maskFilterRef.current = audioCtxRef.current.createBiquadFilter()
      maskFilterRef.current.type = 'peaking'
      maskFilterRef.current.frequency.value = 1200
      maskFilterRef.current.gain.value = 9
      maskFilterRef.current.Q.value = 0.4

      maskGainRef.current = audioCtxRef.current.createGain()
      maskGainRef.current.gain.value = 0.9

      maskSourceRef.current.connect(maskFilterRef.current)
      maskFilterRef.current.connect(maskGainRef.current)
      maskGainRef.current.connect(audioCtxRef.current.destination)
    } catch {
      deactivateVoiceMasking()
    }
  }

  const deactivateVoiceMasking = () => {
    if (audioCtxRef.current) {
      audioCtxRef.current.close()
      audioCtxRef.current = null
    }
    if (maskStreamRef.current) {
      maskStreamRef.current.getTracks().forEach((track) => track.stop())
      maskStreamRef.current = null
    }
  }

  const copyAlertMessage = async () => {
    const name = settings.elderName || 'Elderly user'
    const flags = result.flags.join(', ') || 'No flags'
    const message = `⚠️ Possible scam call detected for ${name}. Risk: ${result.score}/100. Flags: ${flags}. Please check on them immediately.`

    try {
      await navigator.clipboard.writeText(message)
    } catch {
      // ignore copy failures
    }
  }

  const riskRingStyle = {
    background: `conic-gradient(${getRiskColor(result.score)} ${result.score * 3.6}deg, #1f2937 0deg)`,
  }

  const renderHeader = () => (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-2xl">🛡️</span>
          <h1 className="text-xl font-bold text-white">ScamGuard AI</h1>
        </div>
        <p className="text-slate-400 text-xs">Real-time call protection · Perlindungan panggilan masa nyata</p>
      </div>
      <Button
        variant="ghost"
        className="text-slate-400 hover:text-white"
        onClick={() => setView('settings')}
      >
        Settings
      </Button>
    </div>
  )

  const renderHome = () => (
    <div className="space-y-4">
      {renderHeader()}

      {settings.elderName && (
        <Card className="bg-amber-950 border-amber-800">
          <CardContent className="pt-4 pb-4">
            <p className="text-amber-200 text-sm">
              Protecting {settings.elderName} · Melindungi {settings.elderName}
            </p>
            <p className="text-amber-300 text-xs">
              Guardian: {settings.guardianPhone || settings.guardianEmail || 'Not set'}
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-base">Start Protection · Mula Perlindungan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => setView('monitor')}>
            Start Monitoring
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="border-red-700 text-red-300" onClick={() => startDemoMode(SCAM_SCRIPT)}>
              Simulate SCAM
            </Button>
            <Button variant="outline" className="border-green-700 text-green-300" onClick={() => startDemoMode(SAFE_SCRIPT)}>
              Simulate SAFE
            </Button>
          </div>
          <Button variant="ghost" className="w-full text-slate-400" onClick={() => setView('history')}>
            View History
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  const renderMonitor = () => (
    <div className="space-y-4">
      {renderHeader()}

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">Call Monitor · Pemantau Panggilan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-slate-400">Caller number · Nombor pemanggil</Label>
            <Input
              value={callerNumber}
              onChange={(event) => setCallerNumber(event.target.value)}
              placeholder="e.g. 03-2266-2222"
              className="bg-slate-800 border-slate-700 text-white"
            />
            {verifiedCaller && (
              <div className="flex items-center gap-2 text-green-300 text-xs">
                ✅ Verified: {verifiedCaller.org} · No scam indicators detected
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div
              className={`w-28 h-28 rounded-full flex items-center justify-center ${
                result.score >= ALERT_THRESHOLD ? 'risk-pulse' : ''
              }`}
              style={riskRingStyle}
            >
              <div className="w-24 h-24 rounded-full bg-slate-950 flex flex-col items-center justify-center">
                <span className="font-mono text-2xl font-bold text-white">{result.score}</span>
                <span className="text-xs text-slate-400">/ 100</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-400">Risk Level · Tahap Risiko</p>
              <p className="text-lg font-bold" style={{ color: getRiskColor(result.score) }}>
                {getRiskLabel(result.score)}
              </p>
              <p className="text-xs text-slate-400 mt-2">
                {isAnalyzing ? 'Analyzing...' : result.recommendation || 'Listening for new transcript'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {result.flags.map((flag) => (
              <Badge key={flag} className="bg-red-900 text-red-200 border-red-800 text-xs">
                {flag}
              </Badge>
            ))}
          </div>

          <div className="bg-slate-800 rounded-xl p-3 min-h-32">
            <p className="text-slate-300 text-sm font-mono">
              {transcript}
              {partial && ` ${partial}`}
              <span className="cursor-blink">▍</span>
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              onClick={
                isListening
                  ? stopListening
                  : sttMode === 'gemini'
                    ? startGeminiLive
                    : startListening
              }
            >
              {isListening ? 'Stop Listening' : 'Start Listening'}
            </Button>
            <Button
              variant="outline"
              className="border-slate-700 text-slate-300"
              onClick={endCall}
            >
              End Call
            </Button>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>STT: {sttMode === 'gemini' ? 'Gemini Live' : 'Google STT'}</span>
            <Button
              variant="ghost"
              className="h-auto px-2 py-1 text-xs text-slate-400"
              onClick={() => setSttMode((prev) => (prev === 'gemini' ? 'google' : 'gemini'))}
            >
              Switch
            </Button>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Audio source: {audioSource === 'tab' ? 'Tab/System' : 'Microphone'}</span>
            <Button
              variant="ghost"
              className="h-auto px-2 py-1 text-xs text-slate-400"
              onClick={() => setAudioSource((prev) => (prev === 'tab' ? 'mic' : 'tab'))}
            >
              Switch
            </Button>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{isListening ? 'Live mic on' : 'Mic off'}</span>
            <span>{result.score >= MASK_THRESHOLD && result.score < ALERT_THRESHOLD ? '🔊 Voice Protected' : 'Voice normal'}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const renderAlert = () => (
    <div className="fixed inset-0 bg-red-950/95 z-50 flex items-center justify-center px-4">
      <Card className="bg-red-950 border-red-800 w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-red-200 text-lg">⚠️ Scam Alert Detected</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-red-100 text-sm">High risk call detected. End the call now.</p>
          <div className="flex flex-wrap gap-2">
            {result.flags.map((flag) => (
              <Badge key={flag} className="bg-red-800 text-red-200 border-red-700 text-xs">
                {flag}
              </Badge>
            ))}
          </div>
          <div className="bg-red-900/70 rounded-xl p-3 text-xs text-red-100">
            ⚠️ Possible scam call detected for {settings.elderName || 'elderly user'}. Risk: {result.score}/100. Flags:{' '}
            {result.flags.join(', ') || 'No flags'}. Please check on them immediately.
          </div>
          <Button className="w-full bg-red-600 hover:bg-red-700" onClick={copyAlertMessage}>
            Copy Alert Message
          </Button>
          <Button variant="outline" className="w-full border-red-700 text-red-200" onClick={() => endCall('home')}>
            End Call
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  const renderSafe = () => (
    <div className="space-y-4">
      {renderHeader()}
      <Card className="bg-green-950 border-green-800">
        <CardContent className="pt-6 pb-6 space-y-3 text-center">
          <div className="text-4xl">✅</div>
          <p className="text-green-200 text-lg font-bold">No scam indicators detected</p>
          {verifiedCaller && (
            <p className="text-green-300 text-xs">Verified caller: {verifiedCaller.org}</p>
          )}
          <p className="text-slate-300 text-sm">{result.recommendation || 'Stay alert and never share OTPs.'}</p>
          <div className="bg-slate-900 rounded-xl p-3 text-left">
            <p className="text-slate-300 text-xs uppercase tracking-wide mb-2">Transcript · Transkrip</p>
            <p className="text-slate-200 text-sm font-mono whitespace-pre-wrap">{transcript || 'No transcript captured.'}</p>
          </div>
          <Button className="w-full bg-green-700 hover:bg-green-600" onClick={() => setView('home')}>
            Back to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  const renderHistory = () => (
    <div className="space-y-4">
      {renderHeader()}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-base">History · Sejarah</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.length === 0 && (
            <p className="text-slate-400 text-sm">No calls recorded yet.</p>
          )}
          {history.map((entry) => (
            <div key={entry.id} className="bg-slate-800 rounded-lg p-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{entry.timestamp}</span>
                <span className="font-mono">{entry.score}/100</span>
              </div>
              <p className="text-slate-200 text-sm mt-2 line-clamp-2">{entry.transcript}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {entry.flags.map((flag) => (
                  <Badge key={flag} className="bg-slate-700 text-slate-200 border-slate-600 text-xs">
                    {flag}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )

  const renderSettings = () => (
    <div className="space-y-4">
      {renderHeader()}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-base">Elderly Protection · Mod Perlindungan Warga Emas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs uppercase tracking-wide text-slate-400">Elderly name · Nama warga emas</Label>
            <Input
              value={settings.elderName}
              onChange={(event) => setSettings({ ...settings, elderName: event.target.value })}
              placeholder="e.g. Puan Aishah"
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-slate-400">Guardian phone · Telefon penjaga</Label>
            <Input
              value={settings.guardianPhone}
              onChange={(event) => setSettings({ ...settings, guardianPhone: event.target.value })}
              placeholder="e.g. 012-345-6789"
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-slate-400">Guardian email · Emel penjaga</Label>
            <Input
              value={settings.guardianEmail}
              onChange={(event) => setSettings({ ...settings, guardianEmail: event.target.value })}
              placeholder="e.g. guardian@email.com"
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-300">
            API status: STT proxy + Gemini AI enabled when keys are configured.
          </div>
          <Button className="w-full" onClick={() => setView('home')}>
            Save & Return
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="p-4 space-y-4">
      {view === 'home' && renderHome()}
      {view === 'monitor' && renderMonitor()}
      {view === 'alert' && renderAlert()}
      {view === 'safe' && renderSafe()}
      {view === 'history' && renderHistory()}
      {view === 'settings' && renderSettings()}
    </div>
  )
}
