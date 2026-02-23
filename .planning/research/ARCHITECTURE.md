# Architecture Research: Google Calendar Sync Integration

**Domain:** Chrome Extension - Alarm System with Calendar Integration
**Researched:** 2026-02-24
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Popup UI Layer                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ Alarm List   │  │  Calendar    │  │   Settings   │                  │
│  │ Management   │  │  Sync UI     │  │  Management  │                  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                  │
│         │                  │                  │                          │
├─────────┴──────────────────┴──────────────────┴──────────────────────────┤
│                    Service Worker (Background)                           │
│  ┌───────────────┐  ┌────────────────┐  ┌──────────────┐               │
│  │ Alarm         │  │  Calendar      │  │  OAuth       │               │
│  │ Scheduler     │  │  Service       │  │  Manager     │               │
│  └───────┬───────┘  └────────┬───────┘  └──────┬───────┘               │
│          │                    │                  │                       │
├──────────┴────────────────────┴──────────────────┴───────────────────────┤
│                        Storage Layer                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │ Alarms   │  │  OAuth   │  │ Settings │  │  Quick   │                │
│  │  Store   │  │  Tokens  │  │  Store   │  │ Phrases  │                │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                │
├───────────────────────────────────────────────────────────────────────────┤
│                      External APIs                                       │
│  ┌────────────────────────────┐  ┌────────────────────────────┐         │
│  │    Chrome APIs             │  │  Google Calendar API v3    │         │
│  │  (alarms, storage,         │  │  (events.list)             │         │
│  │   identity, notifications) │  │                            │         │
│  └────────────────────────────┘  └────────────────────────────┘         │
└───────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Calendar Sync UI | Sync button, status display, last sync time | HTML button + status text in popup.html |
| Calendar Service | Fetch events from Google Calendar API, transform to alarms | ES6 module with fetch() calls to Calendar API |
| OAuth Manager | Token acquisition, refresh, storage, revocation | chrome.identity.getAuthToken() wrapper |
| Alarm Scheduler | Existing alarm scheduling, merge calendar alarms | Enhanced background.js with merge logic |
| OAuth Token Store | Persist tokens across sessions | Chrome.storage.local with encrypted tokens |

## Recommended Project Structure

```
typing-alarm/
├── background.js           # Service worker (existing) - enhanced with calendar
├── popup.js                # Popup UI (existing) - enhanced with sync UI
├── popup.html              # Popup HTML (existing) - add sync button section
├── popup.css               # Popup styles (existing) - add sync UI styles
├── time.js                 # Time utilities (existing) - no changes needed
├── offscreen.js            # Audio playback (existing) - no changes needed
├── offscreen.html          # Offscreen document (existing) - no changes
├── calendar-service.js     # NEW: Google Calendar API wrapper
├── oauth-manager.js        # NEW: OAuth token management
├── alarm-merger.js         # NEW: Merge calendar events with alarms
├── manifest.json           # Enhanced with identity permission + oauth2 config
└── icons/                  # Existing icons
```

### Structure Rationale

- **calendar-service.js**: Isolates all Google Calendar API interactions. Single responsibility: fetch and transform calendar events. Makes testing easier and keeps API logic separate from alarm logic.

- **oauth-manager.js**: Centralizes OAuth token lifecycle (acquire, refresh, invalidate, store). Prevents token management logic from spreading across multiple files. Handles both interactive (first-time) and silent token acquisition.

- **alarm-merger.js**: Dedicated module for merge logic. Handles comparison, deduplication, and update rules between existing alarms and calendar-synced alarms. Keeps background.js focused on scheduling rather than merge complexity.

## Architectural Patterns

### Pattern 1: Service Facade for External API

**What:** Wrapper module that encapsulates all interactions with Google Calendar API, exposing a simplified interface to the rest of the extension.

**When to use:** When integrating third-party APIs where you want to isolate API-specific logic (authentication headers, error handling, response parsing) from business logic.

**Trade-offs:**
- **Pros**: API changes only affect one module; easier to mock for testing; cleaner calling code
- **Cons**: Adds an extra layer; might be overkill for simple APIs

