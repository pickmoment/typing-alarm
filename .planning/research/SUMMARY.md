# Project Research Summary

**Project:** Typing Alarm - Google Calendar Integration
**Domain:** Chrome Extension (Manifest v3) - Calendar API Integration
**Researched:** 2026-02-24
**Confidence:** HIGH

## Executive Summary

This project adds Google Calendar synchronization to an existing Chrome extension alarm system. Based on research, the recommended approach is straightforward: use Chrome's native identity API for OAuth, make direct REST calls to Calendar API v3 (avoiding external libraries that violate MV3 policies), and implement a simple "replace on sync" strategy for calendar-sourced alarms. No build tools or npm packages are required—the vanilla JavaScript codebase can handle everything with native browser APIs.

The architecture extends the existing service worker pattern with three new modules: OAuth Manager (token lifecycle), Calendar Service (API wrapper), and Alarm Merger (sync logic). The key design decision is treating calendar alarms as read-only snapshots that are replaced on each sync, avoiding the complexity of incremental sync and edit conflict resolution. This "today's events only" approach keeps operations under 30 seconds, respecting Manifest v3 service worker timeout constraints.

Critical risks center on OAuth token management (stale token caching), timezone handling (RFC3339 format with proper offsets), and rate limiting (exponential backoff required). All three have well-documented mitigation patterns and should be addressed in the initial implementation phases. The API is mature (v3 since 2011), browser support is universal (Chrome 88+), and the integration patterns are standard—confidence in technical feasibility is high.

## Key Findings

### Recommended Stack

The integration requires zero npm packages, leveraging native Chrome APIs and direct REST calls. This matches the existing codebase's vanilla JavaScript architecture and avoids violating Chrome Web Store policies against remotely hosted code.

**Core technologies:**
- **chrome.identity API** (Manifest v3): OAuth 2.0 authentication — handles token caching, automatic expiration, and secure credential storage without manual implementation
- **Fetch API** (native): REST calls to Calendar API — MV3 prohibits external libraries like gapi.js, making direct REST the only compliant option
- **Google Calendar API v3**: Event retrieval via REST — stable since 2011, simple `/calendars/primary/events` endpoint with time filters, no client library needed
- **chrome.storage.local** (existing): Token and sync metadata persistence — already in use, reliable across sessions, 10MB quota sufficient
- **OAuth 2.0 scope** `calendar.events.readonly`: Read-only event access — most restrictive scope following principle of least privilege

**What NOT to use:**
- Google API JavaScript Client (gapi.js): Violates MV3 remote hosted code policy
- Google Identity Services library: Same remote code restrictions
- Build tools or npm packages: Adds unnecessary complexity to vanilla JS codebase
- Broader OAuth scopes: `calendar.readonly` grants more access than needed

### Expected Features

Research reveals clear feature boundaries between table stakes (must-have for credibility), differentiators (competitive advantage), and anti-features (commonly requested but problematic).

**Must have (table stakes):**
- OAuth authorization with chrome.identity API — users expect secure Google sign-in
- Fetch today's timed events only — core use case without complexity creep
- Manual sync button — user control, simplest implementation
- Skip all-day events — no specific time means no alarm needed
- Event title → alarm message mapping — basic expectation
- Event start time → alarm time — core functionality
- Visual distinction for calendar alarms — users need to know source (badge/icon/color)
- Sync status display — last sync time, success/error/loading states
- Token persistence across sessions — can't require re-auth every time
- Error handling for common cases — auth expiry, network failure, rate limits

**Should have (competitive advantage):**
- Smart reminder timing (parse event.reminders) — users expect "15min before" alarms like native calendar apps
- Event location display — low effort, adds context
- Filter by event type — skip focus time, out-of-office blocks
- Recurring event instance handling — weekly meetings are common use case

**Defer (v2+):**
- Multiple calendar support — most users have one primary calendar, adds UI complexity
- Auto-sync with periodic triggers — convenience feature after manual sync is proven
- Two-way sync (create calendar events from alarms) — fundamentally different product direction
- Multi-day/week view — scope creep, most value is in "today's events"
- Real-time push sync — Chrome extensions can't maintain persistent WebSocket connections

