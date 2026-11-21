import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createPool } from "../server/db.mjs";
import { pricingPolicy } from "../server/catalog.mjs";
import { setupDatabase } from "../scripts/db.mjs";

// Runs the real startup setup (`node scripts/db.mjs init`) against a disposable database.
async function setupTestDatabase(t) {
  const name = `cinecircle_test_seed_${randomBytes(5).toString("hex")}`;
  const previous = process.env.DB_NAME;
  process.env.DB_NAME = name;
  const pool = createPool({ database: name });
  const admin = createPool({ database: undefined });
  t.after(async () => {
    if (previous === undefined) delete process.env.DB_NAME;
    else process.env.DB_NAME = previous;
    await pool.end();
    try {
      await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
    } finally {
      await admin.end();
    }
  });
  // Setup reports what it did on the console; keep the test output to the results.
  const restart = async () => {
    const log = console.log;
    console.log = () => {};
    try {
      await setupDatabase();
    } finally {
      console.log = log;
    }
  };
  await restart();
  return { pool, restart };
}
const demoCounts = async (pool) => {
  const [[counts]] = await pool.query(
    `SELECT (SELECT COUNT(*) FROM review_comment) AS comments,(SELECT COUNT(*) FROM comment_like) AS commentLikes,
    (SELECT COUNT(*) FROM list_bookmark) AS bookmarks,(SELECT COUNT(*) FROM users WHERE username='eleanor') AS eleanor`,
  );
  return counts;
};

test("sample tickets are priced and discounted by the checkout rules for their screening", async (t) => {
  const { pool } = await setupTestDatabase(t);
  const [tickets] = await pool.query(
    `SELECT t.price,st.seat_number AS seat,st.seat_type AS type,s.start_time AS startTime,td.discount_id AS discountId
    FROM ticket t JOIN screening s USING(screening_id)
    JOIN screening_seat ss ON ss.screening_id=t.screening_id AND ss.screening_seat_id=t.screening_seat_id
    JOIN seat st ON st.cinema_id=ss.cinema_id AND st.hall_id=ss.hall_id AND st.seat_id=ss.seat_id
    LEFT JOIN ticket_discount td USING(ticket_id) ORDER BY st.seat_number`,
  );
  assert.deepEqual(
    tickets.map((t) => [t.seat, t.type]),
    [
      ["C3", "standard"],
      ["C4", "standard"],
      ["D5", "premium"],
    ],
  );
  // Independent of the checkout code: a 13:00 screening is a matinee, the weekday matinee
  // offer takes HK$8 off on Monday to Friday only, and premium seats cost HK$25 more.
  const startTime = tickets[0].startTime;
  assert.equal(startTime.slice(11, 16), "13:00");
  const day = new Date(`${startTime.slice(0, 10)}T12:00:00Z`).getUTCDay();
  const weekday = day > 0 && day < 6;
  for (const ticket of tickets) {
    const base =
      pricingPolicy.matinee +
      (ticket.type === "premium" ? pricingPolicy.premiumSeatExtra : 0);
    assert.equal(Number(ticket.price), weekday ? base - 8 : base, ticket.seat);
    assert.equal(ticket.discountId, weekday ? 1 : null, ticket.seat);
  }
  const [[{ booked }]] = await pool.query(
    "SELECT COUNT(*) AS booked FROM screening_seat WHERE screening_id=1 AND status='booked'",
  );
  assert.equal(booked, 3);
});

test("demo comments and bookmarks arrive once with their tables and are not restored after deletion", async (t) => {
  const { pool, restart } = await setupTestDatabase(t);
  assert.deepEqual(await demoCounts(pool), {
    comments: 11,
    commentLikes: 5,
    bookmarks: 7,
    eleanor: 1,
  });

  // A database from before comments and bookmarks existed gains them, with their demo rows, once.
  await pool.query("DROP TABLE comment_like, review_comment, list_bookmark");
  await restart();
  assert.deepEqual(await demoCounts(pool), {
    comments: 11,
    commentLikes: 5,
    bookmarks: 7,
    eleanor: 1,
  });
  await restart();
  assert.deepEqual(await demoCounts(pool), {
    comments: 11,
    commentLikes: 5,
    bookmarks: 7,
    eleanor: 1,
  });

  // Members removed every comment and bookmark, and the classic members deleted their
  // accounts (which renames them). A restart leaves all of that as it is.
  await pool.query("DELETE FROM comment_like");
  await pool.query("DELETE FROM review_comment ORDER BY comment_id DESC");
  await pool.query("DELETE FROM list_bookmark");
  await pool.query(
    "UPDATE users SET username=CONCAT('deleted-member-',user_id),deleted_date=NOW() WHERE username IN ('eleanor','theo','rosa','sam')",
  );
  await restart();
  assert.deepEqual(await demoCounts(pool), {
    comments: 0,
    commentLikes: 0,
    bookmarks: 0,
    eleanor: 0,
  });
});
