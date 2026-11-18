import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { randomBytes } from "node:crypto";

let app, pool, adminPool, mia, alex;
const database = `cinecircle_test_${randomBytes(5).toString("hex")}`;
before(async () => {
  const module = await import("../server/app.mjs").catch(() => ({}));
  assert.equal(
    typeof module.createApp,
    "function",
    "The backend must expose a working createApp factory",
  );
  const db = await import("../server/db.mjs");
  const { seedDatabase } = await import("../server/seed.mjs");
  await db.initializeDatabase(database);
  pool = db.createPool({ database });
  adminPool = db.createPool({ database: undefined });
  await seedDatabase(pool);
  app = module.createApp({
    pool,
    sessionSecret: randomBytes(32).toString("hex"),
  });
  mia = request.agent(app);
  alex = request.agent(app);
  assert.equal(
    (
      await mia
        .post("/api/auth/login")
        .send({ username: "mia", password: "Cinema2026!" })
    ).status,
    200,
  );
  assert.equal(
    (
      await alex
        .post("/api/auth/login")
        .send({ username: "alex", password: "Cinema2026!" })
    ).status,
    200,
  );
});
after(async () => {
  if (pool) await pool.end();
  if (adminPool) {
    await adminPool.query(`DROP DATABASE \`${database}\``);
    await adminPool.end();
  }
});

test("catalog searches and genres come from the 22-table database", async () => {
  const [tables] = await pool.query("SHOW TABLES");
  assert.equal(tables.length, 22);
  const res = await request(app).get("/api/movies?q=Mood");
  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.movies.map((m) => m.title),
    ["In the Mood for Love"],
  );
  assert.ok(res.body.movies[0].poster.startsWith("/images/"));
  const genre = await request(app).get("/api/movies?genre=Animation");
  assert.ok(genre.body.movies.length > 0);
  assert.ok(genre.body.movies.every((m) => m.genres.includes("Animation")));
  assert.equal(
    (await request(app).get("/api/movies/1%20OR%201=1")).status,
    400,
  );
});

test("registration persists account, rejects duplicates, authenticates, and logs out", async () => {
  const agent = request.agent(app);
  assert.equal((await agent.get("/api/session")).body.user, null);
  assert.equal(
    (
      await agent
        .post("/api/auth/login")
        .send({ username: "mia", password: "wrong" })
    ).status,
    401,
  );
  const res = await agent.post("/api/auth/register").send({
    username: "newmember",
    email: "new@example.test",
    password: "SafePass2026!",
  });
  assert.equal(res.status, 201);
  assert.equal(
    (await agent.get("/api/session")).body.user.username,
    "newmember",
  );
  assert.equal(
    (
      await request(app).post("/api/auth/register").send({
        username: "newmember",
        email: "other@example.test",
        password: "SafePass2026!",
      })
    ).status,
    409,
  );
  const [[user]] = await pool.execute(
    "SELECT password_hash FROM users WHERE username=?",
    ["newmember"],
  );
  assert.ok(user.password_hash.startsWith("scrypt:"));
  assert.ok(!user.password_hash.includes("SafePass"));
  const duplicateEmail = await request(app).post("/api/auth/register").send({
    username: "another_member",
    email: "NEW@example.test",
    password: "SafePass2026!",
  });
  assert.equal(duplicateEmail.status, 409);
  await agent.post("/api/auth/logout");
  assert.equal((await agent.get("/api/session")).body.user, null);
  assert.equal((await agent.put("/api/me/watchlist/1")).status, 401);
  assert.equal(
    (
      await mia
        .post("/api/auth/logout")
        .set("Origin", "https://foreign.example")
    ).status,
    403,
  );
});

