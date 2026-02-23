# Testing Practices

**Analysis Date:** 2026-02-24

## Current State

**No automated testing infrastructure exists in this codebase.**

- No test framework installed (Jest, Mocha, Vitest, etc.)
- No test files present (`*.test.js`, `*.spec.js`)
- No `package.json` with test scripts
- No CI/CD pipeline for automated testing
- No code coverage measurement

## Testing Approach

### Manual Testing Only
All testing is currently manual:
- Load extension as unpacked in Chrome
- Test UI interactions in popup window
- Verify alarms fire at correct times
- Check notifications display properly
- Test various time input formats
- Verify storage persistence across sessions

### Console Logging for Debugging
- `console.log()` statements used throughout codebase
- `console.error()` for error cases
- Chrome DevTools used to inspect storage, alarms, messages
- Service worker console for background script debugging

## Test Coverage Gaps

### High Priority (Core Functionality)

**Time Parsing (`time.js`)**
- No tests for `parseTimeString()` - critical function with multiple input formats
- Missing coverage for:
  - 12-hour time format: "3:30pm", "오후 3:30"
  - 24-hour time format: "15:30", "15:30:45"
  - Korean relative time: "30분후", "1시간 30분 후"
  - Korean date formats: "12월 25일 14:30", "2024년 1월 1일"
  - Edge cases: Feb 29, month boundaries, invalid inputs
  - DST transitions
  - Timezone handling

**Alarm Scheduling (`background.js`, `time.js`)**
- No tests for `computeNextOccurrence()` - calculates next alarm time
- Missing coverage for:
  - Daily recurring alarms crossing midnight
  - Weekly alarms with custom day selection
  - Weekday-only recurring alarms
  - Leap year handling
  - DST transitions affecting alarm times
  - One-time alarms vs recurring alarms

**Storage Operations**
- No tests for race conditions during concurrent save/load
- Missing coverage for:
  - Multiple rapid saves (race condition)
  - Storage quota exceeded errors
  - Corrupted data recovery
  - Migration from old schema to new
  - Storage sync between service worker and popup

### Medium Priority (User Interactions)

**Alarm CRUD Operations (`popup.js`)**
- No tests for alarm creation, editing, deletion
- Missing coverage for:
  - Creating alarm from various input formats
  - Editing existing alarm (changing time, message, repeat settings)
  - Deleting single alarm
  - Bulk operations (delete all, disable all)
  - Enable/disable toggle functionality
  - Duplicate alarm handling

**UI Rendering (`popup.js`)**
- No tests for list rendering
- Missing coverage for:
  - Rendering empty list
  - Rendering large list (100+ alarms)
  - Countdown timer updates
  - Sorting behavior
  - Filter/search (if added)

**Quick Phrases Management (`popup.js`)**
- No tests for quick phrase CRUD
- Missing coverage for:
  - Adding new quick phrase
  - Deleting quick phrase
  - Using quick phrase to create alarm
  - Quick phrase version migration

### Lower Priority (Edge Cases)

**Error Handling**
- No tests for error scenarios
- Missing coverage for:
  - Storage permission denied
  - Notification permission denied
  - Alarm API failures
  - Invalid state recovery
  - Concurrent modification conflicts

**Audio Playback (`offscreen.js`)**
- No tests for AudioContext
- Missing coverage for:
  - Sound starts and stops correctly
  - AudioContext suspended state handling
  - Multiple rapid sound triggers
  - Sound loop interval timing
  - Browser audio policy restrictions

**Window Management (`background.js`)**
- No tests for popup window lifecycle
- Missing coverage for:
  - Creating alarm popup window
  - Focusing existing window vs creating new
  - Window close handling
  - Multiple windows edge case

## Recommended Testing Strategy

### Test Framework Selection
Recommended options for Chrome extension testing:
- **Jest** + `@jest-environment-webextensions` - Popular, good Chrome API mocking
- **Vitest** - Fast, modern alternative to Jest
- **Playwright** - E2E testing in real Chrome instance
- **Puppeteer** - Chrome automation for integration tests

### Unit Testing Priority
1. **`time.js` functions** (highest priority - pure functions, easy to test)
   - `parseTimeString()` with all input formats
   - `computeNextOccurrence()` for recurring logic
   - `formatTime()`, `splitInputs()`, `defaultDaysForRepeat()`

2. **Storage operations** (high priority - data integrity critical)
   - Mock `chrome.storage.local` API
   - Test save/load cycles
   - Test error handling

