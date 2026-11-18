import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createPool, initializeDatabase } from "../server/db.mjs";

async function testDatabase(t) {
  const name = `cinecircle_test_schema_${randomBytes(5).toString("hex")}`;
  const admin = createPool({ database: undefined, multipleStatements: true });
  const pool = createPool({ database: name });
  t.after(async () => {
    await pool.end();
    try {
      await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
    } finally {
      await admin.end();
    }
  });
  return { name, admin, pool };
}

const fixture = [
  "INSERT INTO users(user_id,username,password_hash) VALUES (1,'first_member','fixture'),(2,'second_member','fixture')",
  "INSERT INTO user_email(user_id,email) VALUES (1,'first@example.test'),(1,'alternate@example.test')",
  "INSERT INTO movie(movie_id,title,duration,language) VALUES (1,'Test Film',90,'English')",
  "INSERT INTO review(user_id,movie_id,rating) VALUES (1,1,7),(2,1,8)",
  "INSERT INTO cinema(cinema_id,cinema_name,district,street) VALUES (1,'Test Cinema','Central','Test Street')",
  "INSERT INTO hall VALUES (1,1,'Hall One',8),(1,2,'Hall Two',8)",
  "INSERT INTO seat VALUES (1,1,1,'A1','standard'),(1,2,1,'A1','standard')",
  "INSERT INTO follows(follower_id,followed_id) VALUES (1,2)",
];

async function rejectInvalidWrites(pool) {
  const duplicates = [
    [
      "INSERT INTO users(username,password_hash) VALUES ('FIRST_MEMBER','fixture')",
      "uq_users_username",
    ],
    ["INSERT INTO user_email VALUES (2,'FIRST@example.test')", "uq_user_email"],
    [
      "INSERT INTO review(user_id,movie_id,rating) VALUES (1,1,9)",
      "uq_review_user_movie",
    ],
    ["INSERT INTO seat VALUES (1,1,2,'A1','standard')", "uq_seat_number"],
  ];
  for (const [sql, name] of duplicates) {
    await assert.rejects(pool.query(sql), {
      code: "ER_DUP_ENTRY",
      message: new RegExp(name),
    });
  }
  await assert.rejects(
    pool.query(
      "UPDATE follows SET followed_id=1 WHERE follower_id=1 AND followed_id=2",
    ),
    { code: "ER_CHECK_CONSTRAINT_VIOLATED", message: /chk_no_self_follow/ },
  );
}

test("fresh databases enforce the five revised rules while accepting valid rows", async (t) => {
  const { name, pool } = await testDatabase(t);
  await initializeDatabase(name);
  for (const sql of fixture) await pool.query(sql);
  await rejectInvalidWrites(pool);
});

test("legacy setup stops at conflicts, then upgrades in place and tolerates repeat setup", async (t) => {
  const { name, admin, pool } = await testDatabase(t);
  const original = await readFile(
    new URL("./fixtures/CineCircle_MySQL_before_revision.sql", import.meta.url),
    "utf8",
  );
  await admin.query(
    original
      .replace("CREATE DATABASE cinecircle", `CREATE DATABASE \`${name}\``)
      .replace("USE cinecircle;", `USE \`${name}\`;`),
  );
  for (const sql of fixture) await pool.query(sql);

  await pool.query("INSERT INTO follows(follower_id,followed_id) VALUES (2,2)");
  await assert.rejects(initializeDatabase(name), /chk_no_self_follow/);
  const [beforeUpgrade] = await pool.query(
    "SHOW INDEX FROM users WHERE Key_name='uq_users_username'",
  );
  assert.equal(
    beforeUpgrade.length,
    0,
    "A preflight conflict should stop the upgrade before any ALTER TABLE.",
  );
  const [[{ selfFollows }]] = await pool.query(
    "SELECT COUNT(*) AS selfFollows FROM follows WHERE follower_id=followed_id",
  );
  assert.equal(
    selfFollows,
    1,
    "Conflicting data must be retained for the owner to resolve.",
  );
  await pool.query("DELETE FROM follows WHERE follower_id=2 AND followed_id=2");

  const snapshotSql = "SELECT * FROM review ORDER BY review_id";
  const [before] = await pool.query(snapshotSql);
  await Promise.all([initializeDatabase(name), initializeDatabase(name)]);
  const [after] = await pool.query(snapshotSql);
  assert.deepEqual(after, before);
  await rejectInvalidWrites(pool);
});
