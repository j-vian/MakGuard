import { NextRequest, NextResponse } from 'next/server'
import { generateScanContent, generateScanMultimodal } from '@/lib/gemini'
import type { ScanMultimodalPart } from '@/lib/gemini'
import { SCAN_THREAT_TAGS, parseScanResult } from '@/lib/scan'

const MAX_MESSAGE_LENGTH = 3000

const SYSTEM_PROMPT = `You are MakGuard, a Malaysian financial scam detection AI.
Analyze the provided message and determine if it is a scam.

Return JSON with exactly these fields:
- risk_score: integer 0-100
- confidence: "low" | "medium" | "high"
- threat_tags: array of snake_case tags (use ONLY values from the list below; include all that apply)
- explanation: written directly to the user, referencing specific words or phrases from their actual message

EXPLANATION RULES:
- Talk directly to the user, not about the message
- Quote or reference specific words you spotted in the message
- If safe: describe what the message is actually about, then confirm it is safe
- If scam: name exactly which tricks the scammer is using, then tell the user what not to do
- Maximum 3 sentences, no jargon
- Safe example: "This looks like a friendly reminder from someone you know about a small debt of RM5. There are no suspicious links, urgency tactics, or requests for personal information. You can safely reply or transfer the amount to your friend."
- Scam example: "This message is impersonating Maybank and using the word URGENT to pressure you into clicking a fake link. The URL maybank2u-secure-verify.com is not a real Maybank site and is designed to steal your login credentials. Do not click the link — real banks never suspend accounts via SMS this way."

Allowed threat_tags (snake_case only):
${SCAN_THREAT_TAGS.map((t) => `- ${t}`).join('\n')}

Scoring guide:
- 0 to 30: Safe, no scam indicators
- 31 to 60: Suspicious, some scam patterns detected
- 61 to 85: Likely scam, strong indicators present
- 86 to 100: Definite scam, multiple confirmed patterns

Tag mapping hints:
- bank_impersonation: fake bank messages (Maybank, CIMB, etc.)
- urgency_tactics: account frozen, act now, deadlines
- phishing_link: suspicious URLs or click-here links
- government_impersonation: LHDN, PDRM, Bank Negara, SSM impersonation
- fake_prize: you won a prize/lottery
- otp_pin_request: asks for OTP, PIN, TAC, password
- investment_scam: guaranteed returns, unit trust/crypto schemes
- urgent_money_transfer: rush payment or transfer
- emotional_manipulation: fear, guilt, or pressure tactics`

const CALL_GUARD_SYSTEM_PROMPT = `You are MakGuard Call Guard, a Malaysian financial scam detection AI.
Analyze a LIVE conversation transcript (or audio from a video call) and determine if the OTHER party is using scam tactics.

Return JSON with exactly these fields:
- risk_score: integer 0-100
- confidence: "low" | "medium" | "high"
- threat_tags: array of snake_case tags (use ONLY values from the list below; include all that apply)
- explanation: written directly to the user, quoting specific words the caller said

EXPLANATION RULES:
- Assume the user is the potential victim on the call
- Quote or reference specific phrases from the transcript
- If safe: say the conversation sounds normal so far
- If scam: name the tactics (fake bank officer, OTP harvest, urgent transfer, etc.) and tell the user what NOT to do
- Maximum 3 sentences, no jargon
- Scam example: "The caller claimed your Maybank account is frozen and asked for your TAC code — real banks never ask for TAC over a call. Hang up and call the number on your bank card."

Allowed threat_tags (snake_case only):
${SCAN_THREAT_TAGS.map((t) => `- ${t}`).join('\n')}

Scoring guide:
- 0 to 30: Safe, no scam indicators in speech
- 31 to 60: Suspicious patterns (pressure, vague authority)
- 61 to 85: Likely phone scam — strong indicators
- 86 to 100: Definite scam — multiple confirmed patterns (OTP request + urgent transfer + impersonation)

Focus on spoken scam patterns: bank/government impersonation, OTP/TAC/PIN requests, urgent transfers, safe-account tricks, investment guarantees, remote-access pressure.

Threatening coercion (e.g. "give me your money", "you will be arrested", "transfer now or else") directed at the listener in a financial or authority context should score at least 75 unless clearly a joke.

Educational or neutral discussion (presentations, training, news, "how scams work", "types of scamming") without pressuring the listener to act should score 0–35 even if words like scam, fraud, or bank appear.`

