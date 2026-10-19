# Wag Journal: product requirements document

Status: revised following product discovery; confirmed decisions and remaining implementation questions  
Date: 19 October 2026

## 1. Purpose

Wag Journal helps puppy owners build a practical daily rhythm by making activities quick to record, patterns easy to see and schedules easy to adjust.

The core loop is: start with a suitable schedule, record what actually happens, review patterns, then adjust the schedule. Success means an owner can explain what is working for their puppy and make a useful change without maintaining a complicated diary.

## 2. Confirmed requirements

- Use **Wag Journal** as the app name across the web app, native mobile apps and user-facing materials.
- Launch a React web app with a very simple kiosk interface and responsive phone access. React Native mobile apps follow after the web experience is validated.
- Host the web app and API on Vercel, targeting the Hobby plan and no more than 12 API route entrypoints or deployed functions.
- Design for owners and caregivers who may not be technically confident.
- Record outside trips, potty events, playtime, meals, training and crate time.
- Visualise and export recorded data.
- Help owners understand which times of day work best and develop a consistent rhythm.
- Offer starting schedules informed by puppy age and other relevant factors, with owner-controlled adjustments.
- Bind data to an account and persist it in a database.

## 3. Confirmed launch scope and priorities

The product is free at launch, with public signup for independent households. Each household tracks one dog initially, with a data model that can support additional dogs later.

Priorities, highest first:

1. Fewer potty accidents.
2. Better sleep and settling.
3. Easier coordination between caregivers.

The dashboard and schedule suggestions should follow this order. These are desired outcomes, not guaranteed effects.

- Support a shared, ready-to-use tablet kiosk and personal phones for logging and reviewing the diary.
- Provide separate caregiver accounts linked to one shared household diary. The owner manages access; all caregivers can log, correct entries and edit the schedule, with attribution and undo for changes.
- Support offline logging on tablets and phones, with durable local storage, visible pending status and automatic synchronisation.
- Record point events and durations. Provide configurable defaults per activity, easy overrides and optional start/stop recording.
- Record preset durations immediately as estimates; allow later confirmation or correction. Never silently convert an estimate to an observed end time.
- Include sleep tracking separately from crate occupancy, optional settling time and wake-up records.
- Provide stable starting routines with fixed times and event-based prompts. Suggest evidence-supported adjustments when patterns persist; require an owner to accept, edit or dismiss each suggestion.
- Notify every caregiver, subject to device permission and individual quiet hours or mute settings. Provide prominent personal mute/unmute controls and timed mute options.
- Include CSV exports and downloadable, printable PDF summaries for a selected date range.
- Require a PIN to leave kiosk logging mode for management functions; account permissions still apply after unlocking.
- No billing or subscription features at launch.

## 4. Primary journeys

### Set up a puppy and starting routine

The owner creates an account and household, enters the puppy's name and date of birth or estimated age, confirms the household timezone and provides daily routine constraints. They can choose a suggested schedule, customise it or begin logging without one.

### Record an activity in the moment

A caregiver opens the kiosk and records an activity using the current time. Routine logging requires no typing. The app immediately confirms the entry, distinguishes locally pending entries from server-saved entries and provides an undo action.

### Understand the day

A caregiver sees recent activity, any running sessions and the next planned activity. They can answer questions such as when the puppy last ate, whether the last outside trip produced a potty event and how long the current crate session has lasted.

### Improve the routine

A caregiver reviews comparable days, examines activity times and outcomes, changes a schedule item and selects when the revised schedule takes effect. Historical records retain the schedule version that applied at the time.

## 5. Activity recording

### Event model

| Activity | Minimum record | Optional detail or outcome |
| --- | --- | --- |
| Outside trip | Start time; optional return time or estimated duration | Purpose: toilet (default), play or other; linked potty outcomes; explicit no result; unknown outcome |
| Potty | Time and type: wee, poo or both | Location and accident status recorded separately from type; optional link to an outside trip |
| Meal | Time | Amount and unit; finished, partial, refused or unknown |
| Play | Start time; optional end time | Settled, still energetic, overstimulated or unknown |
| Training | Start time; optional end time | Skill practised; engaged, mixed, disengaged or unknown |
| Crate | Entry and exit times | Optional settling observation; never automatically counted as sleep |
| Sleep | Sleep time; confirmed wake time or estimated duration | Inside or outside crate; settling time; linked wake-up records; observed or estimated |

