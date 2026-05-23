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

const SKIP_URL_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'devtools://',
  'https://makguard.vercel.app/',
  'http://localhost:3000/',
]

const API_BASE = 'https://makguard.vercel.app'
const API_BASE_DEV = 'http://localhost:3000'

function shouldSkipUrl(url) {
  if (!url) return true
  return SKIP_URL_PREFIXES.some((prefix) => url.startsWith(prefix))
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
    SKIP_URL_PREFIXES,
    API_BASE,
    API_BASE_DEV,
    shouldSkipUrl,
    passesHeuristicPrefilter,
    truncateText,
    getApiBase,
    riskBadgeColor,
  }
}
