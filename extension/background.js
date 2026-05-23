importScripts('shared.js')

const CACHE_TTL_MS = 5 * 60 * 1000
const scanCache = new Map()

async function isEnabled() {
  const data = await chrome.storage.local.get(['enabled'])
  return data.enabled !== false
}

function cacheKey(url, textSnippet) {
  return `${url}::${textSnippet.slice(0, 120)}`
}

function getCached(key) {
  const entry = scanCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    scanCache.delete(key)
    return null
  }
  return entry.result
}

function setCache(key, result) {
  scanCache.set(key, { ts: Date.now(), result })
  if (scanCache.size > 100) {
    const oldest = scanCache.keys().next().value
    scanCache.delete(oldest)
  }
}

async function scanPage(payload) {
  const { url, text, urls, tabId } = payload
  const shared = globalThis.MakGuardShared

  if (!(await isEnabled())) return
  if (shared.shouldSkipUrl(url)) return

  const message = shared.truncateText(text, 3000)
  if (!shared.passesHeuristicPrefilter(message, urls)) return

  const key = cacheKey(url, message)
  const cached = getCached(key)
  if (cached) {
    await applyScanResult(tabId, cached)
    return
  }

  try {
    const apiBase = shared.getApiBase()
    const res = await fetch(`${apiBase}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        page_url: url,
        source: 'extension',
      }),
    })

    if (!res.ok) {
      console.warn('[MakGuard] Scan API error:', res.status)
      return
    }

    const result = await res.json()
    setCache(key, result)
    await applyScanResult(tabId, result)
  } catch (err) {
    console.warn('[MakGuard] Scan failed:', err)
  }
}

async function applyScanResult(tabId, result) {
  const shared = globalThis.MakGuardShared
  const score = result.risk_score ?? 0
  const color = shared.riskBadgeColor(score)

  if (tabId != null) {
    await chrome.action.setBadgeText({ tabId, text: score > 30 ? '!' : '' })
    await chrome.action.setBadgeBackgroundColor({ tabId, color })

    if (score >= 61) {
      chrome.tabs.sendMessage(tabId, {
        type: 'MAKguard_ALERT',
        result,
      }).catch(() => {})
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'MAKguard_PAGE_CONTENT') {
    const tabId = sender.tab?.id
    scanPage({ ...message.payload, tabId }).then(() => sendResponse({ ok: true }))
    return true
  }

  if (message.type === 'MAKguard_GET_STATUS') {
    isEnabled().then((enabled) => sendResponse({ enabled }))
    return true
  }

  if (message.type === 'MAKguard_SET_ENABLED') {
    chrome.storage.local.set({ enabled: message.enabled }).then(() => {
      if (!message.enabled) {
        chrome.action.setBadgeText({ text: '' })
      }
      sendResponse({ enabled: message.enabled })
    })
    return true
  }
})

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ enabled: true })
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    chrome.action.setBadgeText({ tabId, text: '' })
  }
})
