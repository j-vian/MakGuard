import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_STT_URL = 'https://speech.googleapis.com/v1/speech:recognize'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { audioBase64, sampleRateHertz, languageCode } = body

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return NextResponse.json(
        { error: 'audioBase64 is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GOOGLE_STT_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_STT_API_KEY is not configured' },
        { status: 500 }
      )
    }

    const response = await fetch(`${GOOGLE_STT_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          encoding: 'WEBM_OPUS',
          sampleRateHertz: Number(sampleRateHertz) || 48000,
          languageCode: languageCode || 'en-MY',
          enableAutomaticPunctuation: true,
        },
        audio: { content: audioBase64 },
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message || 'STT request failed' },
        { status: response.status }
      )
    }

    const transcript = Array.isArray(data.results)
      ? data.results
          .map((r: { alternatives?: Array<{ transcript?: string }> }) =>
            r.alternatives?.[0]?.transcript || ''
          )
          .join(' ')
          .trim()
      : ''

    return NextResponse.json({ transcript }, { status: 200 })
  } catch (error) {
    console.error('STT API error:', error)
    return NextResponse.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 }
    )
  }
}
