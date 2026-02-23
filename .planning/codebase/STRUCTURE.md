# Directory Structure

**Analysis Date:** 2026-02-24

## Project Layout

```
typing-alarm/
├── .claude/                  # Claude Code configuration and workflows
├── docs/                     # Documentation (not tracked in git)
├── icons/                    # Extension icons and visual assets
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── manifest.json            # Chrome extension manifest (v3)
├── background.js            # Service worker (main background logic)
├── popup.html               # Main UI popup window
├── popup.js                 # Popup UI logic and event handlers
├── popup.css                # Popup styling
├── offscreen.html           # Offscreen document for audio playback
├── offscreen.js             # Audio playback logic (AudioContext)
└── time.js                  # Time parsing and scheduling utilities
```

## Key File Locations

### Core Logic Files

**`background.js`** - Service worker / background script
- Location: Root directory
- Purpose: Main extension lifecycle management
- Key functions:
  - `rescheduleAll()` - Rebuild all Chrome alarms from storage
  - `startActiveAlarm(id)` - Mark alarm as active in storage
  - `stopActiveAlarm()` - Clear active alarm and stop sound
  - `playAlarmSound()` - Trigger offscreen audio via messaging
  - `openAlarmPopup()` - Create/focus alarm notification window
- Dependencies: Imports from `time.js`
- Chrome APIs: `chrome.runtime`, `chrome.alarms`, `chrome.storage`, `chrome.notifications`, `chrome.windows`, `chrome.offscreen`

**`popup.js`** - Main UI controller
- Location: Root directory
- Purpose: Alarm list rendering, user interactions, CRUD operations
- Key functions:
  - `loadAndRender()` - Load from storage and render UI
  - `render(items)` - Build alarm list DOM (lines 111-231)
  - `onAdd()` - Parse input and create new alarm (lines 98-166)
  - `updateRemaining()` - Live countdown timer updates (lines 345-384)
  - `rescheduleLocal(items)` - Trigger background reschedule (lines 405-422)
- Dependencies: Imports from `time.js`
- Chrome APIs: `chrome.storage`, `chrome.runtime`

**`time.js`** - Time parsing and calculation utilities
- Location: Root directory
- Purpose: Parse natural language time inputs, compute next alarm occurrences
- Key exports:
  - `parseTimeString(input, now)` - Parse all time input formats (lines 1-36)
  - `computeNextOccurrence(item, now)` - Calculate next alarm time for recurring alarms (lines 214-247)
  - `formatTime(h, m, s)` - Format time for display (line 250)
  - `splitInputs(raw)` - Split multi-line input (line 260)
  - `defaultDaysForRepeat(repeat)` - Get default days for repeat types (line 270)
- No dependencies, pure utility module

### UI Files

**`popup.html`** - Main popup interface
- Location: Root directory
- Purpose: Extension popup UI structure
- Key elements:
  - `#timeInput` - Textarea for alarm input
  - `#list` - Container for alarm items
  - `#alarmBanner` - Active alarm notification banner
  - `#quickList` - Quick phrase shortcuts
  - `#itemTemplate` - Template for alarm list items
- Loads: `popup.css`, `popup.js` (as ES module)

**`popup.css`** - Popup styling
- Location: Root directory
- Purpose: All UI styling for popup window
- Key sections: Form inputs, alarm list, banner, buttons, quick phrases

### Audio Playback

**`offscreen.html`** - Offscreen document for audio
- Location: Root directory
- Purpose: Host AudioContext for alarm sound playback
- Why offscreen: Service workers can't play audio; requires separate document context
- Loads: `offscreen.js`

**`offscreen.js`** - Audio playback logic
- Location: Root directory
- Purpose: AudioContext management and sound generation
- Key functions:
  - Message listener for `start-sound` and `stop-sound`
  - Creates 880Hz sine wave tone
  - Manages looping via `setInterval`

### Extension Configuration

**`manifest.json`** - Chrome extension manifest
- Location: Root directory
- Purpose: Extension metadata, permissions, and resource declarations
- Manifest version: 3
- Permissions: `storage`, `alarms`, `notifications`, `offscreen`
- Background: `background.js` as ES module service worker
- Action: `popup.html`
- Web accessible resources: Icons for all URLs

### Assets

**`icons/`** - Extension icon set
- Location: `./icons/`
- Contents: Standard Chrome extension icon sizes (16, 32, 48, 128)
- Used in: manifest.json, notifications, browser toolbar