test("review CRUD enforces author ownership, rating bounds, and deletes dependent likes", async () => {
  const res = await mia
    .put("/api/movies/12/my-review")
    .send({ rating: 8.5, text: "A beautiful film, worth another watch." });
  assert.equal(res.status, 200);
  const id = res.body.review.reviewId;
  const resubmit = await mia
    .put("/api/movies/12/my-review")
    .send({ rating: 8, text: "A second thought about the same film." });
  assert.equal(resubmit.status, 200);
  assert.equal(resubmit.body.review.reviewId, id);
  assert.equal(
    (
      await alex
        .patch(`/api/reviews/${id}`)
        .send({ rating: 1, text: "Hijacked" })
    ).status,
    403,
  );
  assert.equal(
    (await mia.patch(`/api/reviews/${id}`).send({ rating: 11 })).status,
    400,
  );
  assert.equal(
    (
      await mia
        .patch(`/api/reviews/${id}`)
        .send({ rating: 9, text: "Edited review." })
    ).status,
    200,
  );
  assert.equal((await alex.put(`/api/reviews/${id}/like`)).status, 200);
  const detail = await mia.get("/api/movies/12");
  assert.ok(
    detail.body.reviews.some(
      (r) => r.reviewId === id && r.text === "Edited review." && r.likes === 1,
    ),
  );
  assert.equal((await mia.delete(`/api/reviews/${id}`)).status, 200);
  const [[count]] = await pool.execute(
    "SELECT COUNT(*) AS n FROM review_like WHERE review_id=?",
    [id],
  );
  assert.equal(count.n, 0);
});

test("watchlist and watched date persist independently of the browser", async () => {
  await mia.put("/api/me/watchlist/12");
  assert.ok(
    (await mia.get("/api/me/library")).body.watchlist.some(
      (m) => m.movieId === 12,
    ),
  );
  const marked = await mia
    .put("/api/me/watched/12")
    .send({ date: "2026-10-01" });
  assert.equal(marked.status, 200);
  const library = (await mia.get("/api/me/library")).body;
  assert.ok(!library.watchlist.some((m) => m.movieId === 12));
  assert.ok(
    library.watched.some(
      (m) => m.movieId === 12 && m.watchDate.startsWith("2026-10-01"),
    ),
  );
  assert.equal(
    (await mia.put("/api/me/watched/12").send({ date: "2026-02-31" })).status,
    400,
  );
  await mia.delete("/api/me/watched/12");
});

test("list CRUD protects privacy, preserves exact order, and removes children", async () => {
  const created = await mia.post("/api/lists").send({
    name: "Weekend discoveries",
    description: "Test list",
    visibility: "private",
  });
  assert.equal(created.status, 201);
  const { userId, listId } = created.body.list;
  const path = `/api/lists/${userId}/${listId}`;
  assert.equal((await alex.get(path)).status, 404);
  assert.equal((await alex.patch(path).send({ name: "Stolen" })).status, 403);
  assert.equal(
    (await mia.post(`${path}/movies`).send({ movieId: 3 })).status,
    200,
  );
  assert.equal(
    (await mia.post(`${path}/movies`).send({ movieId: 4 })).status,
    200,
  );
  assert.equal(
    (await mia.put(`${path}/order`).send({ movieIds: [4, 3] })).status,
    200,
  );
  assert.equal(
    (await mia.put(`${path}/order`).send({ movieIds: [4, 99] })).status,
    409,
  );
  assert.deepEqual(
    (await mia.get(path)).body.movies.map((m) => m.movieId),
    [4, 3],
  );
  await mia
    .patch(path)
    .send({ name: "Public discoveries", visibility: "public" });
  assert.equal(
    (await request(app).get(path)).body.list.name,
    "Public discoveries",
  );
  assert.equal((await mia.delete(path)).status, 200);
  assert.equal((await mia.get(path)).status, 404);
});

test("concurrent list creation assigns distinct owner-local IDs", async () => {
  const responses = await Promise.all(
    ["One", "Two"].map((name) =>
      mia.post("/api/lists").send({ name, visibility: "private" }),
    ),
  );
  assert.ok(responses.every((r) => r.status === 201));
  assert.notEqual(responses[0].body.list.listId, responses[1].body.list.listId);
  for (const r of responses)
    await mia.delete(`/api/lists/${r.body.list.userId}/${r.body.list.listId}`);
});

