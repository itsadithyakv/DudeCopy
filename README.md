# DudeCopy

DudeCopy is an open-source Chrome Extension (Manifest V3) for fast, reliable text extraction from webpages.

It focuses on two high-value actions:
- `Copy Text (Reader)`: extracts clean article-style content from the current page.
- `Copy All Text`: copies visible textual content from the current page.

It also includes:
- Local copy history (`chrome.storage.local`)
- History export as JSON
- Configurable history limit in settings
- Unsupported-tab detection with clear UI feedback

## Features

- **Reader copy**: Uses Mozilla Readability to extract structured, readable content.
- **All-text copy**: Traverses visible text nodes and collects on-screen text.
- **Local-first history**: Every copy action is stored locally on-device.
- **Export history**: Download complete history as a timestamped JSON file.
- **Settings**: Set max stored history entries (10-500).
- **Unsupported tab badge**: Copy actions are disabled on restricted tabs (for example `chrome://` pages or policy-blocked tabs).

## How It Works

1. User clicks an action in the popup.
2. Popup checks if the current tab can be scripted.
3. Content script runs one of two flows:
   - `GET_READABLE_ARTICLE`: clones the DOM and parses with Readability.
   - `GET_VISIBLE_TEXT`: collects visible text nodes from the live page.
4. Popup copies result to clipboard and writes it to local history via the background service worker.
5. History page can list, copy, clear, and export entries.

## Architecture

- `manifest.json`: MV3 config, permissions, pages, and scripts
- `src/background.js`: storage and settings message handling
- `src/content-script.js`: page text extraction logic
- `src/popup.html` + `src/scripts/popup.js`: primary UX and action handlers
- `src/history.html` + `src/scripts/history.js`: local history management and export
- `src/options.html` + `src/scripts/options.js`: extension settings
- `src/lib/readability.js`: bundled Mozilla Readability runtime

## Privacy

- No cloud backend.
- No telemetry.
- History is stored in `chrome.storage.local` on the user’s device.

## Setup (Development)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select this repository.
5. Open the DudeCopy popup and test on a regular website tab.

## Build Notes

- This project is currently loaded as an unpacked extension.
- The repository includes only the runtime needed for current features (`@mozilla/readability`).

## License

See [LICENSE](LICENSE).
