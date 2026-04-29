const listEl = document.getElementById("list");
const exportButton = document.getElementById("exportHistory");
const searchInputEl = document.getElementById("searchInput");
const typeFilterEl = document.getElementById("typeFilter");
const themeToggleBtn = document.getElementById("themeToggle");

const ICONS = {
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 1 0 9.8 9.8Z"></path></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2.5"></path><path d="M12 19.5V22"></path><path d="M4.93 4.93l1.77 1.77"></path><path d="M17.3 17.3l1.77 1.77"></path><path d="M2 12h2.5"></path><path d="M19.5 12H22"></path><path d="M4.93 19.07l1.77-1.77"></path><path d="M17.3 6.7l1.77-1.77"></path></svg>',
  empty: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7h8"></path><path d="M8 12h8"></path><path d="M8 17h5"></path><rect x="4" y="3" width="16" height="18" rx="2"></rect></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="10" height="10" rx="2"></rect><path d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1"></path></svg>'
};

let currentHistory = [];
let settings = {
  maxHistoryItems: 50,
  theme: "light"
};

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggleBtn.innerHTML = theme === "dark" ? ICONS.sun : ICONS.moon;
}

function formatAbsoluteDate(value) {
  const date = new Date(value);
  return `${date.toLocaleDateString()} - ${date.toLocaleTimeString()}`;
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

function derivePreview(text) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, 240);
}

function deriveTitle(item) {
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

function updateSummary(items) {
  const readerCount = items.filter((item) => item.type === "article").length;
  const visibleCount = items.filter((item) => item.type === "visible_text" || item.type === "selection").length;
  document.getElementById("historyCount").textContent = String(items.length);
  document.getElementById("readerCount").textContent = String(readerCount);
  document.getElementById("visibleCount").textContent = String(visibleCount);
}

function matchesFilter(item, query, typeFilter) {
  const haystack = [item.text, item.meta?.title, item.meta?.siteName, item.meta?.url, item.meta?.preview, item.type]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  if (typeFilter !== "all" && item.type !== typeFilter) {
    return false;
  }

  if (!query) {
    return true;
  }

  return haystack.includes(query);
}

function createEmptyState(title) {
  const node = document.createElement("div");
  node.className = "empty-state";
  node.innerHTML = `
    <div class="empty-mark">${ICONS.empty}</div>
    <h2 class="empty-title">${title}</h2>
  `;
  return node;
}

function createItemElement(item) {
  const node = document.createElement("article");
  const badgeClass = item.type === "article" ? "pill reader" : "pill visible";
  const badgeLabel = item.type === "article" ? "Reader" : item.type === "selection" ? "Selection" : "All Text";
  const siteMeta = item.meta?.siteName || item.meta?.url || "Local";
  node.className = "history-card";
  node.innerHTML = `
    <div class="history-header">
      <div style="min-width:0;flex:1;">
        <div class="${badgeClass}">${escapeHtml(badgeLabel)}</div>
        <h2 class="history-title" style="margin-top:10px;">${escapeHtml(deriveTitle(item))}</h2>
        <div class="history-meta" style="margin-top:6px;">${escapeHtml(formatRelativeTime(item.createdAt))} - ${escapeHtml(siteMeta)}</div>
        <div class="history-meta" style="margin-top:4px;">${escapeHtml(formatAbsoluteDate(item.createdAt))}</div>
      </div>
      <div class="history-actions">
        <button class="secondary-button history-view" type="button">View</button>
        <button class="secondary-button history-copy" type="button" aria-label="Copy item">${ICONS.copy}</button>
      </div>
    </div>
    <div class="history-body">${escapeHtml(item.meta?.preview || derivePreview(item.text))}</div>
    <textarea class="history-fulltext" readonly hidden></textarea>
  `;

  const fullTextEl = node.querySelector(".history-fulltext");
  fullTextEl.value = item.text || "";

  node.querySelector(".history-copy").addEventListener("click", async () => {
    await navigator.clipboard.writeText(item.text);
  });

  const viewButton = node.querySelector(".history-view");
  viewButton.addEventListener("click", () => {
    const expanded = !fullTextEl.hidden;
    fullTextEl.hidden = expanded;
    node.classList.toggle("is-expanded", !expanded);
    viewButton.textContent = expanded ? "View" : "Hide";
  });

  return node;
}

function renderHistory() {
  const query = searchInputEl.value.trim().toLowerCase();
  const typeFilter = typeFilterEl.value;
  const filtered = currentHistory.filter((item) => matchesFilter(item, query, typeFilter));

  listEl.innerHTML = "";

  if (!currentHistory.length) {
    listEl.appendChild(createEmptyState("No history"));
    updateSummary([]);
    return;
  }

  updateSummary(currentHistory);

  if (!filtered.length) {
    listEl.appendChild(createEmptyState("No match"));
    return;
  }

  const fragment = document.createDocumentFragment();
  filtered.forEach((item) => fragment.appendChild(createItemElement(item)));
  listEl.appendChild(fragment);
}

function updateExportButton() {
  exportButton.disabled = currentHistory.length === 0;
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportHistory() {
  if (!currentHistory.length) {
    return;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  downloadJson(`uncopy-history-${stamp}.json`, currentHistory);
}

async function loadSettings() {
  const response = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
  if (!response?.ok) {
    throw new Error(response?.error || "Could not load settings.");
  }

  settings = response.settings;
  applyTheme(settings.theme || "light");
}

async function saveTheme(theme) {
  const response = await chrome.runtime.sendMessage({
    type: "SAVE_SETTINGS",
    payload: {
      maxHistoryItems: settings.maxHistoryItems,
      theme,
      enabledDomains: settings.enabledDomains
    }
  });
  if (!response?.ok) {
    throw new Error(response?.error || "Could not save theme.");
  }

  settings = response.settings;
  applyTheme(settings.theme);
}

async function loadHistory() {
  const response = await chrome.runtime.sendMessage({ type: "GET_HISTORY" });
  if (!response?.ok) {
    throw new Error(response?.error || "Could not load history.");
  }

  currentHistory = response.history || [];
  updateExportButton();
  renderHistory();
}

async function clearHistory() {
  const response = await chrome.runtime.sendMessage({ type: "CLEAR_HISTORY" });
  if (!response?.ok) {
    throw new Error(response?.error || "Could not clear history.");
  }
}

document.getElementById("refresh").addEventListener("click", () => {
  loadHistory().catch(() => null);
});

document.getElementById("clearAll").addEventListener("click", async () => {
  try {
    await clearHistory();
    await loadHistory();
  } catch {}
});

document.getElementById("exportHistory").addEventListener("click", () => {
  exportHistory();
});

searchInputEl.addEventListener("input", renderHistory);
typeFilterEl.addEventListener("change", renderHistory);

themeToggleBtn.addEventListener("click", async () => {
  try {
    await saveTheme(settings.theme === "dark" ? "light" : "dark");
  } catch {}
});

Promise.all([loadSettings(), loadHistory()]).catch(() => {
  updateSummary([]);
  listEl.innerHTML = "";
  listEl.appendChild(createEmptyState("Unavailable"));
});
