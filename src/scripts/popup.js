const statusEl = document.getElementById("status");
const unsupportedBadgeEl = document.getElementById("unsupportedBadge");
const copyReaderBtn = document.getElementById("copyReader");
const copyAllBtn = document.getElementById("copyAll");

let copySupported = false;

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.className = isError ? "status error" : "status";
}

function canScriptUrl(url) {
  if (!url) {
    return false;
  }
  return !/^(chrome|chrome-extension|edge|about|devtools|view-source):/i.test(url);
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) {
    throw new Error("No active tab found.");
  }
  return tab;
}

function applyUnsupportedState(unsupported, reason = "") {
  copySupported = !unsupported;
  copyReaderBtn.disabled = unsupported;
  copyAllBtn.disabled = unsupported;
  unsupportedBadgeEl.classList.toggle("hidden", !unsupported);
  if (unsupported && reason) {
    setStatus(reason, true);
  }
}

async function detectCopySupport() {
  const tab = await getActiveTab();
  if (!canScriptUrl(tab.url)) {
    applyUnsupportedState(true, "Unsupported tab: copy actions are blocked on this page type.");
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => true
    });
    applyUnsupportedState(false);
    setStatus("Ready.");
  } catch (error) {
    const raw = String(error?.message || error || "");
    if (raw.includes("ExtensionsSettings policy")) {
      applyUnsupportedState(true, "Unsupported tab: browser/enterprise policy blocks page scripting.");
      return;
    }
    applyUnsupportedState(true, "Unsupported tab for copy actions.");
  }
}

async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/lib/readability.js", "src/content-script.js"]
    });
    return true;
  } catch (error) {
    const raw = String(error?.message || error || "");
    if (raw.includes("ExtensionsSettings policy")) {
      applyUnsupportedState(true, "Unsupported tab: browser/enterprise policy blocks page scripting.");
    }
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

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

async function addHistory(text, type, meta = {}) {
  await chrome.runtime.sendMessage({
    type: "ADD_HISTORY",
    payload: {
      text,
      type,
      source: "popup",
      meta
    }
  });
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
  await copyText(text);
  await addHistory(text, "article", { title: article.title, siteName: article.siteName });
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
  await copyText(text);
  await addHistory(text, "visible_text");
}

copyReaderBtn.addEventListener("click", async () => {
  setStatus("Copying reader text...");
  try {
    await copyReaderText();
    setStatus("Reader text copied.");
  } catch (error) {
    setStatus(error?.message || "Unexpected reader copy error.", true);
  }
});

copyAllBtn.addEventListener("click", async () => {
  setStatus("Copying all text...");
  try {
    await copyAllText();
    setStatus("All visible text copied.");
  } catch (error) {
    setStatus(error?.message || "Unexpected copy error.", true);
  }
});

detectCopySupport().catch((error) => {
  applyUnsupportedState(true, "Unsupported tab for copy actions.");
  setStatus(error?.message || "Failed to detect tab support.", true);
});