3. **Alarm scheduling logic** (high priority - core feature)
   - Mock `chrome.alarms` API
   - Test alarm creation, cancellation, rescheduling
   - Test one-time vs recurring alarms

### Integration Testing
- Test full alarm lifecycle: create → schedule → fire → notification → stop
- Test popup ↔ background communication via messages
- Test storage sync between popup and background
- Test offscreen document audio playback

### E2E Testing
- Load extension in real Chrome instance
- Create alarm via popup UI
- Wait for alarm to fire
- Verify notification appears
- Verify sound plays
- Verify alarm window opens

### Manual Testing Checklist
Create a checklist for regression testing:
- [ ] Create alarm with various time formats
- [ ] Edit existing alarm
- [ ] Delete alarm
- [ ] Enable/disable alarm
- [ ] Create recurring daily alarm
- [ ] Create recurring weekly alarm
- [ ] Create weekday-only alarm
- [ ] Verify alarm fires at correct time
- [ ] Verify notification displays
- [ ] Verify sound plays
- [ ] Verify alarm popup opens
- [ ] Stop alarm before auto-stop
- [ ] Let alarm auto-stop
- [ ] Create quick phrase
- [ ] Use quick phrase to create alarm
- [ ] Delete quick phrase
- [ ] Test with 100+ alarms
- [ ] Test storage persistence (close browser, reopen)
- [ ] Test across DST boundary
- [ ] Test leap year date (Feb 29)

## Mocking Strategy

### Chrome API Mocking
Most tests will need Chrome API mocks:
- `chrome.storage.local.get()` / `set()` / `onChanged`
- `chrome.alarms.create()` / `clear()` / `clearAll()` / `onAlarm`
- `chrome.runtime.sendMessage()` / `onMessage`
- `chrome.notifications.create()`
- `chrome.windows.create()` / `update()` / `onRemoved`
- `chrome.offscreen.createDocument()` / `closeDocument()`

### Date/Time Mocking
Tests should mock current time for consistency:
- Use `jest.useFakeTimers()` or similar
- Set known date for testing edge cases (DST, leap year, etc.)
- Test relative time parsing with controlled "now" value

### DOM Mocking
Popup UI tests need DOM environment:
- Use `jsdom` for lightweight DOM simulation
- Or use real browser with Playwright/Puppeteer
- Mock `document.getElementById()`, `createElement()`, etc.

## Test Data

### Sample Test Fixtures
Create reusable test data:
- Valid alarm items with various configurations
- Invalid inputs for parsing tests
- Edge case dates (Feb 29, DST transitions, year boundaries)
- Multiple alarms for sorting/filtering tests

### Example Test Data Structure
```javascript
const testAlarms = [
  {
    id: "test1",
    hour: 9,
    minute: 30,
    second: 0,
    message: "Morning standup",
    repeat: "weekday",
    days: [1, 2, 3, 4, 5],
    enabled: true,
    nextAt: Date.now() + 3600000
  },
  {
    id: "test2",
    hour: 18,
    minute: 0,
    message: "End of day",
    repeat: "daily",
    enabled: true,
    nextAt: Date.now() + 7200000
  }
];
```

## Code Coverage Goals

If testing were implemented, recommended coverage targets:
- **`time.js`**: 90%+ (pure functions, high value)
- **`background.js`**: 70%+ (core logic, harder to test due to Chrome APIs)
- **`popup.js`**: 60%+ (UI code, harder to test, lower priority)
- **`offscreen.js`**: 50%+ (audio code, browser-dependent)

## Continuous Integration

### Recommended CI Setup
If tests were added:
- Run tests on every commit (GitHub Actions, GitLab CI, etc.)
- Run tests on pull requests before merge
- Block merge if tests fail
- Generate coverage reports
- Lint code (ESLint) before running tests

### Example GitHub Actions Workflow
```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
      - run: npm run lint
```

## Current Validation

### What IS Validated Today
- Chrome manifest validation (Chrome checks on load)
- Basic type checks in code (`Array.isArray()`, truthiness checks)
- Error logging to console (helps catch runtime errors)
- Manual QA testing before release

### What IS NOT Validated Today
- Time parsing correctness (no tests)
- Alarm scheduling accuracy (no tests)
- Storage consistency (no tests)
- Error recovery (no tests)
- Performance (no benchmarks)
- Security (no security audits)
- Accessibility (no a11y testing)

---

*Testing audit: 2026-02-24*

**Note:** This document describes the current absence of testing and provides recommendations for establishing a testing practice. No tests currently exist in the codebase.
