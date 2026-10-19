import { readdirSync, existsSync } from "node:fs";
const routes = readdirSync("api").filter((f) => /\.(rs|ts|js)$/.test(f));
if (routes.length > 12)
  throw new Error(`API budget exceeded: ${routes.length}`);
console.log(`API entrypoints: ${routes.length}/12`);
if (existsSync(".vercel/output/functions")) {
  const count = (p) =>
    readdirSync(p, { withFileTypes: true }).reduce(
      (n, f) =>
        n +
        (f.name.endsWith(".func")
          ? 1
          : f.isDirectory()
            ? count(`${p}/${f.name}`)
            : 0),
      0,
    );
  const n = count(".vercel/output/functions");
  if (n > 12) throw new Error(`Function budget exceeded: ${n}`);
  console.log(`Deployed function artifacts: ${n}/12`);
} else
  console.log("Deployment artifact count will be checked after vercel build.");
