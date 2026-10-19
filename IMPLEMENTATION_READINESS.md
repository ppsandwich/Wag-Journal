# Wag Journal: implementation and readiness checklist

Date: 19 October 2026
Status: planning documentation; implementation, service selection and release validation pending

The [PRD](PRD_PUPPY_DIARY.md) is the product source of truth. The user accepted all 46 interview recommendations and confirmed the consolidated understanding. This checklist translates those decisions into work and evidence. An unchecked item is outstanding; no implementation, pilot, service purchase or validation is implied by this document.

The final operating ceiling is provisionally A$100/month, superseding the early A$50 assumption. Plan for commercial eligibility. Web launch is the current delivery boundary; React Native follows web validation.

## 1. Service selection and technical feasibility

Complete before committing to the implementation architecture.

- [ ] Select a commercially suitable Vercel plan and prepare a full monthly cost model for the 5–10-household pilot and expected public usage. Include exchange rates, tax, domain costs, email, backups, storage, scheduler traffic, retries and monitoring. Set usage alerts and document what happens near the A$100 ceiling.
- [ ] Compare managed relational database/authentication options against verified email/password, recovery, household authorisation, serverless connections, backups, deletion and availability requirements.
- [ ] Select an authentication-email provider, verified sending domain and support address. Account emails are in scope; care reminders by email are not.
- [ ] Select a durable reminder scheduler. Demonstrate delivery with the app closed and current server-state validation before sending. Do not rely on an open browser, function timers or Hobby cron.
- [ ] Run a small Rust deployment test covering authentication, database access, reminder delivery and operational diagnostics. Record the result; use TypeScript if Rust creates substantial deployment or maintenance problems.
- [ ] Define API entrypoint grouping, authentication callbacks and reminder handlers. Verify both the 12-entrypoint ceiling and the 12-deployed-function ceiling using deployment output, including any rendered-page functions.
- [ ] Write a short architecture decision record with providers, costs, regions, secrets handling, connection strategy and operational responsibilities. Region and exact providers remain to be selected; no data-residency commitment has been made.

Research starting points, not selected or purchased services:

