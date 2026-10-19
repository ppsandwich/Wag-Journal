# Deployment and actions for the owner

The app can be explored locally now. Production requires the service connections below. No paid plan or external service has been purchased by this build.

## 1. Vercel project

The project has been created in `silentsoars-projects` and connected to `ppsandwich/Wag-Journal`. Its first deployment is https://wag-journal.vercel.app. It currently provides the sample diary; real accounts still need Supabase environment variables. Vercel assigned the first deployment to production automatically. The team was already on Pro; no plan upgrade was purchased.

The product is intended to become commercial. Confirm a suitable Vercel plan and its cost; free signup does not establish Hobby eligibility. Use the provisional A$100 monthly total as a planning ceiling, not a guarantee of service cost.

The local Vercel build passes with two function artifacts (limit: 12), and the hosted Rust `/api/app` endpoint returns HTTP 200. The reminder endpoint rejects unauthorised requests with HTTP 401. After setting service variables, redeploy and test the authenticated workflows. For local Vercel builds install `cargo-zigbuild` and Zig; this workspace uses `CARGO_ZIGBUILD_ZIG_COMMAND=/home/dylan/.local/bin/python-zig` when running the build.

## 2. Connect Supabase

Create or select a Supabase project and choose an appropriate region and backup plan. Supply values through local environment files or Vercel's environment settings, not chat:

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

Enable email confirmation. Configure the production site URL and allowed redirect URLs, including `/` and the recovery destination. Set password and authentication rate-limit policies. Configure custom SMTP; use a verified sender domain and an email provider such as Resend. Confirm signup, recovery and invitation acceptance using two real test accounts. Invitations currently generate a single-use link to share with the intended email recipient; they are not automatically emailed.

**Never set `LOCAL_DEV_AUTH=true` in deployment.** The API also refuses this bypass whenever `VERCEL` is present. It exists only for isolated localhost integration tests.

## 3. Enable notifications and maintenance

Notification keys have been generated locally in `.env.keys.local`, which is git-ignored and permission-restricted. Keep those keys stable; rotating the VAPID key invalidates existing subscriptions. `npm run keys` generates a file only if one does not exist.

Set these Vercel variables from that file:

- `VAPID_PUBLIC_KEY`
- `VITE_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `REMINDER_SECRET`

Set `VAPID_SUBJECT` to the actual support `mailto:` address and `APP_ORIGIN` to the HTTPS deployment URL.

Create an Upstash QStash schedule that POSTs to `https://YOUR-DOMAIN/api/reminders` once per minute (`* * * * *`). Forward `Authorization: Bearer REMINDER_SECRET` as a destination header. The shared bearer secret is validated by the function; never place it in a URL. Allow access through any Vercel deployment protection using the provider's supported protected-deployment configuration rather than disabling protection accidentally.

Budget for 43,200 scheduler calls per 30-day month, plus retries and delivery volume. Recheck provider pricing before enabling paid usage. A once-per-minute sweep exceeds a 1,000-delivery/day allowance.

The worker also purges expired household deletions and 30-day record history. Monitor failed runs; maintenance must not silently stop. Verify deleted data is not reintroduced after a backup restore. Managed backup expiry must be configured and tested separately.

On iPhone/iPad, test from the installed Home Screen app with permission granted. Confirm reminders with the app closed, personal mute, quiet hours, snooze, completion cancellation and stale-reminder suppression. Verify at least two caregivers and two devices.

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
