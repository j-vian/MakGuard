(function () {
  const shared = globalThis.MakGuardShared

  if (!shared.isCallGuardMeetingUrl(location.href)) return

  const SpeechRecognition =
    globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition

  let panelEl = null
  let statusEl = null
  let transcriptEl = null
  let startBtn = null
  let stopBtn = null
  let listening = false
  let recognition = null
  let transcriptParts = []
  let interimTranscript = ''
  let lastScanAt = 0
  let alertDismissed = false
  let periodicScanInterval = null
  let pendingScanTimer = null
  let tabAudioActive = false
  let pendingBannerEl = null
  let urgentConfirmTimer = null
  let lastTabChunkUiAt = 0

  function getTranscript() {
    const parts = [...transcriptParts]
    if (interimTranscript.trim()) parts.push(interimTranscript.trim())
    return shared.truncateText(parts.join(' '), shared.CALL_GUARD_TRANSCRIPT_MAX)
  }

  function appendTranscript(text, source) {
    const trimmed = String(text || '').trim()
    if (!trimmed) return
    transcriptParts.push(trimmed)
    if (transcriptParts.length > 120) {
      transcriptParts = transcriptParts.slice(-80)
    }
    appendTranscriptLine(trimmed, source)
  }

  function appendTranscriptLine(text, source) {
    if (!transcriptEl) return
    const line = document.createElement('div')
    line.className = 'makguard-call-transcript-line'
    if (source === 'tab') {
      line.textContent = text.startsWith('🔊') ? text : `🔊 ${text}`
    } else {
      line.textContent = `· ${text}`
    }
    transcriptEl.appendChild(line)
    while (transcriptEl.children.length > 50) {
      transcriptEl.removeChild(transcriptEl.firstChild)
    }
    transcriptEl.scrollTop = transcriptEl.scrollHeight
  }

  function updateStatus(text, isListening) {
    if (!statusEl) return
    statusEl.textContent = text
    statusEl.classList.toggle('listening', !!isListening)
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function hidePendingUrgentBanner() {
    pendingBannerEl?.remove()
    pendingBannerEl = null
  }

  function showPendingUrgentBanner(snippet) {
    if (alertDismissed) return
    hidePendingUrgentBanner()
    const banner = document.createElement('div')
    banner.id = 'makguard-pending-alert-banner'
    banner.className = 'makguard-alert-banner makguard-call-alert makguard-pending-alert'
    banner.innerHTML = `
      <div class="makguard-alert-inner" style="border-color:#f59e0b;background:linear-gradient(145deg,#422006,#713f12)">
        <div class="makguard-alert-header">
          <span class="makguard-alert-icon">⚡</span>
          <strong>Suspicious call — verifying…</strong>
        </div>
        <p class="makguard-alert-explanation">${escapeHtml(snippet.slice(0, 160))}</p>
      </div>
    `
    document.documentElement.appendChild(banner)
    pendingBannerEl = banner
  }

  function showCallGuardAlert(result) {
    // #region agent log
    shared.agentDebugLog('call-guard.js:showCallGuardAlert', 'alert invoked', {
      risk_score: result?.risk_score,
      alertDismissed,
      willShow: !!(result && result.risk_score >= 61 && !alertDismissed),
    }, 'H4')
    // #endregion
    if (!result || result.risk_score < 61) return
    if (alertDismissed) return

    hidePendingUrgentBanner()

    const existing = document.getElementById('makguard-alert-banner')
    if (existing) existing.remove()

    const banner = document.createElement('div')
    banner.id = 'makguard-alert-banner'
    banner.className = 'makguard-alert-banner makguard-call-alert'
    banner.innerHTML = `
      <div class="makguard-alert-inner">
        <div class="makguard-alert-header">
          <span class="makguard-alert-icon">⚠</span>
          <strong>Potential scam call — hang up</strong>
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
      alertDismissed = true
      banner.remove()
    })

    setTimeout(() => {
      if (banner.isConnected) banner.remove()
    }, 45000)
  }

  function scheduleTranscriptScan(options = {}) {
    const { force = false, urgent = false } = options
    const transcript = getTranscript()
    if (!transcript.trim()) return

    const minGap = urgent ? shared.CALL_GUARD_FAST_SCAN_MS : shared.CALL_GUARD_SCAN_DEBOUNCE_MS
    const now = Date.now()

    if (!force && !urgent && now - lastScanAt < minGap) return
    if (!force && !urgent && !shared.passesCallGuardHeuristic(transcript)) return

    if (urgent) {
      updateStatus('⚡ Suspicious speech — analyzing…', true)
      const tail = getTranscript()
      if (tail) showPendingUrgentBanner(tail)
    }

    clearTimeout(pendingScanTimer)
    const delay = urgent ? 350 : force ? 200 : 600

    pendingScanTimer = setTimeout(() => {
      if (!listening) return
      const latest = getTranscript()
      if (!latest.trim()) return
      if (!force && !urgent && !shared.passesCallGuardHeuristic(latest)) return
      if (!urgent && Date.now() - lastScanAt < minGap) return

      lastScanAt = Date.now()
      // #region agent log
      shared.agentDebugLog('call-guard.js:scheduleTranscriptScan', 'sending scan', {
        urgent,
        force,
        transcriptLen: latest.length,
        transcriptTail: latest.slice(-120),
        hasUrgentKw: shared.hasUrgentCallGuardKeywords(latest),
      }, 'H1')
      // #endregion
      chrome.runtime.sendMessage({
        type: 'MAKguard_CALL_GUARD_SCAN',
        payload: {
          url: location.href,
          transcript: latest,
          force,
          urgent,
        },
      })
    }, delay)
  }

  /** Amber banner + API scan; red alert only after API confirms (no instant local red). */
  function scheduleUrgentReview(text) {
    const trimmed = String(text || '').trim()
    if (!trimmed) return
    const coercive = shared.hasDirectCoercionPattern(trimmed)
    const urgent = shared.hasUrgentCallGuardKeywords(trimmed)
    if (!coercive && !urgent) return

    showPendingUrgentBanner(trimmed)
    scheduleTranscriptScan({ urgent: true, force: false })

    // #region agent log
    shared.agentDebugLog('call-guard.js:scheduleUrgentReview', 'urgent review scheduled', {
      coercive,
      urgent,
      snippet: trimmed.slice(0, 80),
      confirmMs: shared.CALL_GUARD_ALERT_CONFIRM_MS,
    }, 'H2')
    // #endregion

    if (coercive) {
      clearTimeout(urgentConfirmTimer)
      urgentConfirmTimer = setTimeout(() => {
        if (!listening) return
        scheduleTranscriptScan({ urgent: true, force: true })
      }, shared.CALL_GUARD_ALERT_CONFIRM_MS)
    }
  }

  function onSpeechText(text, isFinal) {
    const trimmed = String(text || '').trim()
    if (!trimmed) return

    if (isFinal) {
      interimTranscript = ''
      appendTranscript(trimmed, 'you')
      const urgent =
        shared.hasUrgentCallGuardKeywords(trimmed) ||
        shared.hasDirectCoercionPattern(trimmed)
      if (urgent) scheduleUrgentReview(trimmed)
      else scheduleTranscriptScan({ urgent: false, force: false })
    } else {
      interimTranscript = trimmed
      appendTranscriptLine(trimmed, 'you')
      if (
        shared.hasUrgentCallGuardKeywords(trimmed) ||
        shared.hasDirectCoercionPattern(trimmed)
      ) {
        scheduleUrgentReview(trimmed)
      }
    }
  }

  function startSpeechRecognition() {
    if (!SpeechRecognition) return

    recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-MY'

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i]
        const text = res[0]?.transcript ?? ''
        if (res.isFinal) {
          onSpeechText(text, true)
        } else {
          interim += text
        }
      }
      if (interim) {
        interimTranscript = interim
        appendTranscriptLine(interim, 'you')
        if (
          shared.hasUrgentCallGuardKeywords(interim) ||
          shared.hasDirectCoercionPattern(interim)
        ) {
          scheduleUrgentReview(interim)
        }
      }
    }

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return
      console.warn('[MakGuard Call Guard] Speech error:', event.error)
    }

    recognition.onend = () => {
      if (listening) {
        try {
          recognition.start()
        } catch {
          /* ignore */
        }
      }
    }

    try {
      recognition.start()
    } catch {
      /* mic optional */
    }
  }

  async function startListening(fromPopup = false) {
    if (listening) return

    const callGuardEnabled = await new Promise((resolve) => {
      chrome.storage.local.get(['callGuardEnabled'], (data) => {
        resolve(data.callGuardEnabled !== false)
      })
    })

    if (!callGuardEnabled) {
      updateStatus('Enable Call Guard in extension popup', false)
      return
    }

    listening = true
    alertDismissed = false
    transcriptParts = []
    interimTranscript = ''
    hidePendingUrgentBanner()
    if (transcriptEl) transcriptEl.innerHTML = ''
    lastScanAt = 0
    startBtn.disabled = true
    stopBtn.disabled = false
    updateStatus('Starting…', true)

    chrome.runtime.sendMessage(
      { type: 'MAKguard_CALL_GUARD_START', payload: { url: location.href } },
      async (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        updateStatus(response?.error ?? 'Could not start Call Guard', false)
        stopListening()
        return
      }

      if (response.needsPopupStart && !fromPopup) {
        appendTranscriptLine('⚠ Click the MakGuard extension icon (puzzle piece) and press "Start Call Guard" to capture remote audio', 'tab')
        updateStatus('Click extension icon → Start Call Guard', false)
      }

      tabAudioActive = response.tabAudio === true || response.startedByPopup === true
      if (tabAudioActive) {
        appendTranscriptLine('Meeting tab audio active (remote caller, headphones OK)', 'tab')
        console.log('[MakGuard Call Guard] Tab audio capture started')
      } else if (!response.needsPopupStart) {
        const capHint = response.captureError ? ` (${response.captureError})` : ''
        appendTranscriptLine(`Tab audio unavailable — mic only${capHint}`, 'tab')
        console.warn('[MakGuard Call Guard] Tab audio failed', response.captureError || response.error)
      }

      try {
        await navigator.mediaDevices.getUserMedia({ audio: true })
        startSpeechRecognition()
      } catch {
        if (!tabAudioActive && !response.needsPopupStart) {
          updateStatus('Allow microphone access to start Call Guard', false)
          stopListening()
          return
        }
      }

      if (tabAudioActive) {
        updateStatus('Listening — tab audio + mic', true)
      } else if (response.needsPopupStart) {
        updateStatus('Mic active — click extension icon for remote audio', true)
      } else {
        updateStatus('Listening via mic only', true)
      }

      if (periodicScanInterval) clearInterval(periodicScanInterval)
      periodicScanInterval = setInterval(() => {
        if (listening) scheduleTranscriptScan({ force: true })
      }, shared.CALL_GUARD_SCAN_DEBOUNCE_MS)
    })
  }

  function stopListening() {
    listening = false
    tabAudioActive = false
    interimTranscript = ''
    hidePendingUrgentBanner()
    startBtn.disabled = false
    stopBtn.disabled = true
    updateStatus('Stopped — start when your call begins', false)

    clearTimeout(pendingScanTimer)
    pendingScanTimer = null
    clearTimeout(urgentConfirmTimer)
    urgentConfirmTimer = null

    if (recognition) {
      try {
        recognition.stop()
      } catch {
        /* ignore */
      }
      recognition = null
    }

    if (periodicScanInterval) {
      clearInterval(periodicScanInterval)
      periodicScanInterval = null
    }

    chrome.runtime.sendMessage({ type: 'MAKguard_CALL_GUARD_STOP' })
  }

  function savePanelPosition(left, top) {
    chrome.storage.local.set({ callGuardPanelPos: { left, top } })
  }

  function loadPanelPosition(panel) {
    chrome.storage.local.get(['callGuardPanelPos'], (data) => {
      const pos = data.callGuardPanelPos
      if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
        panel.style.left = `${Math.max(8, pos.left)}px`
        panel.style.top = `${Math.max(8, pos.top)}px`
        panel.style.right = 'auto'
        panel.style.bottom = 'auto'
      }
    })
  }

  function initDraggable(panel, handle) {
    let dragging = false
    let offsetX = 0
    let offsetY = 0

    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return
      if (e.target.closest('button')) return
      dragging = true
      handle.setPointerCapture(e.pointerId)
      const rect = panel.getBoundingClientRect()
      panel.style.left = `${rect.left}px`
      panel.style.top = `${rect.top}px`
      panel.style.right = 'auto'
      panel.style.bottom = 'auto'
      offsetX = e.clientX - rect.left
      offsetY = e.clientY - rect.top
      panel.classList.add('makguard-call-dragging')
      e.preventDefault()
    })

    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return
      const maxLeft = window.innerWidth - panel.offsetWidth - 8
      const maxTop = window.innerHeight - panel.offsetHeight - 8
      const left = Math.min(maxLeft, Math.max(8, e.clientX - offsetX))
      const top = Math.min(maxTop, Math.max(8, e.clientY - offsetY))
      panel.style.left = `${left}px`
      panel.style.top = `${top}px`
    })

    handle.addEventListener('pointerup', (e) => {
      if (!dragging) return
      dragging = false
      panel.classList.remove('makguard-call-dragging')
      try {
        handle.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      const rect = panel.getBoundingClientRect()
      savePanelPosition(rect.left, rect.top)
    })
  }

  function buildPanel() {
    if (document.getElementById('makguard-call-guard-panel')) return

    panelEl = document.createElement('div')
    panelEl.id = 'makguard-call-guard-panel'
    panelEl.className = 'makguard-call-panel'
    panelEl.innerHTML = `
      <div class="makguard-call-inner">
        <div class="makguard-call-title makguard-call-drag-handle" title="Drag to move">
          <span class="makguard-call-grip" aria-hidden="true">⋮⋮</span>
          <span>🛡</span>
          <span>MakGuard Call Guard</span>
        </div>
        <p class="makguard-call-status" id="makguard-call-status">Stopped — start when your call begins</p>
        <div class="makguard-call-transcript-wrap">
          <div class="makguard-call-transcript" id="makguard-call-transcript" aria-live="polite"></div>
        </div>
        <div class="makguard-call-actions">
          <button type="button" class="makguard-call-btn makguard-call-btn-start" id="makguard-call-start">Start listening</button>
          <button type="button" class="makguard-call-btn makguard-call-btn-stop" id="makguard-call-stop" disabled>Stop</button>
        </div>
        <p class="makguard-call-hint">For remote audio: click MakGuard extension icon → "Start Call Guard". Your mic works immediately. Drag panel by header.</p>
      </div>
    `

    document.documentElement.appendChild(panelEl)
    statusEl = panelEl.querySelector('#makguard-call-status')
    transcriptEl = panelEl.querySelector('#makguard-call-transcript')
    startBtn = panelEl.querySelector('#makguard-call-start')
    stopBtn = panelEl.querySelector('#makguard-call-stop')
    const dragHandle = panelEl.querySelector('.makguard-call-drag-handle')

    startBtn.addEventListener('click', startListening)
    stopBtn.addEventListener('click', stopListening)
    initDraggable(panelEl, dragHandle)
    loadPanelPosition(panelEl)
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'MAKguard_CALL_GUARD_ALERT') {
      showCallGuardAlert(message.result)
      if (message.result?.explanation) {
        appendTranscriptLine(`⚠ Alert: ${message.result.explanation.slice(0, 120)}…`, 'tab')
      }
    }
    if (message.type === 'MAKguard_CALL_GUARD_TAB_AUDIO_CHUNK') {
      const size = message.blobSize ?? 0
      const now = Date.now()
      if (size > 500 && now - lastTabChunkUiAt > 12_000) {
        lastTabChunkUiAt = now
        appendTranscriptLine(`Analyzing remote voice (${Math.round(size / 1024)}KB)…`, 'tab')
        updateStatus('🔊 Analyzing meeting audio…', true)
      }
    }
    if (message.type === 'MAKguard_CALL_GUARD_AUDIO_RESULT' && message.result) {
      // #region agent log
      shared.agentDebugLog('call-guard.js:AUDIO_RESULT', 'received from background', {
        risk_score: message.result.risk_score,
        confidence: message.result.confidence,
        explanationLen: message.result.explanation?.length ?? 0,
        explanationPreview: message.result.explanation?.slice(0, 100),
      }, 'H5')
      // #endregion
      const ex = message.result.explanation
      if (ex) {
        appendTranscriptLine(`[Remote] ${ex.slice(0, 160)}`, 'tab')
      }
      scheduleTranscriptScan({
        force: true,
        urgent: (message.result.risk_score ?? 0) >= 61,
      })
    }
    if (message.type === 'MAKguard_CALL_GUARD_STARTED_BY_POPUP') {
      tabAudioActive = message.tabAudio === true
      if (!listening) {
        startListening(true)
      } else {
        if (tabAudioActive) {
          appendTranscriptLine('Meeting tab audio active (remote caller, headphones OK)', 'tab')
          updateStatus('Listening — tab audio + mic', true)
        }
      }
    }
    if (message.type === 'MAKguard_CALL_GUARD_STOPPED_BY_POPUP') {
      stopListening()
    }
  })

  buildPanel()
})()
