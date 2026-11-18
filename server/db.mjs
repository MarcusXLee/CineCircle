import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";
import { dbOptions } from "./config.mjs";

export function createPool(options = {}) {
  const pool = mysql.createPool({ ...dbOptions(), ...options });
  pool.on("connection", (connection) =>
    connection.query("SET time_zone = '+08:00'"),
  );
  return pool;
}
export async function transaction(pool, fn) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
const revisedConstraints = [
  { table: "users", name: "uq_users_username", columns: "username" },
  { table: "user_email", name: "uq_user_email", columns: "email" },
  {
    table: "review",
    name: "uq_review_user_movie",
    columns: "user_id, movie_id",
  },
  {
    table: "seat",
    name: "uq_seat_number",
    columns: "cinema_id, hall_id, seat_number",
  },
  {
    table: "follows",
    name: "chk_no_self_follow",
    check: "follower_id <> followed_id",
  },
];

async function addMissingConstraints(connection, database) {
  const [installed] = await connection.execute(
    `SELECT table_name AS tableName, constraint_name AS name,
            constraint_type AS type, enforced AS isEnforced
     FROM information_schema.table_constraints WHERE table_schema=?`,
    [database],
  );
  const pending = revisedConstraints.filter((rule) => {
    const existing = installed.find(
      ({ tableName, name }) => tableName === rule.table && name === rule.name,
    );
    if (!existing) return true;
    const expectedType = rule.columns ? "UNIQUE" : "CHECK";
    if (existing.type !== expectedType || existing.isEnforced !== "YES") {
      throw new Error(
        `Unexpected definition for ${rule.table}.${rule.name}. Review it before running setup again.`,
      );
    }
    return false;
  });
  if (!pending.length) return 0;

  await connection.query(`USE \`${database}\``);
  const conflicts = [];
  for (const { table, name, columns, check } of pending) {
    const condition = columns
      ? `GROUP BY ${columns} HAVING COUNT(*) > 1`
      : `WHERE NOT (${check})`;
    const [rows] = await connection.query(
      `SELECT 1 FROM \`${table}\` ${condition} LIMIT 1`,
    );
    if (rows.length) conflicts.push(`${table}.${name}`);
  }
  if (conflicts.length) {
    throw new Error(
      `Existing rows violate ${conflicts.join(", ")}. Review those rows and rerun npm run setup. No rows or constraints were changed.`,
    );
  }

  // MySQL commits each ALTER TABLE separately. On retry, skip rules already installed.
  for (const { table, name, columns, check } of pending) {
    const definition = columns ? `UNIQUE (${columns})` : `CHECK (${check})`;
    await connection.query(
      `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${name}\` ${definition}`,
    );
  }
  return pending.length;
}

export async function initializeDatabase(name = dbOptions().database) {
  if (!/^[a-zA-Z0-9_]{1,64}$/.test(name))
    throw new Error(
      "DB_NAME must contain 1–64 letters, numbers or underscores.",
    );
  const source = await readFile(
    new URL("../CineCircle_MySQL.sql", import.meta.url),
    "utf8",
  );
  const connection = await mysql.createConnection({
    ...dbOptions(),
    database: undefined,
    multipleStatements: true,
  });
  try {
    await connection.query("SET SESSION lock_wait_timeout = 10");
    // This connection owns the setup lock until it closes, including across DDL commits.
    const [[{ acquired }]] = await connection.query(
      "SELECT GET_LOCK('cinecircle-schema-setup', 10) AS acquired",
    );
    if (acquired !== 1)
      throw new Error(
        "CineCircle database setup is already in progress. Try again shortly.",
      );

    const [tables] = await connection.execute(
      "SELECT table_name AS name FROM information_schema.tables WHERE table_schema=? AND table_type='BASE TABLE'",
      [name],
    );
    if (tables.length) {
      const expected = new Set(
        Array.from(
          source.matchAll(/^CREATE TABLE `(\w+)`/gm),
          (match) => match[1],
        ),
      );
      if (
        tables.length !== expected.size ||
        tables.some(({ name }) => !expected.has(name))
      )
        throw new Error(
          `Database ${name} does not contain the expected CineCircle tables. No data was changed. Run npm run setup and choose another database name.`,
        );
      return await addMissingConstraints(connection, name);
    }
    const sql = source
      .replace(
        "CREATE DATABASE cinecircle",
        `CREATE DATABASE IF NOT EXISTS \`${name}\``,
      )
      .replace("USE cinecircle;", `USE \`${name}\`;`);
    await connection.query(sql);
    return 0;
  } finally {
    await connection.end();
  }
}
