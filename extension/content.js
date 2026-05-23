(function () {
  const shared = globalThis.MakGuardShared

  const GMAIL_BODY_SELECTORS = [
    '.a3s.aiL',
    '.ii.gt',
    '[role="main"] .gs',
    '[role="main"] [data-message-id]',
  ]

  const SCAN_DEBOUNCE_MS = 400

  let currentPageKey = location.href
  let hasRequestedScan = false
  let alertDismissedThisVisit = false
  let scanTimer = null

  function isPageReload() {
    const nav = performance.getEntriesByType('navigation')[0]
    return nav?.type === 'reload'
  }

  function extractLinksFrom(root) {
    return Array.from(root.querySelectorAll('a[href]'))
      .map((a) => a.href)
      .filter(Boolean)
      .slice(0, 50)
  }

  function extractGmailContent() {
    for (const selector of GMAIL_BODY_SELECTORS) {
      const el = document.querySelector(selector)
      const text = el?.innerText?.trim() ?? ''
      if (text.length >= 50) {
        return {
          url: location.href,
          text,
          urls: extractLinksFrom(el),
        }
      }
    }
    return null
  }

  function extractGmailInboxList() {
    const main = document.querySelector('[role="main"]')
    if (!main) return null

    const rowSelectors = 'tr.zA, tr[class*="zA"], [role="row"]'
    const rows = main.querySelectorAll(rowSelectors)
    const parts = []

    for (const row of rows) {
      const rowText = row.innerText?.replace(/\s+/g, ' ').trim()
      if (rowText && rowText.length > 12) {
        parts.push(rowText)
      }
      if (parts.length >= 40) break
    }

    if (parts.length === 0) return null

    const text = parts.join('\n')
    return {
      url: location.href,
      text,
      urls: extractLinksFrom(main),
    }
  }

  function extractPageData() {
    if (location.hostname === 'mail.google.com') {
      const openEmail = extractGmailContent()
      if (openEmail) return openEmail

      const inboxList = extractGmailInboxList()
      if (inboxList) return inboxList
    }

    const text = document.body?.innerText ?? ''
    const links = extractLinksFrom(document.body ?? document)

    return {
      url: location.href,
      text,
      urls: links,
    }
  }

  function sendPageContent(forceFresh = false) {
    const data = extractPageData()
    if (shared.shouldSkipUrl(data.url)) return
    if (!data.text.trim()) return
    if (hasRequestedScan && !forceFresh) return

    hasRequestedScan = true

    chrome.runtime.sendMessage({
      type: 'MAKguard_PAGE_CONTENT',
      payload: {
        url: data.url,
        text: data.text,
        urls: data.urls,
        forceFresh,
      },
    })
  }

  function tryInstantCacheThenScan() {
    const data = extractPageData()
    if (shared.shouldSkipUrl(data.url)) return
    if (!data.text.trim()) return

    chrome.runtime.sendMessage(
      {
        type: 'MAKguard_TRY_INSTANT_CACHE',
        payload: {
          url: data.url,
          text: data.text,
          urls: data.urls,
        },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          scheduleScanOnce(SCAN_DEBOUNCE_MS)
          return
        }
        if (response?.hit) {
          hasRequestedScan = true
          return
        }
        scheduleScanOnce(SCAN_DEBOUNCE_MS)
      }
    )
  }

  function scheduleScanOnce(delayMs, forceFresh = false) {
    if (hasRequestedScan && !forceFresh) return
    clearTimeout(scanTimer)
    scanTimer = setTimeout(() => sendPageContent(forceFresh), delayMs)
  }

  function onPageChanged() {
    const nextKey = location.href
    if (nextKey === currentPageKey) return

    currentPageKey = nextKey
    hasRequestedScan = false
    alertDismissedThisVisit = false
    clearTimeout(scanTimer)

    tryInstantCacheThenScan()
  }

  function startScanFlow() {
    if (isPageReload()) {
      scheduleScanOnce(SCAN_DEBOUNCE_MS, true)
      return
    }
    tryInstantCacheThenScan()
  }

  startScanFlow()

  let lastUrl = location.href
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      onPageChanged()
    }
  }, 400)

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'MAKguard_ALERT') {
      showAlertBanner(message.result)
    }
  })

  function showAlertBanner(result) {
    if (!result || result.risk_score < 61) return
    if (alertDismissedThisVisit) return

    const existing = document.getElementById('makguard-alert-banner')
    if (existing) return

    const banner = document.createElement('div')
    banner.id = 'makguard-alert-banner'
    banner.className = 'makguard-alert-banner'
    banner.innerHTML = `
      <div class="makguard-alert-inner">
        <div class="makguard-alert-header">
          <span class="makguard-alert-icon">⚠</span>
          <strong>Likely scam — do not click links</strong>
          <button type="button" class="makguard-alert-dismiss" aria-label="Dismiss">×</button>
        </div>
        <p class="makguard-alert-score">Risk score: ${result.risk_score}/100 · ${result.confidence} confidence</p>
        <p class="makguard-alert-explanation">${escapeHtml(result.explanation)}</p>
        <a class="makguard-alert-link" href="https://makguard.vercel.app/dashboard" target="_blank" rel="noopener noreferrer">
          Open MakGuard dashboard →
        </a>
      </div>
    `

    document.documentElement.appendChild(banner)

    banner.querySelector('.makguard-alert-dismiss')?.addEventListener('click', () => {
      alertDismissedThisVisit = true
      banner.remove()
      chrome.runtime.sendMessage({
        type: 'MAKguard_ALERT_DISMISSED',
        payload: { url: location.href },
      })
    })

    setTimeout(() => {
      if (banner.isConnected) banner.remove()
    }, 30000)
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
})()
