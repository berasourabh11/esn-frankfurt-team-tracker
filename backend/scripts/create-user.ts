/**
 * Creates a member account, e.g. the first moderator of a fresh database.
 *
 *   npm run user:create            → local database (.data/esn.sqlite)
 *   npm run user:create -- --remote → Cloudflare D1 (needs `npx wrangler login`)
 *
 * After that, people register on the site and a moderator accepts them.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { MIN_PASSWORD_LENGTH, hashPassword } from "../src/lib/password";
import { newId, nowIso } from "../src/lib/util";
import { applyMigrations } from "../src/migrate";
import { openSqlite } from "../src/sqlite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const remote = process.argv.includes("--remote");
const windows = process.platform === "win32";

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Don't echo the password while it is typed.
      const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
      (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => {
        if (s.startsWith(question)) write.call(rl, s);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

const name = await ask("Name: ");
const email = (await ask("E-mail: ")).toLowerCase();
const role = (await ask("Role (admin/moderator/member/user) [admin]: ")) || "admin";
const team = await ask("Team (optional, e.g. Events): ");
const password = await ask(`Password (min. ${MIN_PASSWORD_LENGTH} characters): `, true);

if (name.length < 2 || !email.includes("@")) throw new Error("Enter a name and a valid e-mail.");
if (!["admin", "moderator", "member", "user"].includes(role)) throw new Error("Unknown role.");
if (password.length < MIN_PASSWORD_LENGTH) throw new Error("The password is too short.");

const q = (v: string | null) => (v === null ? "NULL" : `'${v.replace(/'/g, "''")}'`);
const now = nowIso();
const values = [
  newId("m"),
  name,
  email,
  role,
  "active",
  team || null,
  await hashPassword(password),
  now,
  now,
];
const statement = `INSERT INTO users (id, name, email, role, status, team, password_hash, created_at, updated_at) VALUES (${values.map(q).join(", ")});`;

if (remote) {
  // Passed as a file so no shell has to quote the SQL.
  mkdirSync(join(root, ".data"), { recursive: true });
  const sqlFile = join(root, ".data", "create-user.sql");
  writeFileSync(sqlFile, statement);
  const result = spawnSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      "esn-frankfurt",
      "--remote",
      "--yes",
      "--file",
      windows ? `"${sqlFile}"` : sqlFile,
    ],
    { cwd: root, stdio: "inherit", shell: windows },
  );
  unlinkSync(sqlFile);
  process.exit(result.status ?? 1);
} else {
  const file = process.env.DB_FILE ?? join(root, ".data", "esn.sqlite");
  mkdirSync(dirname(file), { recursive: true });
  const db = openSqlite(file);
  await applyMigrations(db, join(root, "migrations"));
  db.exec(statement);
  console.log(`Created ${role} account for ${email} in ${file}`);
}
