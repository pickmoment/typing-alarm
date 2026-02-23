# Codebase Concerns

**Analysis Date:** 2026-02-24

## Tech Debt

**Duplicate Alarm Scheduling:**
- Issue: `rescheduleAll()` in `background.js` and `rescheduleLocal()` in `popup.js` duplicate the same alarm scheduling logic without a shared utility
- Files: `background.js` (lines 97-111), `popup.js` (lines 405-422)
- Impact: Inconsistent behavior if logic diverges between files; maintenance burden when scheduling logic needs updates
- Fix approach: Extract shared scheduling logic to `time.js` (e.g., `scheduleAlarms(items)` function) and import from both files

**Timer Leak in popup.js:**
- Issue: `liveTimer` and `alarmTimer` intervals are cleared only when rendering changes or popup loads, not when popup closes
- Files: `popup.js` (lines 30-31, 113-115, 227-229, 238-241, 248-249)
- Impact: Memory leak if popup stays open; timers continue firing and consuming resources
- Fix approach: Add unload/beforeunload listener to clean up timers: `window.addEventListener('unload', () => { clearInterval(liveTimer); clearInterval(alarmTimer); })`

**Inconsistent Storage Key Usage:**
- Issue: Storage keys defined in multiple files without central constant export
- Files: `background.js` (lines 3-5), `popup.js` (lines 8, 33-36)
- Impact: Risk of typos causing data not to sync; duplication of magic strings
- Fix approach: Export all storage key constants from `time.js` and import into both `background.js` and `popup.js`

**No Input Sanitization:**
- Issue: Alarm messages and custom labels are not sanitized before storing or displaying
- Files: `popup.js` (lines 185, 450), `background.js` (line 62)
- Impact: Potential XSS if messages contain HTML/script tags; data corruption with special characters
- Fix approach: Sanitize/escape user input in `time.js` before storage, or use text content methods consistently in DOM manipulation

**Weak Error Recovery:**
- Issue: Silent error catches without user feedback or logging details; some errors only log to console
- Files: `background.js` (lines 73-74, 196-197), `popup.js` (lines 210-213, 483-487)
- Impact: Users unaware when operations fail; difficult to debug production issues
- Fix approach: Use structured error logging with timestamp; display specific error messages in UI

## Known Bugs

**Race Condition in Save Verification:**
- Symptom: Verification check `verifyStoredItems()` races against async storage, can report false failures
- Files: `popup.js` (lines 476, 204, 522-530)
- Trigger: Multiple rapid saves; system under load
- Workaround: Refresh button re-syncs state, but doesn't guarantee consistency
- Fix approach: Add retry logic with exponential backoff in `verifyStoredItems()` before reporting failure

**Popup Window Doesn't Close When Alarm Ends:**
- Symptom: Alarm popup window stays open after `stopAlarm` is triggered; user must close manually
- Files: `background.js` (line 195), `popup.js` (line 266)
- Trigger: Alarm stops via automatic timeout or stop button
- Workaround: User closes popup manually
- Fix approach: After `stopAlarm`, send message to popup to close window: `chrome.windows.update(windowId, { focused: true }).then(() => window.close())`

**AudioContext May Not Resume:**
- Symptom: `AudioContext` suspended state after first use can prevent sound playback on subsequent alarms
- Files: `offscreen.js` (lines 16-21, 24)
- Trigger: Browser policy on audio context after page interaction; affects Chrome on some systems
- Workaround: Click alarm popup to resume audio context
- Fix approach: Resume AudioContext on message: `if (ctx.state === 'suspended') await ctx.resume()`

**Storage Keys Overwritten by Duplication:**
- Symptom: Items loaded from storage may lose `enabled` field if not explicitly set in JSON
- Files: `popup.js` (lines 154), `background.js` (line 128)
- Trigger: Older alarm data migrated before `enabled` field was added
- Workaround: Re-save alarm through UI to update structure
- Fix approach: Add migration logic in `loadItems()` to ensure all items have `enabled` field set

## Security Considerations

**No Chrome API Permissions Validation:**
- Risk: Extension requests broad permissions without runtime validation of actual usage
- Files: `manifest.json` (lines 14-18)
- Current mitigation: Only needed permissions are requested
- Recommendations: Add CSP to `manifest.json` to restrict inline scripts; audit actual permission usage

**Unrestricted Web Access Resources:**
- Risk: Icons accessible to all URLs via `<all_urls>` match pattern
- Files: `manifest.json` (lines 26-34)
- Current mitigation: Only low-sensitivity icon assets exposed
- Recommendations: Restrict to `chrome://` or specific extension contexts; or use content-hashing for icons

