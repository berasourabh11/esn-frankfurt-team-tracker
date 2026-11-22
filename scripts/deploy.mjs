// Deploys the API (backend/) and the website to Cloudflare.
//
//   node scripts/deploy.mjs            API + database migrations + website
//   node scripts/deploy.mjs --web      website only
//   node scripts/deploy.mjs --api      API + migrations only
//
// Addresses come from deploy.config.json. Needs `npx wrangler login` once.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(join(root, "deploy.config.json"), "utf8"));
const siteUrl = config.siteUrl.replace(/\/+$/, "");
const apiUrl = config.apiUrl.replace(/\/+$/, "");
const only = process.argv.find((a) => a === "--web" || a === "--api");

function run(command, args, { cwd = root, env = {} } = {}) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (only !== "--web") {
  const backend = join(root, "backend");
  run("npx", ["wrangler", "d1", "migrations", "apply", "esn-frankfurt", "--remote"], {
    cwd: backend,
    env: { CI: "true" }, // no confirmation prompt
  });
  run("npx", ["wrangler", "deploy"], { cwd: backend });
}

if (only !== "--api") {
  // NEXT_PUBLIC_* values are built into the website, so they are set here
  // (they take precedence over .env.local, which points at localhost).
  const env = {
    NEXT_PUBLIC_SITE_URL: siteUrl,
    NEXT_PUBLIC_API_BASE_URL: apiUrl,
    EVENTS_API_BASE_URL: apiUrl,
  };
  run("npx", ["opennextjs-cloudflare", "build"], { env });
  run("npx", ["opennextjs-cloudflare", "deploy"], { env });
}

console.log(`\nDone. Website: ${siteUrl}  API: ${apiUrl}`);
