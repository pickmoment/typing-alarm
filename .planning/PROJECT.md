# Typing Alarm - Google Calendar Integration

## What This Is

A Chrome extension that creates customizable alarms with flexible natural language time input (Korean and English). Users can set one-time or recurring alarms with custom messages. Now adding Google Calendar integration to automatically create alarms from today's calendar events.

## Core Value

Users can quickly set alarms without precise formatting, and now sync their calendar events to never miss scheduled meetings or appointments.

## Requirements

### Validated

<!-- Shipped and confirmed valuable - existing functionality -->

- ✓ User can create alarms with natural language time input (Korean/English) - existing
- ✓ User can set one-time or recurring alarms (daily, weekday, weekly, custom days) - existing
- ✓ User can add custom messages to alarms - existing
- ✓ User can enable/disable alarms without deleting them - existing
- ✓ User can edit existing alarms inline - existing
- ✓ User can delete alarms - existing
- ✓ User sees live countdown timers for upcoming alarms - existing
- ✓ Alarms fire with desktop notifications and audio alerts - existing
- ✓ User can configure alarm duration and sound interval - existing
- ✓ User can save and use quick phrase shortcuts - existing
- ✓ Alarm data persists across browser sessions - existing

### Active

<!-- Current scope - Google Calendar sync feature -->

- [ ] User can authorize Google Calendar access with one-time OAuth setup
- [ ] User can click sync button at top of popup to pull today's calendar events
- [ ] System creates alarms from today's timed events (skips all-day events)
- [ ] Calendar event title becomes alarm message
- [ ] Calendar event start time becomes alarm time
- [ ] Re-syncing merges updates (updates existing calendar alarms, adds new ones)
- [ ] User sees visual indication of which alarms came from calendar sync
- [ ] User sees sync status (success, error, last sync time)
- [ ] Auth token persists across browser restarts

### Out of Scope

- Multi-day calendar sync (only today's events) - keeping it simple for v1
- Editing calendar-synced alarms - they're read-only snapshots
- Two-way sync (updating calendar from alarms) - one-way only
- Choosing specific calendars - primary calendar only for v1
- Custom reminder offsets - uses event start time directly

## Context

**Existing Architecture:**
- Chrome Extension Manifest v3
- Vanilla JavaScript with ES modules
- Service worker background script for alarm scheduling
- Chrome Alarms API for reliable scheduling
- Offscreen document for audio playback
- Local storage for persistence
- No build tools (direct file deployment)

**Existing Capabilities:**
- Flexible time parsing (handles "9:30", "20분후", "내일 09:00", etc.)
- Recurring alarm support with custom day selection
- Live UI updates with countdown timers
- Desktop notifications and audio alerts
- Settings for alarm duration and sound interval
- Quick phrase system for common inputs

**New Integration Requirements:**
- Google Calendar API v3 for event fetching
- OAuth 2.0 for user authorization
- Chrome identity API for OAuth flow
- Event filtering (timed events only, today only)
- Merge/update logic for re-syncing

## Constraints

- **Platform**: Chrome Extension Manifest v3 - must use chrome.identity API for OAuth
- **Tech Stack**: Vanilla JavaScript, ES modules, no build tools - keep consistency
- **Authentication**: OAuth 2.0 with chrome.identity API - one-time setup, persist tokens
- **Calendar API**: Google Calendar API v3 - requires API key and OAuth client ID
- **Permissions**: Must add `identity` permission to manifest.json
- **Data Privacy**: Calendar data stays local, no external servers
- **Network**: Requires internet for initial OAuth and calendar sync
- **Scope**: Today's events only - no multi-day syncing in v1

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Manual sync button vs automatic | User wants control over when to sync | — Pending |
| Event start time (not reminders) | Simpler, more predictable | — Pending |
| Merge/update on re-sync | Prevents duplicates, keeps data fresh | — Pending |
| Skip all-day events | All-day events don't need timed alarms | — Pending |
| Primary calendar only | Reduces complexity for v1 | — Pending |
| Read-only calendar alarms | Prevents confusion about sync direction | — Pending |

---
*Last updated: 2026-02-24 after initialization*
