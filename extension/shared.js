/** @type {readonly string[]} */
const SUSPICIOUS_PATTERNS = [
  'maybank',
  'cimb',
  'public bank',
  'rhb',
  'hong leong',
  'ambank',
  'bank islam',
  'bank rakyat',
  'lhdn',
  'pdrm',
  'bank negara',
  'account suspended',
  'account frozen',
  'verify now',
  'verify account',
  'urgent',
  'act now',
  'immediately',
  'otp',
  ' tac ',
  'tac code',
  'pin number',
  'click here',
  'you have won',
  'congratulations',
  'prize',
  'lottery',
  'guaranteed return',
  'investment scheme',
  'transfer now',
  'send money',
  'rm ',
  'ringgit',
]

const SUSPICIOUS_TLDS = ['.xyz', '.top', '.click', '.tk', '.ml', '.ga', '.cf', '.gq']

const SYSTEM_URL_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'devtools://',
]

const OWN_APP_HOSTS = new Set(['makguard.vercel.app', 'localhost'])

const API_BASE = 'https://makguard.vercel.app'
const API_BASE_DEV = 'http://localhost:3000'

/** In-memory session cache TTL (not persisted to chrome.storage) */
const SESSION_CACHE_TTL_MS = 30 * 60 * 1000

function shouldSkipUrl(url) {
  if (!url) return true
  if (SYSTEM_URL_PREFIXES.some((prefix) => url.startsWith(prefix))) return true

  try {
    const parsed = new URL(url)
    if (!OWN_APP_HOSTS.has(parsed.hostname)) return false

    // Always scan demo/test pages hosted on our domain
    if (parsed.pathname.startsWith('/demo/')) return false

    // Skip our own app UI (landing + dashboard tools) to avoid redundant scans
    return (
      parsed.pathname === '/' ||
      parsed.pathname.startsWith('/dashboard') ||
      parsed.pathname.startsWith('/shield') ||
      parsed.pathname.startsWith('/report')
    )
  } catch {
    return false
  }
}

function passesHeuristicPrefilter(text, urls) {
  const lower = text.toLowerCase()
  if (lower.length < 50) return false

  const textHit = SUSPICIOUS_PATTERNS.some((p) => lower.includes(p))
  const urlHit = urls.some((u) => {
    const ul = u.toLowerCase()
    return SUSPICIOUS_TLDS.some((tld) => ul.includes(tld)) || SUSPICIOUS_PATTERNS.some((p) => ul.includes(p))
  })

  return textHit || urlHit
}

function truncateText(text, maxLen) {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.slice(0, maxLen)}…`
}

function hashString(value) {
  let hash = 5381
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i)
  }
  return (hash >>> 0).toString(36)
}

/** Fingerprint from email-like lines, not static Gmail chrome at the top of innerText */
function contentFingerprint(text) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 12)

  const suspiciousLines = lines.filter((line) => {
    const lower = line.toLowerCase()
    return (
      SUSPICIOUS_PATTERNS.some((p) => lower.includes(p)) ||
      SUSPICIOUS_TLDS.some((tld) => lower.includes(tld))
    )
  })

  const sample =
    suspiciousLines.length > 0
      ? suspiciousLines.join('\n').slice(0, 1200)
      : lines.slice(0, 25).join('\n').slice(0, 1200)

  if (!sample) {
    return hashString(text.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 800))
  }

  return hashString(sample.toLowerCase())
}

function buildCacheKey(url, text) {
  return `${url}::${contentFingerprint(text)}`
}

/**
 * Dynamic views (Gmail inbox list) must always get a live AI scan.
 * Stable views (opened email thread, demo pages, normal sites) may use session cache.
 */
function isStableScanContext(url) {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== 'mail.google.com') return true

    const hash = parsed.hash || ''
    if (!hash || hash === '#inbox') return false

    if (hash.startsWith('#inbox/') && hash.length > 8) return true

    return false
  } catch {
    return true
  }
}

const CACHE_ENTITY_TERMS = [
  'bsn',
  'maybank',
  'cimb',
  'public bank',
  'rhb',
  'hong leong',
  'ambank',
  'bank islam',
  'bank rakyat',
  'lhdn',
  'pdrm',
  'bank negara',
]

/** Cached explanation must not mention entities absent from current page text */
function cacheMatchesCurrentContent(cachedResult, message) {
  if (!cachedResult || !message) return false

  const lower = message.toLowerCase()
  const explanation = String(cachedResult.explanation ?? '').toLowerCase()

  for (const term of CACHE_ENTITY_TERMS) {
    if (explanation.includes(term) && !lower.includes(term)) {
      return false
    }
  }

  return true
}

function getApiBase() {
  return API_BASE
}

function riskBadgeColor(score) {
  if (score <= 30) return '#22c55e'
  if (score <= 60) return '#f59e0b'
  return '#ef4444'
}

// Export for service worker / content scripts (no bundler)
if (typeof globalThis !== 'undefined') {
  globalThis.MakGuardShared = {
    SUSPICIOUS_PATTERNS,
    SUSPICIOUS_TLDS,
    SYSTEM_URL_PREFIXES,
    OWN_APP_HOSTS,
    API_BASE,
    API_BASE_DEV,
    shouldSkipUrl,
    passesHeuristicPrefilter,
    truncateText,
    contentFingerprint,
    buildCacheKey,
    cacheMatchesCurrentContent,
    isStableScanContext,
    SESSION_CACHE_TTL_MS,
    getApiBase,
    riskBadgeColor,
  }
}
