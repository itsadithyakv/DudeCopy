const STORAGE_KEYS = {
  HISTORY: "copyHistory",
  SETTINGS: "settings"
};

const DEFAULT_SETTINGS = {
  maxHistoryItems: 50,
  isPaused: false
};

function getIconPath(isPaused) {
  const iconFile = isPaused ? "icons/dudeOff.png" : "icons/dudeOn.png";
  return {
    16: chrome.runtime.getURL(iconFile),
    32: chrome.runtime.getURL(iconFile),
    48: chrome.runtime.getURL(iconFile),
    128: chrome.runtime.getURL(iconFile)
  };
}

function isUrlUnsupported(url) {
  if (!url) {
    return true;
  }
  return /^(chrome|chrome-extension|edge|about|devtools|view-source):/i.test(url);
}

async function getSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] || {}) };
}

async function setSettings(nextSettings) {
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: nextSettings });
}

async function syncActionIcon() {
  const settings = await getSettings();
  await chrome.action.setIcon({ path: getIconPath(settings.isPaused) });
}

async function setUnsupportedBadge(tabId, unsupported) {
  if (!tabId) {
    return;
  }
  await chrome.action.setBadgeBackgroundColor({ tabId, color: unsupported ? "#ff5c5c" : "#00ffb3" });
  await chrome.action.setBadgeText({ tabId, text: unsupported ? "!" : "" });
  await chrome.action.setBadgeTextColor({ tabId, color: "#0f0f10" });
}

async function refreshUnsupportedBadgeForTab(tabId) {
  if (!tabId) {
    return;
  }
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  const unsupported = isUrlUnsupported(tab?.url);
  await setUnsupportedBadge(tabId, unsupported);
}

async function refreshUnsupportedBadgeForActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]?.id) {
    return;
  }
  await refreshUnsupportedBadgeForTab(tabs[0].id);
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await getSettings();
  await setSettings(existing);
  await syncActionIcon();
  await refreshUnsupportedBadgeForActiveTab();
});

chrome.runtime.onStartup.addListener(async () => {
  await syncActionIcon();
  await refreshUnsupportedBadgeForActiveTab();
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await refreshUnsupportedBadgeForTab(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    await refreshUnsupportedBadgeForTab(tabId);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case "GET_EXTENSION_STATE": {
        const settings = await getSettings();
        sendResponse({ ok: true, isPaused: Boolean(settings.isPaused) });
        break;
      }
      case "TOGGLE_PAUSE": {
        const settings = await getSettings();
        const next = { ...settings, isPaused: !settings.isPaused };
        await setSettings(next);
        await chrome.action.setIcon({ path: getIconPath(next.isPaused) });
        sendResponse({ ok: true, isPaused: next.isPaused });
        break;
      }
      case "SET_TAB_UNSUPPORTED": {
        const tabId = Number(message.payload?.tabId || sender.tab?.id);
        const unsupported = Boolean(message.payload?.unsupported);
        await setUnsupportedBadge(tabId, unsupported);
        sendResponse({ ok: true });
        break;
      }
      case "ADD_HISTORY": {
        const item = message.payload;
        const { [STORAGE_KEYS.HISTORY]: existing = [] } = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
        const settings = await getSettings();

        const nextItem = {
          id: crypto.randomUUID(),
          text: item.text,
          source: item.source,
          type: item.type,
          createdAt: new Date().toISOString(),
          meta: item.meta || {}
        };

        const next = [nextItem, ...existing].slice(0, settings.maxHistoryItems || DEFAULT_SETTINGS.maxHistoryItems);
        await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: next });
        sendResponse({ ok: true, item: nextItem });
        break;
      }
      case "GET_HISTORY": {
        const { [STORAGE_KEYS.HISTORY]: history = [] } = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
        sendResponse({ ok: true, history });
        break;
      }
      case "CLEAR_HISTORY": {
        await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: [] });
        sendResponse({ ok: true });
        break;
      }
      case "GET_SETTINGS": {
        const settings = await getSettings();
        sendResponse({ ok: true, settings });
        break;
      }
      case "SAVE_SETTINGS": {
        const current = await getSettings();
        const safe = {
          ...current,
          maxHistoryItems: Math.min(500, Math.max(10, Number(message.payload.maxHistoryItems) || DEFAULT_SETTINGS.maxHistoryItems))
        };
        await setSettings(safe);
        sendResponse({ ok: true, settings: safe });
        break;
      }
      default:
        sendResponse({ ok: false, error: "Unknown message type" });
    }
  })().catch((error) => {
    sendResponse({ ok: false, error: error?.message || "Unexpected error" });
  });

  return true;
});
