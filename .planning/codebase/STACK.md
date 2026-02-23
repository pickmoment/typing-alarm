# Technology Stack

**Analysis Date:** 2026-02-24

## Languages

**Primary:**
- JavaScript (ES6+) - All application logic, modules use `import`/`export` statements
- HTML5 - UI structure and templates
- CSS3 - Styling with CSS custom properties (variables)

## Runtime

**Environment:**
- Chrome 88+ (Manifest v3 compliant)
- Runs as browser extension within Chrome extension system

**Module System:**
- ES Modules (type: "module" in background service worker)
- Dynamic imports supported

## Frameworks

**Core:**
- Chrome Extension APIs v3 - Core extension platform
  - `chrome.alarms` - Alarm scheduling
  - `chrome.storage.local` - Local data persistence
  - `chrome.notifications` - User notifications
  - `chrome.windows` - Window management
  - `chrome.runtime` - Message passing and lifecycle
  - `chrome.offscreen` - Offscreen document for audio playback

**UI:**
- Vanilla JavaScript (no framework)
- DOM manipulation via direct `document` API
- Template element (`<template>`) for list items

**Audio:**
- Web Audio API - Sound synthesis via `AudioContext`, `OscillatorNode`, `GainNode`

**Build/Dev:**
- No build tool detected (raw files deployed as-is)

## Key Dependencies

**Critical:**
- Chrome Extension Manifest v3 - API support for alarms, storage, notifications, offscreen documents
- Web Audio API - Sine wave alarm sound generation at 880Hz frequency
- Local Storage API - Persists alarm configurations and quick phrases

**Time Parsing:**
- Custom time parsing library: `time.js` - Handles Korean date/time formats, relative time expressions, clock strings

## Configuration

**Environment:**
- No `.env` file detected
- Configuration stored in `chrome.storage.local`:
  - `alarms` - Alarm list
  - `alarmSettings` - Duration and sound interval settings
  - `quickPhrases` - User-saved quick input phrases
  - `alarmActive` - Currently active alarm state

**Build:**
- `manifest.json` - Chrome extension configuration (v3)

## Platform Requirements

**Development:**
- Chrome browser (version 88+)
- Text editor with ES6 module support
- No build tools or package managers required

**Production:**
- Chrome browser (version 88+)
- User must have extension installed and enabled
- Internet connection not required (runs offline)

**Browser Permissions:**
- `alarms` - Chrome Alarms API for scheduling
- `storage` - Local data persistence
- `notifications` - Desktop notifications when alarm fires
- `offscreen` - Audio playback in offscreen document

---

*Stack analysis: 2026-02-24*
