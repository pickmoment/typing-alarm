# Feature Research: Calendar-Integrated Alarm Apps

**Domain:** Calendar sync for alarm/reminder browser extensions
**Researched:** 2026-02-24
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| OAuth authorization flow | Users expect secure, standard Google sign-in | MEDIUM | Chrome identity API provides built-in support; requires manifest config |
| Fetch today's events | Core use case - users want today's schedule | LOW | Google Calendar API events.list with timeMin/timeMax filters |
| Visual sync status indicator | Users need to know sync succeeded/failed | LOW | Show last sync time, loading state, error messages |
| Skip all-day events | All-day events don't need time-specific alarms | LOW | Filter events where `start.dateTime` is missing (only `start.date` exists) |
| Event title as alarm message | Users expect to see what the event is about | LOW | Map `event.summary` to alarm message directly |
| Event start time as alarm time | Users expect alarms at event start time | LOW | Parse `event.start.dateTime` and convert to alarm time |
| Re-sync button/trigger | Users need control over when to pull fresh data | LOW | Manual trigger in UI, clears and re-fetches |
| Distinguish calendar vs manual alarms | Users need to know which alarms are synced | LOW | Visual badge/icon, separate data field (`source: "calendar"`) |
| Token persistence | Users shouldn't re-auth on every browser restart | LOW | Chrome storage for refresh tokens, chrome.identity handles caching |
| Handle sync errors gracefully | Network issues, auth expiry, API limits happen | MEDIUM | Retry logic, clear error messages, don't break existing alarms |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Smart reminder timing (before event) | Industry standard: alarms N minutes before events | MEDIUM | Parse `event.reminders.overrides[]` and create multiple alarms per event (e.g., 15min before + at start) |
| Multiple calendar support | Power users have work/personal calendars | MEDIUM | Fetch calendar list, let user select which to sync; API supports calendarId parameter |
| Sync frequency options (auto-sync) | Convenience: auto-sync hourly/daily vs manual only | MEDIUM | Chrome alarms API for periodic sync; balance API quota vs freshness |
| Event conflict detection | Show overlapping events/alarms to prevent double-booking | MEDIUM | Compare event times, highlight conflicts in UI |
| Custom reminder offset per event | Users want different lead times for different event types | HIGH | UI for editing synced alarm times (makes them "modified" not pure sync) |
| Filter by calendar event type | Skip focus time, out-of-office, working location | LOW | Filter `event.eventType` field (focusTime, outOfOffice, workingLocation) |
| Sync recurring event instances | Handle repeating meetings correctly | HIGH | API has `instances` endpoint for recurring events; requires careful date logic |
| Two-way sync (alarm to calendar) | Create calendar events from manual alarms | HIGH | Reverse flow: POST to events.insert; complexity in deciding what should sync back |
| Smart snooze with calendar awareness | Snooze until X minutes before next event | MEDIUM | Fetch next event, calculate snooze duration dynamically |
| Event location in alarm | Show where event is (meeting room, address) | LOW | Display `event.location` field in alarm UI |
| Attendee awareness | Show who's in the meeting | LOW | Display `event.attendees[]` count or names |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time push sync | "I want instant updates when calendar changes" | Chrome extensions can't maintain persistent WebSocket connections; push notifications require server infrastructure; excessive battery/network usage | Manual sync button + periodic auto-sync (hourly); users rarely need sub-minute freshness |
| Edit synced alarms | "I want to change the time of this meeting alarm" | Creates confusion: is it still synced? Does it update on next sync? Which is source of truth? | Mark edited alarms as "detached" from calendar; OR make calendar alarms strictly read-only |
| Multi-day/week calendar sync | "Show me all my events for the week" | Complexity: recurring events, all-day events spanning days, storage bloat, UI clutter | Stick to today-only for v1; users care most about "what's coming up today" |
| Sync deleted calendar events | "Auto-delete alarms when I delete calendar events" | Requires tracking event IDs, handling incremental sync with deletion detection; what if event was deleted by mistake? | Re-sync replaces all calendar alarms (simpler mental model) |
| Multiple Google accounts | "I have work and personal Google accounts" | Chrome identity API complexity; users must choose account each time; token management per account | Single account per extension; users can switch by re-authorizing |
| Automatic sync on startup | "Sync automatically when I open Chrome" | Users may not want immediate network activity; can fail silently if offline; feels invasive | Show stale sync time, let user click sync when ready |
| Sync past events | "Show events from yesterday" | Past events are not actionable; alarm already passed; wastes storage and API quota | Only fetch events with `start.dateTime >= now` |
| Customize alarm sound per event | "Different sounds for different meeting types" | High complexity; requires event categorization; most users won't configure | Single alarm sound for all (matches existing extension behavior) |

