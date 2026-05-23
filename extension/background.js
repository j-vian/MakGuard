importScripts('shared.js')

const LEGACY_STORAGE_CACHE_KEY = 'makguardScanCache'

const memoryCache = new Map()
const callGuardCache = new Map()
/** @type {Map<number, { pageKey: string | null, scanned: boolean, alertShown: boolean }>} */
const tabSessions = new Map()
/** @type {Map<number, { alertShown: boolean, lastAlertAt: number }>} */
const callGuardSessions = new Map()
const callGuardScanInFlight = new Set()
/** @type {Map<number, string>} */
const callGuardTabUrls = new Map()

async function ensureOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  })
  if (contexts.length > 0) return
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Capture Google Meet and Teams tab audio for Call Guard scam detection.',
  })
}

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

function getCallGuardSession(tabId) {
  return callGuardSessions.get(tabId) ?? { alertShown: false, lastAlertAt: 0 }
}

async function scanCallGuardTranscript(tabId, payload) {
  const shared = globalThis.MakGuardShared
  const { url, transcript, force, urgent } = payload

  if (!(await isEnabled())) return
  if (tabId == null || !url || !transcript?.trim()) return

  if (!force && !urgent && !shared.passesCallGuardHeuristic(transcript)) {
    // #region agent log
    shared.agentDebugLog('background.js:scanCallGuardTranscript', 'skipped heuristic', {
      transcriptLen: transcript.length,
      force,
      urgent,
    }, 'H6')
    // #endregion
    return
  }

  const inFlightKey = `t:${tabId}`
  if (callGuardScanInFlight.has(inFlightKey)) {
    if (!urgent) return
  }
  callGuardScanInFlight.add(inFlightKey)

  const cacheKey = shared.buildCallGuardCacheKey(url, transcript)
  const cacheTtl = urgent ? 8_000 : getCacheTtlMs()
  const cached = callGuardCache.get(cacheKey)
  if (!urgent && cached && Date.now() - cached.ts < cacheTtl) {
    callGuardScanInFlight.delete(inFlightKey)
    await applyCallGuardResult(tabId, cached.result)
    return
  }

  try {
    const apiBase = await shared.getApiBaseAsync()
    console.log('[MakGuard Call Guard] Transcript scan →', apiBase, { urgent, len: transcript.length })
    const res = await fetch(`${apiBase}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: shared.truncateText(transcript, shared.CALL_GUARD_TRANSCRIPT_MAX),
        page_url: url,
        source: 'call_guard',
      }),
    })

    if (!res.ok) {
      console.warn('[MakGuard Call Guard] Scan API error:', res.status)
      // #region agent log
      shared.agentDebugLog('background.js:scanCallGuardTranscript', 'API error', {
        status: res.status,
        apiBase,
      }, 'H2')
      // #endregion
      return
    }

    let result = await res.json()
    // #region agent log
    shared.agentDebugLog('background.js:scanCallGuardTranscript', 'API result', {
      risk_score: result.risk_score,
      confidence: result.confidence,
      hasError: !!result.error,
      urgent,
      transcriptLen: transcript.length,
    }, 'H1')
    // #endregion
    if (result.error || typeof result.risk_score !== 'number') {
      console.warn('[MakGuard Call Guard] Invalid scan result:', result.error ?? 'missing risk_score')
      return
    }

    if (
      urgent &&
      shared.hasDirectCoercionPattern(transcript) &&
      result.risk_score < 61
    ) {
      result = {
        ...result,
        risk_score: Math.max(result.risk_score, 75),
        confidence: result.confidence === 'low' ? 'medium' : result.confidence,
        explanation:
          result.explanation ||
          'Urgent scam phrases were detected in this call. Do not send money or share verification codes.',
      }
      // #region agent log
      shared.agentDebugLog('background.js:scanCallGuardTranscript', 'urgent score boost', {
        boostedTo: result.risk_score,
      }, 'H1')
      // #endregion
    }

    callGuardCache.set(cacheKey, { ts: Date.now(), result })
    if (callGuardCache.size > 80) {
      const oldest = callGuardCache.keys().next().value
      callGuardCache.delete(oldest)
    }
    await applyCallGuardResult(tabId, result)
  } catch (err) {
    console.warn('[MakGuard Call Guard] Scan failed:', err)
  } finally {
    callGuardScanInFlight.delete(inFlightKey)
  }
}

async function scanCallGuardAudio(tabId, payload) {
  const shared = globalThis.MakGuardShared
  const { url, audio_data, transcript } = payload

  if (!(await isEnabled()) || tabId == null || !audio_data) return

  const inFlightKey = `a:${tabId}`
  if (callGuardScanInFlight.has(inFlightKey)) return
  callGuardScanInFlight.add(inFlightKey)

  try {
    await chrome.tabs.sendMessage(tabId, { type: 'MAKguard_CALL_GUARD_ANALYZING' })
  } catch {
    /* tab may not be ready */
  }

  try {
    const apiBase = await shared.getApiBaseAsync()
    const scanUrl = url || callGuardTabUrls.get(tabId) || ''
    // #region agent log
    shared.agentDebugLog('background.js:scanCallGuardAudio', 'sending to API', {
      apiBase,
      audioDataLen: audio_data?.length ?? 0,
      audioDataPrefix: audio_data?.slice(0, 80),
      hasTranscript: !!transcript,
      scanUrl: scanUrl?.slice(0, 50),
    }, 'H4')
    // #endregion
    const res = await fetch(`${apiBase}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: transcript
          ? shared.truncateText(transcript, shared.CALL_GUARD_TRANSCRIPT_MAX)
          : undefined,
        audio_data,
        page_url: scanUrl,
        source: 'call_guard',
      }),
    })

    if (!res.ok) {
      console.warn('[MakGuard Call Guard] Audio scan error:', res.status)
      // #region agent log
      shared.agentDebugLog('background.js:scanCallGuardAudio', 'audio API error', {
        status: res.status,
        audioBytes: audio_data?.length ?? 0,
      }, 'H2')
      // #endregion
      return
    }

    const result = await res.json()
    // #region agent log
    shared.agentDebugLog('background.js:scanCallGuardAudio', 'audio API result', {
      risk_score: result.risk_score,
      confidence: result.confidence,
      hasError: !!result.error,
      errorMsg: result.error,
      audioBytes: audio_data?.length ?? 0,
      explanationLen: result.explanation?.length ?? 0,
      explanationPreview: result.explanation?.slice(0, 100),
    }, 'H5')
    // #endregion
    if (result.error || typeof result.risk_score !== 'number') {
      return
    }
    await applyCallGuardResult(tabId, result)
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'MAKguard_CALL_GUARD_AUDIO_RESULT',
        result,
      })
    } catch {
      /* ignore */
    }
  } catch (err) {
    console.warn('[MakGuard Call Guard] Audio scan failed:', err)
  } finally {
    callGuardScanInFlight.delete(inFlightKey)
  }
}

