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

/** Call Guard — browser-based meeting platforms (web client only) */
const CALL_GUARD_MEETING_HOSTS = [
  'meet.google.com',
  'teams.microsoft.com',
  'teams.live.com',
]

/** Minimum gap between routine transcript scans */
const CALL_GUARD_SCAN_DEBOUNCE_MS = 4_000
/** Minimum gap between urgent / keyword-triggered scans */
const CALL_GUARD_FAST_SCAN_MS = 1_200
/** Tab audio chunk length sent to Gemini (captures remote caller in headphones) */
const CALL_GUARD_AUDIO_CHUNK_MS = 4_000
const CALL_GUARD_TRANSCRIPT_MAX = 3000
const CALL_GUARD_ALERT_COOLDOWN_MS = 25_000

/** Narrow phrases → show red alert immediately (demo / coercion lines) */
const CALL_GUARD_INSTANT_ALERT_PATTERNS = [
  'give me your money',
  'give me the money',
  'give me money now',
  'you will be arrested',
  "you'll be arrested",
  'or you will be arrested',
  'transfer now or else',
  'send the money now',
]

/** Direct coercion — fast scan + amber “verifying” banner (not instant red alert). */
const CALL_GUARD_URGENT_PATTERNS = [
  'give me your money',
  'give me the money',
  'give me money',
  'you will be arrested',
  "you'll be arrested",
  'or you will be arrested',
  'or youll be arrested',
  'send money now',
  'transfer now',
  'transfer immediately',
  'account frozen',
  'account suspended',
  'otp code',
  ' tac code',
  'tac code',
  'give me your pin',
  'give me your password',
  'safe account',
]

/** Wait before treating urgent speech as needing a confirmed API alert. */
const CALL_GUARD_ALERT_CONFIRM_MS = 5_500

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

function isCallGuardMeetingUrl(url) {
  if (!url) return false
  try {
    const host = new URL(url).hostname.toLowerCase()
    return CALL_GUARD_MEETING_HOSTS.some(
      (h) => host === h || host.endsWith(`.${h}`)
    )
  } catch {
    return false
  }
}

function hasUrgentCallGuardKeywords(text) {
  const lower = String(text || '').toLowerCase()
  return CALL_GUARD_URGENT_PATTERNS.some((p) => lower.includes(p))
}

function hasDirectCoercionPattern(text) {
  const lower = String(text || '').toLowerCase()
  return CALL_GUARD_INSTANT_ALERT_PATTERNS.some((p) => lower.includes(p))
}

/** Looser gate for live call transcripts — enough speech or scam keywords */
function passesCallGuardHeuristic(text) {
  const lower = text.toLowerCase().trim()
  if (hasDirectCoercionPattern(lower) || hasUrgentCallGuardKeywords(lower)) {
    return lower.length >= 12
  }
  if (lower.length < 30) return false
  if (lower.length >= 80) return true
  return SUSPICIOUS_PATTERNS.some((p) => lower.includes(p))
}

function buildCallGuardCacheKey(url, text) {
  return `call::${url}::${contentFingerprint(text)}`
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

async function getApiBaseAsync() {
  try {
    const data = await chrome.storage.local.get(['useLocalApi'])
    if (data.useLocalApi) return API_BASE_DEV
  } catch {
    /* content script may not have storage in some contexts */
  }
  return API_BASE
}

// #region agent log
const DEBUG_LOG_KEY = 'makguardDebug412c85'
const DEBUG_LOG_MAX = 80

function agentDebugLog(location, message, data, hypothesisId) {
  const entry = {
    sessionId: '412c85',
    runId: 'pre-fix',
    hypothesisId,
    location,
    message,
    data: data ?? {},
    timestamp: Date.now(),
  }
  console.log('[MakGuard debug]', location, message, entry.data)
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get([DEBUG_LOG_KEY], (stored) => {
        const list = Array.isArray(stored[DEBUG_LOG_KEY]) ? stored[DEBUG_LOG_KEY] : []
        list.push(entry)
        while (list.length > DEBUG_LOG_MAX) list.shift()
        chrome.storage.local.set({ [DEBUG_LOG_KEY]: list })
      })
    }
  } catch {
    /* ignore */
  }
  fetch('http://127.0.0.1:7365/ingest/5d27478f-eddb-47ce-acb6-2d3d7899d202', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '412c85' },
    body: JSON.stringify(entry),
  }).catch(() => {})
}
// #endregion

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
    CALL_GUARD_MEETING_HOSTS,
    CALL_GUARD_SCAN_DEBOUNCE_MS,
    CALL_GUARD_FAST_SCAN_MS,
    CALL_GUARD_AUDIO_CHUNK_MS,
    CALL_GUARD_ALERT_COOLDOWN_MS,
    CALL_GUARD_URGENT_PATTERNS,
    CALL_GUARD_INSTANT_ALERT_PATTERNS,
    CALL_GUARD_ALERT_CONFIRM_MS,
    CALL_GUARD_TRANSCRIPT_MAX,
    hasDirectCoercionPattern,
    shouldSkipUrl,
    passesHeuristicPrefilter,
    passesCallGuardHeuristic,
    hasUrgentCallGuardKeywords,
    isCallGuardMeetingUrl,
    buildCallGuardCacheKey,
    truncateText,
    contentFingerprint,
    buildCacheKey,
    cacheMatchesCurrentContent,
    isStableScanContext,
    SESSION_CACHE_TTL_MS,
    getApiBase,
    getApiBaseAsync,
    riskBadgeColor,
    agentDebugLog,
  }
}
