import { NextRequest, NextResponse } from 'next/server'
import { geminiScanModel } from '@/lib/gemini'
import { parseScanResult } from '@/lib/scan'

const SYSTEM_PROMPT = `You are a scam detection AI protecting elderly Malaysians from phone fraud.
Analyze the call transcript or message for: urgency/pressure, fake authority (bank/police), financial manipulation (transfer now, account blocked), fear tactics, secrecy demands, personal data requests.

Return only JSON with exactly these fields:
- score: integer 0-100
- flags: array of short strings
- recommendation: one sentence in simple English

Rules:
- 0 to 34: SAFE (no scam indicators detected)
- 35 to 64: SUSPICIOUS (some indicators detected)
- 65 to 100: SCAM (strong indicators)
- Never claim 100% safe; prefer "No scam indicators detected" wording.`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const message =
      typeof body.message === 'string' ? body.message :
      typeof body.transcript === 'string' ? body.transcript :
      typeof body.transcript_chunk === 'string' ? body.transcript_chunk :
      ''

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message or transcript is required' },
        { status: 400 }
      )
    }

    const prompt = `${SYSTEM_PROMPT}\n\nAnalyze this transcript:\n"${message}"`

    const result = await geminiScanModel.generateContent(prompt)
    const responseText = result.response.text()

    const cleanedResponse = responseText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim()

    const scanResult = parseScanResult(JSON.parse(cleanedResponse))

    return NextResponse.json(scanResult, { status: 200 })

  } catch (error) {
    console.error('Scan API error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze message' },
      { status: 500 }
    )
  }
}