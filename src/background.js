const STORAGE_KEYS = {
  HISTORY: "copyHistory",
  SETTINGS: "settings"
};

const DEFAULT_SETTINGS = {
  maxHistoryItems: 50
};

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  if (!existing[STORAGE_KEYS.SETTINGS]) {
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case "ADD_HISTORY": {
        const item = message.payload;
        const { [STORAGE_KEYS.HISTORY]: existing = [] } = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
        const { [STORAGE_KEYS.SETTINGS]: settings = DEFAULT_SETTINGS } = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);

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
        const { [STORAGE_KEYS.SETTINGS]: settings = DEFAULT_SETTINGS } = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
        sendResponse({ ok: true, settings: { ...DEFAULT_SETTINGS, ...settings } });
        break;
      }
      case "SAVE_SETTINGS": {
        const safe = {
          maxHistoryItems: Math.min(500, Math.max(10, Number(message.payload.maxHistoryItems) || DEFAULT_SETTINGS.maxHistoryItems))
        };
        await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: safe });
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
