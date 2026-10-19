import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const endpoint = process.env.TEST_API_URL || "http://127.0.0.1:3001/api/app";
const owner = randomUUID(),
  stranger = randomUUID(),
  caregiver = randomUUID(),
  h = randomUUID();
let passed = 0;
async function request(user, action, payload = {}, status = 200) {
  const r = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${user.startsWith("kiosk_") ? user : `local:${user}`}`,
    },
    body: JSON.stringify({ action, payload }),
  });
  const value = await r.json();
  assert.equal(r.status, status, `${action}: ${JSON.stringify(value)}`);
  return value;
}
function ok(name) {
  passed++;
  console.log(`✓ ${name}`);
}
const time = new Date(Date.now() - 60000).toISOString();
const e = {
  id: randomUUID(),
  householdId: h,
  version: 0,
  updatedAt: time,
  type: "outside",
  at: time,
};
const m = {
  id: randomUUID(),
  entity: "event",
  record: e,
  expectedVersion: 0,
  createdAt: time,
};
try {
  await request(owner, "createHousehold", {
    id: h,
    name: "Integration test",
    puppy: "Milo",
    birthDate: "2026-01-01",
    timezone: "Australia/Melbourne",
  });
  ok("create household");
  await request(stranger, "mutate", m, 403);
  assert.equal((await request(stranger, "snapshot")).households.length, 0);
  ok("reject unrelated household reads and writes");
  const first = await request(owner, "mutate", m),
    retry = await request(owner, "mutate", m);
  assert.deepEqual(first, retry);
  ok("idempotent retry returns the original result");
  await request(
    owner,
    "mutate",
    { ...m, record: { ...e, notes: "different payload" } },
    400,
  );
  ok("reject reuse of mutation ID with a different payload");
  await request(
    owner,
    "mutate",
    { ...m, id: randomUUID(), record: { ...e, id: randomUUID() } },
    409,
  );
  ok("prevent duplicate active sessions");
  await request(
    owner,
    "mutate",
    { ...m, id: randomUUID(), record: { ...e, notes: "Stale edit" } },
    409,
  );
  ok("preserve concurrent version conflict");
  const p = {
    ...e,
    id: randomUUID(),
    type: "potty",
    potty: "wee",
    tripId: e.id,
  };
  await request(owner, "mutate", { ...m, id: randomUUID(), record: p });
  ok("link a potty outcome without duplicating the trip");
  await request(
    owner,
    "mutate",
    {
      ...m,
      id: randomUUID(),
      expectedVersion: 1,
      record: { ...first.record, outcome: "no-result" },
    },
    400,
  );
  ok("reject contradictory no-result outcome");
  const snap = await request(owner, "snapshot");
  assert.equal(snap.events.length, 2);
  ok("snapshot contains each event once");
  const invite = await request(owner, "invite", {
    householdId: h,
    email: `${caregiver}@local.test`,
  });
  await request(stranger, "acceptInvite", { token: invite.token }, 400);
  await request(caregiver, "acceptInvite", { token: invite.token });
  await request(caregiver, "acceptInvite", { token: invite.token }, 400);
  ok("email-bound, single-use caregiver invitations");
  await request(caregiver, "mutate", {
    ...m,
    id: randomUUID(),
    expectedVersion: 1,
    record: { ...first.record, end: new Date().toISOString() },
  });
  ok("caregiver ends a session from another device");
  await request(
    caregiver,
    "mutate",
    {
      id: randomUUID(),
      entity: "constraint",
      expectedVersion: 0,
      record: {
        id: randomUUID(),
        householdId: h,
        type: "meal",
        instruction: "Test constraint",
        source: "Test",
      },
    },
    403,
  );
  ok("caregiver cannot modify protected care constraints");
  const k = await request(owner, "pairKiosk", {
    householdId: h,
    name: "Test tablet",
    pin: "123456",
  });
  const ks = await request(k.token, "snapshot", { all: true });
  assert.equal(ks.members.length, 0);
  assert.equal(ks.history.length, 0);
  ok("kiosk snapshot excludes management and history");
  await request(
    k.token,
    "invite",
    { householdId: h, email: "bad@example.com" },
    403,
  );
  ok("kiosk cannot manage caregivers");
  for (let i = 0; i < 5; i++)
    await request(k.token, "unlockKiosk", { pin: "000000" }, 400);
  await request(k.token, "unlockKiosk", { pin: "123456" }, 429);
  ok("PIN attempts are rate limited");
  await request(owner, "resetPin", { deviceId: k.id, pin: "654321" });
  await request(k.token, "unlockKiosk", { pin: "654321" });
  ok("owner can reset PIN and unlock only requests personal sign-in");
  await request(owner, "revokeKiosk", { deviceId: k.id });
  await request(k.token, "snapshot", {}, 403);
  await request(k.token, "quarantine", { id: randomUUID(), changes: [] });
  ok("revoked kiosk loses read access but can quarantine pending work");
  await request(owner, "removeMember", { householdId: h, userId: caregiver });
  await request(caregiver, "mutate", { ...m, id: randomUUID() }, 403);
  ok("removed caregiver cannot write");
  await request(owner, "deleteHousehold", { householdId: h });
  await request(owner, "mutate", { ...m, id: randomUUID() }, 423);
  assert.ok((await request(owner, "snapshot")).households[0].deletionAt);
  await request(owner, "cancelDeletion", { householdId: h });
  ok("deletion locks ordinary writes and can be cancelled");
  const other = randomUUID();
  await request(stranger, "createHousehold", {
    id: other,
    name: "Other",
    puppy: "Pip",
    birthDate: "2026-01-01",
    timezone: "UTC",
  });
  await request(
    owner,
    "mutate",
    {
      ...m,
      id: randomUUID(),
      expectedVersion: 2,
      record: { ...first.record, householdId: other },
    },
    403,
  );
  ok("record ownership cannot be changed by payload");
  console.log(`${passed} integration checks passed.`);
} finally {
  // These are isolated test households created by this script, not user records.
  const postgres = (await import("postgres")).default;
  const sql = postgres(
    process.env.DATABASE_URL ||
      "postgres://wag:wag_local_only@127.0.0.1:54329/wag",
    { prepare: false },
  );
  await sql`delete from households where owner_id in (${owner},${stranger})`;
  await sql`delete from profiles where id in (${owner},${stranger},${caregiver})`;
  await sql.end();
}
