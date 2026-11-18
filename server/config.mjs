import "dotenv/config";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const localDir = path.join(root, ".local");
// True once a connection was chosen in .env (by `npm run setup`) or the environment.
export const dbConfigured = () =>
  Boolean(process.env.DB_HOST || process.env.DB_SOCKET || process.env.DB_USER);
// Read on every call so that settings entered by the setup wizard apply immediately.
export function dbOptions() {
  return {
    ...(process.env.DB_SOCKET
      ? { socketPath: process.env.DB_SOCKET }
      : {
          host: process.env.DB_HOST || "127.0.0.1",
          port: Number(process.env.DB_PORT || 3306),
        }),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "cinecircle",
    timezone: "+08:00",
    dateStrings: true,
    decimalNumbers: true,
    connectionLimit: 10,
    charset: "utf8mb4",
  };
}
export function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  mkdirSync(localDir, { recursive: true });
  const file = path.join(localDir, "session-secret");
  try {
    return readFileSync(file, "utf8");
  } catch {
    const value = randomBytes(32).toString("hex");
    writeFileSync(file, value, { mode: 0o600 });
    return value;
  }
}
