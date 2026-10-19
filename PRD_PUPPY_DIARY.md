# Wag Journal: product requirements document

Status: product decisions confirmed following the 46-question requirements interview; implementation and release validation pending
Date: 19 October 2026

This document is the product source of truth. The user accepted all 46 interview recommendations and confirmed the consolidated understanding. The [implementation and readiness checklist](IMPLEMENTATION_READINESS.md) tracks the remaining work and decision provenance. Confirmation authorises these documentation updates; it does not authorise service purchases or app implementation. Provisional values below are accepted starting points for validation, not proven care guidance or completed checks.

## 1. Purpose

Wag Journal helps puppy owners build a practical daily rhythm by making activities quick to record, patterns easy to see and schedules easy to adjust.

The core loop is: start with a suitable schedule, record what actually happens, review patterns, then adjust the schedule. Success means an owner can explain what is working for their puppy and make a useful change without maintaining a complicated diary.

## 2. Confirmed requirements

- Use **Wag Journal** as the app name across the web app, native mobile apps and user-facing materials.
- Launch a React web app with a very simple kiosk interface and responsive phone access. React Native mobile apps follow after the web experience is validated.
- Host the web app and API on Vercel with commercial-ready hosting and no more than 12 API route entrypoints or deployed functions. Use a provisional A$100 monthly operating ceiling with usage alerts; select and cost services before purchasing.
- Design for owners and caregivers who may not be technically confident.
- Record all seven activities: outside trips, potty events, playtime, meals, training, crate time and sleep.
- Visualise and export recorded data.
- Help owners understand which times of day work best and develop a consistent rhythm.
- Offer starting schedules informed by puppy age and other relevant factors, with owner-controlled adjustments.
- Bind data to an account and persist it in a database.

## 3. Confirmed launch scope and priorities

The product is free at launch, with public signup for independent households after a household pilot. Plan for a future commercial product without adding billing at launch. Each household tracks one dog initially, with a data model that can support additional dogs later. A person can belong to multiple households; personal devices provide a clearly labelled household switcher and each kiosk stays paired to one household.

Provisionally allow 10 caregivers and three paired kiosks per household. Explain limits clearly. Apply abuse controls to signup and invitations without imposing an arbitrary daily limit on ordinary care logging. Run a pilot with 5–10 households for at least two weeks after core flows pass testing, extending it until the release criteria are met.

Priorities, highest first:

1. Fewer potty accidents.
2. Better sleep and settling.
3. Easier coordination between caregivers.

The dashboard and schedule suggestions should follow this order. These are desired outcomes, not guaranteed effects.

- Support a shared, ready-to-use tablet kiosk and personal phones for logging and reviewing the diary.
- Provide separate caregiver accounts linked to one shared household diary. The owner manages access; all caregivers can log, correct entries and edit the schedule, with attribution and undo for changes.
- Support offline logging on tablets and phones, with durable local storage, visible pending status and automatic synchronisation.
- Record point events and durations. Running timers are the first-use default for duration activities; provide configurable estimated presets and easy overrides.
- Record preset durations immediately as estimates; allow later confirmation or correction. Never silently convert an estimate to an observed end time.
- Include sleep tracking separately from crate occupancy, optional settling time and wake-up records.
- Provide stable starting routines with fixed times and event-based prompts. Suggest evidence-supported adjustments when patterns persist; require an owner to accept, edit or dismiss each suggestion.
- Notify every caregiver, subject to device permission and individual quiet hours or mute settings. Provide prominent personal mute/unmute controls and timed mute options.
- Include CSV exports and downloadable, printable PDF summaries for a selected date range.
- Require a PIN to leave kiosk logging mode for management functions; account permissions still apply after unlocking.
- No billing or subscription features at launch.

## 4. Primary journeys

### Set up a puppy and starting routine

The owner creates an account and household, enters the puppy's name and date of birth or estimated age, confirms the household timezone and provides daily routine constraints. Keep the profile minimal, adding care factors only where documented rules use them. Use the illustrated puppy identity; photo uploads and diary attachments are outside launch scope. The owner can choose a suggested schedule, customise it or begin logging without one.

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

### Logging defaults, corrections and outcomes