| Component | Candidate or constraint | Official reference |
| --- | --- | --- |
| Hosting | Vercel commercial plan; Hobby is restricted to personal, non-commercial use | [Hobby](https://vercel.com/docs/plans/hobby), [Pro](https://vercel.com/docs/plans/pro-plan) |
| Backend | Rust preferred, with accepted TypeScript fallback after feasibility testing | [Rust runtime](https://vercel.com/docs/functions/runtimes/rust) |
| Database and authentication | Supabase is a candidate; verify plan costs, backups and deletion capability | [Pricing](https://supabase.com/pricing), [backups](https://supabase.com/docs/guides/platform/backups) |
| Scheduler | QStash is a candidate; include delayed jobs, retries and recovery traffic in costs | [Pricing](https://upstash.com/pricing/qstash), [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing) |
| Authentication email | Resend is a candidate; configure production SMTP and sending-domain verification | [Resend pricing](https://resend.com/pricing), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp) |
| Apple browser push | Verify Home Screen installation, permission and supported versions | [Apple Web Push documentation](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers) |

These references were gathered during discovery. Recheck capabilities and prices when selecting services; the accepted budget is not evidence that a particular combination fits it.

## 2. Care content and interpretation

Review before enabling care guidance for public use. Logging development and testing can proceed independently.

- [ ] Name a qualified vet or trainer to review care-related template timings and rules.
- [ ] Build a source register for each template: source URL, publication/review date, applicable age bands and inputs, rationale, limitations and reviewer approval.
- [ ] Define which onboarding factors alter a documented rule. Do not collect unused care factors or introduce unsupported feeding, exercise, toilet or crate-duration advice.
- [ ] Define supported structured protected constraints and their conflict checks. Preserve instruction text, source and history; do not pretend arbitrary prose can be enforced automatically.
- [ ] Specify each suggestion rule: eligible events, observation window, exclusions, unknown handling, minimum sample, evidence text, protected constraints and before/after preview.
- [ ] Validate the provisional minimum of seven mostly complete days and 10 relevant observations. Determine feature-specific rules; these numbers alone do not justify a suggestion.
- [ ] Define suggestion equivalence and weekly frequency boundaries. Verify the one-new-suggestion-per-week limit and two-week suppression after dismissal.
- [ ] Test marked logging gaps within a mostly complete day, unknown outcomes, sparse observations, contradictory outcomes and changed schedules. Define how completeness corrections affect previously generated suggestions.
- [ ] Define outcome denominators and interval pairing for each chart. Verify one trip with multiple potty events counts once in trip-level summaries while retaining individual events.
- [ ] Validate provisional matching tolerances (meals ±30 minutes; other fixed-time activities ±15 minutes) and outside-prompt merging within 15 minutes. Specify boundary inclusivity, chains of prompts and interaction with manually scheduled opportunities.

## 3. Domain model, API and access control

Complete contracts and invariants before implementing dependent flows.

- [ ] Define relational schema, identifiers, constraints, indexes and migrations for all records listed in PRD section 9, including links, versions, history, completeness assessments, delivery state and device preferences.
- [ ] Define shared web/native API contracts, validation errors, idempotency, pagination, incremental sync and compatibility policy.
- [ ] Write an authorisation matrix for owner, caregiver, locked kiosk, authenticated unlocked access, removed member, revoked kiosk and household pending deletion. Check every operation server-side.
- [ ] Define transactional boundaries for concurrent session starts, session completion, schedule fulfilment, ownership transfer, invitation acceptance, undo and deletion.
- [ ] Specify optimistic version checks and the conflict-review flow. Preserve both competing edits and offline starts; do not silently overwrite or use last-write-wins for conflicting corrections.
- [ ] Specify membership limits, invitation expiry/single use/email binding, owner-transfer acceptance, multi-household switching and anti-abuse controls. Resolve exact limit counting, including invitations, before enforcement.
- [ ] Specify verified email/password, password-manager support, persistent sessions and recovery. Choose session lifetimes and sensitive-operation reauthentication rules with the selected provider.
- [ ] Define the six-digit kiosk PIN storage, failure-rate limits, owner reset and two-minute relocking mechanism. Ensure PIN possession cannot grant account privileges.
- [ ] Design secure revocation quarantine: how rejected pending records are preserved, how the owner reviews them, how accepted records retain provenance, and how unaccepted records are eventually disposed of. A revoked credential must not regain ordinary household access.
- [ ] Define the audit-history and deletion model. Keep 30-day record recovery distinct from household deletion and anonymisation of deleted accounts.

## 4. Offline storage and synchronisation

- [ ] Choose durable browser storage and detect failures, capacity limits and eviction where possible. Never show a successful save if local persistence failed.
- [ ] Generate stable event IDs before sending; prove retries and reloads cannot duplicate records.
- [ ] Implement a 30-day personal diary cache plus current routine and active sessions. Preserve pending entries irrespective of age; enforce the kiosk's narrower visible history and note restrictions.
- [ ] Specify sync ordering and recovery for edits/deletes, linked records, offline schedule matching, concurrent completions and schema updates.
- [ ] Implement pending-entry sign-out choices with counts: stay and sync, or explicitly discard and sign out. Clear access to private cached data after sign-out.
- [ ] Partition cached data by account and household. Test switching between households and between accounts on one device.
- [ ] Verify disconnected revocation behaviour, then lock and quarantine on reconnection. Test removed caregivers as well as kiosks.
- [ ] Document browser storage limits and that offline-only entries are not yet protected by server backups. Explain relevant save states in plain language.

## 5. Routine, time and reminder engine

- [ ] Specify schedule versions, effective dates, weekday/weekend variants, single-occurrence changes and defaults to tomorrow. Preserve completed and past plans when applying a change today.
- [ ] Define identical-type matching using actual start times, unique eligible plans and reversible automatic links. Reconcile offline claims atomically.
- [ ] Define which confirmed events trigger relative prompts. Estimated ends must never trigger waking or other confirmed-completion prompts.
- [ ] Implement merged outside prompts with visible reasons and manual-plan precedence; fulfil the combined opportunity once.
- [ ] Specify UTC storage and historical timezone context. Travel must not move the household routine; explicit timezone changes apply prospectively.
- [ ] Specify and test nonexistent local times, repeated local times, ambiguous manual entry, cross-midnight sessions and incorrect device clocks. Deliver a repeated clock-time planned activity once.
- [ ] Design durable reminder state and retries, including checks for membership, completion, schedule version, mute, quiet hours, snooze and expiry immediately before dispatch.
- [ ] Define per-caregiver delivery across multiple subscribed devices without repeated reminders to the same endpoint. Test retries and subscription replacement; document limits on dismissing delivered notifications.
- [ ] Implement personal 10-, 30- and 60-minute snooze, one-hour/until-morning/indefinite mute and quiet hours initially off. Snooze must not change the routine or others' preferences.
- [ ] Suppress delivery more than 15 minutes after its intended time, including the new intended time after explicit snooze. Cancel unsent reminders and snoozes after completion; never replay a stale backlog.
- [ ] Verify recovery after scheduler interruption and stale jobs after schedule changes or household deletion. Document platform delivery limitations without promising guaranteed push arrival.

## 6. Interaction design and accessibility

Use the established PRD section 6a design direction. This work specifies and validates it; it does not reopen the visual brief.

- [ ] Prototype onboarding, Today/kiosk, all seven logging actions, the two-tap potty flow, preset selection, active-session resolution, Diary correction, Routine and Patterns.
- [ ] Cover invitations, recovery, household switching, kiosk pairing/PIN/reset/revocation, personal mute/snooze, change history, conflict resolution and deletion/cancellation.
- [ ] Specify default, pressed, focus, disabled, loading, empty, pending, saved, failed and offline states. Preserve entered details through errors.
- [ ] Maintain stable control positions, visible labels, 48 × 48 CSS px minimum touch targets and at least 72 px primary kiosk action height. Test all seven actions on the target tablet without default-size scrolling.
- [ ] Preserve text scaling and reflow, keyboard navigation, screen-reader announcements, visible focus, reduced motion and validated colour contrast to WCAG 2.2 AA.
- [ ] Keep optional outcomes and notes after initial save; distinguish unknowns, estimates and confirmed times without relying on colour.
- [ ] Verify the ten-second quick undo, 30-day authenticated recovery and kiosk restrictions without accidental privilege escalation.
- [ ] Verify personal preference changes do not alter other users' controls or a kiosk's shared preferences.
- [ ] Test independent sleep/crate ending, “Also woke up”, overlapping activities, forgotten timers and backdating/future-time validation.

## 7. Charts and exports

- [ ] Implement daily timeline, multi-day comparison, time-of-day summaries and routine review, with readable table alternatives and access to supporting entries.
- [ ] Label plans, observed events, estimates, unfinished sessions, unknown outcomes and logging gaps consistently across screens and exports.
- [ ] Define date-range boundaries and treatment of sessions crossing the selected range. Verify summaries and exports use the same rules.
- [ ] Export filtered activity CSV, separate schedule data and field definitions. Include IDs, links, units and timezone; protect user-entered fields against spreadsheet formula execution.
- [ ] Generate a concise seven-day default PDF with 7-day, 30-day and custom ranges, relevant routine, outcomes, estimates, gaps and optional diary detail. Verify print layout and sharing/download on supported devices.
- [ ] Exclude caregiver emails from ordinary exports. Check deleted-account attribution and enforce authenticated household access.
- [ ] Require internet for exports and older history; explain unavailable actions without pretending locally cached data is complete.

## 8. Operations, privacy and release evidence

- [ ] Name the operator, establish a working support address and document service-alert, incident, recovery and deletion-request handling.
- [ ] Verify daily-backup coverage and demonstrate no more than 24 hours of server data loss and restoration within one business day. Review targets before widening public use.
- [ ] Demonstrate seven-day household deletion cancellation, live-data purge and backup expiry targeted within 30 further days. Verify provider limits and prevent deleted data from returning during restoration.
- [ ] Confirm anonymous historical attribution after personal-account deletion while preserving shared care records. Separate membership removal from account deletion.
- [ ] Define privacy disclosures, retention and telemetry implementation with the selected services. Obtain explicit pilot consent; exclude diary text, puppy names, care outcomes and session recordings from usage telemetry.
- [ ] Measure logging time, corrections, failed saves and feature use. Document event definitions without capturing sensitive care details in application logs.
- [ ] Select actual tablet/phone/desktop test devices and record OS/browser versions. Current Safari and Chrome are primary targets on applicable platforms; older devices require their own evidence.
- [ ] Verify permission denied, unsupported push, required installation, closed-app delivery, poor connectivity and reconnect behaviour on the supported matrix.
- [ ] Measure at least 95% of operations meeting each target under documented normal conditions: local feedback ≤200 ms, account confirmation ≤2 seconds and other-device visibility ≤5 seconds.
- [ ] Demonstrate idempotency, household isolation, PIN controls, concurrent-edit recovery, offline reload, storage failure, timezone transitions and restoration. Record results against every PRD section 11 acceptance criterion.
- [ ] Run 5–10 pilot households for at least two weeks after core flows pass tests, including nontechnical caregivers and shared-tablet users.
- [ ] Demonstrate at least 90% of common logging tasks correctly completed within five seconds after orientation. Verify setup, correction, muting and PDF sharing without developer assistance.
- [ ] Verify pilot owners can explain an evidence-supported pattern, its missing-data limits and a routine adjustment without assistance.
- [ ] Resolve all known defects that lose or expose data; verify reminders, exports and recovery. Extend the pilot if release conditions are unmet.
- [ ] Assemble a release evidence record containing test matrix/results, pilot findings, content-review approval, restoration/deletion evidence, named responsibilities, service-cost model and deployed-function count.

## 9. Later React Native release

- [ ] Review web usability, offline reliability and schedule interpretation before beginning the native release.
- [ ] Select supported native OS versions, distribution/build arrangements and native-specific interactions.
- [ ] Preserve the shared API, household permissions, navigation hierarchy and domain behaviour while using native offline-storage and notification adapters.
- [ ] Revalidate background notifications, shared completion, personal muting, offline recovery and exports across native and web clients. Web acceptance does not establish native acceptance.

## 10. Interview decision trace

All entries below are accepted product decisions or explicitly accepted provisional values. Acceptance does not mark their implementation complete. Q1's initial A$50 budget is superseded by Q24; no other earlier scope is silently withdrawn.

| Decision | Accepted outcome | PRD section |
| --- | --- | --- |
| Q1 | Pilot of 5–10 households, then public signup; modest paid services allowed; original A$50 ceiling superseded by Q24 | 3, 10, 12 |
| Q2 | Current iPad/iPhone/Android/desktop targets; Safari and Chrome first; exact versions and kiosk model pending | 6 |
| Q3 | Running timers first; estimated presets optional | 5 |
| Q4 | Potty → Wee/Poo/Both; details follow save; accident/location unknown until supplied | 5 |
| Q5 | Locked kiosk shows today/active sessions, allows backdating and immediate undo; management needs PIN and account permissions | 6 |
| Q6 | Preserve competing edits; automatically combine independent entries; explicit conflict review | 5, 10 |
| Q7 | One reminder per occurrence per eligible caregiver; personal snooze; no escalation | 7 |
| Q8 | Transparent sourced care rules and qualified review before public guidance | 7, 12 |
| Q9 | Multiple households per person; one dog per household; fixed-household kiosk | 3 |
| Q10 | Pilot, usability, recovery, notifications, exports and access checks define completion | 11, 12 |
| Q11 | Forgotten timers stay unfinished; explicit end/correction; midnight review | 5 |
| Q12 | Resolve active session before replacement; preserve competing offline starts | 5 |
| Q13 | Personal duration preferences follow the account; kiosk settings shared per device | 5 |
| Q14 | Link potty to one active trip at occurrence time, with undo; no result remains optional | 5 |
| Q15 | Six-digit PIN; two-minute management relock; owner reset; online account/device management | 6 |
| Q16 | Disconnected revoked clients retain pending work; lock and quarantine on reconnect | 6, 9 |
| Q17 | Seven-day, single-use, email-bound invitations; accepted ownership transfer | 9 |
| Q18 | Personal 10/30/60-minute snooze; quiet hours off initially; morning mute uses household wake time | 7 |
| Q19 | Suppress delivery over 15 minutes late; keep plan visible; no stale backlog | 7 |
| Q20 | Routine edits default to tomorrow; today/future/one-off options; history preserved | 7 |
| Q21 | Provisional seven days/10 observations; one new suggestion weekly; two-week dismissal suppression | 8 |
| Q22 | Seven-day deletion cancellation; live purge afterwards; backup expiry target within 30 further days | 9 |
| Q23 | Explicit pilot telemetry consent; minimal usage measures; no diary content or recordings | 12 |
| Q24 | Commercial direction; provisional A$100 monthly ceiling; no purchase authorisation | 2, 3, 10 |
| Q25 | Rust feasibility test; TypeScript fallback for substantial deployment/maintenance problems | 10 |
| Q26 | Verified email/password, password managers, persistent sessions and email recovery; no social sign-in | 9 |
| Q27 | Demonstrate ≤24-hour disaster data-loss window and restore within one business day | 10 |
| Q28 | Same-type matching using actual start; provisional meal ±30 minutes/other fixed plans ±15 minutes | 7 |
| Q29 | Merge relative outside prompts within provisional 15-minute window; manual plan precedence | 7 |
| Q30 | Explicit mostly complete/some gaps/unsure day review; mostly complete days qualify for suggestions | 8 |
| Q31 | Household timezone stable during travel; prospective changes; explicit daylight-saving handling | 9 |
| Q32 | Seven-day PDF default; 7/30/custom ranges; optional diary; separate CSV plans; exclude caregiver emails | 9 |
| Q33 | Minimal puppy profile; only rule-used care factors; no photos or attachments | 4, 13 |
| Q34 | Transfer/delete owned households before account deletion; anonymised former-caregiver records | 9 |
| Q35 | Named operator, working support address and qualified reviewer before public launch | 12 |
| Q36 | Personal 30-day diary cache/current routine; kiosk today/active sessions; retain pending work; online older history/exports | 6, 9 |
| Q37 | Pending-entry count at sign-out; stay/sync or explicit discard; clear private access | 9 |
| Q38 | Ten-second quick undo; 30-day record recovery; conflict-aware new history changes | 5 |
| Q39 | Only owner changes protected constraints; conflicting edits need explicit owner resolution | 7 |
| Q40 | Sleep and crate ending independent; optional explicit waking; no inferred sleep location | 5 |
| Q41 | Explicit contradictory-outcome correction; multiple potty records per trip without duplicate trip counts | 5, 8 |
| Q42 | Actual events cannot be future; 5/15/30-minute backdating; validate end/start and device clock | 5 |
| Q43 | Provisional 10 caregivers/three kiosks per household; signup/invitation abuse controls | 3 |
| Q44 | At least 95% meet ≤200 ms local/≤2 s account/≤5 s other-device targets under documented conditions | 10 |
| Q45 | At least two-week pilot; 5–10 households; evidence-based public-release gate | 12 |
| Q46 | Fully specify web release; native-specific selection and validation follow web results | 10, 14 |
