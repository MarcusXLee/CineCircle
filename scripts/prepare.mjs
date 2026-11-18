import { spawn, spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import path from "node:path";
import { root, dbConfigured, dbOptions } from "../server/config.mjs";
import { setupDatabase, waitForDatabase, explain } from "./db.mjs";

const envFile = path.join(root, ".env");
const dbKeys = [
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "DB_SOCKET",
];

// Saves the connection in .env, replacing earlier database lines and keeping any others.
function saveSettings(settings) {
  let lines = [];
  try {
    lines = readFileSync(envFile, "utf8")
      .split(/\r?\n/)
      .filter((line) => !dbKeys.some((key) => line.startsWith(key + "=")));
  } catch {}
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  for (const [key, value] of Object.entries(settings)) {
    const quote = ["'", '"', "`"].find((q) => !value.includes(q)) ?? "'";
    lines.push(`${key}=${quote}${value}${quote}`);
  }
  writeFileSync(envFile, lines.join("\n") + "\n", { mode: 0o600 });
}
function apply(settings) {
  delete process.env.DB_SOCKET;
  Object.assign(process.env, settings);
}
// Reads a line without echoing it, for the MySQL password.
function askHidden(prompt) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    stdout.write(prompt);
    let value = "";
    const finish = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
    };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") return (finish(), resolve(value));
        if (ch === "\u0003") return (finish(), process.exit(130));
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else if (ch >= " ") value += ch;
      }
    };
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();
    stdin.on("data", onData);
  });
}
// Interactive questions for the MySQL connection; repeats until the connection works.
export async function configure() {
  if (!process.stdin.isTTY) {
    if (dbConfigured()) return;
    console.error(
      "Run `npm run setup` in a terminal window to enter your MySQL connection.",
    );
    process.exit(1);
  }
  console.log(
    "\nCineCircle setup: connect to the MySQL server on this computer (MySQL 8.0.16 or newer).\nPress Enter to keep the value shown in [brackets].\n",
  );
  const current = dbOptions();
  for (;;) {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const ask = async (question, fallback) =>
      (await rl.question(`${question} [${fallback}]: `)).trim() || fallback;
    const settings = {
      DB_HOST: await ask("MySQL host", current.host || "127.0.0.1"),
      DB_PORT: await ask("Port", String(current.port || 3306)),
      DB_USER: await ask("User", current.user),
      DB_NAME: await ask("Database name to create or reuse", current.database),
    };
    rl.close();
    settings.DB_PASSWORD = await askHidden(
      current.password
        ? "Password (hidden; Enter keeps the saved one): "
        : "Password (hidden; Enter if none): ",
    );
    if (!settings.DB_PASSWORD) settings.DB_PASSWORD = current.password;
    apply(settings);
    try {
      const version = await waitForDatabase();
      saveSettings(settings);
      console.log(`Connected to MySQL ${version}. Settings saved in .env.\n`);
      return;
    } catch (e) {
      console.error(`\n${explain(e)}\n`);
      Object.assign(current, {
        host: settings.DB_HOST,
        port: settings.DB_PORT,
        user: settings.DB_USER,
        database: settings.DB_NAME,
      });
      const again = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      const retry = (await again.question("Try again? [Y/n]: ")).trim();
      again.close();
      if (/^n/i.test(retry)) process.exit(1);
    }
  }
}
// Makes sure a working connection exists, then creates the schema and demo data if needed.
export async function prepare() {
  try {
    if (!dbConfigured()) {
      // Many fresh installs (for example Homebrew MySQL) accept root without a password.
      try {
        await waitForDatabase();
        const o = dbOptions();
        saveSettings({
          DB_HOST: o.host,
          DB_PORT: String(o.port),
          DB_USER: o.user,
          DB_PASSWORD: "",
          DB_NAME: o.database,
        });
        console.log(`Using MySQL at ${o.host}:${o.port} as ${o.user}.`);
      } catch {
        await configure();
      }
    }
    await setupDatabase();
  } catch (e) {
    console.error(`\n${explain(e)}`);
    process.exit(1);
  }
}
function newest(entry) {
  const info = statSync(entry);
  if (!info.isDirectory()) return info.mtimeMs;
  return Math.max(
    info.mtimeMs,
    ...readdirSync(entry).map((name) => newest(path.join(entry, name))),
  );
}
// Builds the website when it is missing or older than its source files.
export function buildSite() {
  let built = 0;
  try {
    built = statSync(path.join(root, "dist", "index.html")).mtimeMs;
  } catch {}
  const sources = ["src", "public", "index.html", "vite.config.js"].map((p) =>
    newest(path.join(root, p)),
  );
  if (built > Math.max(...sources)) return;
  console.log("Building the website…");
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "node_modules/vite/bin/vite.js"),
      "build",
      "--logLevel",
      "warn",
    ],
    { cwd: root, stdio: "inherit" },
  );
  if (result.status !== 0) {
    console.error("Building the website failed. See the messages above.");
    process.exit(1);
  }
}
export function openBrowser(url) {
  const [cmd, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  spawn(cmd, args, { stdio: "ignore", detached: true })
    .on("error", () => {})
    .unref();
}
