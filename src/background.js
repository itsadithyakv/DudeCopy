const STORAGE_KEYS = {
  HISTORY: "copyHistory",
  SETTINGS: "settings"
};

const DEFAULT_SETTINGS = {
  maxHistoryItems: 50,
  isPaused: false,
  theme: "light",
  enabledDomains: []
};

const unlockedTabs = new Set();

function getIconPath() {
  return {
    16: chrome.runtime.getURL("icons/UncopyLogo-16.png"),
    32: chrome.runtime.getURL("icons/UncopyLogo-32.png"),
    48: chrome.runtime.getURL("icons/UncopyLogo-48.png"),
    128: chrome.runtime.getURL("icons/UncopyLogo-128.png")
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
  const settings = { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] || {}) };
  settings.enabledDomains = Array.isArray(settings.enabledDomains) ? settings.enabledDomains : [];
  return settings;
}

async function setSettings(nextSettings) {
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: nextSettings });
}

async function syncActionIcon() {
  await chrome.action.setIcon({ path: getIconPath() });
}

async function setBadge(tabId, { text = "", backgroundColor = "#366fbc", textColor = "#ffffff" } = {}) {
  if (!tabId) {
    return;
  }
  await chrome.action.setBadgeBackgroundColor({ tabId, color: backgroundColor });
  await chrome.action.setBadgeTextColor({ tabId, color: textColor });
  await chrome.action.setBadgeText({ tabId, text });
}

async function syncBadgeForTab(tabId) {
  if (!tabId) {
    return;
  }

  const tab = await chrome.tabs.get(tabId).catch(() => null);
  const unsupported = isUrlUnsupported(tab?.url);

  if (unsupported) {
    unlockedTabs.delete(tabId);
    await setBadge(tabId, { text: "!", backgroundColor: "#d97757" });
    return;
  }

  if (unlockedTabs.has(tabId)) {
    await setBadge(tabId, { text: "ON", backgroundColor: "#366fbc" });
    return;
  }

  await setBadge(tabId, { text: "" });
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

function enableCopyInMainWorld() {
  if (window.__uncopyMainWorldInstalled) {
    return;
  }

  window.__uncopyMainWorldInstalled = true;

  const blockedTypes = new Set(["copy", "cut", "contextmenu", "selectstart", "dragstart"]);
  const keyTypes = new Set(["keydown", "keypress", "keyup"]);
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  const originalPreventDefault = Event.prototype.preventDefault;

  function isProtectedShortcut(event) {
    const key = String(event.key || "").toLowerCase();
    return (event.ctrlKey || event.metaKey) && ["a", "c", "v", "x"].includes(key);
  }

  function shouldBypass(event) {
    return blockedTypes.has(event.type) || (keyTypes.has(event.type) && isProtectedShortcut(event));
  }

  Event.prototype.preventDefault = function patchedPreventDefault() {
    if (shouldBypass(this)) {
      return false;
    }
    return originalPreventDefault.call(this);
  };

  EventTarget.prototype.addEventListener = function patchedAddEventListener(type, listener, options) {
    if (blockedTypes.has(type)) {
      return;
    }
    return originalAddEventListener.call(this, type, listener, options);
  };

  const guard = (event) => {
    if (!shouldBypass(event)) {
      return;
    }
    event.stopImmediatePropagation();
  };

  const targets = [window, document, document.documentElement, document.body].filter(Boolean);
  const types = ["copy", "cut", "contextmenu", "selectstart", "dragstart", "keydown", "keypress", "keyup"];

  for (const target of targets) {
    for (const type of types) {
      target.addEventListener(type, guard, true);
    }
  }

  const styleId = "uncopy-main-world-style";
  let style = document.getElementById(styleId);
  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    (document.head || document.documentElement).appendChild(style);
  }

  style.textContent = `
    html, body, body * {
      user-select: text !important;
      -webkit-user-select: text !important;
      -webkit-touch-callout: default !important;
      -webkit-tap-highlight-color: rgba(54, 111, 188, 0.18) !important;
      pointer-events: auto !important;
    }

    ::selection {
      background: rgba(54, 111, 188, 0.22) !important;
    }
  `;

  const cleanNode = (node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    node.style.setProperty("user-select", "text", "important");
    node.style.setProperty("-webkit-user-select", "text", "important");
    node.style.setProperty("-webkit-touch-callout", "default", "important");
    node.style.setProperty("pointer-events", "auto", "important");
    [
      "oncopy",
      "oncut",
      "onpaste",
      "oncontextmenu",
      "onselectstart",
      "ondragstart",
      "onkeydown",
      "onkeyup",
      "onkeypress",
      "onmousedown",
      "onmouseup",
      "onauxclick"
    ].forEach((attribute) => node.removeAttribute(attribute));
  };

  cleanNode(document.documentElement);
  cleanNode(document.body);
  document.querySelectorAll("*").forEach(cleanNode);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.target instanceof HTMLElement) {
        cleanNode(mutation.target);
      }
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          cleanNode(node);
          node.querySelectorAll?.("*").forEach(cleanNode);
        }
      });
    }
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["style", "class", "oncopy", "oncontextmenu", "onselectstart", "ondragstart"]
  });
}

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

