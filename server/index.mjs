import { createPool } from "./db.mjs";
import { createApp } from "./app.mjs";
import { sessionSecret } from "./config.mjs";
const pool = createPool();
await pool.query("SELECT 1");
const host = process.env.HOST || "127.0.0.1",
  port = Number(process.env.PORT || 3001);
export const server = createApp({
  pool,
  sessionSecret: sessionSecret(),
}).listen(port, host, () =>
  console.log(`CineCircle API: http://${host}:${port}`),
);
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
      await pool.end();
      process.exit(0);
    }),
  );