**Example:**
```javascript
// calendar-service.js
export class CalendarService {
  constructor(oauthManager) {
    this.oauthManager = oauthManager;
    this.baseURL = 'https://www.googleapis.com/calendar/v3';
  }

  async getTodayEvents() {
    const token = await this.oauthManager.getToken();
    const timeMin = new Date();
    timeMin.setHours(0, 0, 0, 0);
    const timeMax = new Date(timeMin);
    timeMax.setDate(timeMax.getDate() + 1);

    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime'
    });

    const response = await fetch(
      `${this.baseURL}/calendars/primary/events?${params}`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    if (!response.ok) {
      throw new Error(`Calendar API error: ${response.status}`);
    }

    const data = await response.json();
    return this._transformEvents(data.items || []);
  }

  _transformEvents(events) {
    return events
      .filter(event => event.start?.dateTime) // Skip all-day events
      .map(event => ({
        id: event.id,
        title: event.summary || 'Untitled Event',
        startTime: new Date(event.start.dateTime),
        source: 'calendar'
      }));
  }
}
```

### Pattern 2: Token Manager with Automatic Retry

**What:** Centralized OAuth token management that automatically handles token invalidation and retry with fresh tokens.

**When to use:** Any OAuth-based integration where tokens can expire or become invalid during use.

**Trade-offs:**
- **Pros**: Automatic recovery from token failures; consistent error handling; single source of truth for tokens
- **Cons**: Adds complexity; requires careful handling of concurrent requests

**Example:**
```javascript
// oauth-manager.js
export class OAuthManager {
  constructor() {
    this.STORAGE_KEY = 'oauth_token';
    this.SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
  }

  async getToken(interactive = false) {
    try {
      const token = await chrome.identity.getAuthToken({
        interactive,
        scopes: this.SCOPES
      });
      if (token) {
        await this._cacheToken(token);
        return token;
      }
      throw new Error('No token received');
    } catch (error) {
      if (interactive) {
        throw new Error(`OAuth failed: ${error.message}`);
      }
      // Non-interactive failure - might need user interaction
      return null;
    }
  }

  async invalidateAndRetry(oldToken) {
    // Remove bad token from cache
    await chrome.identity.removeCachedAuthToken({ token: oldToken });
    // Try to get new token (non-interactive)
    return this.getToken(false);
  }

  async revokeToken() {
    const result = await chrome.storage.local.get(this.STORAGE_KEY);
    const token = result[this.STORAGE_KEY];
    if (token) {
      await chrome.identity.removeCachedAuthToken({ token });
      await chrome.storage.local.remove(this.STORAGE_KEY);
    }
  }

  async _cacheToken(token) {
    await chrome.storage.local.set({ [this.STORAGE_KEY]: token });
  }
}
```

### Pattern 3: Merge Strategy with Source Tagging

**What:** When syncing external data with local data, tag items by source and apply different update rules based on source.

**When to use:** Any sync scenario where you have locally-created items and externally-sourced items that need to coexist.

**Trade-offs:**
- **Pros**: Clear ownership; prevents accidental overwrites; enables source-specific behavior
- **Cons**: Requires source field on all items; merge logic can become complex

