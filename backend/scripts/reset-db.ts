/** Deletes the local development database; the next `npm run dev` recreates and re-seeds it. */
import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const file = join(dirname(fileURLToPath(import.meta.url)), "..", ".data", "esn.sqlite");
for (const suffix of ["", "-wal", "-shm"]) {
  if (existsSync(file + suffix)) rmSync(file + suffix);
}
console.log(`Removed ${file}`);