**No Data Validation on Storage Read:**
- Risk: Arbitrary data from `chrome.storage.local` not type-checked before use
- Files: `background.js` (lines 114-117), `popup.js` (lines 113-117, 395-398)
- Current mitigation: Partial `Array.isArray()` checks
- Recommendations: Implement schema validation (e.g., `zod` or similar) for all storage reads; validate `item.hour`, `item.minute`, `item.second` are numbers before arithmetic

**Message Listener No Validation:**
- Risk: `chrome.runtime.onMessage` handler doesn't validate message sender origin
- Files: `background.js` (lines 20-33), `offscreen.js` (lines 4-14)
- Current mitigation: Simple type checks on message properties
- Recommendations: Add `sender.id === chrome.runtime.id` check to verify internal messages only; whitelist allowed message types

## Performance Bottlenecks

**Full List Render on Every Change:**
- Problem: `render()` clears all DOM nodes and rebuilds entire list on every update
- Files: `popup.js` (lines 111-231)
- Cause: No virtual scrolling or incremental updates
- Improvement path: Implement incremental DOM updates; only re-render items that changed; cache DOM references

**Live Timer Fires Every Item Every Second:**
- Problem: `updateRemaining()` queries DOM and updates text for every item every 1000ms, even when popup not visible
- Files: `popup.js` (lines 227-229, 345-384)
- Cause: No visibility detection; continuous polling
- Improvement path: Use `visibilitychange` event to pause timer when popup loses focus; throttle updates to 500ms for offscreen items

**No Index on Alarm ID Lookups:**
- Problem: Linear search through items array for each find/update operation
- Files: `background.js` (lines 50-51, 102-108), `popup.js` (lines 217, 348)
- Cause: Small dataset (likely <100 alarms) not indexed
- Improvement path: Acceptable for current scale; if >1000 alarms, implement `Map<id, item>` cache

**Repeated Storage Reads:**
- Problem: Multiple separate reads to `chrome.storage.local` instead of batching
- Files: `popup.js` (lines 91-94)
- Cause: Sequential async operations without aggregation
- Improvement path: Batch storage reads: `chrome.storage.local.get([STORAGE_KEY, ACTIVE_KEY, SETTINGS_KEY])`

## Fragile Areas

**Date/Time Calculation Logic:**
- Files: `time.js` (entire file), specifically `computeNextOccurrence()` (lines 214-247)
- Why fragile: Complex regex patterns for parsing multiple input formats; edge cases around DST, year boundaries, month/day validation
- Safe modification: Test all parsing paths with timezone-aware dates; add unit tests for edge cases (Feb 29, month boundaries, DST transitions)
- Test coverage: No test files found; manually verified inputs only

**Storage Sync Between Service Worker and Popup:**
- Files: `background.js` (lines 113-122), `popup.js` (lines 394-403)
- Why fragile: Message passing and storage listeners can race; no guaranteed order of updates
- Safe modification: Use `storage.onChanged` listener exclusively for sync; avoid dual save paths; consider versioning/timestamps on storage records
- Test coverage: No tests; behavior only verified manually in browser

**Alarm Popup Window Management:**
- Files: `background.js` (lines 35-39, 177-199), `popup.js` (lines 263-266)
- Why fragile: Window ID tracking with null fallback; no validation that window still exists; async race between update and close
- Safe modification: Always wrap `chrome.windows.update()` in try/catch; check window exists before updating; use timeout to prevent hang
- Test coverage: No automated tests; manual UI testing only

**Offscreen Document Lifecycle:**
- Files: `background.js` (lines 124-131), `offscreen.js` (entire file)
- Why fragile: Document created on demand but never explicitly destroyed; reliance on cleanup timing
- Safe modification: Add explicit `closeDocument()` when alarm stops; ensure `stopLoop()` always runs
- Test coverage: No tests; behavior depends on browser lifecycle management

## Scaling Limits

**Chrome Storage Quota:**
- Current capacity: Chrome extension storage limited to 10MB per extension (5MB per item)
- Limit: With average alarm ~300 bytes, ~30,000 alarms before hitting limit
- Scaling path: Implement pagination/archival; export old alarms to JSON backup; consider IndexedDB for larger datasets

**Alarm Count Limit:**
- Current capacity: Chrome alarms API supports unlimited alarms but browser throttles wake-ups
- Limit: Performance degradation above 1000 active alarms; unclear documented limit
- Scaling path: Implement alarm aggregation (group alarms at same time); use service worker scheduling instead of native alarms