- Start outside trips, play, training, crate time and sleep with running timers by default. Personal accounts remember their own timer/preset preferences across devices. Each kiosk has shared device preferences; one caregiver's personal changes do not alter other people's controls. Do not introduce preset care-duration values without review.
- Use the two-tap flow Potty → Wee / Poo / Both. Save on the second tap, then offer location, accident status and other details. Keep “Mark as accident” prominent. Unspecified location and accident status remain unknown.
- Automatically link a potty event to the single outside trip active at its occurrence time, with visible undo. Multiple possible trips require selection. Linking does not infer location or accident status. Ending a trip offers an optional “No result”; no response remains unknown.
- Preserve multiple potty events within a trip. Count the trip once in trip-level outcome summaries and count potty events separately. If a new result conflicts with “No result”, offer an explicit replacement rather than silently reconciling the contradiction.
- A forgotten timer remains unfinished until confirmed or corrected. Show “Still running?” with end-now and earlier-end options. Flag sessions crossing midnight for review without repeated notifications; never invent their end times.
- Starting an already-running activity offers “Keep running” or “End earlier session and start new”, with correction of the earlier end time. Competing offline starts are preserved for review, not silently merged or discarded.
- Ending crate time leaves sleep unchanged unless the caregiver selects “Also woke up”. Waking ends sleep but does not end crate occupancy. Starting sleep may offer a link to an active crate session without assuming location.
- Provide backdating shortcuts for 5, 15 and 30 minutes ago and an exact date/time picker. Actual records must be now or in the past; future activities belong in Routine. Reject an end before its start. Explain a future timestamp caused by device-clock error without losing entered details.
- Keep quick undo available for 10 seconds. Corrections and deleted records remain recoverable through change history for 30 days by authorised caregivers. Undo creates a new change and preserves intervening edits or requires conflict resolution. Household deletion overrides record recovery. Locked kiosks retain only immediate undo; broader history requires authenticated access.

## 6. Kiosk requirements

- Prioritise logging, current activity and recent history over charts or configuration.
- Support touch use on a shared tablet, alongside responsive phone and desktop access.
- Use readable labels and accessible controls; do not rely on colour or icons alone. Target WCAG 2.2 AA at implementation and validation.
- Show which puppy is being logged, the current time and the time since relevant recent events.
- Keep a paired household device ready to log without repeated sign-in for each event. Pairing requires an authenticated owner.
- Restrict locked kiosk access to logging, backdating, immediate undo, today's entries and active sessions. Keep notes and full history behind unlocking; editing or deleting older entries requires unlocking. Use a six-digit PIN to leave logging mode, followed by personal authentication where needed to establish permissions. The PIN alone must never expose an owner account. Relock management after two minutes of inactivity. Rate-limit failed attempts; the owner resets a forgotten PIN. Account, membership and device-management changes require internet access.
- Let the owner revoke a kiosk remotely. Record the device as the source when a caregiver is not individually identified; never falsely attribute an entry to the owner.
- Save offline entries durably on the device and show their pending status. Synchronise without duplication and surface conflicts that require correction.
- If local persistence fails, clearly state that the event has not been saved.

### Supported devices and disconnected access

Target current iPads, iPhones, Android phones and desktop browsers, prioritising current Safari and Chrome on applicable platforms. Support older devices only after testing. Record exact devices, OS versions and browser versions before claiming support; a specific kiosk model is not yet selected. Explain installation and permission prerequisites for phone notifications.

A disconnected kiosk cannot learn that access has been revoked. It can continue logging locally until reconnection. On reconnecting, lock ordinary access and quarantine pending entries for owner review. Do not silently import them or delete pending work. Apply the same principle to a removed caregiver. Explain this limitation during kiosk pairing. The secure quarantine/review mechanism must be designed and tested before release; revocation must not grant ordinary read or write access.

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
- Automatically link a logged activity to a scheduled item when there is exactly one eligible match within a defined activity-specific time window. Provide easy undo. Ambiguous matches remain unlinked until a caregiver chooses; already fulfilled items cannot be matched twice. Reconcile offline matches on sync. Use actual start times and identical activity types. Provisional matching windows are ±30 minutes for meals and ±15 minutes for other fixed-time activities; validate these as software tolerances, not care advice.
- Keep missed or skipped plans distinct from missing diary entries.
- Combine relative outside prompts whose due times fall within a provisional 15-minute window, showing all reasons. An existing manually scheduled outside opportunity within that window takes precedence. Completing the combined opportunity fulfils it once. Validate merging, including chains of nearby prompts, before release. Manual changes take precedence over template defaults.
- When the puppy enters another template age band, offer a preview of suggested changes and retain the existing schedule until the owner accepts them.
- Record schedule versions and effective dates. Default routine changes to tomorrow, with explicit today and future-date options and “This occurrence only” for one-off changes. Preview when the change takes effect. Applying an edit today changes only future, uncompleted items; completed and past plans retain their history.
- Keep a stable baseline, with flexible prompts following confirmed meals, waking and other relevant activities. An estimated end cannot trigger an event-based care reminder.
- Generate occasional suggested changes when patterns persist across several days. Explain the proposed change, supporting observations, sample size, unknown data and applicable schedule constraints. The owner can accept, edit or dismiss; no change applies automatically.
- Prioritise suggestions about toilet timing, then sleep and settling. Preserve protected vet or trainer instructions and show when a suggestion conflicts with them.

