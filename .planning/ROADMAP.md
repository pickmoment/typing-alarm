# Roadmap: Typing Alarm - Google Calendar Integration

**Project:** Typing Alarm - Google Calendar Integration
**Core Value:** Users can quickly set alarms without precise formatting, and now sync their calendar events to never miss scheduled meetings or appointments.
**Created:** 2026-02-24
**Depth:** Standard (5 phases)

## Phases

- [ ] **Phase 1: OAuth Foundation** - Establish Google Calendar authentication with chrome.identity API
- [ ] **Phase 2: Calendar API Integration** - Fetch and transform today's calendar events into alarms
- [ ] **Phase 3: Data Management & Merge** - Integrate calendar alarms with existing alarm system
- [ ] **Phase 4: UI & Status Display** - Add sync controls and visual feedback to popup
- [ ] **Phase 5: Error Handling & Polish** - Implement robust error recovery and edge case handling

## Phase Details

### Phase 1: OAuth Foundation
**Goal**: User can securely authorize Google Calendar access and tokens persist across sessions

**Depends on**: Nothing (first phase)

**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04

**Success Criteria** (what must be TRUE):
1. User can click authorize button and complete Google OAuth consent flow
2. OAuth token persists across browser restarts without requiring re-authentication
3. User sees clear error message when authorization fails or is denied
4. User can re-authorize after token revocation in Google account settings
5. Extension manifest includes identity permission and OAuth2 client configuration

**Plans**: TBD

---

### Phase 2: Calendar API Integration
**Goal**: System can fetch today's calendar events and transform them into alarm-ready data

**Depends on**: Phase 1 (requires working OAuth token)

**Requirements**: SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05

**Success Criteria** (what must be TRUE):
1. User can click sync button to trigger calendar event fetch
2. System retrieves only timed events from today (skips all-day events)
3. Calendar event title correctly maps to alarm message field
4. Calendar event start time correctly maps to alarm time in user's local timezone
5. System handles timezone conversion without shifting events to wrong times

**Plans**: TBD

---

### Phase 3: Data Management & Merge
**Goal**: Calendar alarms integrate seamlessly with manual alarms without data loss

**Depends on**: Phase 2 (requires calendar event data)

**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04

**Success Criteria** (what must be TRUE):
1. Calendar-synced alarms are tagged with "source: calendar" metadata
2. Re-syncing replaces existing calendar alarms while preserving manual alarms
3. User can delete individual calendar-synced alarms without affecting manual alarms
4. Calendar alarms persist across browser restarts just like manual alarms
5. Alarm list shows both manual and calendar alarms without duplicates

**Plans**: TBD

---

### Phase 4: UI & Status Display
**Goal**: User has clear controls and feedback for calendar sync operations

**Depends on**: Phase 3 (requires working backend sync flow)

**Requirements**: UI-01, UI-02, UI-03, UI-04

**Success Criteria** (what must be TRUE):
1. Sync button shows loading spinner during active sync operation
2. Calendar-synced alarms have visual distinction (icon, badge, or color) from manual alarms
3. User sees sync status display with last sync time and success/error state
4. Sync button is disabled during active sync to prevent concurrent operations
5. User can identify which alarms came from calendar at a glance

**Plans**: TBD

---

### Phase 5: Error Handling & Polish
**Goal**: System handles all failure scenarios gracefully with clear user feedback

**Depends on**: Phase 4 (requires complete sync flow to test error paths)

**Requirements**: ERROR-01, ERROR-02, ERROR-03, ERROR-04

**Success Criteria** (what must be TRUE):
1. System implements exponential backoff when hitting Calendar API rate limits
2. Network failures show user-friendly error messages without breaking extension
3. All sync operations complete within service worker 30-second timeout
4. User sees specific error messages for different failure scenarios (auth expired, network offline, rate limited)
5. Extension recovers from all error states without requiring browser restart

**Plans**: TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. OAuth Foundation | 0/0 | Not started | - |
| 2. Calendar API Integration | 0/0 | Not started | - |
| 3. Data Management & Merge | 0/0 | Not started | - |
| 4. UI & Status Display | 0/0 | Not started | - |
| 5. Error Handling & Polish | 0/0 | Not started | - |

## Coverage

**Total v1 Requirements:** 21
**Mapped to Phases:** 21
**Unmapped:** 0 ✓

| Category | Requirements | Phase |
|----------|--------------|-------|
| OAuth & Authentication | AUTH-01, AUTH-02, AUTH-03, AUTH-04 | Phase 1 |
| Calendar Sync | SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05 | Phase 2 |
| Data Management | DATA-01, DATA-02, DATA-03, DATA-04 | Phase 3 |
| UI & Feedback | UI-01, UI-02, UI-03, UI-04 | Phase 4 |
| Error Handling | ERROR-01, ERROR-02, ERROR-03, ERROR-04 | Phase 5 |

---
*Last updated: 2026-02-24*