Sleep is included at launch and must not be inferred from crate occupancy. Settling time and wake-up records are optional and available after initial logging. Wake-up records end a sleep interval; returning to sleep starts a linked interval so awake time is not counted as sleep. Outcome fields remain optional to protect logging speed; omitted outcomes are unknown, never failures or successes.

### Required behaviour

- Save common timestamp events with one tap, and potty events with no more than two taps. Optional detail comes after the initial save.
- Support start/stop and configurable preset durations for outside trips, play, training, crate time and sleep. A session remains visible across devices and browser reloads.
- Starting an activity with a preset saves its estimated duration immediately. Provide an easy override, confirmation and correction. Store estimated and confirmed end times separately and label estimates in charts and exports. Passing an estimated end does not confirm completion or trigger downstream care prompts.
- Permit valid overlap, such as play outdoors or sleep in the crate. Prevent two active sessions of the same type for the same puppy unless the caregiver explicitly corrects the earlier session.
- A potty record linked to an outside trip is one event, not a duplicate in totals.
- Default to now, with quick backdating choices and an exact-time picker accessible from the kiosk. Allow notes, time correction and deletion from the diary. Record creation and modification timestamps separately from when the activity happened.
- Flag sessions without a confirmed end for review. Estimated ends may prompt a quiet check-in. Exclude unfinished and estimated durations from confirmed-duration averages; show estimated summaries separately when useful.
- Offer quick undo and protect against accidental repeated taps. Retried network requests must not create duplicate events.
- Allow an owner to mark periods of incomplete logging so summaries can distinguish missing information from inactivity.

## 6. Kiosk requirements

- Prioritise logging, current activity and recent history over charts or configuration.
- Support touch use on a shared tablet, alongside responsive phone and desktop access.
- Use readable labels and accessible controls; do not rely on colour or icons alone. Target WCAG 2.2 AA at implementation and validation.
- Show which puppy is being logged, the current time and the time since relevant recent events.
- Keep a paired household device ready to log without repeated sign-in for each event. Pairing requires an authenticated owner.
- Restrict locked kiosk access to logging and limited recent history. Require a PIN to leave logging mode for settings, exports or caregiver management. Unlocking does not grant owner privileges: authenticated caregiver permissions still apply. Rate-limit PIN attempts and provide owner-controlled recovery and automatic relocking.
- Let the owner revoke a kiosk remotely. Record the device as the source when a caregiver is not individually identified; never falsely attribute an entry to the owner.
- Save offline entries durably on the device and show their pending status. Synchronise without duplication and surface conflicts that require correction.
- If local persistence fails, clearly state that the event has not been saved.

### Usability for nontechnical caregivers

- Keep routine logging immediately available. Reveal optional detail after saving, with advanced settings outside the everyday workflow.
- Use familiar activity names, visible text labels, large touch targets and consistent actions across web and native mobile apps. Do not require discovery of gestures or icon meanings.
- Provide short, guided setup with sensible defaults, a clear next step and the ability to skip optional questions. Explain notification permissions when enabling reminders.
- Describe saving in everyday language: saved on this device, waiting for internet, or saved to the account. Explain what to do if an entry could not be saved; never expose raw technical errors.
- Make estimates, confirmed times, reminder mute state and undo easy to recognise without requiring knowledge of timers, synchronisation or database records.
- Explain charts with short plain-language findings, dates and observation counts. Let caregivers inspect the supporting diary entries.
- Provide account recovery, invitation acceptance, kiosk pairing and export flows that need no technical setup by the caregiver.
- Validate first-use logging, backdating, mute/unmute, correcting an estimate and sharing a PDF with participants who describe themselves as not technically confident.

## 6a. Look, feel and interaction design

### Design direction

Wag Journal should feel like a thoughtfully illustrated everyday notebook: warm, calm and slightly whimsical, with extremely clear controls for tired puppy owners and occasional caregivers. Use the sun-bleached utility direction: warm paper, eucalyptus accents, readable ink-coloured text and generous spacing. Familiar actions and predictable placement take priority over decoration.

### Research references

Reviewed on 19 October 2026 using the products' official descriptions and published screenshots. These are reference observations, not hands-on usability findings or proof that the current shipped apps look identical to their marketing images. The design decisions below are specific to Wag Journal.

