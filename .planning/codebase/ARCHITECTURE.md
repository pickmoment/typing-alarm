# Architecture

**Analysis Date:** 2026-02-24

## Pattern Overview

**Overall:** Event-driven service worker architecture with decoupled UI and alarm processing

**Key Characteristics:**
- Service worker pattern for persistent background processing (Chrome Extensions MV3)
- Message-passing architecture for inter-component communication
- Offscreen document pattern for audio playback (required by Chrome APIs)
- Functional programming with pure utility functions for time/date logic
- Local storage-based state persistence

## Layers

**Service Worker (Background):**
- Purpose: Core alarm scheduling, lifecycle management, and chrome API orchestration
- Location: `background.js`
- Contains: Chrome event listeners, alarm scheduling logic, notification triggering, popup window management, offscreen document coordination
- Depends on: `time.js` for schedule calculations, Chrome APIs (alarms, storage, notifications, windows, offscreen)
- Used by: Popup UI (via messages), Chrome platform events, offscreen document

**Popup UI Layer:**
- Purpose: User interface for alarm management, time input, and settings configuration
- Location: `popup.js`, `popup.html`, `popup.css`
- Contains: Input parsing, list rendering with live updates, form handling, settings management, quick phrase management
- Depends on: `time.js` for input validation and schedule calculations, Chrome storage API, Service worker (via messaging)
- Used by: User interactions, storage change listeners

**Time/Date Utility Layer:**
- Purpose: Parse flexible time input formats, compute next alarm occurrences, format time values
- Location: `time.js`
- Contains: Pure functions for time string parsing, occurrence calculation, date manipulation
- Depends on: JavaScript Date API only (no external dependencies)
- Used by: Service worker, Popup UI for validation and scheduling

**Offscreen Audio Layer:**
- Purpose: Isolated audio playback execution (required by Chrome Extensions MV3 for audio playback in service workers)
- Location: `offscreen.js`, `offscreen.html`
- Contains: Web Audio API oscillator-based beep generation, interval-based looping
- Depends on: Chrome messaging API, Web Audio API
- Used by: Service worker (receives commands via messages)

## Data Flow

**Adding an Alarm (User Initiates):**

1. User enters time string in `popup.js` text area (e.g., "9:30", "20분후", "내일 09:00")
2. `popup.js` calls `parseTimeString()` from `time.js` to validate and parse
3. Duplicate check performed via `isDuplicateAlarm()`
4. New alarm object created with UUID and stored in Chrome local storage (key: "alarms")
5. `popup.js` calls `rescheduleLocal()` to create Chrome alarm entries
6. Service worker (`background.js`) is notified of storage changes
7. Chrome alarms are scheduled at computed `nextAt` timestamps

**Alarm Firing (System Triggered):**

1. Chrome Alarms API fires at scheduled time, triggers `chrome.alarms.onAlarm` listener in `background.js`
2. Service worker retrieves alarm metadata from storage (key: "alarms")
3. Service worker creates desktop notification with alarm time and message
4. Service worker calls `startActiveAlarm()` to:
   - Store active alarm state in storage (key: "alarmActive")
   - Trigger offscreen document creation for audio playback
   - Send message to offscreen document to start sound loop
   - Schedule auto-stop alarm
5. Service worker calls `openAlarmPopup()` to open dedicated popup window with alarm state
6. Popup UI subscribes to storage changes and displays active alarm banner
7. User clicks "알람 끄기" button, sends `stopAlarm` message to service worker
8. Service worker clears active alarm state and stops offscreen sound

**Scheduling Next Occurrence:**

1. When alarm fires, service worker computes next occurrence using `computeNextOccurrence(item, now)`
2. If repeat is "once" or one-off, alarm is removed from list
3. If repeat is "daily", "weekdays", "weekends", or "custom", next date is calculated
4. New Chrome alarm scheduled at computed `nextAt` timestamp (in milliseconds)
5. Updated alarm list persisted to storage

**State Management:**

- **Alarm List Storage:** Array stored as `chrome.storage.local[STORAGE_KEY]` ("alarms")
- **Active Alarm State:** Object stored as `chrome.storage.local[STORAGE_ACTIVE_KEY]` ("alarmActive") containing `{id, title, startedAt, endsAt}`
- **Settings:** Object stored as `chrome.storage.local[SETTINGS_KEY]` ("alarmSettings") containing `{durationMs, intervalMs}`
- **Quick Phrases:** Array stored as `chrome.storage.local[QUICK_KEY]` ("quickPhrases")

