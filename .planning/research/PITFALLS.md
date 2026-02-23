# Pitfalls Research

**Domain:** Google Calendar API Integration in Chrome Extensions (Manifest v3)
**Researched:** 2026-02-24
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Stale OAuth Token Caching

**What goes wrong:**
Chrome's `chrome.identity.getAuthToken()` caches access tokens in memory, but developers forget to remove invalid tokens using `removeCachedAuthToken()`. This causes persistent authentication failures where the extension keeps using an expired token even after the user revokes access or the token expires.

**Why it happens:**
The API documentation states it "automatically handles expiration," leading developers to assume no manual token management is needed. However, certain edge cases (revoked permissions, account changes, server-side invalidation) aren't automatically detected.

**How to avoid:**
- Always wrap Calendar API calls in error handling that checks for 401 (Unauthorized) responses
- On 401 errors, immediately call `chrome.identity.removeCachedAuthToken({ token: oldToken })`
- Then retry `getAuthToken({ interactive: false })` to get a fresh token
- Only prompt user interactively if the silent refresh fails

**Warning signs:**
- API calls work initially but fail later without code changes
- Users report "already signed in but can't sync" issues
- 401 errors that persist across browser restarts

**Phase to address:**
Phase 1 (OAuth Setup) - Implement proper token refresh flow from the start

---

### Pitfall 2: Interactive OAuth Flow Without User Context

**What goes wrong:**
Launching `getAuthToken({ interactive: true })` on extension startup or when the popup first opens causes a confusing authorization prompt with no explanation. Users see an OAuth consent screen out of nowhere and often deny it or close it, thinking it's malicious.

**Why it happens:**
Chrome documentation explicitly warns: "do not use getAuthToken interactively when your app is first launched." Developers trigger OAuth eagerly to "prepare" the extension, but this creates terrible UX.

**How to avoid:**
- NEVER call `getAuthToken({ interactive: true })` automatically on startup
- Only trigger interactive OAuth after an explicit user action (clicking "Sync Calendar" button)
- Add clear UI messaging: "Click to connect your Google Calendar" with explanation text
- Use `interactive: false` for background token refreshes
- Check for existing tokens with `getAuthToken({ interactive: false })` first

**Warning signs:**
- OAuth prompts appearing unexpectedly
- Low user authorization completion rates
- User reviews mentioning "suspicious permission requests"

**Phase to address:**
Phase 1 (OAuth Setup) - Design UI-first with explicit sync trigger

---

### Pitfall 3: Missing Manifest OAuth Configuration

**What goes wrong:**
Developers add `identity` permission but forget to declare the `oauth2` section in manifest.json with client_id and scopes. This causes cryptic runtime errors or OAuth flows that fail silently without clear error messages.

**Why it happens:**
Chrome's `identity` API works for multiple OAuth providers, so the manifest schema doesn't enforce Google-specific configuration. Developers test with placeholder values or skip manifest updates during development.

**How to avoid:**
- Add required manifest configuration immediately:
```json
{
  "permissions": ["identity", "storage"],
  "host_permissions": ["https://www.googleapis.com/*"],
  "oauth2": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/calendar.readonly"
    ]
  },
  "key": "YOUR_EXTENSION_PUBLIC_KEY"
}
```
- Include the `key` field to maintain consistent extension ID across development
- Verify scopes match exactly what Calendar API requires (no more, no less)

**Warning signs:**
- OAuth flows start but never complete
- Error: "OAuth2 not configured"
- Extension ID changes between installs

**Phase to address:**
Phase 1 (OAuth Setup) - First implementation step before writing any OAuth code

---

### Pitfall 4: Calendar API Rate Limit Ignorance

**What goes wrong:**
The extension syncs calendar repeatedly without exponential backoff, hitting Google's per-user-per-minute quota limits (typically 60 requests/minute/user). This causes 429 (Too Many Requests) or 403 (usageLimits) errors that break sync functionality.

**Why it happens:**
Developers test with small calendars and low request volumes, never encountering quota limits. In production, users with busy calendars or aggressive sync intervals hit limits immediately.

**How to avoid:**
- Implement exponential backoff for ALL Calendar API calls (even successful ones can hit rate limits on retry)
- Use this pattern:
```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 || error.status === 403) {
        const delay = Math.min(1000 * Math.pow(2, i), 8000);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```
