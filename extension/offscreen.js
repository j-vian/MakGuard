let mediaStream = null
let mediaRecorder = null
let activeTabId = null
let passthroughCtx = null
let passthroughSource = null

/** Chrome tab capture stops Meet playback unless we route audio back to speakers. */
async function startTabAudioPassthrough(stream) {
  stopTabAudioPassthrough()
  try {
    passthroughCtx = new AudioContext()

    // Resume if suspended (common when created without user gesture)
    if (passthroughCtx.state === 'suspended') {
      // #region agent log
      fetch('http://127.0.0.1:7365/ingest/5d27478f-eddb-47ce-acb6-2d3d7899d202', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '412c85' },
        body: JSON.stringify({
          sessionId: '412c85',
          location: 'offscreen.js:startTabAudioPassthrough',
          message: 'AudioContext suspended, resuming',
          data: { stateBefore: passthroughCtx.state },
          timestamp: Date.now(),
          hypothesisId: 'H2',
        }),
      }).catch(() => {})
      // #endregion
      await passthroughCtx.resume()
    }

    passthroughSource = passthroughCtx.createMediaStreamSource(stream)
    passthroughSource.connect(passthroughCtx.destination)
    console.log('[MakGuard offscreen] Tab audio passthrough enabled (you can still hear the call)')
    // #region agent log
    const tracks = stream.getAudioTracks?.() ?? []
    const trackInfo = tracks.map(t => ({
      id: t.id?.slice(0,8),
      enabled: t.enabled,
      muted: t.muted,
      readyState: t.readyState,
      label: t.label?.slice(0,30),
    }))
    fetch('http://127.0.0.1:7365/ingest/5d27478f-eddb-47ce-acb6-2d3d7899d202', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '412c85' },
      body: JSON.stringify({
        sessionId: '412c85',
        location: 'offscreen.js:startTabAudioPassthrough',
        message: 'passthrough enabled',
        data: {
          trackCount: tracks.length,
          trackInfo,
          ctxState: passthroughCtx.state,
          sampleRate: passthroughCtx.sampleRate,
        },
        timestamp: Date.now(),
        hypothesisId: 'H1',
      }),
    }).catch(() => {})
    // #endregion
  } catch (err) {
    console.warn('[MakGuard offscreen] Passthrough failed:', err)
    // #region agent log
    fetch('http://127.0.0.1:7365/ingest/5d27478f-eddb-47ce-acb6-2d3d7899d202', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '412c85' },
      body: JSON.stringify({
        sessionId: '412c85',
        location: 'offscreen.js:startTabAudioPassthrough',
        message: 'passthrough FAILED',
        data: { error: String(err) },
        timestamp: Date.now(),
        hypothesisId: 'H2',
      }),
    }).catch(() => {})
    // #endregion
    stopTabAudioPassthrough()
  }
}

function stopTabAudioPassthrough() {
  try {
    passthroughSource?.disconnect()
  } catch {
    /* ignore */
  }
  passthroughSource = null
  if (passthroughCtx) {
    passthroughCtx.close().catch(() => {})
    passthroughCtx = null
  }
}

async function acquireTabStream(streamId) {
  const attempts = [
    { audio: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId }, video: false },
    {
      audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
      video: false,
    },
  ]
  let lastErr = null
  for (let i = 0; i < attempts.length; i++) {
    const constraints = attempts[i]
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      // #region agent log
      fetch('http://127.0.0.1:7365/ingest/5d27478f-eddb-47ce-acb6-2d3d7899d202', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '412c85' },
        body: JSON.stringify({
          sessionId: '412c85',
          location: 'offscreen.js:acquireTabStream',
          message: 'getUserMedia succeeded',
          data: {
            attemptIdx: i,
            streamId: streamId?.slice(0, 20),
            streamActive: stream.active,
            trackCount: stream.getAudioTracks().length,
          },
          timestamp: Date.now(),
          hypothesisId: 'H1',
        }),
      }).catch(() => {})
      // #endregion
      return stream
    } catch (err) {
      lastErr = err
      // #region agent log
      fetch('http://127.0.0.1:7365/ingest/5d27478f-eddb-47ce-acb6-2d3d7899d202', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '412c85' },
        body: JSON.stringify({
          sessionId: '412c85',
          location: 'offscreen.js:acquireTabStream',
          message: 'getUserMedia attempt failed',
          data: { attemptIdx: i, error: String(err) },
          timestamp: Date.now(),
          hypothesisId: 'H1',
        }),
      }).catch(() => {})
      // #endregion
    }
  }
  throw lastErr || new Error('offscreen tab audio failed')
}

