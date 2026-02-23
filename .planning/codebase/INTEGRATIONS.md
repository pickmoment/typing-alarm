# External Integrations

**Analysis Date:** 2026-02-24

## APIs & External Services

**None detected**

This is a fully self-contained Chrome extension with no external API dependencies.

## Data Storage

**Databases:**
- None - Uses only local storage

**Local Storage:**
- Type: Chrome Extension `chrome.storage.local` API
- Connection: Built-in to Chrome extension system
- Data persisted across:
  - Browser sessions
  - Extension installations/updates
  - User data includes: alarms, settings, quick phrases

**Storage Keys:**
- `alarms` - Array of alarm objects with schedule, message, repeat settings
- `alarmSettings` - User preferences for alarm duration and sound interval
- `quickPhrases` - Saved quick input phrases for rapid alarm creation
- `alarmActive` - Current active alarm state during playback

**File Storage:**
- None - Extension icons only (non-functional resources)

**Caching:**
- None explicitly used

## Authentication & Identity

**Auth Provider:**
- None - No authentication required

**Implementation:**
- Extension runs with user's Chrome profile permissions
- No user accounts or login system

## Monitoring & Observability

**Error Tracking:**
- Basic console logging: `console.error()` in `background.js` (lines 69, 74)
- Errors logged to browser console for debugging only

**Logs:**
- No persistent logging
- Runtime errors output to Chrome extension console
- Example error handling at: `background.js` lines 68-75 (notification error handling)

## CI/CD & Deployment

**Hosting:**
- Not applicable - Distributed as Chrome Web Store extension or manual load

**CI Pipeline:**
- None detected

## Environment Configuration

**Required env vars:**
- None - Application is configuration-free

**Secrets location:**
- Not applicable - No API keys or credentials required

## Webhooks & Callbacks

**Incoming:**
- None - Extension does not receive external webhooks

**Outgoing:**
- None - Extension does not send data to external services

## Inter-Process Communication

**Internal Chrome APIs Used:**

**Message Passing:**
- `chrome.runtime.onMessage` listener in `background.js` (line 20)
  - Handles `reschedule` message - Re-calculate alarm schedule
  - Handles `playSound` message - Trigger immediate beep
  - Handles `stopAlarm` message - Stop active alarm

**Message Flow:**
1. Popup UI (`popup.js`) sends messages to background (`background.js`)
2. Background sends messages to offscreen document (`offscreen.js`) for audio control
3. Offscreen document communicates back via message listener

**Example from `background.js` (line 135):**
```javascript
await chrome.runtime.sendMessage({ type: "offscreen-play" });
```

**Example from `popup.js` (line 264):**
```javascript
await chrome.runtime.sendMessage({ type: "stopAlarm" });
```

**Example from `offscreen.js` (line 4):**
```javascript
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "offscreen-play") {
    playBeep();
  }
  // ... more message handling
});
```

## Chrome Extension Lifecycle

**Installation & Startup:**
- `chrome.runtime.onInstalled` (background.js line 12) - Reschedule alarms on install
- `chrome.runtime.onStartup` (background.js line 16) - Reschedule alarms on browser start
- `chrome.windows.onRemoved` (background.js line 35) - Clean up popup window reference

**Alarm Triggers:**
- `chrome.alarms.onAlarm` (background.js line 41) - Core alarm firing handler
- Automatically creates notifications and opens popup on alarm trigger

---

*Integration audit: 2026-02-24*
