import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export const geminiModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
})

/** Structured JSON output for /api/scan — consistent field shapes */
export const geminiScanModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: {
      type: SchemaType.OBJECT,
      properties: {
        score: { type: SchemaType.INTEGER },
        flags: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        recommendation: { type: SchemaType.STRING },
      },
      required: ['score', 'flags', 'recommendation'],
    },
  },
})