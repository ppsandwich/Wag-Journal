# Deployment and actions for the owner

The app can be explored locally now. Production requires the service connections below. No paid plan or external service has been purchased by this build.

## 1. Vercel project

The project has been created in `silentsoars-projects` and connected to `ppsandwich/Wag-Journal`. The live application is https://wag-journal.vercel.app. Supabase and reminder credentials are configured in Production; Preview remains a sample-only environment to avoid sharing production data. Vercel assigned the first deployment to production automatically. The team was already on Pro; no plan upgrade was purchased.

The product is intended to become commercial. Confirm a suitable Vercel plan and its cost; free signup does not establish Hobby eligibility. Use the provisional A$100 monthly total as a planning ceiling, not a guarantee of service cost.

The local Vercel build passes with two function artifacts (limit: 12), and the hosted Rust `/api/app` endpoint returns HTTP 200. The reminder endpoint rejects unauthorised requests with HTTP 401. After setting service variables, redeploy and test the authenticated workflows. For local Vercel builds install `cargo-zigbuild` and Zig; this workspace uses `CARGO_ZIGBUILD_ZIG_COMMAND=/home/dylan/.local/bin/python-zig` when running the build.

## 2. Supabase and email delivery

A separate free project, `gpvfklevabyoafamuron`, is running in Sydney. All migrations have been applied. Magic-Seeker was paused with the owner's explicit approval to free an active-project slot; remembrall was left running. The generated password is stored in `.env.supabase.local`; deployment credentials are in `.env.cloud.local`. Both files are git-ignored and permission-restricted.

These values have been configured in Vercel Production:

| Variable | Where used | Value |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Browser | Project URL |
| `VITE_SUPABASE_ANON_KEY` | Browser | Public anon/publishable key |
| `SUPABASE_URL` | Rust API | Same project URL |
| `SUPABASE_ANON_KEY` | Rust API | Public anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Rust API only | Administration key for personal account deletion |
| `DATABASE_URL` | Rust API and reminder worker | Server-only PostgreSQL transaction-pooler connection string |

Never prefix a database password, service-role key or other secret with `VITE_`.

Run `npm run db:migrate` with the managed `DATABASE_URL` supplied securely. The migration command applies all numbered SQL files. The application tables intentionally have no public RLS policies; direct browser Data API access is denied.

Email confirmation is enabled, and the site URL and redirect allowlist point to the live app. **Custom SMTP remains outstanding.** Select a sender address and verified domain, connect the provider in Supabase Auth → Emails → SMTP Settings, then verify signup and recovery delivery. Set `VITE_EMAIL_READY=true` in Vercel Production and redeploy only once delivery is verified; until then, the app disables new signup and recovery while allowing existing accounts to sign in. Review password and authentication rate-limit policies before public signup. Invitations currently generate a single-use link to share with the intended email recipient; they are not automatically emailed.

**Never set `LOCAL_DEV_AUTH=true` in deployment.** The API also refuses this bypass whenever `VERCEL` is present. It exists only for isolated localhost integration tests.

## 3. Notifications and maintenance

The existing Vercel team is on Pro. `vercel.json` schedules `/api/reminders` every minute and runs functions in Sydney. [Vercel Pro supports minute-level cron](https://vercel.com/docs/cron-jobs/usage-and-pricing), so no QStash account or new subscription was needed. Function usage still applies.

VAPID keys, `APP_ORIGIN`, `VAPID_SUBJECT`, `REMINDER_SECRET` and `CRON_SECRET` have been configured in Production. `VAPID_SUBJECT` is the live app URL. Keys are also stored in ignored `.env.keys.local`; keep them stable because rotating VAPID keys invalidates existing subscriptions. The authenticated maintenance endpoint returns 200. Never place the cron secret in a URL.

The worker purges expired household deletions and 30-day record history. Monitor failed runs and verify actual scheduled invocations in Vercel. Managed backup retention and restore guarantees still need an operational plan; the free Supabase project is not a validated production backup strategy. A local restore drill is not a substitute for that plan.

Budget for 43,200 cron invocations per 30-day month, plus usage from the app. Check usage and alerts against the provisional A$100 monthly budget. No paid plan was purchased or upgraded during setup.

On iPhone/iPad, test from the installed Home Screen app with permission granted. Confirm reminders with the app closed, personal mute, quiet hours, snooze, completion cancellation and stale-reminder suppression. Verify at least two caregivers and two devices. Actual push delivery to physical phones remains unverified.

## 4. Finish the content and public-release gates

- Name the service operator and establish a support address.
- Arrange a qualified vet/trainer review of sourced starting routines and suggestion rules. Those features are gated off; the app currently supports owner-created routines and descriptive patterns.
- Choose actual kiosk, phone and desktop devices and record tested OS/browser versions.
- Run the planned 5–10-household pilot for at least two weeks after the core deployment checks pass.
- Confirm the five-second logging target, accessibility, privacy wording, restore targets and deletion policies.
- Review the remaining items in `docs/IMPLEMENTATION_STATUS.md` before public release.

## Local commands

```bash
npm ci
npm run dev
```

Open `http://localhost:5173` and choose **Meet Alfie’s sample diary**. The sample is fictional and stored on that device. It is never silently uploaded into a real household.

For the local database/API, copy `.env.example` to `.env` and use the development database connection. The current build started a container named `wag-journal-postgres`, listening only on localhost port 54329. To create it on another machine:

```bash
docker run -d --name wag-journal-postgres \
  -e POSTGRES_USER=wag -e POSTGRES_PASSWORD=wag_local_only -e POSTGRES_DB=wag \
  -p 127.0.0.1:54329:5432 postgres:17-alpine
```

With `DATABASE_URL` supplied in the shell:

```bash
npm run db:migrate
npm run api
```

The API reads `.env` through dotenv. The Node migration command expects environment variables in the shell. Run `LOCAL_DEV_AUTH=true npm run api` only to execute the isolated local integration suite. This does not enable a fake browser login or replace testing actual Supabase authentication.

```bash
npm run check
npm run test:api
npm run test:restore
cargo test --locked
npm audit --omit=dev
```

`test:api` needs the locally running API with `LOCAL_DEV_AUTH=true` and a dedicated test database. It creates and deletes only its own random test households. `test:restore` uses the named local Docker container and a disposable restore database; it never restores over the source database.

## Managed smoke tests

The nine-check hosted suite creates two temporary, pre-confirmed Supabase accounts without sending emails. It checks the real deployment, sharing, conflicts, deletion/anonymisation and public Data API isolation, then removes its test accounts and household. It is opt-in and requires the ignored deployment environment:

```bash
WAG_HOSTED_TEST=true node --env-file=.env.cloud.local scripts/test-hosted.mjs
```

Do not repurpose those test credentials as real caregiver accounts.
