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

test("catalog searches and genres come from the 25-table database", async () => {
  const [tables] = await pool.query("SHOW TABLES");
  assert.equal(tables.length, 25);
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

test("comments take replies at any depth and likes; removing one removes its replies", async () => {
  const review = (await request(app).get("/api/reviews?userId=3&movieId=7"))
    .body.reviews[0];
  const post = (agent, text, parentId) =>
    agent
      .post(`/api/reviews/${review.reviewId}/comments`)
      .send({ text, parentId });
  const top = (await post(alex, "The docking scene!")).body.comment;
  const second = (await post(mia, "The music in that scene.", top.commentId))
    .body.comment;
  const third = (await post(alex, "Hans Zimmer on an organ.", second.commentId))
    .body.comment;
  assert.equal(second.parentId, top.commentId);
  // One review on its own, for links past the first page of a film's reviews.
  assert.deepEqual(
    (
      await request(app).get(`/api/reviews?reviewId=${review.reviewId}`)
    ).body.reviews.map((r) => r.reviewId),
    [review.reviewId],
  );
  // Each level lists only its own comments, with reply counts.
  const level = async (parent) =>
    (
      await request(app).get(
        `/api/reviews/${review.reviewId}/comments${parent ? `?parent=${parent}` : ""}`,
      )
    ).body.comments;
  const firstLevel = await level();
  assert.ok(firstLevel.every((c) => c.parentId === null));
  assert.equal(
    firstLevel.find((c) => c.commentId === top.commentId).replyCount,
    1,
  );
  assert.deepEqual(
    (await level(top.commentId)).map((c) => c.commentId),
    [second.commentId],
  );
  // The path to a deep comment runs from the top-level comment down.
  const path = (await request(app).get(`/api/comments/${third.commentId}/path`))
    .body.comments;
  assert.deepEqual(
    path.map((c) => c.commentId),
    [top.commentId, second.commentId, third.commentId],
  );
  // A reply cannot point at a comment under another review, through the API or in SQL.
  const other = (await request(app).get("/api/reviews?userId=2&movieId=11"))
    .body.reviews[0];
  const elsewhere = (
    await alex
      .post(`/api/reviews/${other.reviewId}/comments`)
      .send({ text: "Elsewhere." })
  ).body.comment;
  assert.equal(
    (await post(mia, "Wrong thread.", elsewhere.commentId)).status,
    404,
  );
  await assert.rejects(
    pool.query(
      "INSERT INTO review_comment(review_id,parent_comment_id,user_id,comment_text) VALUES(?,?,1,'Wrong thread.')",
      [review.reviewId, elsewhere.commentId],
    ),
    { code: "ER_NO_REFERENCED_ROW_2" },
  );
  // Likes: not on your own comment; counted and shown as liked for the viewer.
  assert.equal(
    (await alex.put(`/api/comments/${top.commentId}/like`)).status,
    400,
  );
  assert.equal(
    (await mia.put(`/api/comments/${top.commentId}/like`)).status,
    200,
  );
  assert.equal(
    (await mia.put(`/api/comments/${top.commentId}/like`)).status,
    200,
  );
  const liked = (
    await mia.get(`/api/reviews/${review.reviewId}/comments`)
  ).body.comments.find((c) => c.commentId === top.commentId);
  assert.equal(liked.likes, 1);
  assert.equal(liked.liked, true);
  await mia.put(`/api/comments/${third.commentId}/like`);
  // Removing the top comment removes the whole chain under it, and the likes on it.
  const removed = await alex.delete(`/api/comments/${top.commentId}`);
  assert.equal(removed.status, 200);
  assert.equal(removed.body.removed, 3);
  const [[{ comments, likes }]] = await pool.query(
    "SELECT (SELECT COUNT(*) FROM review_comment WHERE comment_id IN (?,?,?)) AS comments,(SELECT COUNT(*) FROM comment_like WHERE comment_id IN (?,?,?)) AS likes",
    [
      top.commentId,
      second.commentId,
      third.commentId,
      top.commentId,
      second.commentId,
      third.commentId,
    ],
  );
  assert.equal(comments, 0);
  assert.equal(likes, 0);
  await alex.delete(`/api/comments/${elsewhere.commentId}`);
});

test("replies from members you follow come first, marked as following", async () => {
  const review = (await request(app).get("/api/reviews?userId=3&movieId=7"))
    .body.reviews[0];
  // Noah (not followed by Mia) answers first; Alex (followed by Mia) answers later.
  const [early] = await pool.query(
    "INSERT INTO review_comment(review_id,user_id,comment_text,create_date) VALUES(?,3,'First in.',DATE_SUB(NOW(),INTERVAL 1 HOUR))",
    [review.reviewId],
  );
  const [late] = await pool.query(
    "INSERT INTO review_comment(review_id,user_id,comment_text) VALUES(?,2,'Later, but followed.')",
    [review.reviewId],
  );
  const order = async (agent) =>
    (await agent.get(`/api/reviews/${review.reviewId}/comments`)).body.comments
      .filter((c) => [early.insertId, late.insertId].includes(c.commentId))
      .map((c) => [c.commentId, c.following]);
  assert.deepEqual(await order(mia), [
    [late.insertId, true],
    [early.insertId, false],
  ]);
  // Signed out, or for a member who follows neither, the conversation runs in time order.
  assert.deepEqual(await order(request(app)), [
    [early.insertId, false],
    [late.insertId, false],
  ]);
  await pool.query("DELETE FROM review_comment WHERE comment_id IN (?,?)", [
    early.insertId,
    late.insertId,
  ]);
});

test("collections can be bookmarked; the most bookmarked lead, and each member keeps theirs", async () => {
  // Alex's public list (2,1); Mia owns (1,1); Alex's (2,1) is public, Mia's (1,2) private.
  const savedKeys = async () =>
    (await mia.get("/api/me/bookmarks")).body.lists.map(
      (l) => `${l.userId}/${l.listId}`,
    );
  const seeded = await savedKeys();
  assert.ok(!seeded.includes("2/1"));
  assert.equal((await mia.put("/api/lists/2/1/bookmark")).status, 200);
  assert.equal((await mia.put("/api/lists/2/1/bookmark")).status, 200);
  assert.equal((await mia.put("/api/lists/1/1/bookmark")).status, 400);
  assert.equal((await alex.put("/api/lists/1/2/bookmark")).status, 404);
  // Most recently saved first.
  assert.deepEqual(await savedKeys(), ["2/1", ...seeded]);
  assert.equal(
    (await mia.get("/api/me/bookmarks")).body.total,
    seeded.length + 1,
  );
  const saved = (await mia.get("/api/me/bookmarks")).body.lists[0];
  assert.equal(saved.bookmarked, true);
  assert.equal(saved.bookmarks, 1);
  // Browsing everyone's collections, the most bookmarked come first.
  const browse = (await request(app).get("/api/lists?public=1")).body.lists;
  const counts = browse.map((l) => l.bookmarks);
  assert.deepEqual(
    counts,
    [...counts].sort((a, b) => b - a),
  );
  assert.ok(counts[0] > 0);
  // A list made private disappears from others' saved lists, and comes back when public.
  await alex.patch("/api/lists/2/1").send({ visibility: "private" });
  assert.deepEqual(await savedKeys(), seeded);
  assert.equal((await mia.get("/api/me/bookmarks")).body.total, seeded.length);
  await alex.patch("/api/lists/2/1").send({ visibility: "public" });
  assert.deepEqual(await savedKeys(), ["2/1", ...seeded]);
  // Deleting a bookmarked list removes its bookmarks with it.
  const made = (
    await alex
      .post("/api/lists")
      .send({ name: "Short-lived", visibility: "public" })
  ).body.list;
  await mia.put(`/api/lists/2/${made.listId}/bookmark`);
  assert.equal((await alex.delete(`/api/lists/2/${made.listId}`)).status, 200);
  const [[{ remaining }]] = await pool.query(
    "SELECT COUNT(*) AS remaining FROM list_bookmark WHERE owner_id=2 AND list_id=?",
    [made.listId],
  );
  assert.equal(remaining, 0);
  assert.equal((await mia.delete("/api/lists/2/1/bookmark")).status, 200);
  assert.deepEqual(await savedKeys(), seeded);
});

test("a new list can start with a film, in one transaction", async () => {
  const made = await mia
    .post("/api/lists")
    .send({ name: "Rainy Sundays", visibility: "public", movieId: 7 });
  assert.equal(made.status, 201);
  const { listId } = made.body.list;
  const shown = (await mia.get(`/api/lists/1/${listId}`)).body;
  assert.deepEqual(
    shown.movies.map((m) => m.movieId),
    [7],
  );
  // An unknown film leaves no half-made list behind.
  const [[{ listsBefore }]] = await pool.query(
    "SELECT COUNT(*) AS listsBefore FROM film_list WHERE user_id=1",
  );
  assert.equal(
    (await mia.post("/api/lists").send({ name: "Ghost", movieId: 999999 }))
      .status,
    404,
  );
  const [[{ listsAfter }]] = await pool.query(
    "SELECT COUNT(*) AS listsAfter FROM film_list WHERE user_id=1",
  );
  assert.equal(listsAfter, listsBefore);
  await mia.delete(`/api/lists/1/${listId}`);
});

test("members comment on reviews; authors of the comment or the review may remove it", async () => {
  const review = (
    await mia
      .put("/api/movies/7/my-review")
      .send({ rating: 9, text: "Still thinking about the docking scene." })
  ).body.review;
  const posted = await alex
    .post(`/api/reviews/${review.reviewId}/comments`)
    .send({ text: "  The organ score in that scene!  " });
  assert.equal(posted.status, 201);
  assert.equal(posted.body.comment.text, "The organ score in that scene!");
  assert.equal(posted.body.comment.username, "alex");
  assert.equal(
    (
      await alex
        .post(`/api/reviews/${review.reviewId}/comments`)
        .send({ text: "   " })
    ).status,
    400,
  );
  assert.equal(
    (await alex.post("/api/reviews/999999/comments").send({ text: "Hello" }))
      .status,
    404,
  );
  assert.equal(
    (
      await request(app)
        .post(`/api/reviews/${review.reviewId}/comments`)
        .send({ text: "Hi" })
    ).status,
    401,
  );
  const second = (
    await mia
      .post(`/api/reviews/${review.reviewId}/comments`)
      .send({ text: "Right? I had chills." })
  ).body.comment;
  const thread = (
    await request(app).get(`/api/reviews/${review.reviewId}/comments`)
  ).body.comments;
  assert.deepEqual(
    thread.map((c) => c.username),
    ["alex", "mia"],
  );
  const listed = (
    await request(app).get("/api/reviews?movieId=7")
  ).body.reviews.find((r) => r.reviewId === review.reviewId);
  assert.equal(listed.commentCount, 2);
  // Mia wrote the review, so she may remove Alex's comment; Alex may not remove Mia's.
  assert.equal(
    (await alex.delete(`/api/comments/${second.commentId}`)).status,
    403,
  );
  assert.equal(
    (await mia.delete(`/api/comments/${posted.body.comment.commentId}`)).status,
    200,
  );
  assert.equal(
    (await mia.delete(`/api/comments/${second.commentId}`)).status,
    200,
  );
  // Deleting a review removes its comments with it.
  await alex
    .post(`/api/reviews/${review.reviewId}/comments`)
    .send({ text: "One more thought." });
  assert.equal(
    (await mia.delete(`/api/reviews/${review.reviewId}`)).status,
    200,
  );
  const [[{ remaining }]] = await pool.query(
    "SELECT COUNT(*) AS remaining FROM review_comment WHERE review_id=?",
    [review.reviewId],
  );
  assert.equal(remaining, 0);
});

test("notifications gather comments, replies, follows, bookings and reminders; read state persists", async () => {
  const kinds = async () => (await mia.get("/api/me/notifications")).body;
  // A comment on Mia's review, and a reply after Mia in a conversation under Alex's review.
  const lalaland = (await request(app).get("/api/reviews?userId=1&movieId=10"))
    .body.reviews[0];
  await alex
    .post(`/api/reviews/${lalaland.reviewId}/comments`)
    .send({ text: "Saturday at nine?" });
  const arrival = (await request(app).get("/api/reviews?userId=2&movieId=11"))
    .body.reviews[0];
  const asked = (
    await mia
      .post(`/api/reviews/${arrival.reviewId}/comments`)
      .send({ text: "Who is in for a rewatch?" })
  ).body.comment;
  // Date Mia's comment a moment earlier so Noah's answer clearly comes after it.
  await pool.query(
    "UPDATE review_comment SET create_date=DATE_SUB(NOW(),INTERVAL 5 SECOND) WHERE comment_id=?",
    [asked.commentId],
  );
  await pool.query(
    "INSERT INTO review_comment(review_id,parent_comment_id,user_id,comment_text) VALUES(?,?,3,'Me!')",
    [arrival.reviewId, asked.commentId],
  );
  // Alex, whom Mia follows, reviews a film after the follow.
  const [[{ unreviewed }]] = await pool.query(
    "SELECT MIN(movie_id) AS unreviewed FROM movie WHERE movie_id NOT IN (SELECT movie_id FROM review WHERE user_id=2)",
  );
  const [newReview] = await pool.query(
    "INSERT INTO review(user_id,movie_id,rating,review_text,create_date) VALUES(2,?,8,'A quiet surprise.',DATE_ADD(NOW(),INTERVAL 1 SECOND))",
    [unreviewed],
  );
  // Likes on Mia's comment and on her review.
  await alex.put(`/api/comments/${asked.commentId}/like`);
  await alex.put(`/api/reviews/${lalaland.reviewId}/like`);
  // A screening Mia holds a ticket for, starting in half an hour.
  const [screening] = await pool.query(
    "INSERT INTO screening(movie_id,cinema_id,hall_id,start_time,end_time) VALUES(13,1,1,DATE_ADD(NOW(),INTERVAL 30 MINUTE),DATE_ADD(NOW(),INTERVAL 140 MINUTE))",
  );
  await pool.query(
    "INSERT INTO screening_seat(screening_id,screening_seat_id,cinema_id,hall_id,seat_id) SELECT ?,seat_id,cinema_id,hall_id,seat_id FROM seat WHERE cinema_id=1 AND hall_id=1",
    [screening.insertId],
  );
  await pool.query(
    "INSERT INTO ticket(user_id,screening_id,screening_seat_id,price) VALUES(1,?,7,98)",
    [screening.insertId],
  );
  const before = await kinds();
  const found = new Set(before.notifications.map((n) => n.kind));
  for (const kind of [
    "comment",
    "reply",
    "like",
    "review-like",
    "review",
    "follow",
    "ticket",
    "reminder",
  ])
    assert.ok(found.has(kind), `expected a ${kind} notification`);
  // A reply links to the comment it answers, so the conversation opens at that level.
  const reply = before.notifications.find((n) => n.kind === "reply");
  assert.equal(reply.actor, "noah");
  assert.equal(reply.reviewId, arrival.reviewId);
  assert.equal(reply.focusId, asked.commentId);
  // Only reviews written since the follow: Alex's older ones stay out.
  const reviews = before.notifications.filter((n) => n.kind === "review");
  assert.deepEqual(
    reviews.map((n) => n.refId),
    [newReview.insertId],
  );
  await pool.query("DELETE FROM review WHERE review_id=?", [
    newReview.insertId,
  ]);
  assert.ok(before.unread > 0);
  // Nobody sees their own comments as notifications.
  assert.ok(!before.notifications.some((n) => n.actor === "mia"));
  assert.equal((await mia.post("/api/me/notifications/read")).status, 200);
  assert.equal((await kinds()).unread, 0);
  const [later] = await pool.query(
    "INSERT INTO review_comment(review_id,user_id,comment_text,create_date) VALUES(?,2,'One more thing.',DATE_ADD(NOW(),INTERVAL 2 SECOND))",
    [lalaland.reviewId],
  );
  assert.equal((await kinds()).unread, 1);
  assert.equal((await request(app).get("/api/me/notifications")).status, 401);
  // Nothing real is dated ahead of the clock; leave no such comment for later tests.
  await pool.query("DELETE FROM review_comment WHERE comment_id=?", [
    later.insertId,
  ]);
});

test("notifications are read up to the newest one seen; later ones, re-follows and late reminders stay new", async () => {
  const feed = async () => (await mia.get("/api/me/notifications")).body;
  // Read up to the newest item shown; a comment arriving after it stays unread.
  const seen = await feed();
  const newest = seen.notifications[0].at;
  assert.equal(
    (await mia.post("/api/me/notifications/read").send({ upTo: newest }))
      .status,
    200,
  );
  assert.equal((await feed()).unread, 0);
  const lalaland = (await request(app).get("/api/reviews?userId=1&movieId=10"))
    .body.reviews[0];
  const later = (
    await alex
      .post(`/api/reviews/${lalaland.reviewId}/comments`)
      .send({ text: "After you looked." })
  ).body.comment;
  await pool.query(
    "UPDATE review_comment SET create_date=DATE_ADD(?,INTERVAL 1 SECOND) WHERE comment_id=?",
    [newest, later.commentId],
  );
  assert.equal((await feed()).unread, 1);
  // The mark never moves backwards, and must be a time.
  await mia
    .post("/api/me/notifications/read")
    .send({ upTo: "2000-01-01 00:00:00" });
  assert.equal((await feed()).readAt, newest);
  assert.equal(
    (await mia.post("/api/me/notifications/read").send({ upTo: "soon" }))
      .status,
    400,
  );
  await mia.post("/api/me/notifications/read");
  // Following again is a new notification, with a new key.
  await pool.query(
    "UPDATE follows SET follow_date=DATE_SUB(NOW(),INTERVAL 1 DAY) WHERE follower_id=2 AND followed_id=1",
  );
  const firstFollow = (await feed()).notifications.find(
    (n) => n.kind === "follow" && n.actorId === 2,
  );
  // (read a few seconds ago: times are kept to the second)
  await pool.query(
    "UPDATE users SET notifications_read_at=DATE_ADD(NOW(),INTERVAL -5 SECOND) WHERE user_id=1",
  );
  await alex.delete("/api/users/1/follow");
  await alex.put("/api/users/1/follow");
  const again = (await feed()).notifications.find(
    (n) => n.kind === "follow" && n.actorId === 2,
  );
  assert.ok(again.unread);
  assert.notEqual(again.key, firstFollow?.key);
  // Booking a screening that starts within the hour reminds you, even after reading.
  await mia.post("/api/me/notifications/read");
  const [[soon]] = await pool.query(
    "SELECT s.screening_id AS id,s.start_time AS startTime,s.end_time AS endTime,(SELECT MIN(screening_seat_id) FROM screening_seat ss WHERE ss.screening_id=s.screening_id AND ss.status='available') AS seat FROM screening s WHERE s.start_time>NOW() AND NOT EXISTS(SELECT 1 FROM ticket t WHERE t.screening_id=s.screening_id) ORDER BY s.start_time LIMIT 1",
  );
  await pool.query(
    "UPDATE screening SET start_time=DATE_ADD(NOW(),INTERVAL 30 MINUTE),end_time=DATE_ADD(NOW(),INTERVAL 150 MINUTE) WHERE screening_id=?",
    [soon.id],
  );
  await pool.query(
    "UPDATE users SET notifications_read_at=DATE_ADD(NOW(),INTERVAL -5 SECOND) WHERE user_id=1",
  );
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal(
    (
      await mia
        .post("/api/bookings")
        .send({ screeningId: soon.id, seatIds: [soon.seat] })
    ).status,
    201,
  );
  const reminder = (await feed()).notifications.find(
    (n) => n.kind === "reminder" && n.refId === soon.id,
  );
  assert.ok(reminder?.unread, "a reminder for a booking made within the hour");
  // Put the screening back where it was, so its hall's schedule stays intact.
  await pool.query(
    "UPDATE screening SET start_time=?,end_time=? WHERE screening_id=?",
    [soon.startTime, soon.endTime, soon.id],
  );
  await alex.delete(`/api/comments/${later.commentId}`);
});

test("the review feed can show only members the visitor follows", async () => {
  const feed = (await mia.get("/api/reviews?following=1&limit=50")).body
    .reviews;
  const [follows] = await pool.query(
    "SELECT followed_id AS id FROM follows WHERE follower_id=1",
  );
  const followed = new Set(follows.map((f) => f.id));
  assert.ok(feed.length > 0);
  assert.ok(feed.every((r) => followed.has(r.userId)));
  assert.equal(
    (await request(app).get("/api/reviews?following=1")).status,
    401,
  );
});

test("premium seats are the middle seats from the middle rows back", async () => {
  const seats = (await request(app).get("/api/screenings/1")).body.seats;
  const premium = seats
    .filter((s) => s.type === "premium")
    .map((s) => s.number)
    .sort();
  assert.deepEqual(premium, [
    "D3",
    "D4",
    "D5",
    "D6",
    "E3",
    "E4",
    "E5",
    "E6",
    "F3",
    "F4",
    "F5",
    "F6",
  ]);
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
