import {
  GoogleGenerativeAI,
  SchemaType,
  type GenerationConfig,
} from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const scanGenerationConfig: GenerationConfig = {
  responseMimeType: 'application/json',
  responseSchema: {
    type: SchemaType.OBJECT,
    properties: {
      risk_score: { type: SchemaType.INTEGER },
      confidence: {
        type: SchemaType.STRING,
        format: 'enum',
        enum: ['low', 'medium', 'high'],
      },
      threat_tags: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.STRING },
      },
      explanation: { type: SchemaType.STRING },
    },
    required: ['risk_score', 'confidence', 'threat_tags', 'explanation'],
  },
}

/** Prefer models with higher free-tier limits and lower congestion */
const SCAN_MODEL_FALLBACKS = [
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
] as const

function getUpstreamStatus(error: unknown): number | undefined {
  if (error != null && typeof error === 'object' && 'status' in error) {
    const status = (error as Record<string, unknown>).status
    return typeof status === 'number' ? status : undefined
  }
  return undefined
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const geminiModel = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
})

/**
 * Run scan with model fallbacks and short retries on 503 (high demand).
 * Tries gemini-2.0-flash first (1,500 free RPD), then lighter / backup models.
 */
export type ScanMultimodalPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }

async function runScanGeneration(
  content: string | ScanMultimodalPart[]
): Promise<string> {
  let lastError: unknown

  for (const modelName of SCAN_MODEL_FALLBACKS) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: scanGenerationConfig,
    })

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await model.generateContent(content)
        const text = result.response.text()
        if (text?.trim()) return text
        throw new Error('Empty response from Gemini')
      } catch (error) {
        lastError = error
        const status = getUpstreamStatus(error)

        if (status === 503 && attempt === 0) {
          await sleep(2000)
          continue
        }

        if (status === 503 || status === 404 || status === 429) {
          break
        }

        throw error
      }
    }
  }

  throw lastError ?? new Error('All Gemini scan models failed')
}

export async function generateScanContent(prompt: string): Promise<string> {
  return runScanGeneration(prompt)
}

export async function generateScanMultimodal(
  parts: ScanMultimodalPart[]
): Promise<string> {
  return runScanGeneration(parts)
}