## Key Abstractions

**Alarm Item Object:**
- Purpose: Encapsulates all alarm configuration and scheduling state
- Examples: `background.js` line 50-92, `popup.js` line 443-458
- Pattern: Plain JavaScript object with properties: `id`, `hour`, `minute`, `second`, `message`, `repeat`, `days`, `enabled`, `oneOffAt`, `nextAt`, `lastFired`, `createdAt`, `raw`, `hasSeconds`
- Normalized representation ensures consistent state across service worker, popup, and storage

**Time Parsing Pipeline:**
- Purpose: Transform user input text to standardized time/date representation
- Examples: `time.js` lines 1-36 (entry point), 38-119 (date parsing), 121-197 (clock parsing)
- Pattern: Sequential regex matching with fallback chain → `parseTimeString()` → `parseDateBasedInput()` or `parseClockString()` → returns `{hour, minute, second, hasSeconds, normalized, absoluteAt?}`

**Message Protocol:**
- Purpose: Standardize communication between popup, service worker, and offscreen document
- Examples: `background.js` line 20-33, `offscreen.js` line 4-14, `popup.js` line 264
- Pattern: Type-based routing with message objects: `{type: string, ...payload}`
  - `reschedule`: Popup → Service Worker (trigger full reschedule)
  - `playSound`: Popup → Service Worker (one-off beep)
  - `stopAlarm`: Popup → Service Worker (stop active alarm)
  - `offscreen-play`, `offscreen-start`, `offscreen-stop`: Service Worker → Offscreen (control audio)

## Entry Points

**Service Worker Initialization:**
- Location: `background.js` lines 12-18
- Triggers: Chrome extension install (`chrome.runtime.onInstalled`), browser startup (`chrome.runtime.onStartup`)
- Responsibilities: Call `rescheduleAll()` to rebuild alarm schedules from persisted state

**Popup Window:**
- Location: `popup.html` (linked from `manifest.json` action), `popup.js` module initialization (lines 81-89)
- Triggers: User clicks extension icon
- Responsibilities: Load and render alarm list, handle user input, manage settings, display active alarm state

**Background Alarms:**
- Location: `background.js` lines 41-95
- Triggers: Chrome Alarms API fires at scheduled times
- Responsibilities: Create notifications, manage active alarm state, reschedule recurring alarms

**Offscreen Audio:**
- Location: `offscreen.html`, `offscreen.js` lines 4-14
- Triggers: Service worker sends messages requesting audio
- Responsibilities: Create Web Audio oscillators, generate beep sounds at intervals

## Error Handling

**Strategy:** Graceful degradation with user-facing error messages and console logging

**Patterns:**

- **Storage Errors:** Try-catch blocks around all storage operations; `verifyStoredItems()` validates persistence before confirming success to user (`popup.js` lines 201-213)
- **Notification Errors:** Chrome API errors caught and logged; `chrome.runtime.lastError` checked (`background.js` lines 68-75)
- **Popup Window Errors:** Window creation errors caught; fallback to no-op (`background.js` lines 177-199)
- **Time Parsing:** Return `null` for unparseable input; UI displays "인식할 수 없는 입력" message (`popup.js` lines 464-466)
- **Duplicate Detection:** Checked before insert; conflicts reported to user (`popup.js` lines 176-180)
- **Validation:** Input bounds checked (e.g., seconds 5-900, interval 1-30) with validation messages (`popup.js` lines 272-279)

## Cross-Cutting Concerns

**Logging:**
- Approach: `console.error()` for critical failures (notification errors, popup window open failures)
- Instances: `background.js` lines 70, 74, 197

**Validation:**
- Input parsing: Multi-stage regex validation in `time.js` with format fallback chain
- Duplicate detection: Compare hour/minute/second or absoluteAt (`popup.js` lines 508-520)
- Storage verification: Fetch and verify after save (`popup.js` lines 475-480)
- Settings bounds: Numeric range checks with user feedback (`popup.js` lines 272-279)

**Authentication:**
- Not applicable; extension operates within user's browser context

---

*Architecture analysis: 2026-02-24*
