const toggle = document.getElementById('enabled-toggle')
const statusText = document.getElementById('status-text')
const callGuardToggle = document.getElementById('call-guard-toggle')
const callGuardStatusText = document.getElementById('call-guard-status-text')
const localApiToggle = document.getElementById('local-api-toggle')
const localApiStatusText = document.getElementById('local-api-status-text')
const callGuardSection = document.getElementById('call-guard-start-section')
const startCallGuardBtn = document.getElementById('start-call-guard-btn')
const callGuardHint = document.getElementById('call-guard-hint')

let currentTabId = null
let currentTabUrl = null
let callGuardActive = false

function isCallGuardMeetingUrl(url) {
  if (!url) return false
  return (
    url.startsWith('https://meet.google.com/') ||
    url.startsWith('https://teams.microsoft.com/') ||
    url.startsWith('https://teams.live.com/')
  )
}

function updateUI(enabled) {
  toggle.checked = enabled
  statusText.textContent = enabled ? 'ON — scanning in background' : 'OFF — protection disabled'
  statusText.style.color = enabled ? '#4ade80' : '#737373'
}

function updateCallGuardUI(enabled) {
  callGuardToggle.checked = enabled
  callGuardStatusText.textContent = enabled
    ? 'ON — use on Meet / Teams'
    : 'OFF — call listening disabled'
  callGuardStatusText.style.color = enabled ? '#4ade80' : '#737373'
}

function updateCallGuardButton(active, message, isError = false, isSuccess = false) {
  callGuardActive = active
  startCallGuardBtn.textContent = active ? '🛑 Stop Call Guard' : '🎙 Start Call Guard'
  startCallGuardBtn.classList.toggle('active', active)
  callGuardHint.textContent = message
  callGuardHint.classList.toggle('error', isError)
  callGuardHint.classList.toggle('success', isSuccess)
}

chrome.runtime.sendMessage({ type: 'MAKguard_GET_STATUS' }, (response) => {
  updateUI(response?.enabled !== false)
})

chrome.runtime.sendMessage({ type: 'MAKguard_GET_CALL_GUARD_STATUS' }, (response) => {
  updateCallGuardUI(response?.callGuardEnabled !== false)
})

chrome.storage.local.get(['useLocalApi'], (data) => {
  updateLocalApiUI(data.useLocalApi === true)
})

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0]
  if (tab) {
    currentTabId = tab.id
    currentTabUrl = tab.url
    if (isCallGuardMeetingUrl(currentTabUrl)) {
      callGuardSection.style.display = 'block'
      chrome.runtime.sendMessage(
        { type: 'MAKguard_GET_CALL_GUARD_ACTIVE', tabId: currentTabId },
        (response) => {
          if (response?.active) {
            updateCallGuardButton(true, 'Call Guard is listening', false, true)
          } else {
            updateCallGuardButton(false, 'Click to enable tab audio capture for this call')
          }
        }
      )
    }
  }
})

function updateLocalApiUI(enabled) {
  localApiToggle.checked = enabled
  localApiStatusText.textContent = enabled
    ? 'ON — localhost:3000'
    : 'OFF — makguard.vercel.app'
  localApiStatusText.style.color = enabled ? '#4ade80' : '#737373'
}

localApiToggle.addEventListener('change', () => {
  const enabled = localApiToggle.checked
  chrome.storage.local.set({ useLocalApi: enabled }, () => {
    updateLocalApiUI(enabled)
  })
})

toggle.addEventListener('change', () => {
  const enabled = toggle.checked
  chrome.runtime.sendMessage({ type: 'MAKguard_SET_ENABLED', enabled }, (response) => {
    updateUI(response?.enabled ?? enabled)
  })
})

callGuardToggle.addEventListener('change', () => {
  const enabled = callGuardToggle.checked
  chrome.runtime.sendMessage(
    { type: 'MAKguard_SET_CALL_GUARD_ENABLED', enabled },
    (response) => {
      updateCallGuardUI(response?.callGuardEnabled ?? enabled)
    }
  )
})

startCallGuardBtn.addEventListener('click', () => {
  if (currentTabId == null) return
  startCallGuardBtn.disabled = true

  if (callGuardActive) {
    chrome.runtime.sendMessage(
      { type: 'MAKguard_CALL_GUARD_STOP_FROM_POPUP', tabId: currentTabId },
      (response) => {
        startCallGuardBtn.disabled = false
        updateCallGuardButton(false, 'Call Guard stopped')
        chrome.tabs.sendMessage(currentTabId, { type: 'MAKguard_CALL_GUARD_STOPPED_BY_POPUP' })
      }
    )
    return
  }

  updateCallGuardButton(false, 'Starting tab audio capture…')

  chrome.tabCapture.getMediaStreamId({ targetTabId: currentTabId }, (streamId) => {
    const capErr = chrome.runtime.lastError?.message ?? null
    if (capErr || !streamId) {
      startCallGuardBtn.disabled = false
      updateCallGuardButton(false, capErr || 'Failed to capture tab audio', true)
      return
    }

    chrome.runtime.sendMessage(
      {
        type: 'MAKguard_CALL_GUARD_START_FROM_POPUP',
        payload: { streamId, tabId: currentTabId, url: currentTabUrl },
      },
      (response) => {
        startCallGuardBtn.disabled = false
        if (response?.ok && response?.tabAudio) {
          updateCallGuardButton(true, 'Call Guard is listening', false, true)
          chrome.tabs.sendMessage(currentTabId, {
            type: 'MAKguard_CALL_GUARD_STARTED_BY_POPUP',
            tabAudio: true,
          })
        } else {
          const errMsg = response?.error || response?.captureError || 'Failed to start'
          updateCallGuardButton(false, errMsg, true)
        }
      }
    )
  })
})