### Protected care constraints

Only the owner can add, change or remove protected vet/trainer constraints. Caregivers may edit within them; conflicting edits require the owner to explicitly resolve the conflict. Retain the instruction, its source and change history. Free-text notes are not automatically machine-enforceable rules. Define the supported structured constraints and their conflict checks during content and technical design. Suggestions must never silently override them.

### Reminders and muting

- Provide in-app upcoming activities and phone notifications for every caregiver who grants the necessary permission. Delivery remains subject to browser and operating-system capabilities.
- Provide a prominent personal one-tap mute/unmute control. Offer one hour, until morning and until manually re-enabled, with a visible mute status and resume time. Until morning defaults to the household's configured wake time and shows the exact next resume time before confirmation; it can be adjusted.
- Keep mute state and quiet hours per caregiver across their devices. Muting one caregiver never mutes another. Quiet hours start switched off and are offered during setup.
- Send one reminder per planned occurrence to each eligible caregiver, without repeated nagging or escalation. Keep the planned item visible as unconfirmed; silence is not completion or evidence that care was missed.
- Offer personal snooze for 10, 30 or 60 minutes. Snooze changes that caregiver's reminder only, not the household routine or other caregivers' reminders. Completion cancels pending snoozes.
- Suppress a notification that would arrive more than 15 minutes after its intended delivery time. An explicitly snoozed reminder uses its new intended time. Keep the activity visible in the app. After reconnecting or unmuting, resume relevant upcoming reminders without a stale backlog. The 15-minute limit is a software notification policy, not care guidance.
- Completing or linking an activity clears its pending reminder across connected devices and cancels unsent duplicate reminders. Best-effort dismissal of already delivered notifications depends on platform support; do not promise remote removal everywhere.
- Reconcile offline completions on sync. Do not flood caregivers with stale reminders after reconnecting or unmuting; show what is currently relevant.
- Validate the supported phone/browser matrix before implementation and explain any installation or permission steps during setup. In-app reminders remain available if push is unsupported or denied.

### Content requirements

Template values and rules are a launch dependency: research them against reputable veterinary and animal-welfare sources, then obtain review of care-related timing and rules from a qualified vet or trainer. The reviewer has not yet been named. Logging can be built and tested independently; unreviewed care guidance must not be released publicly. This PRD does not prescribe feeding, exercise, toilet or crate-duration limits. Individual care instructions must remain editable, and household constraints must not produce unsupported care recommendations.

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

### Evidence thresholds and logging completeness

Descriptive views may appear before automatic suggestions are justified. Provisionally require at least seven sufficiently logged days and 10 relevant observations before proposing a change. These are starting thresholds for feature-specific validation, not a claim of medical confidence. Define comparison windows, eligible observations and rule-specific exclusions before enabling suggestions.

During weekly review, ask caregivers to mark days “Mostly complete”, “Some gaps” or “Unsure”, with optional gap times. Only mostly complete days qualify for automatic suggestions; other days remain in descriptive charts with clear limitations. Explicit gaps and unknown outcomes remain excluded or annotated as applicable even on mostly complete days. Never infer completeness from event count alone.

Show at most one new suggestion per week and suppress an equivalent dismissed suggestion for two weeks. Define equivalence and the observation window in the rule specification. Explain counts, unknowns and constraints, and retain owner acceptance/edit/dismiss controls.

## 9. Accounts, storage and export

### Ownership and access

