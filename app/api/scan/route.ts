import { NextRequest, NextResponse } from 'next/server'
import { generateScanContent, generateScanMultimodal } from '@/lib/gemini'
import type { ScanMultimodalPart } from '@/lib/gemini'
import { SCAN_THREAT_TAGS, parseScanResult } from '@/lib/scan'

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const message =
      typeof body.message === 'string' ? body.message.trim() : ''
    const imageData =
      typeof body.image_data === 'string' ? body.image_data : undefined

    if (!message && !imageData) {
      return NextResponse.json(
        { error: 'Message or image is required' },
        { status: 400 }
      )
    }

    let responseText: string

    if (imageData) {
      const mimeMatch = imageData.match(/^data:(image\/[\w+.-]+);base64,/)
      const mimeType = mimeMatch?.[1] ?? 'image/jpeg'
      const base64Data = imageData.replace(/^data:image\/[\w+.-]+;base64,/, '')

      const parts: ScanMultimodalPart[] = [
        { text: SYSTEM_PROMPT },
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
      const prompt = `${SYSTEM_PROMPT}\n\nAnalyze this message:\n"${message}"`
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
