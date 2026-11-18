import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { dbOptions } from "../server/config.mjs";
import { initializeDatabase, createPool } from "../server/db.mjs";
import {
  seedDatabase,
  extendCatalog,
  refreshSchedule,
} from "../server/seed.mjs";

const startHint = {
  darwin:
    "Start it with `brew services start mysql@8.4` (Homebrew), or System Settings → MySQL → Start MySQL Server (mysql.com installer).",
  win32:
    "Press Win+R, run services.msc, select the MySQL service (for example MySQL84) and click Start.",
  linux: "Start it with `sudo systemctl start mysql`.",
};
// Turns connection failures into instructions a first-time user can act on.
export function explain(error) {
  const o = dbOptions(),
    where = o.socketPath || `${o.host}:${o.port}`;
  if (["ECONNREFUSED", "ENOENT", "ETIMEDOUT", "ENOTFOUND"].includes(error.code))
    return `No MySQL server answered at ${where}. ${startHint[process.platform] || "Start your MySQL server."}`;
  if (error.code === "ER_ACCESS_DENIED_ERROR")
    return `MySQL rejected user "${o.user}" with that password. Run \`npm run setup\` to enter it again.`;
  if (error.code === "ER_NOT_SUPPORTED_AUTH_MODE")
    return "This MySQL account uses an authentication method Node.js cannot use. Use MySQL 8 with its default authentication.";
  return error.message;
}
// Connects once (or retries while a server such as the Docker `db` service starts) and checks the version.
export async function waitForDatabase({ retries = 0 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const c = await mysql.createConnection({
        ...dbOptions(),
        database: undefined,
        connectTimeout: 5000,
      });
      try {
        const [[{ version }]] = await c.query("SELECT VERSION() AS version");
        const [major, minor, patch] = version.split(/[.-]/).map(Number);
        if (
          /mariadb/i.test(version) ||
          major < 8 ||
          (major === 8 && minor === 0 && patch < 16)
        )
          throw new Error(
            `CineCircle needs MySQL 8.0.16 or newer; this server is ${version}.`,
          );
        return version;
      } finally {
        await c.end();
      }
    } catch (e) {
      const retryable = ["ECONNREFUSED", "ENOENT", "ETIMEDOUT"].includes(
        e.code,
      );
      if (!retryable || attempt >= retries) throw e;
      if (attempt === 0) console.log("Waiting for MySQL…");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}
export async function setupDatabase(options) {
  await waitForDatabase(options);
  const updated = await initializeDatabase();
  if (updated) console.log(`Added ${updated} revised database constraints.`);
  const pool = createPool();
  try {
    const seeded = await seedDatabase(pool);
    console.log(
      seeded
        ? "Loaded demo movies, members, lists and screenings."
        : "Existing data retained.",
    );
    const { films, members } = await extendCatalog(pool);
    if (films) console.log(`Added ${films} film(s) to the catalogue.`);
    if (members) console.log(`Added ${members} demo member(s).`);
    const { days, showings } = await refreshSchedule(pool);
    if (days) console.log(`Added screenings for ${days} upcoming day(s).`);
    if (showings)
      console.log(`Added ${showings} screening(s) so every film is showing.`);
  } finally {
    await pool.end();
  }
}
async function main() {
  const command = process.argv[2] || "init";
  // Docker starts the app while MySQL may still be starting, so wait up to 30 seconds there.
  if (command === "check") await waitForDatabase({ retries: 30 });
  else if (command === "init") await setupDatabase({ retries: 30 });
  else throw new Error("Use init or check.");
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((e) => {
    console.error(explain(e));
    process.exitCode = 1;
  });