- Every puppy, event and schedule belongs to a household bound to its owner account.
- The owner manages membership and kiosk access. Caregivers may log, correct records, view and export the shared diary, and edit schedules with attributed change history and undo; ownership and deletion controls remain with the owner.
- Authorise every server request against household membership or a limited kiosk credential. Knowing a record identifier must never grant access.
- Use verified email and password through an established authentication solution, supporting password managers, persistent personal-device sessions and email-based password recovery. Defer social sign-in. Email verification, invitations and recovery are in scope; email care reminders are not.
- Invitations expire after seven days, are single-use and are tied to the invited email address.
- Ownership may transfer to an existing caregiver after that person's acceptance. An owner must transfer or delete owned households before leaving them or deleting their account.
- Removing membership preserves historical attribution. Deleting the personal account preserves shared care records with anonymised “Former caregiver” attribution and removes personal account information.
- Support export and deletion of household data, with the recovery and deletion rules below.

### Deletion, sign-out and local retention

- Household deletion immediately stops reminders and ordinary household access, with a seven-day cancellation period for the owner. After that period, purge live data. Target backup expiry within 30 further days, subject to verified provider capabilities. Document how restored backups respect prior deletion requests.
- Personal devices cache 30 days of diary history and the current routine. Locked kiosks expose only today and active sessions. Pending entries are retained until safely resolved regardless of age; active sessions remain available. Older history and exports require internet access.
- On sign-out with pending entries, show their count and offer “Stay and sync” or explicit “Discard pending entries and sign out”. Do not silently discard work or leave private data accessible after sign-out. Partition caches by household; account switching must not leak the previous account's data.
- Revocation uses the quarantine/review behaviour in section 6. Specify protected pending-data retention and disposal during technical design; it must not become accessible through the revoked account or kiosk.

### Persistent records

Store users, households, memberships, puppy profiles, kiosk devices, activity events, activity links, schedule templates, schedule versions, schedule items, schedule suggestions and decisions, change history, per-activity duration defaults, notification preferences, push subscriptions, reminder delivery state and incomplete-logging periods and daily completeness assessments in a relational database. Include invitations, ownership-transfer state, deletion requests and revocation/quarantine state as required by the access and recovery flows.

Activity records include a stable ID, household and puppy IDs, type, occurrence time, estimated duration and end time, optional confirmed end time, confirmation status, trip purpose, potty type, location, accident status, structured outcome fields, notes, source device or caregiver, creation time, modification time and sync identifier. Use deletion markers where needed to propagate removals to offline clients, then purge according to the retention policy.

Store timestamps in UTC and retain timezone context. Anchor routines to the household timezone until it is explicitly changed; travelling with a device must not move the routine. Timezone changes apply prospectively and preserve historical context. Render routine comparisons in the selected household timezone and calculate elapsed durations from absolute timestamps. During daylight-saving transitions, move a nonexistent planned time to the first valid time and deliver a repeated clock-time activity once, with the adjustment visible. Define deterministic handling of ambiguous manually entered times during technical design.

### Export

- Export all records or a selected date range and activity set as CSV.
- Include stable IDs, event type, start and end timestamps, timezone, outcomes, notes, linked-event IDs and attribution where known. Exclude caregiver email addresses from ordinary exports.
- Export schedule versions and planned items separately so plans and observations cannot be confused.
- Preserve unknown values as unknown; include field definitions and units.
- Escape CSV safely, including protection against spreadsheet formula execution in user-entered fields.
- Generate a downloadable, printable PDF summary for a selected date range, suitable for a vet or trainer. Include puppy age, relevant schedule versions, toilet patterns and accidents, sleep and settling, summary counts, estimates, unknowns and logging gaps. Default the PDF to the last seven days, with 7-day, 30-day and custom date ranges. Lead with a concise summary and relevant routine, followed by optional diary detail. Include the diary and current schedule as printable views.

## 10. Reliability and architecture

### Platform and deployment constraints

