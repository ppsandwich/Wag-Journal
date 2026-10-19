import webpush from "web-push";
import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
const destination = ".env.keys.local";
if (existsSync(destination))
  throw Error(
    `${destination} already exists. Keep existing keys to preserve subscriptions.`,
  );
const keys = webpush.generateVAPIDKeys();
writeFileSync(
  destination,
  `VAPID_PUBLIC_KEY=${keys.publicKey}\nVITE_VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\nREMINDER_SECRET=${randomBytes(32).toString("hex")}\n`,
  { mode: 0o600 },
);
console.log(
  `Notification keys saved to ${destination} (git-ignored). Copy them into Vercel environment variables; do not commit or paste secret values into chat.`,
);
