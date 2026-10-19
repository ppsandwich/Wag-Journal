import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import postgres from "postgres";
const {
  SUPABASE_URL: base,
  SUPABASE_ANON_KEY: anon,
  SUPABASE_SERVICE_ROLE_KEY: service,
  DATABASE_URL: db,
} = process.env;
if (process.env.WAG_HOSTED_TEST !== "true" || !base || !anon || !service || !db)
  throw Error(
    "Opt in with WAG_HOSTED_TEST=true and supply the managed test environment.",
  );
const endpoint =
  process.env.TEST_API_URL || "https://wag-journal.vercel.app/api/app";
const sql = postgres(db, { max: 1, prepare: false });
const users = [],
  house = randomUUID();
let checks = 0;
const ok = (name) => {
  checks++;
  console.log("✓ " + name);
};
async function auth(path, method, body, key = service) {
  const r = await fetch(base + "/auth/v1/" + path, {
    method,
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const v = await r.json();
  assert.ok(
    r.ok,
    `Auth request ${path} failed: ${r.status} ${v.msg || v.message || ""}`,
  );
  return v;
}
async function account(label) {
  const email = `wag-test-${randomUUID()}@example.invalid`,
    password = randomBytes(24).toString("base64url");
  const u = await auth("admin/users", "POST", {
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Temporary test " + label },
  });
  users.push(u.id);
  const session = await auth(
    "token?grant_type=password",
    "POST",
    { email, password },
    anon,
  );
  return { id: u.id, email, token: session.access_token };
}
async function call(u, action, payload = {}, status = 200) {
  const r = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + u.token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, payload }),
  });
  const v = await r.json();
  assert.equal(r.status, status, `${action}: ${JSON.stringify(v)}`);
  return v;
}
try {
  const owner = await account("owner"),
    caregiver = await account("caregiver");
  ok("real Supabase password sessions (no emails sent)");
  await call(owner, "createHousehold", {
    id: house,
    name: "Temporary hosted verification",
    puppy: "Test puppy",
    birthDate: "2026-01-01",
    timezone: "Australia/Melbourne",
  });
  ok("hosted Rust creates household in managed PostgreSQL");
  assert.equal((await call(caregiver, "snapshot")).households.length, 0);
  ok("unrelated account cannot read household");
  const at = new Date(Date.now() - 60000).toISOString(),
    e = {
      id: randomUUID(),
      householdId: house,
      version: 0,
      updatedAt: at,
      type: "outside",
      at,
    };
  const mutation = {
    id: randomUUID(),
    entity: "event",
    record: e,
    expectedVersion: 0,
    createdAt: at,
  };
  const first = await call(owner, "mutate", mutation);
  assert.deepEqual(await call(owner, "mutate", mutation), first);
  ok("hosted retry is idempotent");
  const invite = await call(owner, "invite", {
    householdId: house,
    email: caregiver.email,
  });
  await call(caregiver, "acceptInvite", { token: invite.token });
  ok("email-bound invitation joins real caregiver account");
  const ended = await call(caregiver, "mutate", {
    ...mutation,
    id: randomUUID(),
    expectedVersion: 1,
    record: { ...first.record, end: new Date().toISOString() },
  });
  assert.equal(ended.record.version, 2);
  ok("second real caregiver ends shared session");
  await call(
    owner,
    "mutate",
    {
      ...mutation,
      id: randomUUID(),
      record: { ...first.record, notes: "stale" },
    },
    409,
  );
  ok("hosted stale edit returns conflict");
  await call(caregiver, "deleteAccount");
  const data = await call(owner, "snapshot");
  assert.equal(data.members.length, 1);
  assert.equal(data.events[0].actor, "Former caregiver");
  ok(
    "account deletion removes auth user and anonymises retained diary attribution",
  );
  const probe = await fetch(base + "/rest/v1/records?select=id", {
    headers: { apikey: anon, Authorization: "Bearer " + anon },
  });
  const v = await probe.json();
  assert.ok(
    probe.status === 401 ||
      probe.status === 403 ||
      (probe.ok && Array.isArray(v) && v.length === 0),
  );
  ok("public Data API cannot read diary rows");
  console.log(`${checks} hosted checks passed.`);
} finally {
  await sql`delete from households where id=${house}`;
  for (const id of users) {
    await fetch(base + "/auth/v1/admin/users/" + id, {
      method: "DELETE",
      headers: { apikey: service, Authorization: "Bearer " + service },
    });
    await sql`delete from profiles where id=${id}`;
    await sql`delete from account_deletions where user_id=${id}`;
  }
  await sql.end();
  console.log("Temporary accounts and household removed.");
}