**Anti-features to avoid:**
- Sync on every popup open — wastes API quota, triggers rate limits
- Edit synced alarms — creates confusion about source of truth
- Automatic sync on startup — feels invasive, can fail silently offline

### Architecture Approach

The recommended architecture adds three specialized modules to the existing service worker pattern while preserving backward compatibility with manual alarms. Service separation follows single-responsibility principle: OAuth Manager owns token lifecycle, Calendar Service wraps API interactions, and Alarm Merger implements sync logic.

**Major components:**
1. **OAuth Manager** (`oauth-manager.js`) — Token acquisition, refresh, invalidation, and storage; implements automatic retry pattern for 401 errors
2. **Calendar Service** (`calendar-service.js`) — Service facade for Google Calendar API; encapsulates REST calls, response parsing, and event transformation; filters out all-day events
3. **Alarm Merger** (`alarm-merger.js`) — Source tagging and merge strategy; distinguishes calendar vs manual alarms; implements "replace all calendar alarms" strategy for v1 simplicity
4. **Service Worker** (enhanced `background.js`) — Orchestrates sync flow via message handlers; integrates with existing alarm scheduling and persistence
5. **Popup UI** (enhanced `popup.js/html`) — Sync button, status display, loading states, error messages

**Data flow:** User clicks sync → popup sends message → service worker gets token from OAuth Manager → Calendar Service fetches today's events → Alarm Merger identifies changes → service worker updates storage → reschedules all alarms → popup displays status.

**Key architectural patterns:**
- **Service Facade** for external API to isolate Google-specific logic from business logic
- **Token Manager with Automatic Retry** for OAuth token lifecycle and 401 recovery
- **Merge Strategy with Source Tagging** to prevent calendar data from overwriting manual alarms

**Scaling considerations:** Current design handles 1-100 events/day easily. Beyond 500 events, would need pagination and incremental sync with `nextSyncToken`, but "today only" scope makes this unlikely.

### Critical Pitfalls

Research identified 10 critical pitfalls with specific prevention strategies. Top 5 by severity:

1. **Stale OAuth Token Caching** — chrome.identity caches tokens but doesn't auto-detect all invalidations (revoked permissions, account changes). Always wrap API calls with 401 error handling that calls `removeCachedAuthToken()` and retries before showing user errors. **Verify:** Test by revoking access in Google account settings.

2. **Interactive OAuth Without User Context** — Launching OAuth prompts on extension startup confuses users who see unexpected consent screens. Never call `getAuthToken({ interactive: true })` automatically; only trigger after explicit user action (sync button click). **Verify:** OAuth prompt only appears after user clicks "Connect Calendar."

3. **Timezone Hell in Date Filtering** — Calendar API requires RFC3339 timestamps with explicit timezone offsets, but `Date.toISOString()` returns UTC. Using UTC times for "today's events" causes events to appear/disappear near midnight for non-UTC users. Always format dates with user's local timezone offset: `2026-02-24T00:00:00-08:00`. **Verify:** Test with system timezone set to PST, EST, UTC+9.

4. **Calendar API Rate Limits** — Google limits requests to 60/minute/user. Without exponential backoff, rapid syncs hit 429 errors. Implement retry with exponential delays (1s, 2s, 4s, 8s) and prevent sync more than once per minute. **Verify:** Click sync 10 times rapidly, confirm backoff prevents errors.

5. **Service Worker Termination Mid-Sync** — MV3 service workers terminate after 30 seconds of inactivity. Large calendar syncs or slow networks can exceed this, leaving sync incomplete without error notification. Keep operations under 30s by limiting to today only, using `maxResults: 50`, and avoiding unnecessary pagination. **Verify:** Monitor DevTools during sync to confirm completion before timeout.

**Additional critical pitfalls:**
- Missing `oauth2` section in manifest.json causes silent failures
- Mixing timed and all-day event fields (`start.dateTime` vs `start.date`) leads to crashes
- Calendar alarms disappearing on browser restart without proper persistence
- Sync failures without user feedback (need clear status UI)

