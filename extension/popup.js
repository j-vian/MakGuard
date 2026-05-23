const toggle = document.getElementById('enabled-toggle')
const statusText = document.getElementById('status-text')
const callGuardToggle = document.getElementById('call-guard-toggle')
const callGuardStatusText = document.getElementById('call-guard-status-text')

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

chrome.runtime.sendMessage({ type: 'MAKguard_GET_STATUS' }, (response) => {
  updateUI(response?.enabled !== false)
})

chrome.runtime.sendMessage({ type: 'MAKguard_GET_CALL_GUARD_STATUS' }, (response) => {
  updateCallGuardUI(response?.callGuardEnabled !== false)
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
