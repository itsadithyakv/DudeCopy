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
      default:
        sendResponse({ ok: false, error: "Unknown message type" });
    }
  } catch (error) {
    sendResponse({ ok: false, error: error?.message || "Unexpected error" });
  }

  return false;
});
