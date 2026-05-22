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
  },
})