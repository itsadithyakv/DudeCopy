const statusTitleEl = document.getElementById("statusTitle");
const enableCopyBtn = document.getElementById("enableCopy");
const heroIconEl = document.getElementById("heroIcon");
const heroLabelEl = document.getElementById("heroLabel");
const heroSiteEl = document.getElementById("heroSite");
const heroSiteFaviconEl = document.getElementById("heroSiteFavicon");
const heroSiteHostEl = document.getElementById("heroSiteHost");
const copyReaderBtn = document.getElementById("copyReader");
const copyAllBtn = document.getElementById("copyAll");
const recentHistoryEl = document.getElementById("recentHistory");
const siteHostEl = document.getElementById("siteHost");
const siteTitleEl = document.getElementById("siteTitle");
const siteFaviconEl = document.getElementById("siteFavicon");
const themeToggleBtn = document.getElementById("themeToggle");
const toggleSettingsBtn = document.getElementById("toggleSettings");
const settingsPanelEl = document.getElementById("settingsPanel");
const maxHistoryEl = document.getElementById("maxHistory");
const themeLightBtn = document.getElementById("themeLight");
const themeDarkBtn = document.getElementById("themeDark");
const enabledDomainsListEl = document.getElementById("enabledDomainsList");

const ICONS = {
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 1 0 9.8 9.8Z"></path></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2.5"></path><path d="M12 19.5V22"></path><path d="M4.93 4.93l1.77 1.77"></path><path d="M17.3 17.3l1.77 1.77"></path><path d="M2 12h2.5"></path><path d="M19.5 12H22"></path><path d="M4.93 19.07l1.77-1.77"></path><path d="M17.3 6.7l1.77-1.77"></path></svg>',
  unlock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M9 11V8a3 3 0 0 1 6 0"></path></svg>',
  enabled: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>',
  blocked: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M8 8l8 8"></path></svg>',
  working: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 13.66-5.66"></path><path d="M20 4v6h-6"></path><path d="M20 12a8 8 0 0 1-13.66 5.66"></path><path d="M4 20v-6h6"></path></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="10" height="10" rx="2"></rect><path d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1"></path></svg>',
  empty: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7h8"></path><path d="M8 12h8"></path><path d="M8 17h5"></path><rect x="4" y="3" width="16" height="18" rx="2"></rect></svg>'
};

let settings = {
  maxHistoryItems: 50,
  theme: "light",
  enabledDomains: []
};
let currentTabInfo = null;
let copySupported = false;
let unlockEnabled = false;
let isUnlocking = false;
let activeHostname = "";

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggleBtn.innerHTML = theme === "dark" ? ICONS.sun : ICONS.moon;
  themeToggleBtn.setAttribute("aria-label", theme === "dark" ? "Switch to default theme" : "Switch to dark theme");
  themeLightBtn.classList.toggle("is-active", theme === "light");
  themeDarkBtn.classList.toggle("is-active", theme === "dark");
}

function canScriptUrl(url) {
  if (!url) {
    return false;
  }
  return !/^(chrome|chrome-extension|edge|about|devtools|view-source):/i.test(url);
}

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "Unsupported page";
  }
}

function derivePreview(text) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, 140);
}

function deriveHistoryTitle(item) {
  if (item.meta?.title) {
    return item.meta.title;
  }

  const firstLine = String(item.text || "")
    .split("\n")
    .map((part) => part.trim())
    .find(Boolean);
  return firstLine || "Untitled capture";
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return map[char];
  });
}

