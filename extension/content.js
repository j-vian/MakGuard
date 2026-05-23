(function () {
  const shared = globalThis.MakGuardShared

  function extractPageData() {
    const text = document.body?.innerText ?? ''
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map((a) => a.href)
      .filter(Boolean)
      .slice(0, 50)

    return {
      url: location.href,
      text,
      urls: links,
    }
  }

  function sendPageContent() {
    const data = extractPageData()
    if (shared.shouldSkipUrl(data.url)) return

    chrome.runtime.sendMessage({
      type: 'MAKguard_PAGE_CONTENT',
      payload: {
        url: data.url,
        text: data.text,
        urls: data.urls,
      },
    })
  }

  let debounceTimer = null
  function scheduleScan() {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(sendPageContent, 1500)
  }

  scheduleScan()

  const observer = new MutationObserver(() => scheduleScan())
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'MAKguard_ALERT') {
      showAlertBanner(message.result)
    }
  })

  function showAlertBanner(result) {
    if (!result || result.risk_score < 61) return

    const existing = document.getElementById('makguard-alert-banner')
    if (existing) existing.remove()

    const banner = document.createElement('div')
    banner.id = 'makguard-alert-banner'
    banner.className = 'makguard-alert-banner'
    banner.innerHTML = `
      <div class="makguard-alert-inner">
        <div class="makguard-alert-header">
          <span class="makguard-alert-icon">⚠</span>
          <strong>MakGuard detected a likely scam</strong>
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
      banner.remove()
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
