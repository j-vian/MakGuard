import type { ScanResult } from '@/lib/types'

export function parseScanResult(raw: unknown): ScanResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Scan response is not an object')
  }

  const data = raw as Record<string, unknown>

  const score = Math.round(Number(data.score))
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error('Invalid score')
  }

  if (!Array.isArray(data.flags)) {
    throw new Error('Invalid flags')
  }

  const flags = [
    ...new Set(
      data.flags
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
    ),
  ]

  const recommendation =
    typeof data.recommendation === 'string' ? data.recommendation.trim() : ''
  if (!recommendation) {
    throw new Error('Invalid recommendation')
  }

  return {
    score,
    flags,
    recommendation,
  }
}