## Feature Dependencies

```
[OAuth Authorization]
    └──requires──> [Token Persistence]
                       └──enables──> [Fetch Calendar Events]
                                         └──enables──> [Create Alarms from Events]
                                                           └──enhances──> [Visual Distinction]

[Re-sync Button] ──requires──> [Merge Logic] (update existing, add new, preserve manual)

[Smart Reminder Timing] ──requires──> [Event Reminders Parsing]
                        ──conflicts──> [Strict Read-Only Calendar Alarms]

[Auto-sync] ──requires──> [Periodic Background Task]
            ──conflicts──> [Manual-Only Sync] (pick one philosophy)

[Multiple Calendar Support] ──enhances──> [Filter by Calendar Type]
                            ──increases complexity of──> [Sync Status Display]

[Two-way Sync] ──conflicts──> [Read-Only Calendar Alarms]
               ──requires──> [Event Creation Permissions]
```

### Dependency Notes

- **OAuth Authorization requires Token Persistence:** Can't sync without saving tokens across sessions; chrome.identity API provides this
- **Re-sync requires Merge Logic:** Must decide how to handle existing calendar alarms (replace all? update matching? keep manual alarms?)
- **Smart Reminder Timing conflicts with Read-Only:** If alarms are read-only snapshots, can't add custom offsets; must choose one model
- **Auto-sync conflicts with Manual-Only:** Philosophical choice - control vs convenience
- **Two-way Sync conflicts with Read-Only:** Can't both prevent editing AND sync edits back to calendar

## MVP Definition

### Launch With (v1)

Minimum viable product - what's needed to validate the concept.

- [ ] OAuth authorization with chrome.identity API - Essential for any calendar access
- [ ] Manual sync button (not automatic) - User control, simpler implementation
- [ ] Fetch today's timed events only - Core use case, avoids complexity
- [ ] Skip all-day events - Standard behavior, prevents noise
- [ ] Event title → alarm message mapping - Basic expectation
- [ ] Event start time → alarm time - Core functionality
- [ ] Visual distinction for calendar alarms - Users need to know origin
- [ ] Sync status display (success/error/last sync time) - Essential feedback
- [ ] Replace strategy on re-sync - Simplest merge logic: delete old calendar alarms, add new ones
- [ ] Token persistence across sessions - Required for usability
- [ ] Error handling for common cases - Auth expiry, network failure, rate limits

**Rationale:** These features provide the complete "happy path" for calendar sync while avoiding complexity traps. Users can authorize once, click sync daily, and get alarms from their calendar events. No automatic behaviors, no editing conflicts, no multi-day complexity.

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Smart reminder timing (parse event.reminders) - High user value once basic sync works
- [ ] Event location display - Low effort, nice information
- [ ] Filter by event type (skip focus time, OOO) - Prevents alarm spam from non-meeting blocks
- [ ] Recurring event instance handling - Important for weekly meetings, but complex
- [ ] Auto-sync with configurable frequency - Convenience after manual sync is proven