**Example:**
```javascript
// alarm-merger.js
export class AlarmMerger {
  mergeCalendarAlarms(existingAlarms, calendarEvents) {
    const result = {
      toAdd: [],
      toUpdate: [],
      toRemove: [],
      unchanged: []
    };

    // Index existing calendar-synced alarms by calendar event ID
    const calendarAlarms = new Map();
    for (const alarm of existingAlarms) {
      if (alarm.source === 'calendar' && alarm.calendarEventId) {
        calendarAlarms.set(alarm.calendarEventId, alarm);
      }
    }

    // Process incoming calendar events
    for (const event of calendarEvents) {
      const existing = calendarAlarms.get(event.id);

      if (!existing) {
        // New calendar event - create alarm
        result.toAdd.push(this._eventToAlarm(event));
      } else if (this._hasChanged(existing, event)) {
        // Event updated - update alarm
        result.toUpdate.push(this._mergeEventToAlarm(existing, event));
        calendarAlarms.delete(event.id);
      } else {
        // No change
        result.unchanged.push(existing);
        calendarAlarms.delete(event.id);
      }
    }

    // Remaining calendar alarms are no longer in calendar - mark for removal
    result.toRemove = Array.from(calendarAlarms.values());

    return result;
  }

  _eventToAlarm(event) {
    return {
      id: crypto.randomUUID(),
      calendarEventId: event.id,
      source: 'calendar',
      hour: event.startTime.getHours(),
      minute: event.startTime.getMinutes(),
      second: 0,
      message: event.title,
      repeat: 'once',
      days: [],
      enabled: true,
      readonly: true, // Calendar alarms can't be edited
      createdAt: Date.now()
    };
  }

  _hasChanged(alarm, event) {
    const eventHour = event.startTime.getHours();
    const eventMinute = event.startTime.getMinutes();
    return (
      alarm.hour !== eventHour ||
      alarm.minute !== eventMinute ||
      alarm.message !== event.title
    );
  }

  _mergeEventToAlarm(alarm, event) {
    return {
      ...alarm,
      hour: event.startTime.getHours(),
      minute: event.startTime.getMinutes(),
      message: event.title
    };
  }
}
```

## Data Flow

### Initial OAuth Flow (First-Time User)

```
User clicks "Sync" button
    ↓
Popup UI (popup.js) → sendMessage({type: 'calendarSync'})
    ↓
Service Worker (background.js) → receives message
    ↓
OAuth Manager → chrome.identity.getAuthToken({interactive: true})
    ↓
Chrome opens OAuth consent screen (Google login)
    ↓
User approves calendar read permission
    ↓
Chrome returns access token
    ↓
OAuth Manager → stores token in chrome.storage.local
    ↓
[Continue to Calendar Fetch Flow]
```

### Calendar Fetch and Merge Flow

```
Service Worker (background.js) receives sync request
    ↓
OAuth Manager → getToken() → retrieve cached token
    ↓
Calendar Service → getTodayEvents(token)
    ↓
Google Calendar API → GET /calendars/primary/events?timeMin=...&timeMax=...
    ↓
Calendar Service → filter out all-day events, transform to alarm format
    ↓
Alarm Merger → mergeCalendarAlarms(existingAlarms, calendarEvents)
    ↓
Returns: {toAdd[], toUpdate[], toRemove[]}
    ↓
Service Worker → applies changes to alarms storage
    ↓
Service Worker → calls rescheduleAll()
    ↓
Chrome Alarms API → schedules all alarm events
    ↓
Service Worker → sends success response to popup
    ↓
Popup UI → updates sync status ("Last synced: [time]")
```

### Token Refresh on 401 Error

```
Calendar Service → fetch() returns 401 Unauthorized
    ↓
Calendar Service → catches error, calls OAuth Manager
    ↓
OAuth Manager → invalidateAndRetry(oldToken)
    ↓
chrome.identity.removeCachedAuthToken({token: oldToken})
    ↓
chrome.identity.getAuthToken({interactive: false})
    ↓
(If successful) → returns fresh token
    ↓
Calendar Service → retries fetch with new token
    ↓
(If still fails) → throws error, shows "Re-authorize" UI
```

### State Management

New storage keys to add:

- **oauth_token**: OAuth access token string (encrypted by Chrome storage)
- **calendar_sync_status**: `{lastSyncTime: number, success: boolean, error?: string}`
- **alarms**: Enhanced with `source` field ('manual' | 'calendar'), `calendarEventId` field, `readonly` field

