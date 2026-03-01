# DudeCopy

DudeCopy is an open-source Chrome Extension (Manifest V3) for quickly copying readable and visible text from webpages.

## Core Actions

- `Copy Text (Reader)`: Extracts article-style content using Mozilla Readability and copies it to clipboard.
- `Copy All Text`: Collects visible text from the page and copies it to clipboard.

## Features

- Reader-mode extraction for cleaner long-form content.
- Visible-text extraction for general pages.
- Local history stored in `chrome.storage.local`.
- History entries include copy timestamp (date and time).
- History export to JSON.
- Configurable history retention limit (10 to 500).
- Pause/Resume extension mode from popup.
- Dynamic toolbar icon:
  - `dudeOn.png` when active
  - `dudeOff.png` when paused
- Unsupported-tab handling:
  - Popup badge shown for unsupported tabs
  - Toolbar icon badge shown for unsupported tabs
  - Copy actions disabled when scripting is not allowed

## How It Works

1. User opens popup and chooses a copy action.
2. Popup checks:
   - extension pause state
   - whether active tab can be scripted
3. If needed, content scripts are injected into supported tabs.
4. Content script extracts text:
   - `GET_READABLE_ARTICLE` for reader copy
   - `GET_VISIBLE_TEXT` for visible text copy
5. Popup copies output to clipboard.
6. Background service worker stores result in local history with timestamp.

## Project Structure

- `manifest.json`
- `icons/`
  - `dudeOn.png`
  - `dudeOff.png`
  - `dudeBar.png`
- `src/background.js` (state, icons, badges, history/settings storage)
- `src/content-script.js` (text extraction logic)
- `src/popup.html`
- `src/scripts/popup.js`
- `src/history.html`
- `src/scripts/history.js`
- `src/options.html`
- `src/scripts/options.js`
- `src/styles/common.css`
- `src/lib/readability.js`

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
5. Use the DudeCopy popup on a regular website tab.

## Notes

- Some tabs cannot be scripted by Chrome policy (for example `chrome://` pages).
- On unsupported tabs, DudeCopy shows badges and disables copy actions by design.

## License

See [LICENSE](LICENSE).
