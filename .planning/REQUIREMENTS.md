# Requirements: Typing Alarm - Google Calendar Integration

**Defined:** 2026-02-24
**Core Value:** Users can quickly set alarms without precise formatting, and now sync their calendar events to never miss scheduled meetings or appointments.

## v1 Requirements

Requirements for adding Google Calendar sync to the existing alarm extension.

### OAuth & Authentication

- [ ] **AUTH-01**: User can authorize Google Calendar access via one-time OAuth flow
- [ ] **AUTH-02**: OAuth token persists across browser restarts
- [ ] **AUTH-03**: User receives clear error message when auth fails or expires
- [ ] **AUTH-04**: User can re-authorize if token is revoked

### Calendar Sync

- [ ] **SYNC-01**: User can click sync button at top of popup to fetch today's events
- [ ] **SYNC-02**: System fetches only timed events from today (skips all-day events)
- [ ] **SYNC-03**: Calendar event title becomes alarm message
- [ ] **SYNC-04**: Calendar event start time becomes alarm time
- [ ] **SYNC-05**: System handles timezone correctly (user's local timezone)

### Data Management

- [ ] **DATA-01**: Calendar-synced alarms are tagged with "source: calendar"
- [ ] **DATA-02**: Re-syncing updates existing calendar alarms (merge strategy)
- [ ] **DATA-03**: Manual alarms remain untouched during calendar sync
- [ ] **DATA-04**: User can delete calendar-synced alarms individually

### UI & Feedback

- [ ] **UI-01**: Sync button shows loading state during sync
- [ ] **UI-02**: Calendar-synced alarms have visual distinction from manual alarms
- [ ] **UI-03**: User sees sync status (success, error, last sync time)
- [ ] **UI-04**: Sync button is disabled during active sync

### Error Handling

- [ ] **ERROR-01**: System handles API rate limits with exponential backoff
- [ ] **ERROR-02**: System handles network failures gracefully
- [ ] **ERROR-03**: System completes sync within service worker timeout (30s)
- [ ] **ERROR-04**: User sees specific error messages for different failure scenarios

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Sync

- **SYNC-06**: User can configure auto-sync at specific intervals (hourly, daily)
- **SYNC-07**: User can sync specific calendars (not just primary)
- **SYNC-08**: System uses calendar event reminders for alarm timing (not just start time)

### Advanced Features

- **FEAT-01**: User can filter calendar events by type or keyword
- **FEAT-02**: Calendar-synced alarms show event location and attendees
- **FEAT-03**: System handles recurring calendar events intelligently
- **FEAT-04**: User can sync multi-day events (not just today)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Two-way sync (updating calendar from alarms) | Different product model - alarm app vs calendar manager. High complexity, unclear value. |
| Editing calendar-synced alarms | Creates confusion about source of truth. Calendar is authoritative for calendar events. |
| Real-time push sync | Chrome extension architecture doesn't support persistent connections. Service workers terminate after 30s. |
| Automatic sync on startup | Feels invasive, can fail silently, consumes API quota unnecessarily. Manual control preferred. |
| Using Google's gapi.js library | MV3 Content Security Policy prohibits remotely hosted code. Must use direct REST API calls. |
| Syncing multiple calendars in v1 | Adds UI complexity (calendar picker). Primary calendar sufficient for v1. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| SYNC-01 | Phase 2 | Pending |
| SYNC-02 | Phase 2 | Pending |
| SYNC-03 | Phase 2 | Pending |
| SYNC-04 | Phase 2 | Pending |
| SYNC-05 | Phase 2 | Pending |
| DATA-01 | Phase 3 | Pending |
| DATA-02 | Phase 3 | Pending |
| DATA-03 | Phase 3 | Pending |
| DATA-04 | Phase 3 | Pending |
| UI-01 | Phase 4 | Pending |
| UI-02 | Phase 4 | Pending |
| UI-03 | Phase 4 | Pending |
| UI-04 | Phase 4 | Pending |
| ERROR-01 | Phase 5 | Pending |
| ERROR-02 | Phase 5 | Pending |
| ERROR-03 | Phase 5 | Pending |
| ERROR-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-24*
*Last updated: 2026-02-24 after initial definition*