function updateHeroUi() {
  enableCopyBtn.classList.remove("is-enabled", "is-blocked", "is-working");
  heroSiteEl.hidden = true;

  if (!copySupported) {
    heroIconEl.innerHTML = ICONS.blocked;
    heroLabelEl.textContent = "Blocked";
    statusTitleEl.textContent = "Blocked";
    enableCopyBtn.classList.add("is-blocked");
    enableCopyBtn.disabled = true;
    return;
  }

  enableCopyBtn.disabled = false;

  if (isUnlocking) {
    heroIconEl.innerHTML = ICONS.working;
    heroLabelEl.textContent = "Working";
    statusTitleEl.textContent = "Working";
    enableCopyBtn.classList.add("is-working");
    return;
  }

  if (unlockEnabled) {
    heroIconEl.innerHTML = ICONS.enabled;
    heroLabelEl.textContent = "Enabled";
    statusTitleEl.textContent = "Copy Enabled";
    enableCopyBtn.classList.add("is-enabled");
    if (activeHostname) {
      heroSiteHostEl.textContent = activeHostname;
      heroSiteFaviconEl.src = siteFaviconEl.src || "../icons/UncopyLogo.png";
      heroSiteEl.hidden = false;
    }
    return;
  }

  heroIconEl.innerHTML = ICONS.unlock;
  heroLabelEl.textContent = "Enable";
  statusTitleEl.textContent = "Enable Copy";
}

function updateActionAvailability() {
  const disableActions = !copySupported;
  copyReaderBtn.disabled = disableActions;
  copyAllBtn.disabled = disableActions;
  copyReaderBtn.classList.toggle("is-disabled", disableActions);
  copyAllBtn.classList.toggle("is-disabled", disableActions);
}

function renderEmptyRecentHistory() {
  recentHistoryEl.innerHTML = `
    <div class="empty-state">
      <div class="empty-mark">${ICONS.empty}</div>
      <h3 class="empty-title">No history yet</h3>
    </div>
  `;
}

function formatRelativeTime(value) {
  const timestamp = new Date(value).getTime();
  const diffSeconds = Math.round((timestamp - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const units = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60]
  ];

  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds || unit === "minute") {
      return formatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }

  return "just now";
}

function renderRecentHistory(history) {
  recentHistoryEl.innerHTML = "";

  if (!history.length) {
    renderEmptyRecentHistory();
    return;
  }

  const fragment = document.createDocumentFragment();
  history.slice(0, 2).forEach((item) => {
    const node = document.createElement("article");
    node.className = "recent-item";
    node.innerHTML = `
      <div class="recent-row" style="justify-content:space-between;">
        <div style="min-width:0;flex:1;">
          <p class="recent-title truncate">${escapeHtml(deriveHistoryTitle(item))}</p>
          <p class="recent-meta">${escapeHtml(formatRelativeTime(item.createdAt))}${item.meta?.siteName ? ` - ${escapeHtml(item.meta.siteName)}` : ""}</p>
        </div>
        <button class="recent-copy" type="button" aria-label="Copy history item">${ICONS.copy}</button>
      </div>
    `;

    node.querySelector(".recent-copy").addEventListener("click", async () => {
      await navigator.clipboard.writeText(item.text);
    });

    fragment.appendChild(node);
  });

  recentHistoryEl.appendChild(fragment);
}

function renderEnabledDomains() {
  enabledDomainsListEl.innerHTML = "";

  const domains = Array.isArray(settings.enabledDomains) ? settings.enabledDomains.slice().sort() : [];
  if (!domains.length) {
    const empty = document.createElement("div");
    empty.className = "history-body";
    empty.textContent = "No domains";
    enabledDomainsListEl.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  domains.forEach((domain) => {
    const item = document.createElement("div");
    item.className = "domain-item";
    item.innerHTML = `
      <span class="domain-name" title="${escapeHtml(domain)}">${escapeHtml(domain)}</span>
      <button class="icon-button domain-remove" type="button" aria-label="Remove ${escapeHtml(domain)}">
        ${ICONS.blocked}
      </button>
    `;

    item.querySelector("button").addEventListener("click", async () => {
      try {
        await removeEnabledDomain(domain);
      } catch {}
    });

    fragment.appendChild(item);
  });

  enabledDomainsListEl.appendChild(fragment);
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) {
    throw new Error("No active tab found.");
  }
  return tab;
}