test("follow relations and public profiles are persisted, self-follow is rejected", async () => {
  assert.equal((await mia.put("/api/users/3/follow")).status, 200);
  assert.equal((await mia.get("/api/users/3")).body.profile.following, true);
  assert.equal((await mia.put("/api/users/1/follow")).status, 400);
  await mia.delete("/api/users/3/follow");
  assert.equal((await mia.get("/api/users/3")).body.profile.following, false);
});

test("long lists are paged with offset and report whether more remain", async () => {
  const all = (await request(app).get("/api/movies?sort=title")).body;
  assert.equal(all.more, false);
  const first = (await request(app).get("/api/movies?sort=title&limit=5")).body;
  const last = all.movies.length - 3;
  const second = (
    await request(app).get(`/api/movies?sort=title&limit=5&offset=${last}`)
  ).body;
  assert.equal(first.total, all.movies.length);
  assert.deepEqual(
    first.movies.map((m) => m.movieId),
    all.movies.slice(0, 5).map((m) => m.movieId),
  );
  assert.equal(first.more, true);
  assert.equal(second.movies.length, 3);
  assert.equal(second.more, false);
  const reviews = (await request(app).get("/api/reviews?limit=3")).body;
  assert.equal(reviews.reviews.length, 3);
  assert.equal(reviews.more, true);
  const byAlex = (await request(app).get("/api/reviews?userId=2")).body;
  assert.ok(byAlex.reviews.every((r) => r.userId === 2));
  const profile = (await request(app).get("/api/users/2")).body;
  assert.equal(profile.profile.reviewCount, byAlex.reviews.length);
  assert.equal(profile.more.reviews, false);
  assert.equal((await request(app).get("/api/users?limit=2")).body.more, true);
  const publicLists = (await mia.get("/api/lists?public=1")).body.lists;
  assert.ok(publicLists.every((l) => l.visibility === "public"));
  const film = (await alex.get("/api/movies/1")).body;
  assert.equal(film.myReview.userId, 2);
  assert.equal((await request(app).get("/api/movies/1")).body.myReview, null);
});