async function enableCopyOnTab(tabId) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab?.id || isUrlUnsupported(tab.url)) {
    throw new Error("Copy unlock is unavailable on this tab.");
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: enableCopyInMainWorld
    });
  } catch (error) {
    throw new Error(error?.message || "Could not apply copy unlock in the page context.");
  }

  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "ENABLE_COPY_MODE" });
    if (!response?.ok) {
      throw new Error(response?.error || "Could not enable copy on this page.");
    }
  } catch {
    const ok = await ensureContentScript(tabId);
    if (!ok) {
      throw new Error("Could not inject copy tools into this tab.");
    }
    const response = await chrome.tabs.sendMessage(tabId, { type: "ENABLE_COPY_MODE" });
    if (!response?.ok) {
      throw new Error(response?.error || "Could not enable copy on this page.");
    }
  }

  unlockedTabs.add(tabId);
  await syncBadgeForTab(tabId);
  return { ok: true, enabled: true };
}

async function getTabCopyState(tabId) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  const unsupported = isUrlUnsupported(tab?.url);
  const hostname = getHostname(tab?.url);
  const settings = await getSettings();
  const domainEnabled = Boolean(hostname && settings.enabledDomains.includes(hostname));
  if (unsupported) {
    unlockedTabs.delete(tabId);
  }
  return {
    ok: true,
    unsupported,
    enabled: !unsupported && unlockedTabs.has(tabId),
    domainEnabled,
    hostname
  };
}

async function toggleDomainCopy(tabId) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab?.id || isUrlUnsupported(tab.url)) {
    throw new Error("Copy unlock is unavailable on this tab.");
  }

  const hostname = getHostname(tab.url);
  if (!hostname) {
    throw new Error("Could not determine the active domain.");
  }

  const settings = await getSettings();
  const enabledDomains = new Set(settings.enabledDomains);

  if (enabledDomains.has(hostname)) {
    enabledDomains.delete(hostname);
    unlockedTabs.delete(tabId);
    await setSettings({ ...settings, enabledDomains: Array.from(enabledDomains) });
    await syncBadgeForTab(tabId);
    await chrome.tabs.reload(tabId).catch(() => null);
    return { ok: true, enabled: false, hostname };
  }

  enabledDomains.add(hostname);
  await setSettings({ ...settings, enabledDomains: Array.from(enabledDomains) });
  await enableCopyOnTab(tabId);
  return { ok: true, enabled: true, hostname };
}

async function refreshActiveTabBadge() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]?.id) {
    return;
  }
  await syncBadgeForTab(tabs[0].id);
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await getSettings();
  await setSettings(existing);
  await syncActionIcon();
  await refreshActiveTabBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  await syncActionIcon();
  await refreshActiveTabBadge();
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await syncBadgeForTab(activeInfo.tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  unlockedTabs.delete(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    if (isUrlUnsupported(changeInfo.url)) {
      unlockedTabs.delete(tabId);
    }
    await syncBadgeForTab(tabId);
  }

  if (changeInfo.status === "complete") {
    const settings = await getSettings();
    const hostname = getHostname(tab?.url);
    const shouldEnable = hostname && settings.enabledDomains.includes(hostname);

    if (shouldEnable && !isUrlUnsupported(tab?.url)) {
      await enableCopyOnTab(tabId).catch(() => null);
    } else {
      unlockedTabs.delete(tabId);
      await syncBadgeForTab(tabId);
    }
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
        sendResponse({ ok: true, isPaused: next.isPaused });
        break;
      }
      case "ENABLE_COPY_ON_TAB": {
        const tabId = Number(message.payload?.tabId || sender.tab?.id);
        sendResponse(await enableCopyOnTab(tabId));
        break;
      }
      case "GET_TAB_COPY_STATE": {
        const tabId = Number(message.payload?.tabId || sender.tab?.id);
        sendResponse(await getTabCopyState(tabId));
        break;
      }
      case "TOGGLE_DOMAIN_COPY": {
        const tabId = Number(message.payload?.tabId || sender.tab?.id);
        sendResponse(await toggleDomainCopy(tabId));
        break;
      }
      case "SET_TAB_UNSUPPORTED": {
        const tabId = Number(message.payload?.tabId || sender.tab?.id);
        if (message.payload?.unsupported) {
          unlockedTabs.delete(tabId);
        }
        await syncBadgeForTab(tabId);
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
        const safeTheme = message.payload?.theme === "dark" ? "dark" : "light";
        const safe = {
          ...current,
          maxHistoryItems: Math.min(500, Math.max(10, Number(message.payload.maxHistoryItems) || DEFAULT_SETTINGS.maxHistoryItems)),
          theme: safeTheme,
          enabledDomains: Array.isArray(message.payload?.enabledDomains) ? message.payload.enabledDomains : current.enabledDomains
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