- Release 1: launch the responsive React web application for shared tablets, phones and desktop browsers. Include the agreed logging, offline support, schedules, browser notifications, accounts and exports.
- Release 2: build React Native mobile apps after validating the web experience. Native apps remain in product scope but are not a web-launch dependency. Select supported operating-system versions during mobile implementation planning.
- Host the web application and shared authenticated API on Vercel using a plan suitable for the agreed commercial direction. Native app binaries require their own build and distribution process; they consume the same backend and household data.
- Keep no more than 12 API route entrypoints and no more than 12 deployed Vercel Functions. Prefer a small set of grouped handlers with internal routing, leaving room for authentication callbacks and notification delivery. Check actual deployment output, including any server-rendered functions, rather than counting source files alone.
- Vercel counts deployed functions; the relationship to URL routes depends on the framework and bundling. This PRD retains the requested 12-route ceiling as an additional project constraint. See [Vercel runtime and function-count documentation](https://vercel.com/docs/functions/runtimes#functions-created-per-deployment), checked 19 October 2026.
- Share API contracts, validation rules and domain logic where practical between React and React Native, with platform-specific presentation, durable offline storage and notification adapters.
- Use a managed relational database compatible with serverless access. Do not store authoritative records in a function's local filesystem. Keep database credentials server-side and choose a connection strategy suitable for concurrent functions.
- Rust remains preferred, subject to an early deployment test covering authentication, database access and reminder delivery. Use TypeScript if that test exposes substantial deployment or maintenance problems. Preserve shared API contracts in either case. The runtime must satisfy deployment and function-count constraints without changing the required React and React Native clients.
- Use a provisional A$100 monthly operating ceiling with usage alerts, superseding the earlier A$50/Hobby target. Cost hosting, database, authentication email, storage, backups, notifications and any domain costs, accounting for exchange rates and tax. Free public signup does not establish Hobby eligibility: [Vercel Hobby terms](https://vercel.com/docs/plans/hobby) restrict it to personal, non-commercial use. Provider selection and purchases remain pending.

### Reminder delivery

Vercel Hobby cron jobs run at most once daily and do not provide precise timing, so they cannot drive the agreed timely care reminders. Use a compatible durable scheduler or notification service for server-originated reminders, with provider and cost limits selected before implementation. Verify the selected commercial plan's capabilities and the full delivery design; choosing a paid plan alone does not establish reliable reminder behaviour. See [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), checked 19 October 2026.

Do not rely on a browser staying open or a long-running function timer. Native local notifications may supplement delivery, but shared completion, schedule edits and personal muting must reconcile with server state. Deduplicate local and remote notifications and document platform restrictions on cancelling already scheduled or delivered alerts.

### Reliability requirements

- Persist authoritative account data on the server. Device storage is an offline queue and cache, not the only copy.
- Generate event IDs before sending writes and make server writes idempotent.
- Treat concurrent edits explicitly. Automatically combine independent new entries, but preserve competing edits and show a plain-language comparison for resolution. Use record versions or equivalent detection to prevent silent overwrites. Competing offline starts also require review.
- Keep kiosk credentials limited and revocable. Partition cached data by household and clear access on sign-out or revocation when the device reconnects.
- Make sync state observable without exposing private diary data in application logs.
- Back up the database and verify restoration before launch. Initial disaster-recovery targets are no more than 24 hours of server data loss and restoration within one business day. These are serious-failure recovery allowances, not delayed normal saves. Demonstrate the targets and review them before wider public use.
- Target visible local feedback within 200 ms, account-save confirmation within two seconds and visibility on another connected device within five seconds, each for at least 95% of tested operations under documented normal network conditions. Use representative devices and keep pending status visible when targets are missed.

## 11. Web-release acceptance criteria

1. A new owner can register, create a puppy profile and begin logging with or without a schedule.
2. All seven activities (Outside, Potty, Meal, Play, Training, Crate and Sleep) can be logged without mandatory typing. Common timestamp events take one tap; potty takes no more than two taps. Optional detail follows saving.
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
24. First-use duration logging starts timers. Personal and kiosk preferences remain independent; forgotten timers and competing starts require explicit resolution.
25. The two-tap potty flow preserves unknown location/accident status, links only an unambiguous active trip and resolves contradictory outcomes without double-counting.
26. Kiosk PIN attempts are rate-limited, management relocks after two minutes and PIN possession does not grant owner access. Locked history, notes and edit restrictions are enforced server-side where applicable.
27. Revocation blocks ordinary access on reconnection and quarantines pending entries for owner review; sign-out never silently discards pending work or exposes the previous account's cache.
28. Single-use email invitations expire, household switching preserves isolation, ownership transfer requires acceptance and account deletion cannot orphan an owned household.
29. Quick undo lasts 10 seconds, record recovery lasts 30 days, household deletion allows seven-day cancellation and the verified live/backup deletion policy is demonstrated.
30. Routine edits default to tomorrow, one-off edits preserve the baseline and protected constraints require owner conflict resolution. Matching and merged prompts pass boundary and concurrency tests.
31. Snooze is personal, stale reminders expire and quiet hours default off. Completion suppresses unsent snoozes and duplicate reminders without changing another caregiver's preferences.
32. Suggestions enforce validated completeness and sample rules, show at most one new suggestion per week and suppress dismissed equivalents for two weeks. No care guidance ships without qualified review.
33. Timezone travel, prospective timezone changes and both daylight-saving transitions preserve actual timestamps and produce one intended planned occurrence.
34. The 30-day personal cache, persistent pending queue, online export requirements and pending-entry sign-out choices work on the supported device matrix.
35. Performance and disaster-recovery targets in section 10 are measured and met under documented conditions.
36. Public release has a named operator, support address and qualified content reviewer, an accepted service-cost plan, and pilot evidence meeting section 12. No unresolved defects that lose or expose data remain.

## 12. Product validation

Before development, test the logging flow with puppy owners using a tablet and phone. Required usability target: at least 90% of common logging tasks completed correctly within five seconds after initial orientation.

During a household pilot, assess whether owners can identify one evidence-supported pattern, explain any missing-data limits and make a schedule adjustment without assistance. With explicit pilot consent, measure logging completion time, corrections, failed saves and feature use, including abandoned entries and weekly review use where measurable without collecting diary content. Exclude diary text, puppy names, care outcomes and session recordings from usage telemetry. Use interviews to assess pattern interpretation and understanding of missing-data limits. Fewer accidents or improved settling may be owner-reported outcomes, but are not guaranteed effects of the app.

Run the pilot for at least two weeks with 5–10 households, including nontechnical caregivers and shared-tablet users, after core flows pass testing. Public release requires the usability target, no unresolved data-loss or data-exposure defects, verified reminder behaviour and recovery, accurate exports, access-control checks and a demonstrated database restore. Extend the pilot until the conditions are met.

Before public release, name an operator, establish a working support address and name the qualified reviewer for care-related content. The operator handles service alerts, restoration and deletion requests. These people and contact details are not yet confirmed. Logging development and testing may proceed independently of care-content approval.

## 13. Outside initial scope

- Native mobile apps at the initial web launch; React Native apps follow after web validation.
- Wearables or automatic activity detection.
- Medical diagnosis, nutrition calculation or automated care prescriptions.
- Opaque AI-generated schedules or automatic schedule changes.
- Social feeds, public puppy profiles, gamification and subscriptions.
- Professional kennel management and multi-puppy kiosk workflows.
- Email and SMS care reminders, and user-facing external service integrations. Phone push and infrastructure for authentication email, hosting and reminder delivery are in scope.
- Social sign-in, photo uploads and diary attachments.

## 14. Remaining implementation and validation work

The product interview and consolidated understanding are confirmed. The requirements above do not require another broad approval round. The [implementation and readiness checklist](IMPLEMENTATION_READINESS.md) records outstanding work, evidence and all 46 interview decisions.

Before the relevant implementation or release stage, complete:

- Sourced care templates, applicable age bands and supported structured constraints, with qualified review. No care timing values have been validated by this PRD.
- Explainable suggestion algorithms, feature-specific sample rules, comparison windows and tests for sparse, unknown or incomplete data. Validate the provisional seven-day/10-observation baseline.
- Boundary and concurrency validation of the provisional matching windows and prompt merging, plus reminder expiry, deduplication and snooze delivery semantics.
- The exact device/browser matrix, push prerequisites, offline storage capacity and eviction handling, authenticated session lifetimes, PIN rate limits and secure pending-data quarantine. The preferred device families and kiosk behaviour are settled; exact versions and mechanisms are not.
- Authentication/database/email/scheduler provider selection and total service costs within the provisional A$100 ceiling. Validate Rust first and use the accepted fallback if necessary. Vercel hosting and the 12-entrypoint/function budgets remain required.
- Database schema, API contracts, authorisation rules, atomic operations, conflict resolution and deletion/restore mechanisms. Verify the accepted retention and recovery targets against provider capabilities.
- Prototypes and all interaction states, then representative-device usability, accessibility, performance and reliability testing.
- Named operational and care-review responsibilities, a support address and pilot evidence before public release.

After web validation, select native OS versions, build/distribution arrangements and native-specific interactions. Preserve shared contracts and behaviour now. A complete web release does not mean native apps are implemented or validated.