function truncateMessage(text: string): string {
  if (text.length <= MAX_MESSAGE_LENGTH) return text
  return `${text.slice(0, MAX_MESSAGE_LENGTH)}…`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const message =
      typeof body.message === 'string' ? truncateMessage(body.message.trim()) : ''
    const imageData =
      typeof body.image_data === 'string' ? body.image_data : undefined
    const audioData =
      typeof body.audio_data === 'string' ? body.audio_data : undefined
    const pageUrl =
      typeof body.page_url === 'string' ? body.page_url.trim() : undefined
    const source = typeof body.source === 'string' ? body.source : undefined

    const isCallGuard = source === 'call_guard'

    if (!message && !imageData && !audioData) {
      return NextResponse.json(
        { error: 'Message, image, or audio is required' },
        { status: 400 }
      )
    }

    const contextLines: string[] = []
    if (isCallGuard && pageUrl) {
      contextLines.push(
        `Context: Live call on ${pageUrl}. Analyze what the other party said for Malaysian financial scam tactics.`
      )
    }
    if (isCallGuard) {
      contextLines.push(
        'This is Call Guard passive listening — keep the explanation urgent, concise, and actionable for an on-call alert.'
      )
    }
    if (source === 'extension' && pageUrl) {
      contextLines.push(
        `Context: This text was passively extracted from a web page at ${pageUrl}. Focus on scam indicators in the visible page content.`
      )
    }
    if (source === 'extension') {
      contextLines.push(
        'The user did not manually submit this — keep the explanation concise and actionable for a passive browser alert.'
      )
    }

    const contextBlock =
      contextLines.length > 0 ? `\n\n${contextLines.join('\n')}` : ''

    const systemPrompt = isCallGuard ? CALL_GUARD_SYSTEM_PROMPT : SYSTEM_PROMPT

    let responseText: string

    if (audioData && isCallGuard) {
      const mimeMatch = audioData.match(/^data:(audio\/[\w+.-]+);base64,/)
      const mimeType = mimeMatch?.[1] ?? 'audio/webm'
      const base64Data = audioData.replace(/^data:audio\/[\w+.-]+;base64,/, '')

      const parts: ScanMultimodalPart[] = [
        { text: systemPrompt + contextBlock },
        { inlineData: { mimeType, data: base64Data } },
      ]

      if (message) {
        parts.push({
          text: `Recent transcript from the call:\n"${message}"\n\nAnalyze the audio and transcript together for scam indicators.`,
        })
      } else {
        parts.push({
          text: 'Listen to this call audio clip. Transcribe what the other party said and return the standard JSON risk assessment for a live phone/video scam.',
        })
      }

      responseText = await generateScanMultimodal(parts)
    } else if (imageData) {
      const mimeMatch = imageData.match(/^data:(image\/[\w+.-]+);base64,/)
      const mimeType = mimeMatch?.[1] ?? 'image/jpeg'
      const base64Data = imageData.replace(/^data:image\/[\w+.-]+;base64,/, '')

      const parts: ScanMultimodalPart[] = [
        { text: systemPrompt + contextBlock },
        { inlineData: { mimeType, data: base64Data } },
      ]

      if (message) {
        parts.push({ text: `Analyze this message:\n"${message}"` })
      } else {
        parts.push({
          text: 'Analyze this screenshot for scam indicators. Return the standard JSON risk assessment.',
        })
      }

      responseText = await generateScanMultimodal(parts)
    } else {
      const label = isCallGuard
        ? 'Analyze this live call transcript'
        : 'Analyze this message'
      const prompt = `${systemPrompt}${contextBlock}\n\n${label}:\n"${message}"`
      responseText = await generateScanContent(prompt)
    }

    const cleanedResponse = responseText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim()

    const scanResult = parseScanResult(JSON.parse(cleanedResponse))

    return NextResponse.json(scanResult, { status: 200 })
  } catch (error: unknown) {
    console.error('Scan API error:', error)
    const upstreamStatus =
      error != null && typeof error === 'object' && 'status' in error
        ? (error as Record<string, unknown>).status
        : undefined

    if (upstreamStatus === 429) {
      return NextResponse.json(
        {
          error:
            'Gemini API quota exceeded — free tier limit reached. Please wait a minute and try again.',
        },
        { status: 429 }
      )
    }
    if (upstreamStatus === 503) {
      return NextResponse.json(
        {
          error:
            'Gemini AI is experiencing high demand right now. Please try again in a few seconds.',
        },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to analyze message' },
      { status: 500 }
    )
  }
}
