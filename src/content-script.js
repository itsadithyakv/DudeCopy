function isVisibleElement(element) {
  if (!(element instanceof Element)) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function shouldSkipNode(node) {
  const parent = node.parentElement;
  if (!parent) {
    return true;
  }

  const tag = parent.tagName;
  if (["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "CANVAS"].includes(tag)) {
    return true;
  }

  return !isVisibleElement(parent);
}

function collectVisibleText() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  const chunks = [];

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (shouldSkipNode(node)) {
      continue;
    }

    const text = node.textContent?.replace(/\s+/g, " ").trim();
    if (text) {
      chunks.push(text);
    }
  }

  const unique = [];
  const seen = new Set();
  for (const chunk of chunks) {
    if (!seen.has(chunk)) {
      seen.add(chunk);
      unique.push(chunk);
    }
  }

  return unique.join("\n").trim();
}

function extractReadableArticle() {
  const doc = document.cloneNode(true);
  const reader = new Readability(doc, {
    keepClasses: false,
    nbTopCandidates: 5,
    charThreshold: 140
  });

  const parsed = reader.parse();
  if (!parsed?.textContent) {
    return null;
  }

  return {
    title: parsed.title || document.title,
    byline: parsed.byline || "",
    excerpt: parsed.excerpt || "",
    textContent: parsed.textContent.trim(),
    siteName: parsed.siteName || location.hostname,
    length: parsed.length || parsed.textContent.length
  };
}

const UNCOPY_STATE = {
  enabled: false,
  observer: null,
  cleanup: []
};

function installUnlockStyles() {
  const styleId = "uncopy-selection-style";
  let style = document.getElementById(styleId);
  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    document.documentElement.appendChild(style);
  }

  style.textContent = `
    html, body, body * {
      -webkit-user-select: text !important;
      user-select: text !important;
      -webkit-touch-callout: default !important;
      -webkit-tap-highlight-color: rgba(54, 111, 188, 0.18) !important;
    }

    input, textarea, [contenteditable="true"] {
      -webkit-user-select: text !important;
      user-select: text !important;
    }

    ::selection {
      background: rgba(54, 111, 188, 0.22) !important;
    }
  `;
}

function enforceSelectableTree(root = document.documentElement) {
  if (!root) {
    return;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  do {
    const node = walker.currentNode;
    if (!(node instanceof HTMLElement)) {
      continue;
    }

    node.style.setProperty("user-select", "text", "important");
    node.style.setProperty("-webkit-user-select", "text", "important");
    node.style.setProperty("-webkit-touch-callout", "default", "important");
    node.style.setProperty("pointer-events", "auto", "important");
    node.removeAttribute("oncopy");
    node.removeAttribute("oncut");
    node.removeAttribute("onpaste");
    node.removeAttribute("oncontextmenu");
    node.removeAttribute("onselectstart");
    node.removeAttribute("ondragstart");
    node.removeAttribute("onkeydown");
    node.removeAttribute("onkeyup");
    node.removeAttribute("onkeypress");
    node.removeAttribute("onmousedown");
    node.removeAttribute("onmouseup");
    node.removeAttribute("onauxclick");
  } while (walker.nextNode());
}

function clearInlineBlockers() {
  const handlerAttributes = [
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
  ];
  const targets = [document, document.documentElement, document.body, ...document.querySelectorAll("*")];

  targets.forEach((target) => {
    if (!target) {
      return;
    }

    handlerAttributes.forEach((attribute) => {
      if (target.removeAttribute) {
        target.removeAttribute(attribute);
      }
      const propertyName = attribute.toLowerCase();
      if (propertyName in target) {
        try {
          target[propertyName] = null;
        } catch {}
      }
    });

    if (target instanceof HTMLElement) {
      target.style.setProperty("user-select", "text", "important");
      target.style.setProperty("-webkit-user-select", "text", "important");
      target.style.setProperty("-webkit-touch-callout", "default", "important");
      target.style.setProperty("pointer-events", "auto", "important");
    }
  });
}

function installPersistentUnlock() {
  if (UNCOPY_STATE.observer) {
    return;
  }

  UNCOPY_STATE.observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          enforceSelectableTree(node);
        }
      });
      if (mutation.target instanceof HTMLElement) {
        enforceSelectableTree(mutation.target);
      }
    }
  });

  UNCOPY_STATE.observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["style", "class", "oncopy", "oncontextmenu", "onselectstart", "ondragstart"]
  });
}

function installCaptureGuards() {
  if (UNCOPY_STATE.cleanup.length) {
    return;
  }

  const guard = (event) => {
    const type = event.type;
    const key = String(event.key || "").toLowerCase();
    const isShortcut = (event.ctrlKey || event.metaKey) && ["a", "c", "v", "x"].includes(key);
    const shouldGuard = ["copy", "cut", "contextmenu", "selectstart", "dragstart"].includes(type) || (["keydown", "keypress", "keyup"].includes(type) && isShortcut);

    if (!shouldGuard) {
      return;
    }

    event.stopImmediatePropagation();
  };

  const targets = [window, document, document.documentElement, document.body].filter(Boolean);
  const types = ["copy", "cut", "contextmenu", "selectstart", "dragstart", "keydown", "keypress", "keyup"];

  for (const target of targets) {
    for (const type of types) {
      target.addEventListener(type, guard, true);
      UNCOPY_STATE.cleanup.push(() => target.removeEventListener(type, guard, true));
    }
  }
}

function installCopyHistoryBridge() {
  if (window.__uncopyHistoryListenerInstalled) {
    return;
  }
  window.__uncopyHistoryListenerInstalled = true;

  const listener = () => {
    const selectedText = String(window.getSelection?.()?.toString() || "").trim();
    if (!selectedText) {
      return;
    }

    chrome.runtime.sendMessage({
      type: "ADD_HISTORY",
      payload: {
        text: selectedText,
        type: "selection",
        source: "page-selection",
        meta: {
          title: document.title || location.hostname,
          siteName: location.hostname,
          url: location.href,
          preview: selectedText.slice(0, 140)
        }
      }
    });
  };

  document.addEventListener("copy", listener, true);
  UNCOPY_STATE.cleanup.push(() => document.removeEventListener("copy", listener, true));
}

function enableCopyMode() {
  UNCOPY_STATE.enabled = true;
  installUnlockStyles();
  enforceSelectableTree();
  clearInlineBlockers();
  installPersistentUnlock();
  installCaptureGuards();
  installCopyHistoryBridge();

  try {
    document.documentElement.removeAttribute("oncontextmenu");
    document.body?.removeAttribute("oncontextmenu");
  } catch {}

  return {
    enabled: true,
    hostname: location.hostname
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
    switch (message?.type) {
      case "GET_VISIBLE_TEXT": {
        const text = collectVisibleText();
        sendResponse({ ok: true, text });
        break;
      }
      case "GET_READABLE_ARTICLE": {
        const article = extractReadableArticle();
        if (!article) {
          sendResponse({ ok: false, error: "No readable article detected on this page." });
          return;
        }
        sendResponse({ ok: true, article });
        break;
      }
      case "ENABLE_COPY_MODE": {
        sendResponse({ ok: true, ...enableCopyMode() });
        break;
      }
      default:
        sendResponse({ ok: false, error: "Unknown message type" });
    }
  } catch (error) {
    sendResponse({ ok: false, error: error?.message || "Unexpected error" });
  }

  return false;
});