test("premium quote is server-calculated; simultaneous buyers cannot obtain the same seat", async () => {
  const screen = (await mia.get("/api/screenings/1")).body;
  assert.equal(screen.screening.movieId, 1);
  const seatId = screen.seats.find(
    (s) => s.status === "available" && s.type === "standard",
  ).screeningSeatId;
  const premium = await mia
    .post("/api/bookings/quote")
    .send({ screeningId: 1, seatIds: [seatId] });
  const regular = await alex
    .post("/api/bookings/quote")
    .send({ screeningId: 1, seatIds: [seatId] });
  assert.equal(premium.status, 200);
  assert.ok(premium.body.total < regular.body.total);
  const results = await Promise.all(
    [mia, alex].map((agent) =>
      agent
        .post("/api/bookings")
        .send({ screeningId: 1, seatIds: [seatId], price: 0 }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const [[count]] = await pool.execute(
    "SELECT COUNT(*) AS n FROM ticket WHERE screening_id=1 AND screening_seat_id=?",
    [seatId],
  );
  assert.equal(count.n, 1);
  const [[seat]] = await pool.execute(
    "SELECT status FROM screening_seat WHERE screening_id=1 AND screening_seat_id=?",
    [seatId],
  );
  assert.equal(seat.status, "booked");
  assert.ok(results.find((r) => r.status === 201).body.tickets[0].price > 0);
});

test("unavailable or nonexistent seats roll back a multi-seat booking; history is owner-only", async () => {
  const seats = (await mia.get("/api/screenings/1")).body.seats;
  const free = seats.find((s) => s.status === "available").screeningSeatId;
  const sold = seats.find((s) => s.status === "booked").screeningSeatId;
  assert.equal(
    (
      await mia
        .post("/api/bookings")
        .send({ screeningId: 1, seatIds: [free, sold] })
    ).status,
    409,
  );
  assert.equal(
    (
      await mia
        .post("/api/bookings")
        .send({ screeningId: 1, seatIds: [free, 99999] })
    ).status,
    400,
  );
  const [[seat]] = await pool.execute(
    "SELECT status FROM screening_seat WHERE screening_id=1 AND screening_seat_id=?",
    [free],
  );
  assert.equal(seat.status, "available");
  const history = await mia.get("/api/me/tickets");
  assert.equal(history.status, 200);
  assert.ok(history.body.tickets.every((t) => t.userId === 1));
  assert.equal((await request(app).get("/api/me/tickets")).status, 401);
});

test("passwords preserve intentional leading and trailing whitespace", async () => {
  const agent = request.agent(app),
    password = "  WithSpace2026!  ";
  assert.equal(
    (
      await agent.post("/api/auth/register").send({
        username: "space_member",
        email: "space@example.test",
        password,
      })
    ).status,
    201,
  );
  await agent.post("/api/auth/logout");
  assert.equal(
    (
      await agent
        .post("/api/auth/login")
        .send({ username: "space_member", password })
    ).status,
    200,
  );
});

test("watched dates reject tomorrow in the Hong Kong calendar", async () => {
  const current = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const tomorrow = new Date(Date.parse(current + "T12:00:00Z") + 86400000)
    .toISOString()
    .slice(0, 10);
  assert.equal(
    (await mia.put("/api/me/watched/12").send({ date: tomorrow })).status,
    400,
  );
  // Casablanca (1942) cannot have been watched in 1930.
  const early = await mia
    .put("/api/me/watched/13")
    .send({ date: "1930-05-01" });
  assert.equal(early.status, 400);
  assert.match(early.body.error, /1942/);
  assert.equal(
    (await mia.put("/api/me/watched/13").send({ date: "1942-06-01" })).status,
    200,
  );
});

test("every film gets upcoming screenings without overlapping another in its hall", async () => {
  const { scheduleEveryFilm } = await import("../server/seed.mjs");
  // Like a film added to an older database: it has no screenings yet.
  await pool.query(
    "DELETE ss FROM screening_seat ss JOIN screening s USING(screening_id) WHERE s.movie_id=22",
  );
  await pool.query("DELETE FROM screening WHERE movie_id=22");
  assert.equal(await scheduleEveryFilm(pool), 2);
  assert.equal(await scheduleEveryFilm(pool), 0);
  const [mornings] = await pool.query(
    "SELECT TIME(start_time) AS start,TIME(end_time) AS end FROM screening WHERE movie_id=22",
  );
  // It's a Wonderful Life runs 130 minutes: 10:30 to 12:40, clear of the 13:00 show.
  assert.deepEqual(
    mornings.map((m) => m.start + "-" + m.end),
    ["10:30:00-12:40:00", "10:30:00-12:40:00"],
  );
  const [[{ short }]] = await pool.query(
    `SELECT COUNT(*) AS short FROM movie m WHERE (SELECT COUNT(*) FROM screening s
      WHERE s.movie_id=m.movie_id AND s.start_time>NOW()
      AND s.start_time<DATE_ADD(CURRENT_DATE,INTERVAL 11 DAY))<2`,
  );
  assert.equal(short, 0);
  const [[{ overlaps }]] = await pool.query(
    `SELECT COUNT(*) AS overlaps FROM screening a JOIN screening b
      ON a.cinema_id=b.cinema_id AND a.hall_id=b.hall_id AND a.screening_id<b.screening_id
      AND a.start_time<b.end_time AND b.start_time<a.end_time`,
  );
  assert.equal(overlaps, 0);
  // The new screenings are bookable: every seat starts available.
  const [[latest]] = await pool.query(
    "SELECT screening_id AS id FROM screening ORDER BY screening_id DESC LIMIT 1",
  );
  const seats = (await request(app).get(`/api/screenings/${latest.id}`)).body
    .seats;
  assert.equal(seats.filter((x) => x.status === "available").length, 48);
});

test("unsupported and prototype-named sort modes are rejected without a server error", async () => {
  for (const sort of ["constructor", "__proto__", "unknown"]) {
    const res = await request(app).get("/api/movies").query({ sort });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "Choose a valid film sort order.");
  }
});

test("setup refills empty upcoming days and leaves existing screenings unchanged", async () => {
  const { extendSchedule } = await import("../server/seed.mjs");
  assert.equal(await extendSchedule(pool), 0);
  // Simulate an older database whose schedule ends after day 5.
  const [kept] = await pool.query(
    "SELECT * FROM screening WHERE start_time<CURRENT_DATE+INTERVAL 6 DAY ORDER BY screening_id",
  );
  await pool.query(
    "DELETE ss FROM screening_seat ss JOIN screening s USING(screening_id) WHERE s.start_time>=CURRENT_DATE+INTERVAL 6 DAY",
  );
  await pool.query(
    "DELETE FROM screening WHERE start_time>=CURRENT_DATE+INTERVAL 6 DAY",
  );
  assert.equal(await extendSchedule(pool), 5);
  assert.equal(await extendSchedule(pool), 0);
  const [[after]] = await pool.query(
    "SELECT COUNT(*) AS screenings,COUNT(DISTINCT DATE(start_time)) AS days,(SELECT COUNT(*) FROM screening_seat ss JOIN screening s2 USING(screening_id) WHERE s2.start_time>=CURRENT_DATE+INTERVAL 6 DAY) AS seats FROM screening WHERE start_time>=CURRENT_DATE+INTERVAL 6 DAY",
  );
  assert.deepEqual(after, { screenings: 30, days: 5, seats: 30 * 48 });
  const [unchanged] = await pool.query(
    "SELECT * FROM screening WHERE start_time<CURRENT_DATE+INTERVAL 6 DAY ORDER BY screening_id",
  );
  assert.deepEqual(unchanged, kept);
  const [[{ newId }]] = await pool.query(
    "SELECT MAX(screening_id) AS newId FROM screening",
  );
  const res = await request(app).get(`/api/screenings/${newId}`);
  assert.equal(res.status, 200);
  assert.equal(
    res.body.seats.filter((s) => s.status === "available").length,
    48,
  );
});

test("a database failure after the first ticket write rolls back tickets, discounts and seat status", async (t) => {
  const reported = [];
  t.mock.method(console, "error", (error) => reported.push(error));
  const [[before]] = await pool.query(
    "SELECT (SELECT COUNT(*) FROM ticket) AS tickets,(SELECT COUNT(*) FROM ticket_discount) AS discounts",
  );
  await pool.query(`CREATE TRIGGER fail_second_test_ticket BEFORE INSERT ON ticket FOR EACH ROW
    BEGIN
      IF NEW.screening_id=1 AND NEW.screening_seat_id=3 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected failure after first ticket write';
      END IF;
    END`);
  try {
    const response = await alex
      .post("/api/bookings")
      .send({ screeningId: 1, seatIds: [2, 3] });
    assert.equal(response.status, 500);
    assert.ok(reported.some((error) => error.code === "ER_SIGNAL_EXCEPTION"));
    const [[after]] = await pool.query(
      "SELECT (SELECT COUNT(*) FROM ticket) AS tickets,(SELECT COUNT(*) FROM ticket_discount) AS discounts",
    );
    assert.deepEqual(after, before);
    const [seats] = await pool.query(
      "SELECT status FROM screening_seat WHERE screening_id=1 AND screening_seat_id IN(2,3)",
    );
    assert.deepEqual(
      seats.map((s) => s.status),
      ["available", "available"],
    );
  } finally {
    await pool.query("DROP TRIGGER fail_second_test_ticket");
  }
});