function pickMimeType() {
  for (const t of ['audio/webm;codecs=opus', 'audio/webm']) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

let chunkCounter = 0

async function startTabAudio(streamId, tabId) {
  stopTabAudio()
  activeTabId = tabId
  chunkCounter = 0
  console.log('[MakGuard offscreen] Starting tab audio for tab', tabId)

  // #region agent log
  fetch('http://127.0.0.1:7365/ingest/5d27478f-eddb-47ce-acb6-2d3d7899d202', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '412c85' },
    body: JSON.stringify({
      sessionId: '412c85',
      location: 'offscreen.js:startTabAudio:entry',
      message: 'acquiring stream',
      data: { streamId: streamId?.slice(0, 20), tabId },
      timestamp: Date.now(),
      hypothesisId: 'H3',
    }),
  }).catch(() => {})
  // #endregion

  mediaStream = await acquireTabStream(streamId)

  // #region agent log
  const tracks = mediaStream.getAudioTracks?.() ?? []
  fetch('http://127.0.0.1:7365/ingest/5d27478f-eddb-47ce-acb6-2d3d7899d202', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '412c85' },
    body: JSON.stringify({
      sessionId: '412c85',
      location: 'offscreen.js:startTabAudio:streamAcquired',
      message: 'stream acquired',
      data: {
        trackCount: tracks.length,
        trackInfo: tracks.map(t => ({
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState,
        })),
        streamActive: mediaStream.active,
      },
      timestamp: Date.now(),
      hypothesisId: 'H1',
    }),
  }).catch(() => {})
  // #endregion

  await startTabAudioPassthrough(mediaStream)
  const mimeType = pickMimeType()
  mediaRecorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : {})

  mediaRecorder.ondataavailable = (event) => {
    chunkCounter++
    // #region agent log
    if (chunkCounter <= 3 || chunkCounter % 5 === 0) {
      fetch('http://127.0.0.1:7365/ingest/5d27478f-eddb-47ce-acb6-2d3d7899d202', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '412c85' },
        body: JSON.stringify({
          sessionId: '412c85',
          location: 'offscreen.js:ondataavailable',
          message: 'chunk received',
          data: {
            chunkNum: chunkCounter,
            blobSize: event.data?.size ?? 0,
            blobType: event.data?.type,
            streamActive: mediaStream?.active,
            recorderState: mediaRecorder?.state,
          },
          timestamp: Date.now(),
          hypothesisId: 'H3',
        }),
      }).catch(() => {})
    }
    // #endregion

    if (!event.data?.size || activeTabId == null) return
    const reader = new FileReader()
    reader.onloadend = () => {
      const audio_data = reader.result
      if (typeof audio_data !== 'string') return
      chrome.runtime.sendMessage({
        type: 'MAKguard_OFFSCREEN_AUDIO_CHUNK',
        payload: { tabId: activeTabId, audio_data, blobSize: event.data.size },
      })
    }
    reader.readAsDataURL(event.data)
  }

  mediaRecorder.start(3500)

  // #region agent log
  fetch('http://127.0.0.1:7365/ingest/5d27478f-eddb-47ce-acb6-2d3d7899d202', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '412c85' },
    body: JSON.stringify({
      sessionId: '412c85',
      location: 'offscreen.js:startTabAudio:recorderStarted',
      message: 'recorder started',
      data: { mimeType, recorderState: mediaRecorder.state },
      timestamp: Date.now(),
      hypothesisId: 'H3',
    }),
  }).catch(() => {})
  // #endregion
}

function stopTabAudio() {
  activeTabId = null
  stopTabAudioPassthrough()
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
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'MAKguard_OFFSCREEN_START_TAB_AUDIO') {
    const { streamId, tabId } = message.payload ?? {}
    startTabAudio(streamId, tabId)
      .then(() => {
        console.log('[MakGuard offscreen] Tab audio recording started')
        sendResponse({ ok: true })
      })
      .catch((err) => {
        console.warn('[MakGuard offscreen] Tab audio failed:', err)
        sendResponse({ ok: false, error: String(err?.message ?? err) })
      })
    return true
  }
  if (message.type === 'MAKguard_OFFSCREEN_STOP_TAB_AUDIO') {
    stopTabAudio()
    sendResponse({ ok: true })
    return true
  }
  return false
})
