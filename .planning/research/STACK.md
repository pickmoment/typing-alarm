# Stack Research: Google Calendar API Integration

**Domain:** Chrome Extension (Manifest v3) - Google Calendar API Integration
**Researched:** 2026-02-24
**Confidence:** HIGH

## Recommended Stack

### Core Chrome APIs

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| chrome.identity | Manifest v3 | OAuth 2.0 authentication for Google services | Official Chrome API for OAuth in extensions. Handles token caching, automatic expiration, and secure credential storage. Required for Google API authentication in MV3 extensions. |
| chrome.storage.local | Manifest v3 | Persist OAuth tokens and sync metadata | Already in use in existing codebase. Reliable cross-session storage for auth tokens and last sync timestamps. |
| Fetch API | Native (ES2015+) | Make REST API calls to Google Calendar | Native browser API, no dependencies. MV3 prohibits external libraries like gapi.js, so direct REST calls are required. |

### Google APIs

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Google Calendar API | v3 | Fetch calendar events via REST | Current stable version. Simple REST interface (`GET /calendars/calendarId/events`) works perfectly with vanilla JavaScript and Fetch API. No client library needed. |
| OAuth 2.0 | 2.0 | User authorization protocol | Industry standard for API authorization. Chrome.identity API implements this protocol specifically for extensions. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **None required** | - | - | The existing vanilla JavaScript codebase can handle all requirements without additional dependencies. Chrome APIs + Fetch API + native Date handling is sufficient. |

### OAuth Scopes

| Scope | Purpose | Rationale |
|-------|---------|-----------|
| `https://www.googleapis.com/auth/calendar.events.readonly` | Read events from all user calendars | Most restrictive scope for reading events. Recommended over broader `calendar.readonly` scope. Follows principle of least privilege. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Chrome Developer Tools | Extension debugging and API testing | Built-in. Use chrome://extensions with "Developer mode" enabled. |
| Google Cloud Console | OAuth client ID and API key generation | Required for creating OAuth 2.0 credentials. Free tier sufficient. |
| Postman or curl | Test REST API endpoints | Optional but helpful for validating API responses during development. |

## Installation

**No npm packages required.** This integration uses native Chrome APIs and REST calls only.

### Setup Steps:

1. **Register extension in Google Cloud Console:**
   ```bash
   # Visit https://console.cloud.google.com/
   # Create new project or select existing
   # Enable Google Calendar API
   # Create OAuth 2.0 Client ID (Chrome Extension type)
   # Note your Client ID
   ```

2. **Update manifest.json:**
   ```json
   {
     "permissions": [
       "identity",
       "storage",
       "alarms",
       "notifications",
       "offscreen"
     ],
     "oauth2": {
       "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
       "scopes": [
         "https://www.googleapis.com/auth/calendar.events.readonly"
       ]
     }
   }
   ```

3. **Maintain consistent extension ID:**
   - Upload to Chrome Web Store (or private distribution)
   - Copy extension ID from chrome://extensions
   - Use this ID when configuring OAuth client

## Implementation Pattern

### Authentication Flow

```javascript
// Get OAuth token using chrome.identity
chrome.identity.getAuthToken({ interactive: true }, (token) => {
  if (chrome.runtime.lastError) {
    console.error('Auth failed:', chrome.runtime.lastError);
    return;
  }
  // Token automatically cached, use for API calls
  fetchCalendarEvents(token);
});
```

### Making API Calls

```javascript
// Direct REST API call with Fetch
async function fetchCalendarEvents(token) {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const params = new URLSearchParams({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime'
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired, remove from cache and retry
      chrome.identity.removeCachedAuthToken({ token }, () => {
        chrome.identity.getAuthToken({ interactive: false }, (newToken) => {
          fetchCalendarEvents(newToken);
        });
      });
      return;
    }
    throw new Error(`API call failed: ${response.status}`);
  }

  const data = await response.json();
  return data.items || [];
}
```

### Filtering Events

```javascript
// Filter for timed events only (skip all-day events)
function filterTimedEvents(events) {
  return events.filter(event => {
    // Timed events have dateTime, all-day events have date
    return event.start.dateTime && event.end.dateTime;
  });
}
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Direct REST API calls with Fetch | Google API JavaScript Client (gapi.js) | **Never for MV3 extensions.** Gapi.js is externally hosted code, which violates Chrome Web Store policy. Would require bundling entire library locally (unnecessarily complex). |
| chrome.identity.getAuthToken | Manual OAuth 2.0 flow with launchWebAuthFlow | Only if integrating non-Google identity providers. For Google APIs, getAuthToken is purpose-built and simpler. |
| calendar.events.readonly scope | calendar.readonly scope | If you need to read calendar metadata (name, description, settings) in addition to events. Broader scope requires more user trust. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Google API JavaScript Client (gapi.js) from CDN | Chrome MV3 prohibits remotely hosted code. Loading `https://apis.google.com/js/api.js` at runtime violates Web Store policy. | Direct REST API calls with native Fetch API. |
| Google Identity Services (GIS) library | Another external library. Same remote code restrictions apply. | chrome.identity.getAuthToken for OAuth. |
| npm/webpack/build tools | Existing codebase is vanilla JS with no build step. Adding build complexity contradicts project constraints. | Keep vanilla JavaScript approach. Chrome APIs work perfectly without transpilation. |
| Service accounts | Designed for server-to-server auth. Cannot be used in browser extensions where credentials would be exposed. | OAuth 2.0 with user consent via chrome.identity. |
| API keys for authentication | API keys are for identifying the calling application, not authenticating users. Calendar data is private and requires OAuth. | OAuth 2.0 access tokens from chrome.identity. |
| localStorage for token storage | While technically possible, chrome.storage.local is the recommended approach for extensions. Better cross-profile support. | chrome.storage.local (already in use). |
| Implicit grant flow | Deprecated by Google. Chrome.identity uses authorization code flow under the hood. | chrome.identity.getAuthToken (handles flow internally). |