**Trigger for adding:**
- Smart reminders: User feedback requests "alarm 15min before meeting"
- Location/type: Easy wins after v1 ships
- Recurring events: When users report "my weekly standup doesn't show up"
- Auto-sync: When users request "I forget to sync every day"

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Multiple calendar support - Complex UI, most users have one primary calendar
- [ ] Multiple Google account support - Identity management complexity
- [ ] Event attendee display - Nice-to-have information, not actionable
- [ ] Event conflict detection - Useful but not critical for alarm function
- [ ] Custom reminder offsets per event - High complexity, niche use case
- [ ] Two-way sync (create calendar events from alarms) - Requires different architecture
- [ ] Multi-day sync - Scope creep, most value is in "today's events"

**Why defer:**
- Multiple calendars/accounts: Wait for user requests with specific use cases
- Attendee/conflict features: Wait for feedback on what users actually need beyond basic alarms
- Two-way sync: Fundamentally changes product from "read calendar" to "manage calendar"
- Multi-day: Most users care about "what's happening today", not "what's happening this week"

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| OAuth authorization | HIGH | MEDIUM | P1 |
| Fetch today's events | HIGH | LOW | P1 |
| Manual sync button | HIGH | LOW | P1 |
| Skip all-day events | HIGH | LOW | P1 |
| Event → alarm mapping | HIGH | LOW | P1 |
| Visual distinction | HIGH | LOW | P1 |
| Sync status display | HIGH | LOW | P1 |
| Token persistence | HIGH | LOW | P1 |
| Replace strategy on re-sync | MEDIUM | MEDIUM | P1 |
| Error handling | HIGH | MEDIUM | P1 |
| Smart reminder timing | HIGH | MEDIUM | P2 |
| Filter by event type | MEDIUM | LOW | P2 |
| Event location display | LOW | LOW | P2 |
| Recurring event instances | MEDIUM | HIGH | P2 |
| Auto-sync periodic | MEDIUM | MEDIUM | P2 |
| Multiple calendar support | MEDIUM | MEDIUM | P3 |
| Event attendee display | LOW | LOW | P3 |
| Event conflict detection | MEDIUM | MEDIUM | P3 |
| Custom reminder offsets | MEDIUM | HIGH | P3 |
| Two-way sync | LOW | HIGH | P3 |
| Multi-day sync | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (MVP)
- P2: Should have, add when possible (v1.x)
- P3: Nice to have, future consideration (v2+)

## Competitor Feature Analysis

| Feature | Google Calendar (native) | Apple Reminders | Microsoft To Do | Our Approach |
|---------|--------------------------|-----------------|-----------------|--------------|
| Calendar sync | N/A (is the calendar) | Read-only import from calendar | Read-only sync with Outlook | Read-only sync, today only, manual trigger |
| Event reminders | Multiple reminders per event | Single reminder per item | Single reminder | Parse event.reminders, create alarm at start time (v1), add offset reminders later (v2) |
| Recurring events | Full rrule support | Basic repeating | Basic repeating | Sync instances for today only (fetch via instances endpoint) |
| All-day events | Distinct from timed | Mixed with timed | Mixed with timed | Skip entirely (no timed alarm needed) |
| Multi-calendar | User selects which to show | Single calendar app | Multiple lists | Primary calendar only (v1), multi-calendar (v2) |
| Sync frequency | Real-time | Manual or periodic | Real-time | Manual (v1), periodic option (v2) |
| Editing synced items | Edit in calendar | Detaches from calendar | Detaches from sync | Read-only (v1), consider detachment model (v2) |
| Event details | Full event info | Basic title/notes | Title/notes/attachments | Title (v1), add location/attendees (v2) |

**Our differentiator vs native calendar apps:**
- Browser-based, always accessible without switching apps
- Combines calendar events with custom typed alarms in one view
- Flexible natural language input for manual alarms (existing strength)
- Desktop notification + audio alerts (more prominent than calendar notifications)

