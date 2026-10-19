import postgres from "postgres";
import { readFileSync, readdirSync } from "node:fs";
if (!process.env.DATABASE_URL)
  throw Error("Set DATABASE_URL before running migrations.");
const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  prepare: false,
  onnotice: () => {},
});
try {
  for (const file of readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await sql.unsafe(readFileSync(`migrations/${file}`, "utf8"));
  console.log("Database schema applied.");
} finally {
  await sql.end();
}
