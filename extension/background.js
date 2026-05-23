importScripts('shared.js')

const LEGACY_STORAGE_CACHE_KEY = 'makguardScanCache'

const memoryCache = new Map()
/** @type {Map<number, { pageKey: string | null, scanned: boolean, alertShown: boolean }>} */
const tabSessions = new Map()

function getCacheTtlMs() {
  return globalThis.MakGuardShared.SESSION_CACHE_TTL_MS
}

async function isEnabled() {
  const data = await chrome.storage.local.get(['enabled'])
  return data.enabled !== false
}

function pageKeyFromUrl(url) {
  return url
}

function getTabSession(tabId) {
  return tabSessions.get(tabId) ?? { pageKey: null, scanned: false, alertShown: false }
}

function resetTabSession(tabId, pageKey) {
  tabSessions.set(tabId, { pageKey, scanned: false, alertShown: false })
}

function markTabScanned(tabId, pageKey) {
  tabSessions.set(tabId, { pageKey, scanned: true, alertShown: false })
}

function markAlertShown(tabId, pageKey) {
  tabSessions.set(tabId, { pageKey, scanned: true, alertShown: true })
}

function getMemoryCached(cacheKey) {
  const entry = memoryCache.get(cacheKey)
  if (!entry) return null
  if (Date.now() - entry.ts > getCacheTtlMs()) {
    memoryCache.delete(cacheKey)
    return null
  }
  return entry.result
}

function setMemoryCached(url, cacheKey, result) {
  const shared = globalThis.MakGuardShared
  if (!shared.isStableScanContext(url)) return

  memoryCache.set(cacheKey, { ts: Date.now(), result })
  if (memoryCache.size > 150) {
    const oldest = memoryCache.keys().next().value
    memoryCache.delete(oldest)
  }
}

function deleteMemoryCacheKey(cacheKey) {
  memoryCache.delete(cacheKey)
}

function clearMemoryCacheForUrl(url) {
  const prefix = `${url}::`
  for (const key of memoryCache.keys()) {
    if (key === url || key.startsWith(prefix)) {
      memoryCache.delete(key)
    }
  }
}

function clearAllMemoryCache() {
  memoryCache.clear()
}

async function purgeLegacyStorageCache() {
  await chrome.storage.local.remove([LEGACY_STORAGE_CACHE_KEY])
}

function resolveCachedResult(url, cacheKey, message) {
  const shared = globalThis.MakGuardShared

  if (!shared.isStableScanContext(url)) {
    return null
  }

  const memoryHit = getMemoryCached(cacheKey)
  if (memoryHit && shared.cacheMatchesCurrentContent(memoryHit, message)) {
    return memoryHit
  }

  if (memoryHit) {
    deleteMemoryCacheKey(cacheKey)
  }

  return null
}

async function tryInstantCache(tabId, payload) {
  const shared = globalThis.MakGuardShared
  const { url, text, urls } = payload
  const pageKey = pageKeyFromUrl(url)
  const message = shared.truncateText(text, 3000)

  if (!message.trim()) {
    return false
  }

  if (!shared.isStableScanContext(url)) {
    return false
  }

  if (!shared.passesHeuristicPrefilter(message, urls)) {
    clearMemoryCacheForUrl(url)
    markTabScanned(tabId, pageKey)
    await chrome.action.setBadgeText({ tabId, text: '' })
    return false
  }

  const cacheKey = shared.buildCacheKey(url, message)
  const cached = resolveCachedResult(url, cacheKey, message)
  if (cached) {
    markTabScanned(tabId, pageKey)
    await applyScanResult(tabId, pageKey, cached)
    return true
  }

  return false
}

async function scanPage(payload) {
  const { url, text, urls, tabId, forceFresh } = payload
  const shared = globalThis.MakGuardShared

  if (!(await isEnabled())) return
  if (shared.shouldSkipUrl(url)) return
  if (tabId == null) return

  const pageKey = pageKeyFromUrl(url)

  if (forceFresh) {
    resetTabSession(tabId, pageKey)
    clearMemoryCacheForUrl(url)
  }

  const session = getTabSession(tabId)
  if (!forceFresh && session.pageKey === pageKey && session.scanned) {
    return
  }

  const message = shared.truncateText(text, 3000)
  if (!message.trim()) return

  if (!shared.passesHeuristicPrefilter(message, urls)) {
    markTabScanned(tabId, pageKey)
    clearMemoryCacheForUrl(url)
    await chrome.action.setBadgeText({ tabId, text: '' })
    return
  }

  markTabScanned(tabId, pageKey)
  const cacheKey = shared.buildCacheKey(url, message)

  if (!forceFresh) {
    const cached = resolveCachedResult(url, cacheKey, message)
    if (cached) {
      await applyScanResult(tabId, pageKey, cached)
      return
    }
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
    setMemoryCached(url, cacheKey, result)
    await applyScanResult(tabId, pageKey, result)
  } catch (err) {
    console.warn('[MakGuard] Scan failed:', err)
  }
}

async function sendAlertToTab(tabId, result, attempt = 0) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'MAKguard_ALERT',
      result,
    })
  } catch {
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 300))
      await sendAlertToTab(tabId, result, attempt + 1)
    }
  }
}

async function applyScanResult(tabId, pageKey, result) {
  const shared = globalThis.MakGuardShared
  const score = result.risk_score ?? 0
  const color = shared.riskBadgeColor(score)
  const session = getTabSession(tabId)

  await chrome.action.setBadgeText({ tabId, text: score > 30 ? '!' : '' })
  await chrome.action.setBadgeBackgroundColor({ tabId, color })

  if (score >= 61 && session.pageKey === pageKey && !session.alertShown) {
    markAlertShown(tabId, pageKey)
    await sendAlertToTab(tabId, result)
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'MAKguard_PAGE_CONTENT') {
    const tabId = sender.tab?.id
    scanPage({ ...message.payload, tabId }).then(() => sendResponse({ ok: true }))
    return true
  }

  if (message.type === 'MAKguard_TRY_INSTANT_CACHE') {
    const tabId = sender.tab?.id
    const payload = message.payload
    if (tabId == null || !payload?.url) {
      sendResponse({ hit: false })
      return true
    }

    tryInstantCache(tabId, payload).then((hit) => sendResponse({ hit }))
    return true
  }

  if (message.type === 'MAKguard_ALERT_DISMISSED') {
    const tabId = sender.tab?.id
    const pageKey = message.payload?.url
    if (tabId != null && pageKey) {
      const session = getTabSession(tabId)
      if (session.pageKey === pageKeyFromUrl(pageKey)) {
        markAlertShown(tabId, pageKeyFromUrl(pageKey))
      }
    }
    sendResponse({ ok: true })
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

chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.local.set({ enabled: true })
  clearAllMemoryCache()
  purgeLegacyStorageCache()
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setBadgeText({ tabId, text: '' })
    const nextKey = changeInfo.url ?? tab?.url ?? getTabSession(tabId).pageKey
    if (nextKey) {
      resetTabSession(tabId, nextKey)
    }
  }

  if (changeInfo.url) {
    const session = getTabSession(tabId)
    if (session.pageKey !== changeInfo.url) {
      resetTabSession(tabId, changeInfo.url)
    }
  }
})

chrome.tabs.onRemoved.addListener((tabId) => {
  tabSessions.delete(tabId)
})
