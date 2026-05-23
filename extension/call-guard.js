(function () {
  const shared = globalThis.MakGuardShared

  if (!shared.isCallGuardMeetingUrl(location.href)) return

  const SpeechRecognition =
    globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition

  let panelEl = null
  let statusEl = null
  let startBtn = null
  let stopBtn = null
  let listening = false
  let recognition = null
  let mediaRecorder = null
  let mediaStream = null
  let transcriptParts = []
  let lastScanAt = 0
  let alertDismissed = false
  let recordInterval = null
  let periodicScanInterval = null

  function getTranscript() {
    return shared.truncateText(transcriptParts.join(' '), shared.CALL_GUARD_TRANSCRIPT_MAX)
  }

  function appendTranscript(text) {
    const trimmed = String(text || '').trim()
    if (!trimmed) return
    transcriptParts.push(trimmed)
    if (transcriptParts.length > 80) {
      transcriptParts = transcriptParts.slice(-40)
    }
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

  function showCallGuardAlert(result) {
    if (!result || result.risk_score < 61) return
    if (alertDismissed) return

    const existing = document.getElementById('makguard-alert-banner')
    if (existing) return

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

  function scheduleTranscriptScan(force) {
    const transcript = getTranscript()
    if (!transcript.trim()) return

    const now = Date.now()
    const debounce = shared.CALL_GUARD_SCAN_DEBOUNCE_MS
    if (!force && now - lastScanAt < debounce) return

    if (!force && !shared.passesCallGuardHeuristic(transcript)) return

    lastScanAt = now
    chrome.runtime.sendMessage({
      type: 'MAKguard_CALL_GUARD_SCAN',
      payload: {
        url: location.href,
        transcript,
        force,
      },
    })
  }

  function startSpeechRecognition() {
    if (!SpeechRecognition) {
      updateStatus('Speech API not supported — use Chrome', false)
      return
    }

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
          appendTranscript(text)
        } else {
          interim += text
        }
      }
      if (interim) {
        updateStatus(`Listening… ${interim.slice(0, 60)}`, true)
      } else {
        updateStatus('Listening for scam patterns…', true)
      }
      scheduleTranscriptScan(false)
    }

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return
      console.warn('[MakGuard Call Guard] Speech error:', event.error)
      if (event.error === 'not-allowed') {
        updateStatus('Microphone blocked — allow mic in browser', false)
        stopListening()
      }
    }

    recognition.onend = () => {
      if (listening) {
        try {
          recognition.start()
        } catch {
          /* restarted elsewhere */
        }
      }
    }

    recognition.start()
  }

  async function startTabAudioCapture(streamId) {
    if (!streamId) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: streamId,
          },
        },
        video: false,
      })

      mediaStream = stream
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })

      mediaRecorder.ondataavailable = async (event) => {
        if (!event.data?.size || !listening) return
        const reader = new FileReader()
        reader.onloadend = () => {
          const dataUrl = reader.result
          if (typeof dataUrl === 'string') {
            chrome.runtime.sendMessage({
              type: 'MAKguard_CALL_GUARD_AUDIO',
              payload: {
                url: location.href,
                audio_data: dataUrl,
                transcript: getTranscript(),
              },
            })
          }
        }
        reader.readAsDataURL(event.data)
      }

      mediaRecorder.start()
      recordInterval = setInterval(() => {
        if (mediaRecorder?.state === 'recording') {
          mediaRecorder.stop()
          mediaRecorder.start()
        }
      }, 18_000)
    } catch (err) {
      console.warn('[MakGuard Call Guard] Tab audio capture failed:', err)
    }
  }

  async function startListening() {
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
    lastScanAt = 0
    startBtn.disabled = true
    stopBtn.disabled = false
    updateStatus('Starting… allow microphone', true)

    chrome.runtime.sendMessage({ type: 'MAKguard_CALL_GUARD_START' }, async (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        updateStatus(response?.error ?? 'Could not start Call Guard', false)
        stopListening()
        return
      }

      try {
        await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        updateStatus('Microphone required — allow access', false)
        stopListening()
        return
      }

      startSpeechRecognition()
      if (response.streamId) {
        await startTabAudioCapture(response.streamId)
      }

      updateStatus('Listening for scam patterns…', true)
      if (periodicScanInterval) clearInterval(periodicScanInterval)
      periodicScanInterval = setInterval(() => {
        if (listening) scheduleTranscriptScan(true)
      }, shared.CALL_GUARD_SCAN_DEBOUNCE_MS)
    })
  }

  function stopListening() {
    listening = false
    startBtn.disabled = false
    stopBtn.disabled = true
    updateStatus('Stopped — start when your call begins', false)

    if (recognition) {
      try {
        recognition.stop()
      } catch {
        /* ignore */
      }
      recognition = null
    }

    if (recordInterval) {
      clearInterval(recordInterval)
      recordInterval = null
    }

    if (periodicScanInterval) {
      clearInterval(periodicScanInterval)
      periodicScanInterval = null
    }

    if (mediaRecorder) {
      try {
        if (mediaRecorder.state !== 'inactive') mediaRecorder.stop()
      } catch {
        /* ignore */
      }
      mediaRecorder = null
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop())
      mediaStream = null
    }

    chrome.runtime.sendMessage({ type: 'MAKguard_CALL_GUARD_STOP' })
  }

  function buildPanel() {
    if (document.getElementById('makguard-call-guard-panel')) return

    panelEl = document.createElement('div')
    panelEl.id = 'makguard-call-guard-panel'
    panelEl.className = 'makguard-call-panel'
    panelEl.innerHTML = `
      <div class="makguard-call-inner">
        <div class="makguard-call-title">
          <span>🛡</span>
          <span>MakGuard Call Guard</span>
        </div>
        <p class="makguard-call-status" id="makguard-call-status">Stopped — start when your call begins</p>
        <div class="makguard-call-actions">
          <button type="button" class="makguard-call-btn makguard-call-btn-start" id="makguard-call-start">Start listening</button>
          <button type="button" class="makguard-call-btn makguard-call-btn-stop" id="makguard-call-stop" disabled>Stop</button>
        </div>
        <p class="makguard-call-hint">Uses your mic + meeting tab audio (Chrome). Use speakers or share audio so we hear the other party. Google Meet & Teams web supported.</p>
      </div>
    `

    document.documentElement.appendChild(panelEl)
    statusEl = panelEl.querySelector('#makguard-call-status')
    startBtn = panelEl.querySelector('#makguard-call-start')
    stopBtn = panelEl.querySelector('#makguard-call-stop')

    startBtn.addEventListener('click', startListening)
    stopBtn.addEventListener('click', stopListening)
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'MAKguard_CALL_GUARD_ALERT') {
      showCallGuardAlert(message.result)
    }
  })

  buildPanel()
})()
