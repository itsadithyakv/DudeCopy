const maxHistoryEl = document.getElementById("maxHistory");
const statusEl = document.getElementById("status");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = isError ? "status error" : "status";
}

async function loadSettings() {
  const response = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
  if (!response?.ok) {
    throw new Error(response?.error || "Could not load settings.");
  }

  maxHistoryEl.value = response.settings.maxHistoryItems;
}

async function saveSettings() {
  const payload = {
    maxHistoryItems: Number(maxHistoryEl.value)
  };

  const response = await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", payload });
  if (!response?.ok) {
    throw new Error(response?.error || "Could not save settings.");
  }
}

async function clearHistory() {
  const response = await chrome.runtime.sendMessage({ type: "CLEAR_HISTORY" });
  if (!response?.ok) {
    throw new Error(response?.error || "Could not clear history.");
  }
}

document.getElementById("save").addEventListener("click", async () => {
  setStatus("Saving...");
  try {
    await saveSettings();
    setStatus("Settings saved.");
  } catch (error) {
    setStatus(error?.message || "Unexpected error.", true);
  }
});

document.getElementById("clearHistory").addEventListener("click", async () => {
  setStatus("Clearing history...");
  try {
    await clearHistory();
    setStatus("History cleared.");
  } catch (error) {
    setStatus(error?.message || "Unexpected error.", true);
  }
});

loadSettings().catch((error) => {
  setStatus(error?.message || "Unexpected error.", true);
});