function updateSiteCard(tab) {
  activeHostname = canScriptUrl(tab?.url) ? getHostname(tab.url) : "";
  currentTabInfo = {
    title: tab?.title || activeHostname || "Unsupported page",
    url: tab?.url || "",
    siteName: activeHostname || "Unsupported page"
  };

  siteHostEl.textContent = activeHostname || "Unsupported page";
  siteTitleEl.textContent = unlockEnabled && activeHostname ? "Auto-enabled" : "";
  siteFaviconEl.src = tab?.favIconUrl || "../icons/UncopyLogo.png";
  siteFaviconEl.onerror = () => {
    siteFaviconEl.src = "../icons/UncopyLogo.png";
  };
  heroSiteFaviconEl.onerror = () => {
    heroSiteFaviconEl.src = "../icons/UncopyLogo.png";
  };
}

async function loadSettings() {
  const response = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
  if (!response?.ok) {
    throw new Error(response?.error || "Could not load settings.");
  }

  settings = response.settings;
  maxHistoryEl.value = response.settings.maxHistoryItems;
  applyTheme(settings.theme || "light");
  renderEnabledDomains();
}

async function persistSettings() {
  const response = await chrome.runtime.sendMessage({
    type: "SAVE_SETTINGS",
    payload: {
      maxHistoryItems: Number(maxHistoryEl.value),
      theme: settings.theme,
      enabledDomains: settings.enabledDomains
    }
  });

  if (!response?.ok) {
    throw new Error(response?.error || "Could not save settings.");
  }

  settings = response.settings;
  maxHistoryEl.value = settings.maxHistoryItems;
  applyTheme(settings.theme);
  renderEnabledDomains();
}

async function removeEnabledDomain(domain) {
  if (!domain) {
    return;
  }

  if (domain === activeHostname && unlockEnabled) {
    await toggleDomainCopy();
    return;
  }

  settings.enabledDomains = (settings.enabledDomains || []).filter((entry) => entry !== domain);
  await persistSettings();
}

async function loadRecentHistory() {
  const response = await chrome.runtime.sendMessage({ type: "GET_HISTORY" });
  if (!response?.ok) {
    throw new Error(response?.error || "Could not load history.");
  }

  renderRecentHistory(response.history || []);
}

async function loadTabState() {
  const tab = await getActiveTab();
  updateSiteCard(tab);

  copySupported = canScriptUrl(tab.url);
  if (!copySupported) {
    unlockEnabled = false;
    updateHeroUi();
    updateActionAvailability();
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: "GET_TAB_COPY_STATE",
    payload: { tabId: tab.id }
  });

  if (!response?.ok) {
    throw new Error(response?.error || "Could not load tab state.");
  }

  copySupported = !response.unsupported;
  unlockEnabled = Boolean(response.domainEnabled);
  activeHostname = response.hostname || activeHostname;
  updateHeroUi();
  updateActionAvailability();
  siteTitleEl.textContent = unlockEnabled && activeHostname ? "Auto-enabled" : "";
}

async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/lib/readability.js", "src/content-script.js"]
    });
    return true;
  } catch {
    return false;
  }
}

async function sendToActiveTab(message) {
  const tab = await getActiveTab();
  if (!copySupported) {
    throw new Error("Copy actions are unavailable on this tab.");
  }

  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    const ok = await ensureContentScript(tab.id);
    if (!ok) {
      throw new Error("Could not inject copy tools into this tab.");
    }
    return chrome.tabs.sendMessage(tab.id, message);
  }
}

async function addHistory(text, type, meta = {}) {
  const response = await chrome.runtime.sendMessage({
    type: "ADD_HISTORY",
    payload: {
      text,
      type,
      source: "popup",
      meta
    }
  });

  if (!response?.ok) {
    throw new Error(response?.error || "Could not store history.");
  }

  return response.item;
}