- **Pup to Date:** its published screen shows a chronological log, a time-aligned multi-day view and activity shortcuts with elapsed times. Borrow the ability to answer “when was the last time?” without opening a report. Wag Journal adds persistent text labels to activity icons and keeps comparisons outside the kiosk's main logging area. [Product and features](https://puptodate.com/), [reference screenshot](https://puptodate.com/images/screenshot-events2.png).
- **DogLog:** its official site emphasises shared care, reminders and recognising trends. The published profile screen uses a puppy photo and playful pet motifs. Borrow the personal warmth and shared-care emphasis, with decoration limited to small accents so it does not compete with the logging controls. [Product and features](https://www.doglogapp.com/), [reference screenshot](https://res.cloudinary.com/dyrrwpemp/image/upload/f_auto/DogLog/features-screenshot.png).
- **DogNote:** its published activity feed pairs event names with timestamps and caregiver attribution, with labelled navigation; the product also supports filtering and export. Borrow readable diary rows and clear attribution. Wag Journal's routine logging should remain directly accessible, with optional detail revealed after saving. [Product and features](https://dognote.app/), [reference screenshot](https://dognote.app/hero-image.png).

Use these patterns as references; create original illustrations, components and branding. Competitor features do not expand the agreed launch scope.

### Visual language

- **Palette:** use warm paper `#F7F3EA` for the page, near-white `#FFFDF8` for raised surfaces, charcoal `#26332D` for primary text and deep eucalyptus `#355C49` for primary actions. Pale sage `#E5EDE4`, soft peach `#F4DFD2` and butter yellow `#F4E7B8` provide restrained accents with dark text. Use dark rust `#9A382D` for errors and storm blue `#285F83` for focus indicators. These are starting tokens; validate every actual text, control and state pairing before release.
- **Typography:** use a softly expressive serif such as Fraunces for the wordmark and short page headings, with Atkinson Hyperlegible for controls, body copy and data. Keep body text at least 16 CSS px at default web sizing and primary kiosk labels around 20–24 px. Use tabular numerals for times, clear units and native text scaling on mobile. Decorative type never appears in activity labels or timestamps.
- **Shape and spacing:** use softly rounded controls, quiet borders and matte surfaces. Start with an 8 px spacing rhythm, 16–24 px panel padding and 12–20 px corner radii. Keep interactive controls aligned in a stable grid. Organic curves belong in small illustrations or section accents; content remains neatly aligned.
- **Whimsy:** one small, original line-drawn puppy can appear in onboarding and empty states, with a subtle wag-shaped flourish near the wordmark. Keep charts and active logging areas visually quiet. Illustrations are decorative, never required to understand a state. Avoid repeating paw-print backgrounds, novelty control shapes, confetti, streak rewards and persistent animation.
- **Icons:** use a consistent rounded line style paired with visible labels. Distinguish Outside, Potty, Meal, Play, Training, Crate and Sleep with recognisable symbols. Keep activity identity consistent across actions, diary and charts; colour is a secondary cue, never the only distinction.

### Screen structure and navigation

- **Today:** the default personal view shows the puppy's name, current sessions, the next planned activity and quick logging. Place the seven activity actions in a stable order, each with a clear label and last-recorded time where relevant. Charts and setup prompts must not push everyday actions out of reach.
- **Tablet kiosk:** use a compact identity/status header, a large logging area and a recent-history area beside it in landscape or below it in portrait. All seven actions should fit without scrolling at default text size on the agreed target tablet. Allow vertical scrolling at enlarged text sizes rather than shrinking controls. Keep current sessions and their explicit end actions visible. Retain the limited-history and PIN restrictions in section 6.
- **Phone:** use a two-column logging layout with comfortable thumb reach and no horizontal carousel of hidden activities. Use four labelled navigation destinations: Today, Diary, Routine and Patterns. Provide a separate labelled Settings entry. Preserve these names and hierarchy in the later React Native apps while respecting native back navigation and safe areas.
- **Diary:** show a readable chronological list grouped by day, with activity, occurrence time, duration/status and caregiver or device attribution. Expose date and activity filters and a visible edit action. The recent kiosk view is a limited version of this list.
- **Routine:** show a simple agenda with time, activity and estimated duration. Provide explicit Edit and Move actions; dragging may be an enhancement but cannot be required. Show proposed schedule changes as a clear before/after comparison with the supporting observations.
- **Patterns:** start with a plain-language finding, its date range and observation count, then the supporting chart and a route back to the entries. Offer day comparison and a readable data alternative. Use solid marks for actual records and outlined marks for plans, with labels; explicitly label estimated durations. Do not present missing logs as zero activity or accidents as a failing score.

### Logging and feedback

- Maintain the one-tap common event and two-tap potty limits in section 5. Show optional notes and outcomes after saving. A tap must have an obvious effect without a celebratory interstitial or mandatory confirmation dialog.
- For duration activities, show the current mode and preset beside the action, such as “Play · estimated 15 min”. Provide a separate labelled control to change the duration or switch to a running timer. Remember defaults per activity; do not hide mode changes behind long presses. A running session uses an explicit action such as “End play”; an estimate remains labelled until confirmed.
- Keep an inline confirmation and Undo visible after logging without moving the other activity buttons. Announce save results to assistive technology without stealing focus. Pending, saved and failed states use text plus an icon; a successful local save must not imply the account has received the entry.
- Keep personal reminder status prominent in authenticated views: “Reminders on” or “Muted until 7 am”, with a direct mute/unmute action. On a shared kiosk, identify the affected caregiver before changing personal notification preferences; never imply a global household mute.
- Use plain Australian English and sentence-case labels. Examples: “Wee recorded · Undo”, “Saved on this device. Waiting for internet”, and “Nothing logged yet. Start with what your puppy is doing now.” Keep humour out of errors, accidents and missed care prompts.
- Use brief pressed-state feedback and transitions around 120–180 ms, without delaying logging. Respect reduced-motion settings and avoid sound by default.

### Accessibility and design validation

- Provide at least 48 × 48 CSS px touch targets on the web, with larger primary kiosk actions of at least 72 px height and sufficient separation. Use comparable logical dimensions on native apps. Preserve visible keyboard focus, meaningful screen-reader labels, logical focus order and accessible modal dismissal.
- Meet the existing WCAG 2.2 AA target: validate text contrast, control boundaries, non-colour state cues, 200% text resizing and narrow-screen reflow. Keep labels visible when text grows. Do not place texture behind text or chart marks.
- Define default, pressed, focused, disabled, loading, empty, offline, saved and error states for the key flows before implementation. Errors must explain recovery while preserving entered details.
- Prototype Today/kiosk, potty logging, duration adjustment, Diary correction, Routine editing and Patterns before building the full UI. Test with nontechnical caregivers on tablet and phone, including one-handed use and larger text. Keep the five-second logging target in section 12; also check that participants can identify the last meal, distinguish an estimate from a confirmed session, and find mute/unmute without coaching.

## 7. Suggested and editable schedules

### Inputs

Use date of birth or estimated age, expected adult size, usual wake and bedtime, meal routine and caregiver availability. Keep initial setup short, allowing optional details later. Toilet access, current routine and individual needs can provide additional context. Allow owners to mark vet or trainer instructions as protected constraints that suggestions must not overwrite. Do not collect a factor unless it changes a documented rule or helps the owner customise their routine.

### Schedule behaviour

- Provide age-appropriate starting templates with their sources, review date, applicable inputs and plain-language rationale.
- Support fixed-time activities and relative activities, such as an outside opportunity following a recorded wake-up or meal. Specific timing values require sourced content review before release.
- Allow all caregivers to move, add, remove and skip activities, change durations and maintain different weekday and weekend routines. Attribute changes and support undo as a new version, preserving intervening edits or surfacing conflicts.
- Show planned and actual activity separately. Completing a schedule item must create or link to an actual record; scheduled time alone is never evidence that an activity happened.
- Automatically link a logged activity to a scheduled item when there is exactly one eligible match within a defined activity-specific time window. Provide easy undo. Ambiguous matches remain unlinked until a caregiver chooses; already fulfilled items cannot be matched twice. Reconcile offline matches on sync. Matching windows remain an implementation detail to validate.
- Keep missed or skipped plans distinct from missing diary entries.
- Resolve competing relative prompts without duplicating the same upcoming activity. Manual changes take precedence over template defaults.
- When the puppy enters another template age band, offer a preview of suggested changes and retain the existing schedule until the owner accepts them.
- Record schedule versions and effective dates. Do not alter historical plans when editing a future routine.
- Keep a stable baseline, with flexible prompts following confirmed meals, waking and other relevant activities. An estimated end cannot trigger an event-based care reminder.
- Generate occasional suggested changes when patterns persist across several days. Explain the proposed change, supporting observations, sample size, unknown data and applicable schedule constraints. The owner can accept, edit or dismiss; no change applies automatically.
- Prioritise suggestions about toilet timing, then sleep and settling. Preserve protected vet or trainer instructions and show when a suggestion conflicts with them.

### Reminders and muting

- Provide in-app upcoming activities and phone notifications for every caregiver who grants the necessary permission. Delivery remains subject to browser and operating-system capabilities.
- Provide a prominent personal one-tap mute/unmute control. Offer one hour, until morning and until manually re-enabled, with a visible mute status and resume time. Until morning uses a clearly displayed next local morning time that can be adjusted.
- Keep mute state and quiet hours per caregiver across their devices. Muting one caregiver never mutes another.
- Completing or linking an activity clears its pending reminder across connected devices and cancels unsent duplicate reminders. Best-effort dismissal of already delivered notifications depends on platform support; do not promise remote removal everywhere.
- Reconcile offline completions on sync. Do not flood caregivers with stale reminders after reconnecting or unmuting; show what is currently relevant.
- Validate the supported phone/browser matrix before implementation and explain any installation or permission steps during setup. In-app reminders remain available if push is unsupported or denied.

### Content requirements

Template values and rules are a launch dependency: research and review them against reputable veterinary and animal-welfare sources. This PRD does not prescribe feeding, exercise, toilet or crate-duration limits. Individual care instructions must remain editable, and household constraints must not produce unsupported care recommendations.

## 8. Visualisation and interpretation

### Required views

- **Daily timeline:** planned activities alongside actual point events and duration sessions, including activities spanning midnight.
- **Multi-day comparison:** days aligned by local time so repeated patterns and variations are visible.
- **Time-of-day summaries:** distributions of activity times and recorded outcomes, filtered by activity and date range.
- **Routine review:** counts, completed durations, intervals between selected activities and a comparison of periods before and after a schedule change.

### Questions the app should help answer

- At what times do outside trips most often have a recorded potty outcome?
- What recorded intervals commonly separate meals or waking from potty events?
- At which times are training sessions reported as engaged?
- When does play tend to be followed by a settled observation?
- How regularly are meals, crate sessions and other activities occurring?

### Interpretation rules

- Logging frequency alone does not establish the best time for an activity. Use explicit outcomes where available.
- Show date range, observation count and the number of unknown outcomes with every outcome summary.
- For toilet-trip success rates, use trips marked toilet with explicitly recorded outcomes as the denominator. Keep play and other trips separate, and display exclusions and unknowns. Preserve potty type, location and accident status as distinct dimensions. Unlinked potty events remain visible separately.
- Distinguish estimated and confirmed durations in every chart and export. Outcome ratings are optional and skipped ratings are unknown.
- Label observations as associations; do not claim the schedule caused an improvement.
- Show insufficient-data states rather than confident recommendations when evidence is sparse. Define and test feature-specific minimum sample rules before releasing any ranked recommendations.
- Keep raw records accessible from summaries and provide a readable table alternative to charts.
- Filter or annotate marked incomplete periods. Never imply an unlogged activity did not occur.
- Do not automatically change the schedule based on inferred patterns.

## 9. Accounts, storage and export

### Ownership and access

- Every puppy, event and schedule belongs to a household bound to its owner account.
- The owner manages membership and kiosk access. Caregivers may log, correct records, view and export the shared diary, and edit schedules with attributed change history and undo; ownership and deletion controls remain with the owner.
- Authorise every server request against household membership or a limited kiosk credential. Knowing a record identifier must never grant access.
- Support secure sign-in, sign-out and account recovery through an established authentication solution.
- Support export and deletion of household data, with a documented retention and backup-deletion policy.

### Persistent records

Store users, households, memberships, puppy profiles, kiosk devices, activity events, activity links, schedule templates, schedule versions, schedule items, schedule suggestions and decisions, change history, per-activity duration defaults, notification preferences, push subscriptions, reminder delivery state and incomplete-logging periods in a relational database.

Activity records include a stable ID, household and puppy IDs, type, occurrence time, estimated duration and end time, optional confirmed end time, confirmation status, trip purpose, potty type, location, accident status, structured outcome fields, notes, source device or caregiver, creation time, modification time and sync identifier. Use deletion markers where needed to propagate removals to offline clients, then purge according to the retention policy.

Store timestamps in UTC and retain timezone context. Render routine comparisons in the selected household timezone, handle daylight-saving changes explicitly and calculate elapsed durations from absolute timestamps.

### Export

- Export all records or a selected date range and activity set as CSV.
- Include stable IDs, event type, start and end timestamps, timezone, outcomes, notes, linked-event IDs and attribution where known.
- Export schedule versions and planned items separately so plans and observations cannot be confused.
- Preserve unknown values as unknown; include field definitions and units.
- Escape CSV safely, including protection against spreadsheet formula execution in user-entered fields.
- Generate a downloadable, printable PDF summary for a selected date range, suitable for a vet or trainer. Include puppy age, relevant schedule versions, toilet patterns and accidents, sleep and settling, summary counts, estimates, unknowns and logging gaps. Include the diary and current schedule as printable views.

## 10. Reliability and architecture

### Platform and deployment constraints

- Release 1: launch the responsive React web application for shared tablets, phones and desktop browsers. Include the agreed logging, offline support, schedules, browser notifications, accounts and exports.
- Release 2: build React Native mobile apps after validating the web experience. Native apps remain in product scope but are not a web-launch dependency. Select supported operating-system versions during mobile implementation planning.
- Host the web application and shared authenticated API on Vercel, preferably Hobby. Native app binaries require their own build and distribution process; they consume the same backend and household data.
- Keep no more than 12 API route entrypoints and no more than 12 deployed Vercel Functions. Prefer a small set of grouped handlers with internal routing, leaving room for authentication callbacks and notification delivery. Check actual deployment output, including any server-rendered functions, rather than counting source files alone.
- Vercel counts deployed functions; the relationship to URL routes depends on the framework and bundling. This PRD retains the requested 12-route ceiling as an additional project constraint. See [Vercel runtime and function-count documentation](https://vercel.com/docs/functions/runtimes#functions-created-per-deployment), checked 19 October 2026.
- Share API contracts, validation rules and domain logic where practical between React and React Native, with platform-specific presentation, durable offline storage and notification adapters.
- Use a managed relational database compatible with serverless access. Do not store authoritative records in a function's local filesystem. Keep database credentials server-side and choose a connection strategy suitable for concurrent functions.
- Rust remains the backend preference where practical; the runtime choice must satisfy Vercel deployment, function-count and maintenance constraints. It does not alter the required React and React Native clients.
- Hobby is a cost target, not a promise of unlimited free operation. Track compute, database, storage and notification usage. Verify project eligibility against [Vercel Hobby terms](https://vercel.com/docs/plans/hobby), which restrict the plan to personal, non-commercial use; free public signup alone does not determine eligibility.

### Reminder delivery on Hobby

Vercel Hobby cron jobs run at most once daily and do not provide precise timing, so they cannot drive the agreed timely care reminders. Use a compatible durable scheduler or notification service for server-originated reminders, with provider and cost limits selected before implementation. A paid Vercel plan is an alternative if needed. See [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), checked 19 October 2026.

Do not rely on a browser staying open or a long-running function timer. Native local notifications may supplement delivery, but shared completion, schedule edits and personal muting must reconcile with server state. Deduplicate local and remote notifications and document platform restrictions on cancelling already scheduled or delivered alerts.

### Reliability requirements

- Persist authoritative account data on the server. Device storage is an offline queue and cache, not the only copy.
- Generate event IDs before sending writes and make server writes idempotent.
- Treat concurrent edits explicitly. Prevent silent overwrites using record versions or equivalent conflict detection.
- Keep kiosk credentials limited and revocable. Partition cached data by household and clear access on sign-out or revocation when the device reconnects.
- Make sync state observable without exposing private diary data in application logs.
- Back up the database and verify restoration before launch; document recovery and retention expectations.
- Target visible local feedback within 200 ms on agreed representative devices. Validate server-save and multi-device synchronisation targets under documented network conditions.

## 11. MVP acceptance criteria

1. A new owner can register, create a puppy profile and begin logging with or without a schedule.
2. All six requested activity categories can be logged without mandatory typing; common events take at most two taps.
3. A crate session survives reload, can be ended from another authorised device and never becomes a sleep record automatically.
4. An outside trip can link to wee, poo, both, explicit no result or an unknown outcome without double-counting.
5. Entries made during a network outage survive reload and appear once after reconnection. Concurrent edits produce a recoverable outcome.
6. Backdating or correcting a record updates the relevant timelines, summaries and exports.
7. The owner can accept a starting schedule, customise it and retain earlier versions when making changes.
8. Daily and multi-day views distinguish plans, actual records, unfinished sessions and missing data.
9. Outcome summaries expose their sample sizes and exclude unknown outcomes from success calculations.
10. CSV exports match filtered diary records and preserve times, links and unknown values correctly.
11. An unrelated account cannot read or change household data. A kiosk cannot export full history or manage the account.
12. A preset duration is saved immediately as estimated, can be corrected or confirmed and never triggers a confirmed-wake prompt merely because time elapsed.
13. Every eligible caregiver receives reminders; personal mute/unmute, timed mute and quiet hours do not affect others. Confirmed completion clears pending reminders and suppresses unsent duplicates.
14. All caregivers can edit schedules with attribution and undo. Protected care instructions survive suggestions and an owner must explicitly accept a suggested change.
15. A single eligible schedule match links automatically and can be undone. Ambiguous or concurrently claimed matches never silently duplicate fulfilment.
16. PDF summaries respect the selected date range and label estimated and missing data consistently with CSV exports.
17. Kiosk management requires a PIN and still enforces account permissions. Offline logs from both phones and tablet synchronise without duplication.
18. Keyboard and touch testing, daylight-saving cases, sessions spanning midnight, duplicate requests and database restoration are covered before release.

19. The Vercel deployment contains no more than 12 functions and the API has no more than 12 route entrypoints, including callbacks and reminder handlers. A build/deployment check enforces both budgets.
20. At web launch, tablet and phone browsers access the same authorised household data and preserve estimates, offline entries and reminder preferences. At the later mobile release, verify the same behaviour across React Native and web clients using the shared API.
21. Usability testing includes nontechnical caregivers completing setup, logging, correction, muting and PDF sharing without developer assistance.
22. At web launch, test browser reminders with the web app closed on supported platforms under documented permission, installation and connectivity conditions. Test backgrounded native apps at the later mobile release. The delivery design does not depend on Hobby cron for timely reminders.
23. The interface follows section 6a across logging, diary, routine and patterns. Validate labelled controls, stable action placement, touch targets, contrast, text resizing, keyboard/screen-reader use and reduced motion. Decorative elements must not add steps or obscure activity, saving or reminder states.

## 12. Product validation

Before development, test the logging flow with puppy owners using a tablet and phone. Proposed usability target: at least 90% of common logging tasks completed correctly within five seconds after initial orientation.

During a household pilot, assess whether owners can identify one evidence-supported pattern, explain any missing-data limits and make a schedule adjustment without assistance. Track logging effort, corrections, abandoned entries and weekly review use. Fewer accidents or improved settling may be owner-reported outcomes, but are not guaranteed effects of the app.

## 13. Outside initial scope

- Native mobile apps at the initial web launch; React Native apps follow after web validation.
- Wearables or automatic activity detection.
- Medical diagnosis, nutrition calculation or automated care prescriptions.
- Opaque AI-generated schedules or automatic schedule changes.
- Social feeds, public puppy profiles, gamification and subscriptions.
- Professional kennel management and multi-puppy kiosk workflows.
- Email and SMS reminders, and external service integrations. Phone push notifications are in scope.

## 14. Remaining implementation and validation decisions

The product interview has resolved the launch audience, pricing, device coverage, caregiver permissions, activity model, offline support, notification behaviour and export formats. These decisions do not require another approval round.

Before implementation or release, resolve:

- Sourced schedule templates, applicable age bands and care constraints. No care timing values have been validated by this PRD.
- Explainable suggestion rules, minimum sample requirements and comparison windows that avoid overreacting to sparse or incomplete logs.
- Activity-specific schedule-matching windows, reminder expiry and deduplication rules, and default duration values. Do not imply that a software default is care advice.
- Supported tablet and phone browsers, native mobile operating-system versions, push-delivery prerequisites, offline storage limits and PIN/session behaviour.
- Authentication provider, managed database, reminder scheduler, native build/distribution approach, recovery targets and account/data deletion policy. Vercel hosting and the 12-entrypoint/function budgets are confirmed; validate Hobby eligibility and the total service cost.

Validate the minimal logging flow and schedule interpretation with representative households before public web release. After web launch, use the product validation criteria to review logging usability, offline reliability and schedule interpretation before proceeding to the React Native release. These technical and content decisions should preserve the confirmed product scope above.