## Implications for Roadmap

Based on research, suggested phase structure follows component dependencies identified in architecture analysis. OAuth must work before fetching calendar data, calendar data must exist before implementing merge logic, and merge logic must work before adding UI polish. This ordering also aligns with pitfall prevention—critical OAuth and timezone issues are addressed in early phases.

### Phase 1: OAuth Foundation
**Rationale:** All calendar features depend on working authentication. This foundational phase addresses critical pitfalls #1-3 (token caching, interactive OAuth, manifest configuration) before any API integration begins.

**Delivers:**
- Chrome identity API integration with proper token lifecycle management
- OAuth 2.0 client ID registration in Google Cloud Console
- Updated manifest.json with identity permission, oauth2 config, and host permissions
- Token acquisition, refresh, and invalidation logic with automatic retry on 401

**Addresses features from FEATURES.md:**
- OAuth authorization flow (table stakes)
- Token persistence across sessions (table stakes)

**Avoids pitfalls from PITFALLS.md:**
- Stale OAuth token caching (implements removeCachedAuthToken pattern)
- Interactive OAuth without context (UI-first, explicit trigger)
- Missing manifest OAuth configuration (configuration before code)

**Validation:** Can acquire token interactively via button click, tokens persist across browser restarts, token refresh works after revocation in Google settings.

**Research flags:** Standard OAuth patterns, skip detailed research. Chrome identity API is well-documented.

### Phase 2: Calendar API Integration
**Rationale:** With authentication working, can safely fetch and transform calendar data. This phase addresses critical pitfalls #4-5 (rate limits, service worker timeout) and timezone handling (#3 implementation).

**Delivers:**
- Calendar Service module with direct REST API calls to Calendar API v3
- Event fetching with proper RFC3339 timezone formatting
- Filtering for timed events only (skip all-day)
- Rate limiting with exponential backoff retry logic
- Sync operations completing within 30s service worker timeout

**Uses stack elements from STACK.md:**
- Fetch API for REST calls
- Google Calendar API v3 events.list endpoint
- calendar.events.readonly OAuth scope

**Addresses features from FEATURES.md:**
- Fetch today's events (table stakes)
- Skip all-day events (table stakes)
- Event title → alarm message mapping (table stakes)
- Event start time → alarm time (table stakes)

**Avoids pitfalls from PITFALLS.md:**
- Timezone hell (RFC3339 with local offset)
- Calendar API rate limits (exponential backoff)
- Service worker termination (keep sync under 30s)
- Mixing timed/all-day events (filter on start.dateTime presence)

**Validation:** Can fetch real calendar events, transformed data appears correctly, timezone handling works across PST/EST/UTC+9, rate limiting prevents 429 errors during rapid syncs.

**Research flags:** Standard REST API patterns, skip detailed research. Calendar API is well-documented.

### Phase 3: Sync and Merge Logic
**Rationale:** With calendar data available, implement strategy to integrate with existing alarm system without data loss. This phase addresses pitfalls #8 (alarm persistence) and distinguishes calendar vs manual alarms.

**Delivers:**
- Alarm Merger module implementing "replace all calendar alarms" strategy
- Source tagging for alarms (manual vs calendar)
- Calendar alarm persistence across browser restarts
- Deduplication logic to prevent duplicate alarms
- Readonly field for calendar alarms

**Implements architecture component:**
- Merge Strategy with Source Tagging pattern
- Enhanced alarm data model with source, calendarEventId, readonly fields

**Addresses features from FEATURES.md:**
- Distinguish calendar vs manual alarms (table stakes)
- Visual distinction for calendar alarms (table stakes)

**Avoids pitfalls from PITFALLS.md:**
- Overwriting user-created alarms (source tagging prevents)
- Alarm persistence verification (reschedule on startup)
- No deduplication causing duplicates

**Validation:** Calendar alarms appear alongside manual alarms, can distinguish by visual indicator, survive browser restart, re-sync replaces calendar alarms without touching manual ones.

**Research flags:** Standard merge patterns, skip detailed research.