async function copyReaderText() {
  const response = await sendToActiveTab({ type: "GET_READABLE_ARTICLE" });
  if (!response?.ok) {
    throw new Error(response?.error || "Reader extraction failed.");
  }
  const article = response.article;
  const text = `${article.title}\n\n${article.textContent}`.trim();
  if (!text) {
    throw new Error("No reader text found.");
  }
  await navigator.clipboard.writeText(text);
  await addHistory(text, "article", {
    title: article.title || currentTabInfo?.title || "Reader copy",
    siteName: article.siteName || currentTabInfo?.siteName || "",
    url: currentTabInfo?.url || "",
    preview: derivePreview(article.textContent)
  });
}

async function copyAllText() {
  const response = await sendToActiveTab({ type: "GET_VISIBLE_TEXT" });
  if (!response?.ok) {
    throw new Error(response?.error || "Could not extract page text.");
  }
  const text = response.text?.trim();
  if (!text) {
    throw new Error("No visible text found.");
  }
  await navigator.clipboard.writeText(text);
  await addHistory(text, "visible_text", {
    title: currentTabInfo?.title || "Visible text copy",
    siteName: currentTabInfo?.siteName || "",
    url: currentTabInfo?.url || "",
    preview: derivePreview(text)
  });
}

async function toggleDomainCopy() {
  const tab = await getActiveTab();
  if (!copySupported) {
    return;
  }

  isUnlocking = true;
  updateHeroUi();

  const response = await chrome.runtime.sendMessage({
    type: "TOGGLE_DOMAIN_COPY",
    payload: { tabId: tab.id }
  });

  isUnlocking = false;
  if (!response?.ok) {
    throw new Error(response?.error || "Could not update this domain.");
  }

  unlockEnabled = Boolean(response.enabled);
  if (activeHostname) {
    const next = new Set(settings.enabledDomains);
    if (unlockEnabled) {
      next.add(activeHostname);
    } else {
      next.delete(activeHostname);
    }
    settings.enabledDomains = Array.from(next);
  }

  if (unlockEnabled) {
    enableCopyBtn.classList.remove("is-animating");
    void enableCopyBtn.offsetWidth;
    enableCopyBtn.classList.add("is-animating");
    window.setTimeout(() => enableCopyBtn.classList.remove("is-animating"), 700);
  } else {
    enableCopyBtn.classList.remove("is-animating");
  }

  updateHeroUi();
  siteTitleEl.textContent = unlockEnabled && activeHostname ? "Auto-enabled" : "";
  renderEnabledDomains();
}

async function refreshPopup() {
  await Promise.all([loadSettings(), loadRecentHistory()]);
  await loadTabState();
}

enableCopyBtn.addEventListener("click", async () => {
  try {
    await toggleDomainCopy();
  } catch {
    isUnlocking = false;
    updateHeroUi();
  }
});

copyReaderBtn.addEventListener("click", async () => {
  try {
    await copyReaderText();
    await loadRecentHistory();
  } catch {}
});

copyAllBtn.addEventListener("click", async () => {
  try {
    await copyAllText();
    await loadRecentHistory();
  } catch {}
});

themeToggleBtn.addEventListener("click", async () => {
  try {
    settings.theme = settings.theme === "dark" ? "light" : "dark";
    await persistSettings();
  } catch {}
});

themeLightBtn.addEventListener("click", () => {
  settings.theme = "light";
  applyTheme(settings.theme);
});

themeDarkBtn.addEventListener("click", () => {
  settings.theme = "dark";
  applyTheme(settings.theme);
});

document.getElementById("saveSettings").addEventListener("click", async () => {
  try {
    await persistSettings();
  } catch {}
});

document.getElementById("clearHistory").addEventListener("click", async () => {
  try {
    await chrome.runtime.sendMessage({ type: "CLEAR_HISTORY" });
    await loadRecentHistory();
  } catch {}
});

toggleSettingsBtn.addEventListener("click", () => {
  const nextHidden = !settingsPanelEl.hidden;
  settingsPanelEl.hidden = nextHidden;
});

function openExtensionPage(path) {
  chrome.tabs.create({ url: chrome.runtime.getURL(path) });
}

document.getElementById("viewAllHistory").addEventListener("click", () => openExtensionPage("src/history.html"));

refreshPopup().catch(() => {
  renderEmptyRecentHistory();
});
