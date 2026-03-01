const listEl = document.getElementById("list");
const statusEl = document.getElementById("status");
const exportButton = document.getElementById("exportHistory");

let currentHistory = [];

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = isError ? "status error" : "status";
}

function formatDateTimeParts(value) {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString(),
    time: date.toLocaleTimeString()
  };
}

function createItemElement(item) {
  const node = document.createElement("article");
  node.className = "item";

  const meta = document.createElement("div");
  meta.className = "item-meta";
  const parts = formatDateTimeParts(item.createdAt);
  meta.textContent = `Copied on ${parts.date} at ${parts.time}`;

  const metaType = document.createElement("div");
  metaType.className = "item-meta";
  metaType.textContent = `Type: ${item.type || "unknown"}`;

  const text = document.createElement("div");
  text.className = "item-text";
  text.textContent = item.text;

  const actions = document.createElement("div");
  actions.className = "row";

  const copyButton = document.createElement("button");
  copyButton.textContent = "Copy";
  copyButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(item.text);
    setStatus("Copied item to clipboard.");
  });

  actions.appendChild(copyButton);
  node.append(meta, metaType, text, actions);
  return node;
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
    throw new Error("No history to export.");
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  downloadJson(`dudecopy-history-${stamp}.json`, currentHistory);
}

async function loadHistory() {
  const response = await chrome.runtime.sendMessage({ type: "GET_HISTORY" });
  if (!response?.ok) {
    throw new Error(response?.error || "Could not load history.");
  }

  currentHistory = response.history;
  updateExportButton();
  listEl.innerHTML = "";

  if (!currentHistory.length) {
    setStatus("No history yet.");
    return;
  }

  const fragment = document.createDocumentFragment();
  currentHistory.forEach((item) => {
    fragment.appendChild(createItemElement(item));
  });
  listEl.appendChild(fragment);
  setStatus(`Loaded ${currentHistory.length} items.`);
}

async function clearHistory() {
  const response = await chrome.runtime.sendMessage({ type: "CLEAR_HISTORY" });
  if (!response?.ok) {
    throw new Error(response?.error || "Could not clear history.");
  }
}

document.getElementById("refresh").addEventListener("click", () => {
  loadHistory().catch((error) => setStatus(error?.message || "Unexpected error.", true));
});

document.getElementById("clearAll").addEventListener("click", async () => {
  setStatus("Clearing...");
  try {
    await clearHistory();
    await loadHistory();
    setStatus("History cleared.");
  } catch (error) {
    setStatus(error?.message || "Unexpected error.", true);
  }
});

exportButton.addEventListener("click", () => {
  try {
    exportHistory();
    setStatus("History exported.");
  } catch (error) {
    setStatus(error?.message || "Unexpected export error.", true);
  }
});

loadHistory().catch((error) => setStatus(error?.message || "Unexpected error.", true));
