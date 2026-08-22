const toggle = document.getElementById("toggle");
const status = document.getElementById("status");

// Load saved state
chrome.storage.sync.get({ enabled: true }, (result) => {
  toggle.checked = result.enabled;
  updateStatus(result.enabled);
});

// Handle toggle
toggle.addEventListener("change", () => {
  const enabled = toggle.checked;
  chrome.storage.sync.set({ enabled }, () => {
    updateStatus(enabled);
    // Notify content scripts in active Substack tabs
    chrome.tabs.query({ url: "*://*.substack.com/*" }, (tabs) => {
      for (const tab of tabs) {
        chrome.tabs.reload(tab.id);
      }
    });
  });
});

function updateStatus(enabled) {
  if (enabled) {
    status.textContent = "Active on *.substack.com";
    status.className = "status active";
  } else {
    status.textContent = "Paused — prompts will appear normally";
    status.className = "status";
  }
}