### Phase 4: Service Worker Integration
**Rationale:** Wire together OAuth Manager, Calendar Service, and Alarm Merger in service worker message handlers. This is the "glue" phase that connects all components.

**Delivers:**
- Message handler for calendar sync in background.js
- Integration with existing rescheduleAll() flow
- Comprehensive error handling for all failure modes
- Sync status persistence in chrome.storage

**Addresses features from FEATURES.md:**
- Error handling for common cases (table stakes)
- Sync status persistence

**Avoids pitfalls from PITFALLS.md:**
- No user feedback (implement status storage)

**Validation:** Can trigger sync from popup, calendar alarms appear in list, errors are caught and stored, existing alarm scheduling continues to work.

**Research flags:** Standard service worker patterns for existing codebase, skip detailed research.

### Phase 5: UI Implementation
**Rationale:** Backend fully functional, now add user-facing controls and feedback. This phase completes the table stakes features from user perspective.

**Delivers:**
- Sync button in popup UI
- Sync status display (last sync time, loading state, error messages)
- Visual indicators for calendar vs manual alarms (icons, colors, badges)
- Readonly UI behavior for calendar alarms
- User-friendly error messages for auth/network/rate limit failures

**Addresses features from FEATURES.md:**
- Manual sync button (table stakes)
- Visual sync status indicator (table stakes)
- Visual distinction for calendar alarms (table stakes)

**Avoids pitfalls from PITFALLS.md:**
- No loading state during sync (show spinner)
- Generic error messages (user-friendly specifics)
- No visual distinction causing confusion

**Validation:** User can click sync, see progress, understand results, distinguish alarm sources, read clear error messages.

**Research flags:** Standard UI patterns, skip detailed research.

### Phase 6: Polish and Edge Cases
**Rationale:** Core functionality complete. This phase handles remaining edge cases and improves reliability.

**Delivers:**
- Re-authorize UI for expired tokens
- Graceful handling of no events, past events, many events
- Network error recovery
- Comprehensive testing across edge cases

**Validation:** Extension handles all error scenarios without breaking, users can recover from auth failures, edge cases don't crash extension.

**Research flags:** Skip detailed research, use testing feedback to guide fixes.

### Phase Ordering Rationale

- **OAuth before API calls:** Cannot fetch calendar data without working authentication; token refresh must work before building on top of it
- **Calendar fetch before merge:** Need actual event data to design and test merge logic; transformation logic informs merge requirements
- **Merge before UI:** Backend must work correctly before exposing to users; easier to debug without UI complexity
- **Service worker after components:** Integration phase connects already-tested modules; reduces surface area for bugs
- **UI after backend:** Complete user journey once underlying functionality is reliable; prevents building UI for broken features

This ordering front-loads critical pitfalls (OAuth token management, timezone handling, rate limiting) rather than discovering them late. Each phase has clear validation criteria and delivers independently valuable functionality. Total estimated effort: 7-13 days for full implementation.

### Research Flags

**Phases with standard patterns (skip research-phase):**
- **Phase 1:** OAuth with Chrome identity API is well-documented, established patterns exist
- **Phase 2:** REST API calls with Fetch are standard, Calendar API docs are comprehensive
- **Phase 3:** Merge patterns are straightforward for "replace all" strategy
- **Phase 4:** Service worker integration follows existing codebase patterns
- **Phase 5:** UI patterns are conventional, no novel interactions

**Recommendation:** All phases use well-documented APIs and standard patterns. Skip /gsd:research-phase for all phases. Proceed directly to implementation with confidence.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Chrome identity API and Calendar API v3 have comprehensive official documentation; no npm packages required means zero dependency risk; existing vanilla JS codebase confirms technical approach is proven |
| Features | MEDIUM | Table stakes features are well-validated by competitor analysis; user expectations are clear from calendar app patterns; anti-features identified through common mistakes; uncertainty remains around exact optimal user flows |
| Architecture | HIGH | Service facade, token manager, and merge strategy are established patterns; Chrome MV3 service worker architecture is documented; existing codebase provides reference implementation for alarm scheduling; component boundaries are clear |
| Pitfalls | HIGH | All critical pitfalls sourced from official Chrome documentation warnings and Google Calendar API error handling guides; specific code patterns provided for prevention; clear validation criteria for each |

