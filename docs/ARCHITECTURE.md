# Wag Journal architecture

## Implemented stack

- **Client:** React 19, TypeScript and Vite. Original CSS follows the PRD's paper/eucalyptus palette, Fraunces headings and Atkinson Hyperlegible body text. Fonts are served locally.
- **API:** Rust, Axum and the official `vercel_runtime` adapter. The same binary runs on localhost and as one Vercel function. The local runtime, database and permission tests pass; Vercel deployment and the public health route are verified; hosted authenticated flows still need Supabase configuration.
- **Database:** PostgreSQL, accessed only by the server through SQLx. Supabase is the selected authentication integration and intended managed PostgreSQL host. Use its transaction-pooler connection with an appropriate connection limit.
- **Authentication:** Supabase verified email/password and recovery. The API checks bearer tokens against Supabase's user endpoint rather than trusting a client-supplied user ID. Personal account deletion uses a server-only administration key.
- **Offline:** IndexedDB stores an account/device-partitioned snapshot and mutation queue. The queue write and optimistic snapshot update share one transaction. Web Locks serialises sync across tabs. A service worker precaches only public app assets; private API responses are never cached there.
- **Reminders:** A second Vercel function uses PostgreSQL and Web Push. QStash is the intended minute scheduler, forwarding a dedicated bearer secret. No Vercel Hobby cron or open browser is required. Actual provider delivery remains unverified.
- **Exports:** CSV with formula-safe cells, plus downloadable PDFs with an embedded, locally hosted font. All-date export requests are authenticated and require connectivity and a resolved queue.

There are two API source entrypoints: `api/app.rs` and `api/reminders.ts`. The build checks their count. Run the same check after `vercel build` to enforce the separate deployed-function-artifact ceiling.

## API contract

The browser calls `POST /api/app` with an authenticated bearer token and `{ action, payload }`. Responses are JSON. Domain failures use 400, missing authentication 401, denied access 403, version conflicts 409, pending household deletion 423 and PIN lockouts 429. Error responses avoid exposing raw database diagnostics.

Actions include snapshot, createHousehold, mutate, invite, acceptInvite, removeMember, leaveHousehold, transfer, acceptTransfer, deleteHousehold, cancelDeletion, deleteAccount, pairKiosk, unlockKiosk, revokeKiosk, resetPin, subscribe, quarantine, quarantineList and quarantineDiscard. A public GET returns service/version information without private records.

`mutate` accepts `{ id, entity, record, expectedVersion, createdAt }`. Entities are event, routine, check, constraint and preference. Stable mutation IDs make retries idempotent. A receipt stores the original request digest and result; reusing its ID with different content is rejected. Every write checks household access, locks the household and checks record versions. Conflicts retain the pending change and the account version for review.

Independent changes can continue syncing while another record has a conflict. Dependent edits of the conflicted record wait. Choosing the account version removes dependent pending edits of that record. Retrying a local change uses the current version and may surface another domain conflict rather than overwriting silently.

## Storage and trade-offs

Profiles, households, memberships, devices, invitations, ownership transfers, push subscriptions, notification delivery, mutation receipts, history and quarantined batches have separate relational tables. Typed domain records live in a tenant-scoped `records` table with kind, version, timestamps and JSONB detail. This keeps the initial migration compact while preserving transactional household/version checks. It is a deliberate implementation variation from the PRD's proposed separate table for every domain entity. Activity links and routine items currently use validated JSON identifiers; additional database-level foreign-key normalisation can follow if scale warrants it.

All tables have row-level security enabled without public read/write policies. Browser clients never query these tables directly. The database role used by the API must have the necessary privileges; the API is responsible for authorisation. Supabase's public anon key is not a database access grant. Anonymisation functions explicitly deny public, anon and authenticated execution.

Snapshots return 30 days of personal event history plus active sessions, current and historical routines, preferences and recent change history. Older diary views fetch into page memory when online. Kiosk snapshots omit membership, preferences, notes and full history. Pending entries remain durably stored beyond cache age.

## Kiosk security

A pairing creates a random device credential; only its hash is stored server-side. PINs are Argon2 hashes. Five failed attempts lock PIN verification for 15 minutes. PIN success only permits proceeding to personal sign-in. The device does not inherit owner permissions. Management relocks after two idle minutes and signs out the personal session, retaining unresolved pending work while removing the broader personal snapshot.

A disconnected device cannot observe revocation. Upon reconnecting it loses ordinary access. Pending batches can be submitted through a narrow quarantine action that does not restore diary access. Owners inspect and explicitly accept recovered changes; domain conflicts still apply. Removed caregivers can submit batches only for a household with a recorded former membership. Pending work is never silently imported or discarded.

## Time, routines and interpretation

Absolute event times use UTC. Display and routine construction use the household IANA timezone through Temporal. A nonexistent clock time advances to the first valid minute; repeated times choose the earlier occurrence once. Actual durations use absolute elapsed time.

Routine saves create immutable versions. Today's changes have an effective instant, retaining earlier occurrences from previous versions. Future versions begin at local midnight. Date-specific exceptions support one-off time, duration and skip changes. Templates and automated care recommendations are deliberately unavailable pending qualified review; no environment flag currently bypasses that gate.

Summaries distinguish unknown outcomes, estimates, confirmed durations and incomplete logging. Charts describe the observations rather than claiming causation. The provisional seven-day/10-observation suggestion threshold is shown as readiness information, not as a sufficient care recommendation rule.

## Known production limits

- Hosted auth, real email and closed-app phone push still need end-to-end verification with actual service accounts.
- Snapshot polling targets four-second refresh while online. A large history or many concurrent households will need incremental pagination rather than full snapshots.
- Reminder delivery uses a claim/retry ledger and rechecks completion, membership and personal mute immediately before sending. Provider handoff cannot be atomic with database edits or prove delivery. Cross-platform dismissal of already delivered notifications is not promised.
- Credential/session lifetimes follow Supabase configuration and need production review. Account-deletion recovery jobs and managed backup deletion must be exercised against the selected provider.
- Quarantine review is functional but still needs the planned nontechnical-caregiver usability test.
- The local restore exercise verifies PostgreSQL schema, RLS and sample data. It does not validate a managed provider's recovery time or backup-expiry guarantees.

The runtime follows the [official Vercel Rust setup](https://vercel.com/docs/functions/runtimes/rust). Local Vercel builds require cargo-zigbuild and Zig.