async function sendCallGuardAlertToTab(tabId, result, attempt = 0) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'MAKguard_CALL_GUARD_ALERT',
      result,
    })
  } catch {
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 300))
      await sendCallGuardAlertToTab(tabId, result, attempt + 1)
    }
  }
}

async function applyCallGuardResult(tabId, result) {
  const shared = globalThis.MakGuardShared
  const score = result.risk_score ?? 0
  const color = shared.riskBadgeColor(score)
  const session = getCallGuardSession(tabId)

  await chrome.action.setBadgeText({ tabId, text: score > 30 ? '!' : '' })
  await chrome.action.setBadgeBackgroundColor({ tabId, color })

  const now = Date.now()
  const cooldown = shared.CALL_GUARD_ALERT_COOLDOWN_MS
  const canAlert =
    score >= 61 &&
    (!session.alertShown || now - session.lastAlertAt >= cooldown)

  // #region agent log
  shared.agentDebugLog('background.js:applyCallGuardResult', 'alert decision', {
    score,
    canAlert,
    alertShown: session.alertShown,
    msSinceLastAlert: now - session.lastAlertAt,
  }, 'H3')
  // #endregion

  if (canAlert) {
    callGuardSessions.set(tabId, { alertShown: true, lastAlertAt: now })
    await sendCallGuardAlertToTab(tabId, result)
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

  if (message.type === 'MAKguard_CALL_GUARD_START_FROM_POPUP') {
    const { streamId, tabId, url } = message.payload ?? {}
    if (tabId == null || !streamId) {
      sendResponse({ ok: false, error: 'Missing tabId or streamId' })
      return true
    }

    callGuardSessions.set(tabId, { alertShown: false, lastAlertAt: 0 })
    if (url) {
      callGuardTabUrls.set(tabId, url)
    }

    ;(async () => {
      try {
        await ensureOffscreenDocument()
        chrome.runtime.sendMessage(
          {
            type: 'MAKguard_OFFSCREEN_START_TAB_AUDIO',
            payload: { streamId, tabId },
          },
          (offscreenRes) => {
            const offErr = chrome.runtime.lastError?.message ?? null
            sendResponse({
              ok: true,
              tabAudio: offscreenRes?.ok === true,
              captureError: offscreenRes?.error ?? offErr,
            })
          }
        )
      } catch (err) {
        sendResponse({ ok: true, tabAudio: false, error: String(err) })
      }
    })()
    return true
  }

  if (message.type === 'MAKguard_CALL_GUARD_STOP_FROM_POPUP') {
    const tabId = message.tabId
    if (tabId != null) {
      callGuardSessions.delete(tabId)
      callGuardTabUrls.delete(tabId)
    }
    chrome.runtime.sendMessage({ type: 'MAKguard_OFFSCREEN_STOP_TAB_AUDIO' })
    sendResponse({ ok: true })
    return true
  }

  if (message.type === 'MAKguard_GET_CALL_GUARD_ACTIVE') {
    const tabId = message.tabId
    const active = tabId != null && callGuardTabUrls.has(tabId)
    sendResponse({ active })
    return true
  }

  if (message.type === 'MAKguard_CALL_GUARD_START') {
    const tabId = sender.tab?.id
    if (tabId == null) {
      sendResponse({ ok: false, error: 'No active tab' })
      return true
    }

    if (callGuardTabUrls.has(tabId)) {
      sendResponse({ ok: true, tabAudio: true, startedByPopup: true })
      return true
    }

    callGuardSessions.set(tabId, { alertShown: false, lastAlertAt: 0 })
    if (message.payload?.url) {
      callGuardTabUrls.set(tabId, message.payload.url)
    }

    sendResponse({
      ok: true,
      tabAudio: false,
      captureError: 'Please click the MakGuard extension icon and press "Start Call Guard" to enable tab audio capture.',
      needsPopupStart: true,
    })
    return true
  }

  if (message.type === 'MAKguard_CALL_GUARD_STOP') {
    const tabId = sender.tab?.id
    if (tabId != null) {
      callGuardSessions.delete(tabId)
      callGuardTabUrls.delete(tabId)
    }
    chrome.runtime.sendMessage({ type: 'MAKguard_OFFSCREEN_STOP_TAB_AUDIO' })
    sendResponse({ ok: true })
    return true
  }

  if (message.type === 'MAKguard_OFFSCREEN_AUDIO_CHUNK') {
    const { tabId, audio_data, blobSize } = message.payload ?? {}
    // #region agent log
    globalThis.MakGuardShared.agentDebugLog(
      'background.js:OFFSCREEN_AUDIO_CHUNK',
      'chunk received from offscreen',
      {
        tabId,
        blobSize,
        audioDataLen: audio_data?.length ?? 0,
        audioDataPrefix: audio_data?.slice(0, 50),
      },
      'H4'
    )
    // #endregion
    if (tabId != null && audio_data) {
      const url = callGuardTabUrls.get(tabId) ?? ''
      chrome.tabs
        .sendMessage(tabId, {
          type: 'MAKguard_CALL_GUARD_TAB_AUDIO_CHUNK',
          blobSize,
        })
        .catch(() => {})
      scanCallGuardAudio(tabId, { url, audio_data, transcript: '' })
    }
    sendResponse({ ok: true })
    return true
  }

  if (message.type === 'MAKguard_CALL_GUARD_SCAN') {
    const tabId = sender.tab?.id
    scanCallGuardTranscript(tabId, message.payload).then(() => sendResponse({ ok: true }))
    return true
  }

  if (message.type === 'MAKguard_CALL_GUARD_AUDIO') {
    const tabId = sender.tab?.id
    scanCallGuardAudio(tabId, message.payload).then(() => sendResponse({ ok: true }))
    return true
  }

  if (message.type === 'MAKguard_GET_CALL_GUARD_STATUS') {
    chrome.storage.local.get(['callGuardEnabled'], (data) => {
      sendResponse({ callGuardEnabled: data.callGuardEnabled !== false })
    })
    return true
  }

  if (message.type === 'MAKguard_SET_CALL_GUARD_ENABLED') {
    chrome.storage.local
      .set({ callGuardEnabled: message.enabled })
      .then(() => sendResponse({ callGuardEnabled: message.enabled }))
    return true
  }
})

chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.local.set({ enabled: true, callGuardEnabled: true })
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
  callGuardSessions.delete(tabId)
})
