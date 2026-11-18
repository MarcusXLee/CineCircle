// Entry point for `npm run setup` and `npm start`. Only Node built-ins are used before
// dependencies are confirmed, so a fresh download can start with a single command.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const command = process.argv[2];
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 18)) {
  console.error(
    `CineCircle needs Node.js 22.18 or newer; this computer has ${process.version}.\nInstall the LTS version from https://nodejs.org and try again.`,
  );
  process.exit(1);
}

function installed() {
  try {
    const marker = statSync(`${root}node_modules/.package-lock.json`);
    if (marker.mtimeMs < statSync(`${root}package-lock.json`).mtimeMs)
      return false;
    // A node_modules folder copied from another system lacks this system's build tool binary.
    return readdirSync(`${root}node_modules/@rolldown`).some((name) =>
      name.startsWith(`binding-${process.platform}-${process.arch}`),
    );
  } catch {
    return false;
  }
}
if (!installed()) {
  console.log("Installing dependencies (first run only, about a minute)…");
  const npm = process.env.npm_execpath;
  const result = npm
    ? spawnSync(process.execPath, [npm, "ci", "--no-audit", "--no-fund"], {
        cwd: root,
        stdio: "inherit",
      })
    : spawnSync("npm ci --no-audit --no-fund", {
        cwd: root,
        stdio: "inherit",
        shell: true,
      });
  if (result.status !== 0) {
    console.error("Installing dependencies failed. See the messages above.");
    process.exit(1);
  }
}

const { prepare, configure, buildSite, openBrowser } =
  await import("./prepare.mjs");
if (command === "setup") {
  await configure();
  await prepare();
  buildSite();
  console.log("\nSetup complete. Start CineCircle with: npm start");
  process.exit(0);
} else if (command === "start") {
  await prepare();
  buildSite();
  const { server } = await import("../server/index.mjs");
  const ready = () => {
    const url = `http://localhost:${server.address().port}`;
    console.log(
      `\nCineCircle is running at ${url}\nKeep this window open while you use it. Press Ctrl+C to stop.\n`,
    );
    if (!process.argv.includes("--no-open")) openBrowser(url);
  };
  if (server.listening) ready();
  else server.once("listening", ready);
} else {
  console.error("Use: node scripts/launch.mjs setup|start");
  process.exit(1);
}
