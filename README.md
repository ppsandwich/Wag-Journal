# Wag Journal

A shared puppy diary for quick activity logging, practical routines and understandable patterns.

The app is implemented locally with a responsive React interface, an offline diary, a Rust API and PostgreSQL storage. Live accounts and background notifications require the deployment connections below. The fictional sample diary works without credentials.

```bash
npm ci
npm run dev
```

Open http://localhost:5173 and choose **Meet Alfie’s sample diary**.

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