## Storage Key Conventions

**Chrome storage keys defined across files:**

- `STORAGE_KEY = "alarms"` - Main alarm items array
  - Defined in: `background.js` (line 3), `popup.js` (line 8)
  - Structure: `Array<{id, hour, minute, second?, message, repeat, days?, enabled, nextAt, lastFired?, oneOffAt?}>`

- `ACTIVE_KEY = "alarmActive"` / `STORAGE_ACTIVE_KEY = "alarmActive"` - Currently firing alarm
  - Defined in: `background.js` (line 4), `popup.js` (line 33)
  - Structure: `{id, startedAt}`

- `SETTINGS_KEY = "alarmSettings"` - User preferences
  - Defined in: `background.js` (line 5), `popup.js` (line 34)
  - Structure: `{duration: number (ms), interval: number (ms)}`

- `QUICK_KEY = "quickPhrases"` - Saved quick phrases
  - Defined in: `popup.js` (line 35)
  - Structure: `string[]`

- `QUICK_VERSION_KEY = "quickPhrasesVersion"` - Quick phrases schema version
  - Defined in: `popup.js` (line 36)
  - Current version: 2

## Naming Conventions

### Files
- Lowercase with hyphens for HTML: `offscreen.html`, `popup.html`
- camelCase for JavaScript: `background.js`, `popup.js`, `time.js`
- Lowercase for assets: `manifest.json`

### Functions
- camelCase for all functions: `parseTimeString`, `loadAndRender`, `rescheduleAll`
- Async functions prefix with verb: `loadItems()`, `saveItems()`, `startActiveAlarm()`
- Event handlers prefix with `on`: `onAdd()`, `onDelete()`
- DOM updates use descriptive verbs: `render()`, `updateRemaining()`, `showToast()`

### Variables
- camelCase for locals: `timeInput`, `alarmTimer`, `items`
- UPPER_SNAKE_CASE for constants: `STORAGE_KEY`, `ACTIVE_KEY`, `DEFAULT_ALARM_DURATION_MS`
- DOM element variables suffix with type: `timeInput`, `addError`, `listEl`, `refreshBtn`
- IDs generated with: `Date.now().toString(36) + Math.random().toString(36).slice(2)`

### CSS
- kebab-case for classes: `.alarm-item`, `.time-display`, `.alarm-banner`
- camelCase for IDs: `#timeInput`, `#alarmBanner`, `#quickList`

## Where to Add New Code

### Adding a new time input format
1. Add parsing logic to `time.js` → `parseDateBasedInput()` or `parseClockString()`
2. Update usage tooltip in `popup.html`
3. No changes needed in `background.js` or `popup.js`

### Adding a new alarm property
1. Update item structure in `popup.js` → `onAdd()` (where item is created)
2. Update rendering in `popup.js` → `render()` (lines 111-231)
3. Update storage read/write in `popup.js` and `background.js`
4. Update alarm scheduling logic in `background.js` → `chrome.alarms.onAlarm` listener
5. Consider updating `time.js` → `computeNextOccurrence()` if property affects scheduling

### Adding a new UI element
1. Add HTML structure to `popup.html`
2. Add styling to `popup.css`
3. Add event handlers and logic to `popup.js`
4. If element needs data from storage, update `loadAndRender()` or add new load function

### Adding a new notification sound
1. Modify `offscreen.js` to accept sound configuration via message
2. Update `background.js` → `playAlarmSound()` to pass sound settings
3. Add UI controls in `popup.html` and logic in `popup.js` for sound selection
4. Store sound preferences in settings via `SETTINGS_KEY`

### Adding a new background task
1. Add logic to `background.js` service worker
2. Use `chrome.alarms` for scheduled tasks (not setInterval/setTimeout in service worker)
3. Use message passing to communicate with popup via `chrome.runtime.onMessage`

### Modifying alarm lifecycle
- Alarm creation: `popup.js` → `onAdd()`
- Alarm scheduling: `background.js` → `rescheduleAll()` and alarm listener
- Alarm firing: `background.js` → `chrome.alarms.onAlarm` listener
- Alarm display: `popup.js` → `render()` and `updateRemaining()`
- Alarm deletion: `popup.js` → `onDelete()` (inside render function)

---

*Structure audit: 2026-02-24*