Modified alarm item schema:
```javascript
{
  id: string,                    // Existing: UUID
  calendarEventId?: string,       // NEW: Google Calendar event ID (if source=calendar)
  source: 'manual' | 'calendar', // NEW: Source tag
  readonly?: boolean,            // NEW: true for calendar alarms
  hour: number,                  // Existing
  minute: number,                // Existing
  second: number,                // Existing
  hasSeconds: boolean,           // Existing
  message: string,               // Existing
  repeat: string,                // Existing
  days: number[],                // Existing
  enabled: boolean,              // Existing
  oneOffAt: number | null,       // Existing
  nextAt: number | null,         // Existing
  lastFired: number | null,      // Existing
  createdAt: number              // Existing
}
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-100 events/day | Current architecture is sufficient. Sync on-demand only. |
| 100-500 events/day | Add incremental sync using `nextSyncToken` from Calendar API to fetch only changed events. Cache last sync token. |
| 500+ events/day | Add pagination handling for large event lists. Consider limiting to primary calendar only. Add background sync (periodic) with alarm API. |

### Scaling Priorities

1. **First bottleneck**: OAuth token expiration during sync.
   - **Fix**: Implement automatic token refresh with retry logic (Pattern 2)

2. **Second bottleneck**: Large event lists causing slow sync and UI freeze.
   - **Fix**: Paginate Calendar API requests, process events in batches, show progress indicator

3. **Third bottleneck**: Frequent manual syncs hitting API rate limits.
   - **Fix**: Cache sync results with TTL (5-15 minutes), show cached data, disable sync button temporarily

## Anti-Patterns

### Anti-Pattern 1: Storing Tokens in Plaintext

**What people do:** Store OAuth tokens directly in chrome.storage.local as plain strings without encryption awareness.

**Why it's wrong:** While Chrome encrypts storage at the OS level, storing sensitive tokens alongside regular app data increases exposure risk. If storage keys are leaked or logged, tokens are immediately compromised.

**Do this instead:** Use chrome.identity's built-in token caching (which is automatically cleared on logout), and only store tokens in chrome.storage.local as a fallback. Always use `chrome.identity.getAuthToken()` as the primary method - it handles secure caching automatically. If you must store tokens, use a separate storage key and document that it contains sensitive data.

### Anti-Pattern 2: Sync on Every Popup Open

**What people do:** Trigger calendar sync automatically whenever the user opens the popup, thinking it keeps data "fresh."

**Why it's wrong:** Creates unnecessary API calls, drains quota, slows popup load time, and annoys users with frequent auth prompts if tokens expire. Google Calendar API has rate limits (1000 requests per 100 seconds for free tier).

**Do this instead:** Only sync on explicit user action (sync button click). Show last sync time and cache results for 10-15 minutes. For background updates, use Chrome alarms API to sync once per hour at most, and only if user has enabled auto-sync in settings.

### Anti-Pattern 3: Overwriting User-Created Alarms

**What people do:** Use time as the only deduplication key, causing calendar events with the same time as manual alarms to overwrite the manual alarm.

**Why it's wrong:** Destroys user data. User loses custom messages, repeat settings, and has no way to distinguish between manual and synced alarms. Creates confusion about alarm source.

**Do this instead:** Use source tagging (Pattern 3). Never overwrite `source: 'manual'` alarms with calendar data. Keep them as separate items even if times match. Add visual indicators in UI to show alarm source. Make calendar alarms read-only or clearly labeled.

### Anti-Pattern 4: Blocking UI During Sync

**What people do:** Use synchronous-looking code or await the entire sync process in the popup before rendering UI, causing popup to freeze for 2-5 seconds.

**Why it's wrong:** Poor user experience. User thinks extension is broken. Chrome may kill the popup if it's unresponsive too long.

**Do this instead:** Make sync fully asynchronous with optimistic UI updates. Show "Syncing..." status immediately, update alarm list with cached data first, then update with fresh data when sync completes. Use service worker message passing so popup can close while sync continues in background.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Google Calendar API v3 | REST API with OAuth2 Bearer token | Use `events.list` endpoint with `timeMin`/`timeMax` filters. Include `singleEvents=true` to expand recurring events. |
| Chrome Identity API | Native extension API | Use `getAuthToken({interactive: true})` for initial auth, `{interactive: false}` for silent refresh. Handle `chrome.runtime.lastError` for all calls. |
| Chrome Storage API | Native extension API | Enhanced schema with `source` and `calendarEventId` fields. Existing alarm structure is preserved for backward compatibility. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Popup ↔ Service Worker | chrome.runtime.sendMessage() / onMessage | Add new message type: `{type: 'calendarSync'}`. Service worker responds with `{success: boolean, error?: string, syncTime: number}` |
| Service Worker ↔ OAuth Manager | Direct import + async function calls | OAuth Manager exports singleton instance. Service worker imports and calls `getToken()` |
| Service Worker ↔ Calendar Service | Direct import + async function calls | Calendar Service is stateless, instantiated with OAuthManager. Returns transformed event array. |
| Service Worker ↔ Alarm Merger | Direct import + pure function calls | Merger is stateless with pure functions. No side effects, returns merge instructions. |
| Popup ↔ Storage | chrome.storage.local API | Popup reads sync status from storage to display last sync time. Storage change listeners update UI automatically. |

## Component Build Order

Based on dependencies between components, recommended implementation sequence:

### Phase 1: OAuth Foundation (1-2 days)
**Components**: OAuth Manager, manifest.json updates

**Why first**: All calendar features depend on working authentication. This is the foundation.

**Deliverables**:
- Add `identity` permission to manifest.json
- Add `oauth2` config with client_id and scopes
- Create oauth-manager.js with getToken(), invalidateAndRetry(), revokeToken()
- Create simple test UI in popup to verify token acquisition works
- Register extension in Google API Console

**Validation**: Can acquire token interactively and see it in storage

### Phase 2: Calendar API Integration (1-2 days)
**Components**: Calendar Service

**Why second**: Once auth works, can fetch and transform calendar data.

**Deliverables**:
- Create calendar-service.js with getTodayEvents()
- Add fetch logic with proper headers and error handling
- Transform Calendar API response to alarm format
- Add filtering for all-day events
- Handle pagination if needed

**Validation**: Can fetch real calendar events and see transformed data in console

### Phase 3: Merge Logic (1-2 days)
**Components**: Alarm Merger, enhanced alarm schema

**Why third**: Need both existing alarms and calendar events before implementing merge.

**Deliverables**:
- Create alarm-merger.js with mergeCalendarAlarms()
- Add source tagging to alarm schema
- Implement deduplication logic
- Add readonly field for calendar alarms
- Write unit tests for merge scenarios

**Validation**: Merge logic correctly identifies toAdd, toUpdate, toRemove

### Phase 4: Service Worker Integration (2-3 days)
**Components**: Enhanced background.js, message handling

**Why fourth**: Ties everything together in the service worker.

**Deliverables**:
- Add calendarSync message handler to background.js
- Wire up OAuth Manager → Calendar Service → Alarm Merger
- Integrate merge results into existing rescheduleAll() flow
- Add error handling and retry logic
- Store sync status in storage

**Validation**: Can trigger sync from popup and see calendar alarms appear in list

### Phase 5: UI Enhancements (1-2 days)
**Components**: Popup UI, sync button, status display

**Why fifth**: Backend works, now add user-facing UI.

**Deliverables**:
- Add sync button to popup.html
- Add sync status display (last sync time, success/error)
- Add visual indicators for calendar vs manual alarms (icons, colors)
- Add loading/syncing state
- Make calendar alarms read-only (disable edit controls)

**Validation**: User can click sync, see progress, see results, distinguish alarm sources

### Phase 6: Polish and Error Handling (1-2 days)
**Components**: Error messages, edge cases, testing

**Why last**: Core functionality works, now handle edge cases.

**Deliverables**:
- Add re-authorize UI for expired tokens
- Handle network errors gracefully
- Add rate limit handling
- Test with various edge cases (no events, all-day events, many events)
- Add user-friendly error messages

**Validation**: Extension handles all error cases without breaking

**Total estimated effort**: 7-13 days for full implementation

## Sources

- [Google Calendar API v3 Reference](https://developers.google.com/calendar/api/v3/reference) - HIGH confidence
- [Chrome Identity API Documentation](https://developer.chrome.com/docs/extensions/reference/api/identity) - HIGH confidence
- [Chrome Extension OAuth2 Guide](https://developer.chrome.com/docs/extensions/how-to/integrate/oauth) - HIGH confidence
- [Google Calendar Events.list Endpoint](https://developers.google.com/calendar/api/v3/reference/events/list) - HIGH confidence
- Existing codebase analysis (background.js, popup.js, manifest.json) - HIGH confidence

---
*Architecture research for: Typing Alarm - Google Calendar Integration*
*Researched: 2026-02-24*
