const maxHistoryEl = document.getElementById("maxHistory");
const statusEl = document.getElementById("status");
const statusBadgeEl = document.getElementById("statusBadge");
const themeToggleBtn = document.getElementById("themeToggle");
const themeLightBtn = document.getElementById("themeLight");
const themeDarkBtn = document.getElementById("themeDark");

const ICONS = {
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 1 0 9.8 9.8Z"></path></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2.5"></path><path d="M12 19.5V22"></path><path d="M4.93 4.93l1.77 1.77"></path><path d="M17.3 17.3l1.77 1.77"></path><path d="M2 12h2.5"></path><path d="M19.5 12H22"></path><path d="M4.93 19.07l1.77-1.77"></path><path d="M17.3 6.7l1.77-1.77"></path></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 10v6"></path><path d="M12 7h.01"></path></svg>',
  success: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>'
};

let settings = {
  maxHistoryItems: 50,
  theme: "light"
};

function setStatus(message, type = "neutral") {
  statusEl.querySelector(".status-copy").textContent = message;
  statusEl.className = type === "error" ? "status-chip error" : type === "success" ? "status-chip success" : "status-chip";
  statusBadgeEl.innerHTML = type === "success" ? ICONS.success : ICONS.info;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggleBtn.innerHTML = theme === "dark" ? ICONS.sun : ICONS.moon;
  themeLightBtn.classList.toggle("is-active", theme === "light");
  themeDarkBtn.classList.toggle("is-active", theme === "dark");
}

async function loadSettings() {
  const response = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
  if (!response?.ok) {
    throw new Error(response?.error || "Could not load settings.");
  }

  settings = response.settings;
  maxHistoryEl.value = response.settings.maxHistoryItems;
  applyTheme(response.settings.theme || "light");
}

async function persistSettings() {
  const payload = {
    maxHistoryItems: Number(maxHistoryEl.value),
    theme: settings.theme
  };

  const response = await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", payload });
  if (!response?.ok) {
    throw new Error(response?.error || "Could not save settings.");
  }

  settings = response.settings;
  maxHistoryEl.value = response.settings.maxHistoryItems;
  applyTheme(response.settings.theme);
}

async function clearHistory() {
  const response = await chrome.runtime.sendMessage({ type: "CLEAR_HISTORY" });
  if (!response?.ok) {
    throw new Error(response?.error || "Could not clear history.");
  }
}

document.getElementById("save").addEventListener("click", async () => {
  setStatus("Saving settings...");
  try {
    await persistSettings();
    setStatus("Settings saved.", "success");
  } catch (error) {
    setStatus(error?.message || "Unexpected error.", "error");
  }
});

document.getElementById("clearHistory").addEventListener("click", async () => {
  setStatus("Clearing history...");
  try {
    await clearHistory();
    setStatus("History cleared.", "success");
  } catch (error) {
    setStatus(error?.message || "Unexpected error.", "error");
  }
});

themeToggleBtn.addEventListener("click", async () => {
  settings.theme = settings.theme === "dark" ? "light" : "dark";
  applyTheme(settings.theme);
  try {
    await persistSettings();
    setStatus("Theme updated.", "success");
  } catch (error) {
    setStatus(error?.message || "Unexpected error.", "error");
  }
});

themeLightBtn.addEventListener("click", () => {
  settings.theme = "light";
  applyTheme(settings.theme);
});

themeDarkBtn.addEventListener("click", () => {
  settings.theme = "dark";
  applyTheme(settings.theme);
});

document.getElementById("openHistory").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/history.html") });
});

loadSettings()
  .then(() => setStatus("Settings loaded."))
  .catch((error) => {
    setStatus(error?.message || "Unexpected error.", "error");
  });
