# Implementation status

## Implemented

- Responsive notebook-inspired interface with Today, Diary, Routine, Patterns and Settings, locally bundled fonts, empty states, accessible form labels and reduced-motion styling.
- Seven activities, quick timestamps and backdating, separate confirmed/estimated/running sessions, independent crate and sleep records, outside-trip outcomes and linked potty events, notes, editing, deletion and recovery.
- Device-local sample diary clearly separated from real accounts. Supabase sign-up, sign-in, recovery and household onboarding integration.
- IndexedDB mutation queue, reconnect retries, idempotency receipts, version conflict review and account-partitioned local data. Service worker caches application assets rather than authenticated responses.
- Household roles, email-bound single-use invitation links, removal, ownership transfer, kiosk pairing/revocation, PIN throttling, idle relocking and owner review of quarantined changes.
- Versioned routines, weekday schedules, meal/wake-relative prompts, personal presets, single-occurrence exceptions, protected care constraints and explicit plan linking.
- Descriptive patterns, unknown-data treatment, daily completeness, household timezone and DST handling, downloadable CSV and PDF reports.
- Push subscription integration, authenticated reminder worker, mute, quiet hours, snooze, expiry, completion rechecks and duplicate-delivery claims.
- Household deletion grace period, account deletion/anonymisation integration, retention maintenance and a local backup/restore verification script.
- PostgreSQL migrations with RLS enabled, server-side tenant checks, Vercel function configuration and CI.

## Evidence

The local production build and 29 domain/storage tests pass. The API integration suite exercises live Rust HTTP handlers against PostgreSQL; it covers permissions, duplicate retries, conflicts, shared sessions, kiosk restrictions, invitation acceptance and household deletion. The restore drill restores a separate disposable database and checks a sentinel diary entry and RLS. These are development checks, not proof of a configured managed backup service.

Browser checks covered sample logging, navigation, phone-width overflow and a generated PDF. The production app shell and saved sample diary reloaded successfully after the local preview server was stopped. A hosted browser check also verified real sign-in, household onboarding, one-tap meal logging, managed-database persistence and reload; all temporary test data was removed. The nine-check hosted suite passes real Supabase password sessions, managed database persistence, sharing, concurrent edits, account deletion/anonymisation and public Data API isolation. Email delivery and physical-device push testing remain outstanding.

Both source entrypoints and built Vercel function artifacts count 2/12. The hosted Rust health route returns 200, and the unauthorised reminder request returns 401. The app is deployed at https://wag-journal.vercel.app; Supabase and the minute-level Vercel Cron worker are connected; authenticated maintenance returns 200, and Vercel logs show successful scheduled executions each minute. Physical-device notification delivery remains unverified.

## Remaining implementation and release work

1. Connect custom SMTP, verify signup/recovery delivery, then enable `VITE_EMAIL_READY`. Hosted tests with two temporary accounts pass. Complete physical-device testing of revoked sessions, recovery links, offline reconnect and conflict resolution.
2. Qualified review and source/licence approval are required before enabling starting care templates and automated routine suggestions. A generic, editable example routine is available as an unsaved preview; it makes no age-specific care recommendations. Age-based care templates and automated suggestions remain unavailable; the current Patterns screen gives descriptive observations. Before/after suggestion experiments are not implemented.
3. Duration charts include cross-midnight bands and an individual-record table. Validate readability with dense household histories and daylight-saving transition days during the pilot.
4. Validate free-text care instructions operationally. Structured earliest/latest time constraints are enforced; software cannot infer restrictions from arbitrary prose or guarantee a relative prompt complies with such prose.
5. Invitation links are generated for the owner to share. Automatic invitation email delivery is not implemented.
6. The sync implementation polls full snapshots. Measure representative household loads and replace with incremental updates if needed before expanding the pilot.
7. Establish operator identity, support contact, reviewed privacy/retention wording, monitoring, backup expiry and measured restore targets. Personal account deletion spans Supabase and PostgreSQL; maintenance retries completed-auth deletions, but an outage between authentication deletion and recording that step needs operator reconciliation.
8. Perform device/browser, keyboard, screen-reader and installed-PWA testing. Verify the five-second logging goal and concurrent/offline behaviour in the planned two-week pilot with 5–10 households.
9. Check production cost against the provisional A$100/month budget. Scheduler traffic alone is about 43,200 calls in a 30-day month before retries.

Do not describe the application as public-release ready until these gates pass. The original readiness checklist is preserved as a requirement baseline rather than bulk-marked complete.