**Overall confidence:** HIGH

Research is backed by official documentation from Chrome and Google APIs. Technical approach is proven (vanilla JS + native APIs), patterns are standard (OAuth, REST, merge strategies), and pitfalls have documented mitigations. Uncertainty exists only in exact UI flows and optimal user experience, which can be validated through user testing after MVP.

### Gaps to Address

The following areas need attention during planning and implementation:

- **Optimal sync frequency:** Research identifies manual-only for v1, periodic auto-sync for v2, but exact user preference for sync timing needs validation. **Handle:** Ship manual-only, gather user feedback on whether auto-sync is desired and at what frequency.

- **Smart reminder timing:** Event.reminders structure is documented, but integration with existing alarm system for "15min before" alarms needs design work. **Handle:** Defer to Phase 7 (post-MVP), design after base sync is validated.

- **Recurring event instances:** Calendar API `singleEvents=true` expands instances, but handling recurring events that span multiple days needs testing. **Handle:** Document behavior during Phase 2 implementation, adjust if issues arise.

- **Chrome alarm limit:** Chrome allows max 500 concurrent alarms. With calendar + manual alarms, could theoretically hit this limit. **Handle:** Monitor during testing, add pruning logic if needed (unlikely given "today only" scope).

- **User expectations for read-only calendar alarms:** Unclear whether users will try to edit calendar alarms or accept read-only behavior. **Handle:** Implement as read-only in v1, gather feedback, consider "detach from calendar" feature for v2 if requested.

- **Sync token usage:** Research mentions incremental sync with `nextSyncToken` for efficiency, but "today only" scope may not benefit. **Handle:** Skip for v1 (full sync each time), evaluate in v2 if performance issues arise.

## Sources

### Primary (HIGH confidence)
- [Chrome Identity API Reference](https://developer.chrome.com/docs/extensions/reference/api/identity) — OAuth token lifecycle, getAuthToken patterns, security model
- [Chrome Extensions OAuth Guide](https://developer.chrome.com/docs/extensions/how-to/integrate/oauth) — Manifest configuration, interactive vs silent flows
- [Chrome Remote Hosted Code Policy](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code) — Why gapi.js cannot be used
- [Chrome Extension Service Workers](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers) — 30-second timeout, termination behavior
- [Google Calendar API v3 Reference](https://developers.google.com/calendar/api/v3/reference) — Complete API specification
- [Calendar Events List Endpoint](https://developers.google.com/calendar/api/v3/reference/events/list) — Query parameters, filtering, response format
- [Event Resource Structure](https://developers.google.com/calendar/api/v3/reference/events) — dateTime vs date fields, event types
- [Google OAuth 2.0 Scopes](https://developers.google.com/identity/protocols/oauth2/scopes) — Scope options for Calendar API
- [Calendar API Quota Limits](https://developers.google.com/calendar/api/guides/quota) — Rate limits, exponential backoff requirements
- [Calendar API Error Handling](https://developers.google.com/calendar/api/guides/errors) — 401, 403, 410, 429 error responses
- Existing codebase analysis — background.js, popup.js, manifest.json, time.js patterns

### Secondary (MEDIUM confidence)
- [Calendar API JavaScript Quickstart](https://developers.google.com/calendar/api/quickstart/js) — Sample patterns (uses gapi.js, not directly applicable to extensions, but shows API usage)
- [Google Calendar API Sync Guide](https://developers.google.com/calendar/api/guides/sync) — Incremental sync patterns with sync tokens
- [OAuth 2.0 for Web Server Apps](https://developers.google.com/identity/protocols/oauth2/web-server) — Token refresh patterns (chrome.identity handles automatically)

### Tertiary (LOW confidence)
- Competitor feature analysis (Google Calendar, Apple Reminders, Microsoft To Do) — Inferred from public app behavior
- Common UX patterns for calendar sync — Based on domain knowledge, not project-specific research

---
*Research completed: 2026-02-24*
*Ready for roadmap: yes*
