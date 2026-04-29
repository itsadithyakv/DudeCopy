# UnCopy

Version `1.1`

UnCopy is an open-source Chrome Extension (Manifest V3) for unlocking blocked selection and copying readable or visible text from webpages.

## Core Actions

- `Enable Copy`: Turns on copy unlock for the current site and automatically re-applies it on reload for domains you keep enabled.
- `Copy Text (Reader)`: Extracts article-style content using Mozilla Readability and copies it to clipboard.
- `Copy All Text`: Collects visible text from the page and copies it to clipboard.

## Features

- Reader-mode extraction for cleaner long-form content.
- Visible-text extraction for general pages.
- Local history stored in `chrome.storage.local`.
- History entries include copy timestamp (date and time).
- History export to JSON.
- Configurable history retention limit (10 to 500).
- Domain-based auto-enable list with inline removal from popup settings.
- One-click copy unlock for the active site, with re-apply on reload.
- Manual light/dark theme toggle stored in local settings, with light mode as the default.
- Toolbar icon set powered by `UncopyLogo.png`.
- Unsupported-tab handling with blocked state and disabled actions where scripting is not allowed.
- Richer local history cards with source metadata, preview text, search, filtering, and expandable full-text view.

## How It Works

1. User opens popup and enables copy unlock or chooses a copy action.
2. Popup checks:
   - whether active tab can be scripted
   - whether copy unlock is already enabled for the current domain
3. If needed, content scripts are injected into supported tabs.
4. Content script can:
   - remove common anti-copy restrictions and restore normal selection/copy behavior
   - `GET_READABLE_ARTICLE` for reader copy
   - `GET_VISIBLE_TEXT` for visible text copy
5. Popup copies extracted output to clipboard when using the secondary actions.
6. Background service worker stores copy results in local history with timestamp and site metadata.

## Project Structure

- `manifest.json`
- `icons/`
  - `Uncopy.png`
  - `UncopyLogo.png`
- `src/background.js` (domain unlock state, icons, badges, history/settings storage)
- `src/content-script.js` (anti-copy unlock and text extraction logic)
- `src/popup.html`
- `src/scripts/popup.js`
- `src/history.html`
- `src/scripts/history.js`
- `src/styles/common.css`
- `src/lib/readability.js`

## Release

`1.1` includes the UnCopy rebrand, the new popup/history UI, domain auto-enable management, and expandable history entries for partial manual copying.

## Privacy

- No backend services.
- No analytics/telemetry.
- Data remains local in browser storage unless user exports history manually.

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select this repository folder.
5. Use the UnCopy popup on a regular website tab.

## Notes

- Some tabs cannot be scripted by Chrome policy (for example `chrome://` pages).
- On unsupported tabs, UnCopy shows badges and disables unlock/copy actions by design.

## License

See [LICENSE](LICENSE).
