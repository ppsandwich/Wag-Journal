import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const container = "wag-journal-postgres";
const suffix = randomUUID().replaceAll("-", "").slice(0, 12),
  database = `wag_restore_${suffix}`;
const run = (...args) =>
  execFileSync("docker", ["exec", container, ...args], {
    maxBuffer: 20 * 1024 * 1024,
  });
let created = false;
const fixture = randomUUID();
try {
  run(
    "psql",
    "-U",
    "wag",
    "-d",
    "wag",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `insert into profiles(id,email,name) values('${fixture}','restore-test@local.test','Restore test'); insert into households(id,owner_id,data) values('${fixture}','${fixture}','{"puppy":"Restore sentinel"}'::jsonb); insert into records(id,household_id,kind,data) values('${fixture}','${fixture}','event','{"type":"meal","notes":"Restoration preserves this observation"}'::jsonb);`,
  );
  const dump = run("pg_dump", "-U", "wag", "-d", "wag", "-Fc");
  run("createdb", "-U", "wag", database);
  created = true;
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "pg_restore",
      "-U",
      "wag",
      "-d",
      database,
      "--exit-on-error",
    ],
    { input: dump, maxBuffer: 20 * 1024 * 1024 },
  );
  const sql =
    "select count(*) from pg_tables where schemaname='public' and rowsecurity";
  const before = run("psql", "-U", "wag", "-d", "wag", "-Atc", sql)
    .toString()
    .trim();
  const after = run("psql", "-U", "wag", "-d", database, "-Atc", sql)
    .toString()
    .trim();
  assert.equal(after, before);
  assert.ok(Number(after) >= 13);
  const count =
    "select (select count(*) from households)||':'||(select count(*) from records)||':'||(select count(*) from history)";
  assert.equal(
    run("psql", "-U", "wag", "-d", database, "-Atc", count).toString(),
    run("psql", "-U", "wag", "-d", "wag", "-Atc", count).toString(),
  );
  assert.equal(
    run(
      "psql",
      "-U",
      "wag",
      "-d",
      database,
      "-Atc",
      `select data->>'notes' from records where id='${fixture}'`,
    )
      .toString()
      .trim(),
    "Restoration preserves this observation",
  );
  console.log(
    `Local PostgreSQL backup restored successfully; ${after} RLS-protected tables and household/record/history counts match.`,
  );
  console.log(
    "Managed-provider restoration, backup retention and deletion replay still require deployment validation.",
  );
} finally {
  if (created) run("dropdb", "-U", "wag", database);
  run(
    "psql",
    "-U",
    "wag",
    "-d",
    "wag",
    "-c",
    `delete from households where id='${fixture}';delete from profiles where id='${fixture}';`,
  );
}