## Stack Patterns by Variant

**If you need write access (create/update events):**
- Change scope to `https://www.googleapis.com/auth/calendar.events` (read/write)
- Use POST/PUT/DELETE requests to Calendar API
- Same architecture, just different HTTP methods
- Confidence: HIGH (straightforward REST API extension)

**If you need multiple calendar sources:**
- Call `/calendars/calendarId/events` for each calendar ID
- Get calendar list first: `GET /users/me/calendarList`
- Merge results client-side
- Confidence: HIGH (documented API pattern)

**If offline support is critical:**
- Cache event data in chrome.storage.local after sync
- Display cached data when offline
- Sync updates when connection restored
- Confidence: HIGH (standard offline-first pattern)

**If you need recurring event instances:**
- Set `singleEvents: true` query parameter
- API expands recurring events into individual instances
- Confidence: HIGH (documented in API reference)

## Version Compatibility

| Chrome API | Minimum Chrome Version | Notes |
|-----------|------------------------|-------|
| chrome.identity.getAuthToken | Chrome 88+ | MV3 support stable. Token caching automatic. |
| chrome.identity.removeCachedAuthToken | Chrome 88+ | Use when API returns 401 to refresh token. |
| Fetch API | Chrome 42+ | Native support, no polyfill needed. |
| Google Calendar API v3 | Current | Stable since 2011. No breaking changes expected. v4 not planned per Google's API versioning policy. |

## Security Considerations

**Token Storage:**
- chrome.identity caches tokens in memory (automatic)
- Persist OAuth consent state (not the token itself) in chrome.storage.local
- Never log tokens or expose in UI

**Scope Minimization:**
- Use `calendar.events.readonly` not broader `calendar.readonly`
- Request minimal data needed (today's events only)

**Error Handling:**
- Always check chrome.runtime.lastError after chrome.identity calls
- Handle 401 responses by removing cached token and re-authenticating
- Show user-friendly error messages for auth failures

**Content Security Policy:**
- MV3 default CSP is sufficient: `script-src 'self'; object-src 'self'`
- No external scripts allowed (policy compliant by design)

## Migration from Existing Codebase

**Additions needed:**
1. Add `identity` permission to manifest.json
2. Add `oauth2` section with client_id and scopes
3. Create new module: `calendar.js` (Calendar API integration)
4. Add sync UI in popup.html (button + status display)
5. Extend alarm data model with `source` field ("manual" vs "calendar")

**No changes needed:**
- Existing alarm scheduling logic (reuse computeNextOccurrence)
- Time parsing (time.js) - not used for calendar events
- Storage layer (chrome.storage.local already in use)
- Service worker architecture (add calendar sync as new message handler)

**Files to create:**
- `calendar.js` - OAuth + API call logic (new ES module)
- Update `background.js` - Add sync message handler
- Update `popup.js` - Add sync UI handlers
- Update `popup.html` - Add sync button and status

## Sources

- **Chrome Identity API Reference** (HIGH confidence)
  - https://developer.chrome.com/docs/extensions/reference/api/identity
  - Official Chrome documentation, current as of 2025

- **Chrome Extensions OAuth Guide** (HIGH confidence)
  - https://developer.chrome.com/docs/extensions/how-to/integrate/oauth
  - Official implementation guide with manifest setup

- **Remote Hosted Code Policy** (HIGH confidence)
  - https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code
  - Critical: gapi.js cannot be used in MV3 extensions

- **Google Calendar API v3 Reference** (HIGH confidence)
  - https://developers.google.com/calendar/api/v3/reference
  - Official API documentation, REST endpoints

- **Calendar Events List Endpoint** (HIGH confidence)
  - https://developers.google.com/calendar/api/v3/reference/events/list
  - Query parameters for filtering today's events

- **Event Resource Structure** (HIGH confidence)
  - https://developers.google.com/calendar/api/v3/reference/events
  - Distinguishing all-day (date) vs timed (dateTime) events

- **Google OAuth 2.0 Scopes** (HIGH confidence)
  - https://developers.google.com/identity/protocols/oauth2/scopes
  - Complete scope list for Calendar API

- **OAuth 2.0 for Web Server Apps** (MEDIUM confidence)
  - https://developers.google.com/identity/protocols/oauth2/web-server
  - Token refresh patterns (chrome.identity handles this automatically)

- **Calendar API JavaScript Quickstart** (MEDIUM confidence)
  - https://developers.google.com/calendar/api/quickstart/js
  - Sample code uses gapi.js (not applicable to extensions), but shows API patterns

---
*Stack research for: Google Calendar API integration in Chrome Extension MV3*
*Researched: 2026-02-24*