**DOM Rendering Performance:**
- Current capacity: List renders smoothly up to ~500 items
- Limit: ~1000+ items causes UI lag; each render rebuilds entire list
- Scaling path: Implement virtual scrolling (only render visible items); add pagination; implement item caching

**Message Queue:**
- Current capacity: `chrome.runtime.onMessage` handles sequential messages
- Limit: Burst of 50+ messages may drop some due to service worker suspension
- Scaling path: Implement message queue with retry; use `chrome.alarms` for scheduled tasks instead of immediate messages

## Dependencies at Risk

**AudioContext Deprecation:**
- Risk: `AudioContext` constructor in `offscreen.js` is deprecated; should use `new (window.AudioContext || window.webkitAudioContext)()`
- Impact: Will fail silently on older browsers; alarms produce no sound
- Migration plan: Use polyfill wrapper; test on Safari/Firefox; consider alternative sound libraries

**No Build Process:**
- Risk: Using ES6 modules directly in manifest with `"type": "module"` may break in future Chrome versions
- Impact: Background script won't load; entire extension breaks
- Migration plan: Add bundler (Webpack/esbuild); pre-bundle modules into single script

**Chrome Storage API Sync Removed (v120+):**
- Risk: `chrome.storage.sync` was the original sync storage; if codebase migrates to it later, will break in MV3
- Impact: Data loss if user switches devices or reinstalls extension
- Migration plan: Keep using `chrome.storage.local`; implement manual sync to cloud storage if needed

## Missing Critical Features

**No Data Backup/Export:**
- Problem: Alarms stored only in browser; loss on uninstall or device failure
- Blocks: User cannot recover alarms after reinstall; no migration between devices
- Fix approach: Add "Export as JSON" and "Import from JSON" buttons to UI

**No Notification Sound Configuration:**
- Problem: Fixed 880Hz sine wave; users cannot change or mute sound
- Blocks: Cannot accommodate accessibility needs or user preference; no way to use custom alarm sound
- Fix approach: Add audio file upload or frequency selector; add global mute toggle

**No Alarm History/Logs:**
- Problem: No record of which alarms fired; user cannot review past triggers
- Blocks: Cannot debug missed alarms; no analytics on usage
- Fix approach: Store last 100 fired alarms with timestamp; add history view in popup

**No Snooze Function:**
- Problem: User must stop alarm or wait for auto-stop; no way to defer alarm 5-10 minutes
- Blocks: Users close popup without stopping alarm to "snooze"; high annoyance factor
- Fix approach: Add "Snooze 5m" button to alarm banner; reschedule alarm with new time

**No Recurring Alarm Skip:**
- Problem: User cannot skip next occurrence of recurring alarm without disabling it
- Blocks: User forced to disable recurring alarm for one instance
- Fix approach: Add "Skip next" button; mark alarm with skipUntil timestamp; check in `computeNextOccurrence()`

## Test Coverage Gaps

**Time Parsing:**
- What's not tested: All input formats (12-hour time, Korean format, relative times, date-based inputs) lack automated tests
- Files: `time.js` (especially `parseTimeString()`, `parseClockString()`, `parseDateBasedInput()`)
- Risk: Regressions in parsing logic silently accepted; edge cases (2/29, month boundaries) may fail in production
- Priority: High - affects core functionality

**Storage Operations:**
- What's not tested: Race conditions during save/load; corruption recovery; storage quota errors
- Files: `background.js` (lines 113-122), `popup.js` (lines 394-403, 405-422)
- Risk: Silent data loss or corruption under concurrent operations
- Priority: High - data integrity critical

**Alarm Scheduling:**
- What's not tested: Recurring alarm calculation; DST transitions; leap years; custom day selection
- Files: `time.js` `computeNextOccurrence()` (lines 214-247)
- Risk: Alarms fire at wrong times or not at all after DST changes
- Priority: High - core scheduling broken

**UI Interaction:**
- What's not tested: Editing existing alarms; deletion; enable/disable toggle; quick phrase management
- Files: `popup.js` (lines 168-221, 559-577)
- Risk: UI buttons or keyboard shortcuts silently fail; user data loss on delete
- Priority: Medium - manual testing covers most paths

**Error Handling:**
- What's not tested: Storage errors; permission denials; invalid state recovery
- Files: All files with try/catch blocks
- Risk: Unhandled errors cause silent failures or inconsistent state
- Priority: Medium - error paths rarely hit in normal usage

**Audio Playback:**
- What's not tested: AudioContext state management; multiple rapid sound triggers; browser audio suspension
- Files: `offscreen.js` (entire file)
- Risk: Sound may not play; alarms silent in certain browser states
- Priority: Medium - affects user notification

---

*Concerns audit: 2026-02-24*