- Avoid syncing on page load, focus, or rapid user clicks
- Store last sync timestamp and prevent syncing more than once per minute

**Warning signs:**
- 403/429 errors in production logs
- Sync works 2-3 times then stops working
- Users with large calendars report failures

**Phase to address:**
Phase 2 (Calendar Sync) - Implement retry logic alongside initial API integration

---

### Pitfall 5: Timezone Hell in Date Filtering

**What goes wrong:**
Developers filter "today's events" using local dates but Calendar API requires RFC3339 timestamps with explicit timezone offsets. This causes events to disappear or appear on wrong days, especially for users in non-UTC timezones.

**Why it happens:**
JavaScript's `Date.toISOString()` returns UTC times (e.g., "2026-02-24T00:00:00.000Z"), but Calendar API's `timeMin`/`timeMax` parameters interpret these literally. A user in PST at 10pm requesting "today" actually requests tomorrow UTC.

**How to avoid:**
- Always use RFC3339 format with timezone offset:
```javascript
function getTodayBounds() {
  const now = new Date();
  const offset = -now.getTimezoneOffset(); // minutes
  const sign = offset >= 0 ? '+' : '-';
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
  const tzOffset = `${sign}${hours}:${minutes}`;

  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  return {
    timeMin: startOfDay.toISOString().replace('Z', tzOffset),
    timeMax: endOfDay.toISOString().replace('Z', tzOffset)
  };
}
```
- Test with users in PST, EST, JST, and UTC+12 timezones
- Use `singleEvents=true` to expand recurring events properly

**Warning signs:**
- Events appear/disappear near midnight
- Different results for users in different timezones
- All-day events showing up in results (should be filtered by date field, not dateTime)

**Phase to address:**
Phase 2 (Calendar Sync) - Core filtering implementation with timezone awareness

---

### Pitfall 6: Service Worker Termination Mid-Sync

**What goes wrong:**
Chrome Manifest v3 service workers terminate after 30 seconds of inactivity. If calendar sync takes longer (large calendars, slow network, pagination), the service worker dies mid-request, leaving the sync incomplete without error notification.

**Why it happens:**
Extension service workers are event-driven and "shut down when idle." Developers assume synchronous execution like old background pages, but MV3 workers can terminate at any point.

**How to avoid:**
- Keep sync operations under 30 seconds by:
  - Limiting to today's events only (as planned - smart!)
  - Using `maxResults: 50` to avoid large responses
  - Avoiding unnecessary pagination
- For longer operations, break into chunks and use alarms to resume:
```javascript
// Store sync state
await chrome.storage.local.set({ syncInProgress: true, pageToken: token });

// Resume on next wake
chrome.alarms.create('resume-sync', { delayInMinutes: 0.5 });
```
- Add heartbeat message to keep worker alive during critical operations:
```javascript
const keepAlive = setInterval(() => {
  chrome.runtime.sendMessage({ type: 'keepalive' });
}, 20000);
```

**Warning signs:**
- Sync randomly stops mid-operation
- No error logs for failed syncs
- Partial data saved to storage

**Phase to address:**
Phase 2 (Calendar Sync) - Design sync to complete within service worker timeout

---

### Pitfall 7: Mixing Timed and All-Day Event Fields

**What goes wrong:**
Developers try to handle both timed and all-day events with the same code path, accidentally reading `start.date` for timed events or `start.dateTime` for all-day events. This causes crashes or incorrect alarm creation.

**Why it happens:**
Calendar API returns different fields based on event type: timed events use `start.dateTime`/`end.dateTime`, all-day events use `start.date`/`end.date`. The documentation states: "it is not valid to specify start.date and end.dateTime."

