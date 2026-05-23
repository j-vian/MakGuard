const toggle = document.getElementById('enabled-toggle')
const statusText = document.getElementById('status-text')

function updateUI(enabled) {
  toggle.checked = enabled
  statusText.textContent = enabled ? 'ON — scanning in background' : 'OFF — protection disabled'
  statusText.style.color = enabled ? '#4ade80' : '#737373'
}

chrome.runtime.sendMessage({ type: 'MAKguard_GET_STATUS' }, (response) => {
  updateUI(response?.enabled !== false)
})

toggle.addEventListener('change', () => {
  const enabled = toggle.checked
  chrome.runtime.sendMessage({ type: 'MAKguard_SET_ENABLED', enabled }, (response) => {
    updateUI(response?.enabled ?? enabled)
  })
})
