import type { ScanResult } from '@/lib/types'

/** Allowed snake_case tags returned to clients */
export const SCAN_THREAT_TAGS = [
  'bank_impersonation',
  'urgency_tactics',
  'phishing_link',
  'government_impersonation',
  'fake_prize',
  'otp_pin_request',
  'investment_scam',
  'urgent_money_transfer',
  'emotional_manipulation',
] as const

const TAG_ALIASES: Record<string, (typeof SCAN_THREAT_TAGS)[number]> = {
  bank_impersonation: 'bank_impersonation',
  'bank impersonation': 'bank_impersonation',
  urgency_tactics: 'urgency_tactics',
  'urgency tactics': 'urgency_tactics',
  urgency: 'urgency_tactics',
  phishing_link: 'phishing_link',
  'phishing link': 'phishing_link',
  phishing: 'phishing_link',
  government_impersonation: 'government_impersonation',
  'government impersonation': 'government_impersonation',
  fake_prize: 'fake_prize',
  'fake prize': 'fake_prize',
  otp_pin_request: 'otp_pin_request',
  'otp pin request': 'otp_pin_request',
  otp_request: 'otp_pin_request',
  investment_scam: 'investment_scam',
  'investment scam': 'investment_scam',
  urgent_money_transfer: 'urgent_money_transfer',
  emotional_manipulation: 'emotional_manipulation',
}

function normalizeTag(raw: string): (typeof SCAN_THREAT_TAGS)[number] | null {
  const key = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  const snake = key.replace(/\s+/g, '_')
  return TAG_ALIASES[key] ?? TAG_ALIASES[snake] ?? null
}

export function parseScanResult(raw: unknown): ScanResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Scan response is not an object')
  }

  const data = raw as Record<string, unknown>

  const risk_score = Math.round(Number(data.risk_score))
  if (!Number.isFinite(risk_score) || risk_score < 0 || risk_score > 100) {
    throw new Error('Invalid risk_score')
  }

  const confidence = data.confidence
  if (confidence !== 'low' && confidence !== 'medium' && confidence !== 'high') {
    throw new Error('Invalid confidence')
  }

  if (!Array.isArray(data.threat_tags)) {
    throw new Error('Invalid threat_tags')
  }

  const threat_tags = [
    ...new Set(
      data.threat_tags
        .filter((t): t is string => typeof t === 'string')
        .map(normalizeTag)
        .filter((t): t is (typeof SCAN_THREAT_TAGS)[number] => t !== null),
    ),
  ]

  const explanation =
    typeof data.explanation === 'string' ? data.explanation.trim() : ''
  if (!explanation) {
    throw new Error('Invalid explanation')
  }

  return {
    risk_score,
    confidence,
    threat_tags,
    explanation,
  }
}