**Our limitation vs native calendar apps:**
- No real-time sync (acceptable trade-off for browser extension architecture)
- No event creation/editing (out of scope - we're an alarm app, not a calendar app)
- Today-only focus (intentional simplicity)

## Architecture Implications

### Data Model

```javascript
// Extend existing alarm item structure
{
  id: "uuid",
  source: "manual" | "calendar",  // NEW: distinguish origin
  calendarEventId: "event123",     // NEW: track calendar event for updates
  raw: "09:00",                     // existing
  hour: 9,                          // existing
  minute: 0,                        // existing
  message: "Team standup",          // existing (from event.summary)
  repeat: "once",                   // existing (calendar events are one-time for today)
  enabled: true,                    // existing
  readonly: false,                  // NEW: true for calendar alarms
  // ... other existing fields
}
```

### Sync Strategy: Replace vs Merge

**Option A: Replace All Calendar Alarms (RECOMMENDED for v1)**
- On sync: delete all alarms where `source === "calendar"`, then add fresh alarms from today's events
- Pros: Simple, no state tracking, always matches calendar
- Cons: Loses any user modifications to calendar alarms

**Option B: Merge by Event ID**
- Track `calendarEventId`, update matching alarms, add new ones, remove deleted events
- Pros: Preserves user modifications, more sophisticated
- Cons: Complex logic, requires incremental sync token handling, edge cases

**Decision:** Start with Replace (simpler), consider Merge for v2 if users request it.

### Sync Timing

**v1: Manual Only**
- Button in popup UI triggers sync
- Shows loading state during fetch
- Displays sync result (success + count, or error message)
- Stores last sync timestamp

**v2: Optional Auto-sync**
- User setting: "Auto-sync every X hours" or "Manual only"
- Use chrome.alarms API to schedule periodic sync
- Respect API quota (max 1 sync per hour)
- Still show manual sync button for immediate refresh

## Technical Constraints

### Google Calendar API Quotas
- **Queries per day:** 1,000,000 (per project)
- **Queries per 100 seconds:** 50,000 (per project)
- **Queries per 100 seconds per user:** 1,500

**Impact:** Manual sync is safe; auto-sync every hour is safe; real-time sync is not feasible

### Chrome Extension Limitations
- Service workers are ephemeral (can't maintain WebSocket connections)
- chrome.identity API handles OAuth but requires manifest configuration
- Must use chrome.alarms API for scheduled tasks (not setInterval)
- Storage limits: chrome.storage.local has 10MB quota (sufficient for alarm data)

### Calendar API Event Properties Available
- **For alarms:** `summary`, `start.dateTime`, `end.dateTime`, `reminders`, `location`, `eventType`, `attendees`
- **For filtering:** `start.date` (all-day vs timed), `eventType` (focusTime, outOfOffice, etc.)
- **For recurring:** `recurringEventId`, access via `instances` endpoint

## Edge Cases to Handle

| Edge Case | Expected Behavior | Implementation Notes |
|-----------|-------------------|---------------------|
| User deletes calendar event | On next sync, alarm disappears (if using Replace strategy) | No special handling needed with Replace; with Merge requires deletion detection |
| User has no events today | Sync succeeds, shows "0 events synced" message | Check for empty events array, don't treat as error |
| Event starts in the past | Skip creating alarm (already happened) | Filter events where `start.dateTime < now` |
| Event missing summary | Use default message "Calendar event" | Fallback for `event.summary` being empty/null |
| Event without dateTime (all-day) | Skip entirely | Only process events with `start.dateTime` present |
| Token expires mid-session | Show auth error, prompt re-authorization | Catch 401 responses, call chrome.identity.removeCachedAuthToken and retry |
| Network failure during sync | Show error message, keep existing alarms intact | Try-catch around API calls, don't delete old calendar alarms if fetch fails |
| API rate limit hit | Show "try again later" message | Catch 429 responses, inform user |
| Event timezone differs from user | Convert to user's local time | API returns dateTime with timezone, JS Date handles conversion |
| Recurring event (weekly meeting) | v1: Treat as single instance for today; v2: Use instances endpoint | Check for `recurrence` field, optionally fetch instances |
| User has 50+ events today | Only sync first 50 or paginate | API returns `nextPageToken`, decide on reasonable limit |

## UX Patterns

### Authorization Flow
1. User clicks "Connect Google Calendar" button in settings
2. Chrome identity API launches OAuth consent screen
3. User grants calendar.readonly permission
4. Extension receives access token, stores in chrome.storage
5. Success message: "Connected to [user email]"

### Sync Flow
1. User clicks "Sync Calendar" button (or auto-trigger fires)
2. Button shows loading spinner, text changes to "Syncing..."
3. Extension fetches today's events via Calendar API
4. Filters out all-day events, past events
5. Creates/updates alarms from filtered events
6. Shows toast: "Synced 3 events" or "No events today"
7. Updates "Last synced: 2 minutes ago" timestamp

### Error States
- **Auth expired:** "Calendar connection expired. [Reconnect]"
- **Network failure:** "Couldn't sync. Check your connection and try again."
- **API error:** "Calendar sync failed. Try again later."
- **No permission:** "Calendar access not granted. [Grant Access]"

### Visual Distinction
- Calendar alarms have badge/icon (📅) next to message
- Different background color or border
- Grouped separately in list (optional: "Calendar Events" section header)
- Tooltip on hover: "From Google Calendar - Event Name"

## Security & Privacy

- **OAuth scopes:** Request `https://www.googleapis.com/auth/calendar.readonly` (read-only, minimum necessary)
- **Data storage:** Calendar data stays local in chrome.storage, never sent to external servers
- **Token security:** chrome.identity API handles token storage securely, no manual token management
- **User control:** Clear disconnect/revoke option in settings
- **Transparency:** Show user email and last sync time so they know what's connected

## Sources

### High Confidence (Official Documentation)
- Google Calendar API v3 Reference: https://developers.google.com/calendar/api/v3/reference
  - Event properties, filtering, reminders structure
- Google Calendar API Guides (Sync): https://developers.google.com/calendar/api/guides/sync
  - Incremental sync patterns, sync tokens
- Chrome identity API: https://developer.chrome.com/docs/extensions/reference/api/identity
  - OAuth flows, token caching, best practices

### Medium Confidence (Training Data + Domain Knowledge)
- Competitor behavior patterns (Google Calendar, Apple Reminders, Microsoft To Do)
- Common UX patterns for calendar sync features
- Anti-patterns from calendar integration projects

### Low Confidence (Needs Validation)
- Specific quota limits for free vs paid API usage
- Exact user expectations for calendar sync (should validate with user research)
- Optimal sync frequency (manual vs hourly vs daily)

## Recommendations for Project.md

Based on this research, update Active requirements:

**Keep as-is (validated):**
- ✓ Manual sync button
- ✓ Today's events only
- ✓ Skip all-day events
- ✓ Event title → alarm message
- ✓ Event start time → alarm time
- ✓ Visual distinction for calendar alarms
- ✓ Token persistence

**Consider adding to Active (table stakes):**
- [ ] Replace strategy on re-sync (delete all calendar alarms, add fresh)
- [ ] Comprehensive error handling (auth, network, API limits)
- [ ] Read-only calendar alarms (can't be edited, only deleted)

**Move to Future/Out of Scope:**
- Multiple calendars (v2)
- Two-way sync (v2+, different product direction)
- Auto-sync (v1.x, after manual is proven)
- Smart reminder offsets (v1.x, after basic sync works)

---
*Feature research for: Calendar-integrated alarm Chrome extension*
*Researched: 2026-02-24*
*Confidence: MEDIUM (official API docs are HIGH, user behavior patterns are MEDIUM)*
