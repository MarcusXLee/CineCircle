import { createPool } from "./db.mjs";
import { createApp } from "./app.mjs";
import { sessionSecret } from "./config.mjs";
import { refreshSchedule } from "./seed.mjs";
import { expireMemberships } from "./routes/membership.mjs";
const pool = createPool();
await pool.query("SELECT 1");
const expire = () =>
  expireMemberships(pool).catch((error) =>
    console.error("Membership check failed:", error.message),
  );
await expire();
const host = process.env.HOST || "127.0.0.1",
  port = Number(process.env.PORT || 3001);
export const server = createApp({
  pool,
  sessionSecret: sessionSecret(),
}).listen(port, host, () =>
  console.log(`CineCircle API: http://${host}:${port}`),
);
// Screenings are dated relative to today. While the site keeps running, top up the
// programme every hour so it never runs out of upcoming days or leaves a film unscheduled,
// and move members whose premium membership has ended back to regular.
const refresh = setInterval(
  () => {
    refreshSchedule(pool).catch((error) =>
      console.error("Schedule refresh failed:", error.message),
    );
    expire();
  },
  60 * 60 * 1000,
);
refresh.unref();
server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `Port ${port} is already in use. CineCircle may already be running at http://localhost:${port}; otherwise add PORT=3002 to .env.`
      : error.message,
  );
  process.exit(1);
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      clearInterval(refresh);
      await pool.end();
      process.exit(0);
    }),
  );
