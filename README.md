# Wag Journal

A shared puppy diary for quick activity logging, practical routines and understandable patterns.

The app is deployed at **https://wag-journal.vercel.app** with a responsive React interface, an offline diary, a Rust API and a Sydney Supabase database. The reminder/maintenance cron runs each minute. Email delivery and physical-device/pilot checks remain release gates; new signup stays disabled until SMTP is verified. The fictional sample diary works without credentials.

```bash
npm ci
npm run dev
```

Open http://localhost:5173 for the landing page, or http://localhost:5173/sample to go directly to **Alfie’s sample diary**. Sample entries stay on this device, but visiting `/` only opens a diary when signed in (or using a paired kiosk).

- [Deployment and owner actions](docs/DEPLOYMENT.md)
- [Implementation status and remaining release checks](docs/IMPLEMENTATION_STATUS.md)
- [Architecture and security boundaries](docs/ARCHITECTURE.md)
- [Product requirements](PRD_PUPPY_DIARY.md)
- [Original readiness checklist and 46 interview decisions](IMPLEMENTATION_READINESS.md)

```bash
npm run check
cargo test --locked
```

See the deployment guide for the database, API integration and restore tests. Do not enable the localhost test authentication bypass in deployment.
