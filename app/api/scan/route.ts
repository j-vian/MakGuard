import { NextRequest, NextResponse } from 'next/server'
import { geminiModel } from '@/lib/gemini'
import { ScanResult } from '@/lib/types'

const SYSTEM_PROMPT = `You are MakGuard, a Malaysian financial scam detection AI.
Analyze the provided message and determine if it is a scam.

You MUST respond with ONLY a valid JSON object in this exact format, no other text:
{
  "risk_score": <integer between 0 and 100>,
  "confidence": <"low" | "medium" | "high">,
  "threat_tags": <array of strings describing detected threats>,
  "explanation": <string explaining why this is or is not a scam in simple English>
}

Scoring guide:
- 0 to 30: Safe, no scam indicators
- 31 to 60: Suspicious, some scam patterns detected  
- 61 to 85: Likely scam, strong indicators present
- 86 to 100: Definite scam, multiple confirmed patterns

Common Malaysian scam patterns to detect:
- Urgency and panic language (account frozen, act now, last warning)
- Bank impersonation (Maybank, CIMB, Bank Islam, RHB, Hong Leong)
- Government impersonation (LHDN, PDRM, Bank Negara, SSM)
- Fake prize or reward claims
- Requests to click suspicious links
- Requests to transfer money urgently
- Requests to share OTP or PIN
- Investment schemes with guaranteed returns
- Emotional manipulation and fear tactics`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const prompt = `${SYSTEM_PROMPT}\n\nAnalyze this message:\n"${message}"`

    const result = await geminiModel.generateContent(prompt)
    const responseText = result.response.text()

    const cleanedResponse = responseText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim()

    const scanResult: ScanResult = JSON.parse(cleanedResponse)

    return NextResponse.json(scanResult, { status: 200 })

  } catch (error) {
    console.error('Scan API error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze message' },
      { status: 500 }
    )
  }
}