**How to avoid:**
- Filter out all-day events explicitly:
```javascript
const timedEvents = events.filter(event => {
  // All-day events have date field, not dateTime
  return event.start.dateTime && !event.start.date;
});
```
- Never try to convert all-day events to alarms (they don't have specific times)
- If supporting all-day events later, handle them in completely separate code path

**Warning signs:**
- Alarms created at midnight (00:00) when they shouldn't be
- Parse errors with date strings
- `undefined` or `null` values when reading event times

**Phase to address:**
Phase 2 (Calendar Sync) - Event filtering and validation before alarm creation

---

### Pitfall 8: Forgetting Alarm Persistence Verification

**What goes wrong:**
Chrome's documentation warns: "Alarms generally persist until an extension is updated. However, this is not guaranteed, and alarms may be cleared when the browser is restarted." Calendar-synced alarms disappear on browser restart, making the feature unreliable.

**Why it happens:**
Developers test without restarting the browser or only test with persistent alarms. The existing codebase already handles this with `chrome.runtime.onStartup.addListener(() => rescheduleAll())`, but calendar-synced alarms need special handling.

**How to avoid:**
- Store calendar-synced alarm metadata persistently:
```javascript
await chrome.storage.local.set({
  calendarAlarms: items.map(item => ({
    ...item,
    source: 'calendar',
    calendarEventId: event.id,
    lastSynced: Date.now()
  }))
});
```
- In `rescheduleAll()`, distinguish calendar alarms from manual alarms
- Re-sync calendar alarms automatically on startup (with rate limit checks)
- Add visual indicator for calendar alarms so users know they're temporary snapshots

**Warning signs:**
- Calendar alarms disappear after browser restart
- Duplicate alarms created on each sync
- Users report "alarms worked yesterday, gone today"

**Phase to address:**
Phase 3 (Merge Logic) - When implementing re-sync and update behavior

---

### Pitfall 9: Sync Token 410 Gone Without Recovery

**What goes wrong:**
Google Calendar API invalidates sync tokens periodically (ACL changes, expiration, etc.) and returns 410 (Gone). If the extension doesn't handle this, subsequent syncs fail permanently until user manually re-authorizes or reinstalls.

**Why it happens:**
Sync tokens enable efficient incremental sync, but developers implement them once and assume they work forever. The API documentation states: "Sometimes sync tokens are invalidated by the server...requiring a full wipe of the client's store."

**How to avoid:**
- Always handle 410 responses specifically:
```javascript
try {
  const response = await fetch(url);
  if (response.status === 410) {
    // Token invalidated - clear and do full sync
    await chrome.storage.local.remove(['calendarSyncToken', 'calendarAlarms']);
    return fullSync(); // Start fresh
  }
} catch (error) {
  if (error.status === 410) {
    // Same recovery
  }
}
```
- For this project: since syncing "today only," sync tokens may not be needed initially
- If adding sync tokens later (for efficiency), must handle 410 gracefully

**Warning signs:**
- Sync works initially, then fails permanently
- 410 errors in logs without recovery
- Users forced to reinstall extension to fix sync

**Phase to address:**
Phase 3 (Merge Logic) - If implementing incremental sync; otherwise defer to future enhancement

---

### Pitfall 10: No Quota Indicator or User Feedback

**What goes wrong:**
When Calendar API calls fail (rate limits, network errors, auth failures), the extension silently fails without telling the user. Users click "Sync Calendar" and nothing happens, assuming the extension is broken.

**Why it happens:**
Developers focus on happy path during implementation and treat errors as "edge cases" to handle later. Error handling gets deprioritized or implemented poorly.

**How to avoid:**
- Add clear sync status UI in the popup:
  - "Syncing..." with spinner during request
  - "Last synced: 2 minutes ago" on success
  - "Sync failed: Rate limit. Try again in 1 minute" on quota errors
  - "Sync failed: Please reconnect your account" on auth errors
- Store sync state persistently:
```javascript
await chrome.storage.local.set({
  lastSyncStatus: 'success', // or 'rate_limit', 'auth_error', 'network_error'
  lastSyncTime: Date.now(),
  lastSyncError: null // or error message
});
```
- Distinguish error types for user-friendly messaging

**Warning signs:**
- Users report "sync button does nothing"
- No visual feedback during operations
- Generic error messages that don't help users

**Phase to address:**
Phase 2 (Calendar Sync) - Implement alongside initial sync feature

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing OAuth tokens in local storage without encryption | Simple implementation | Tokens exposed to malicious scripts, security audit failures | Never - use chrome.identity API which handles storage securely |
| Using `host_permissions: ["<all_urls>"]` instead of specific Google APIs | Works without configuration changes | Users see scary permission warning, lower install rate | Never - use `"https://www.googleapis.com/*"` |
| Syncing on every popup open | Always shows fresh data | Hits rate limits quickly, wastes quota | Only during development testing |
| Ignoring pagination with `maxResults: 2500` | Single request gets all events | Slow response, service worker timeout, memory issues | For users with <50 events (most cases) |
| Hardcoding timezone as UTC | Simple date math | Wrong times for all non-UTC users | Never - always use user's local timezone |
| No exponential backoff, just retry immediately | Simple error handling | Hammers API when down, wastes quota, longer recovery | Never - Google explicitly requires backoff |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| chrome.identity API | Calling `getAuthToken({ interactive: true })` on startup | Only call after explicit user action (button click), use `interactive: false` for background refreshes |
| Google Calendar API | Using local date strings without timezone | Always format as RFC3339 with timezone offset: `"2026-02-24T00:00:00-08:00"` |
| OAuth scopes | Requesting `calendar` (full access) instead of `calendar.readonly` | Use minimal scope needed - readonly for this project |
| Event filtering | Checking `event.status !== 'cancelled'` | Not enough - also filter out all-day events with `event.start.dateTime` check |
| Recurring events | Using `singleEvents=false` and trying to parse RRULE | Always use `singleEvents=true` to let API expand instances |
| Token refresh | Catching 401 and showing error to user | Automatically call `removeCachedAuthToken()` and retry before showing error |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Syncing entire calendar history | Slow initial sync, timeouts | Use `timeMin` and `timeMax` to limit to today only | >100 events per sync |
| Creating alarms without deduplication | Duplicate notifications, alarm limit reached | Check if alarm already exists before creating, use event IDs as identifiers | >50 calendar events |
| Fetching full event details when only need summary | Slow response, wasted bandwidth | API returns all fields by default - this is actually fine for small result sets | >500 events (not issue for today-only) |
| Polling calendar every minute | Quick quota exhaustion | Manual sync button only, or use push notifications (complex, defer to v2) | After ~50 syncs = quota limit reached |
| Storing entire event objects | Storage bloat | Only store fields needed for alarms: id, summary, start.dateTime, end.dateTime | >1000 calendar events stored |
| Chrome alarms API limit | Extension stops creating alarms | Chrome limits 500 concurrent alarms - track count, prune old ones | >500 active alarms |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing OAuth tokens in sync storage | Tokens leaked across user's browsers, potential account takeover | Use local storage only, or let chrome.identity API manage tokens |
| Not validating calendar event data | XSS if event summary contains malicious HTML | Treat all event data as untrusted, sanitize before displaying in UI |
| Using `setAccessLevel('TRUSTED_CONTEXTS')` for storage | Allows content scripts to read sensitive data | Keep default access level, only service worker should access Calendar data |
| Overly broad host permissions | Security review rejection, user distrust | Minimal: `"https://www.googleapis.com/*"` only |
| No CSP in manifest | Allows inline scripts if XSS exists | Add `"content_security_policy": { "extension_pages": "script-src 'self'; object-src 'self'" }` |
| Logging full API responses | Sensitive user data in logs, privacy issues | Log errors only, never full event details |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No loading state during sync | User clicks sync repeatedly, triggers multiple requests | Show spinner, disable button during sync, show "Syncing..." text |
| Generic error messages | "Something went wrong" tells user nothing | Specific: "Rate limit reached. Try again in 1 minute" or "Please reconnect your Google account" |
| No visual distinction for calendar alarms | User edits calendar alarm, expects it to update calendar | Show calendar icon badge, make read-only, add tooltip: "Synced from calendar" |
| Syncing on every browser startup | Slows startup, wastes quota, no user visibility | Manual sync only, or add setting: "Auto-sync on startup" (default OFF) |
| No indication of last sync time | User doesn't know if data is stale | Show "Last synced: 5 minutes ago" timestamp |
| Creating alarms for past events | Pointless alarms that fire immediately | Filter out events where start time < now |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **OAuth Flow:** Often missing removeCachedAuthToken() on 401 errors - verify token refresh works
- [ ] **Calendar Sync:** Often missing timezone offset in RFC3339 dates - verify with non-UTC users
- [ ] **Error Handling:** Often missing exponential backoff for 429/403 - verify retries with delays
- [ ] **Event Filtering:** Often missing all-day event check - verify only timed events create alarms
- [ ] **Alarm Creation:** Often missing duplicate detection - verify re-sync doesn't create duplicates
- [ ] **Service Worker:** Often missing persistence check on startup - verify alarms survive browser restart
- [ ] **Rate Limiting:** Often missing sync throttling - verify can't trigger sync more than once/minute
- [ ] **User Feedback:** Often missing sync status display - verify user sees loading/success/error states
- [ ] **Permission Scope:** Often requesting calendar instead of calendar.readonly - verify manifest uses minimal scope
- [ ] **Date Boundaries:** Often using wrong day boundaries - verify "today" works correctly at 11:59pm

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Stale cached tokens | LOW | Call `chrome.identity.removeCachedAuthToken()`, prompt re-auth |
| Rate limit exceeded | MEDIUM | Show user message, implement 60-second cooldown, add backoff |
| Invalid sync tokens (410) | MEDIUM | Clear stored sync token, trigger full sync, warn user of data refresh |
| Service worker terminated mid-sync | HIGH | Add sync state tracking, resume mechanism, or redesign for <30s completion |
| Timezone errors | HIGH | Requires code change, data migration for existing alarms, re-sync for all users |
| Hit 500 alarm limit | HIGH | Prune old alarms, add alarm count tracking, limit calendar sync to next N events |
| Missing host permissions | LOW | Update manifest.json, trigger extension update, republish |
| XSS from event data | HIGH | Sanitize all event text, audit existing alarms, patch and force update |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Stale OAuth token caching | Phase 1 (OAuth Setup) | Test token refresh by revoking access in Google settings |
| Interactive OAuth without context | Phase 1 (OAuth Setup) | User must click "Sync Calendar" button before seeing OAuth prompt |
| Missing manifest OAuth config | Phase 1 (OAuth Setup) | Extension loads without errors, OAuth flow completes successfully |
| Calendar API rate limits | Phase 2 (Calendar Sync) | Sync 10 times rapidly, verify backoff prevents 429 errors |
| Timezone hell in date filtering | Phase 2 (Calendar Sync) | Test with system timezone set to PST, EST, UTC+9 |
| Service worker termination | Phase 2 (Calendar Sync) | Monitor Chrome DevTools, verify sync completes before 30s |
| Mixing timed/all-day events | Phase 2 (Calendar Sync) | Add all-day event, verify it doesn't create alarm |
| Alarm persistence | Phase 3 (Merge Logic) | Create calendar alarms, restart browser, verify alarms recreated |
| Sync token 410 gone | Phase 3 (Merge Logic) | Simulate 410 response, verify graceful fallback to full sync |
| No user feedback | Phase 2 (Calendar Sync) | Trigger each error type, verify user-friendly message shown |

## Sources

### Official Documentation (HIGH confidence)
- Chrome Extension Identity API: https://developer.chrome.com/docs/extensions/reference/api/identity
- Chrome Extension Service Workers: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers
- Chrome Extension Offscreen Documents: https://developer.chrome.com/docs/extensions/reference/api/offscreen
- Chrome Alarms API: https://developer.chrome.com/docs/extensions/reference/api/alarms
- Chrome Storage API: https://developer.chrome.com/docs/extensions/reference/api/storage
- Chrome Extension Permissions: https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
- Google Calendar API Quota Limits: https://developers.google.com/calendar/api/guides/quota
- Google Calendar API Events.list: https://developers.google.com/calendar/api/v3/reference/events/list
- Google Calendar API Error Handling: https://developers.google.com/calendar/api/guides/errors
- Google Calendar API Sync: https://developers.google.com/calendar/api/guides/sync
- Google Calendar API Batch Operations: https://developers.google.com/calendar/api/guides/batch
- Google Calendar API Event Types: https://developers.google.com/calendar/api/concepts/events-calendars
- Chrome Extension OAuth2 Manifest: https://developer.chrome.com/docs/extensions/reference/manifest/oauth2

### Project Context (HIGH confidence)
- Existing codebase at /Users/user/projects/chrome-extentions/typing-alarm/
- PROJECT.md requirements and constraints
- Current Manifest v3 architecture with service workers
- Existing alarm scheduling and persistence patterns

---
*Pitfalls research for: Google Calendar API integration in Chrome Extension (Manifest v3)*
*Researched: 2026-02-24*
