import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { waitForDatabase } from "./db.mjs";
import { initializeDatabase, createPool } from "../server/db.mjs";
import { seedDatabase } from "../server/seed.mjs";
import { createApp } from "../server/app.mjs";
await waitForDatabase();
const database = `cinecircle_test_browser_${randomBytes(5).toString("hex")}`;
await initializeDatabase(database);
const pool = createPool({ database });
await seedDatabase(pool);
const server = createApp({
  pool,
  sessionSecret: randomBytes(32).toString("hex"),
}).listen(3002, "127.0.0.1");
const client = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"],
  {
    stdio: "inherit",
    env: { ...process.env, VITE_PORT: "5174", API_PORT: "3002" },
  },
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  client.kill();
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
  const admin = createPool({ database: undefined });
  await admin.query(`DROP DATABASE \`${database}\``);
  await admin.end();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
client.on("exit", stop);
