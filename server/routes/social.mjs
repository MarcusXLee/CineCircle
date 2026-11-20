import { Router } from "express";
import {
  HttpError,
  id,
  text,
  requireUser,
  userInfo,
  page,
  trimPage,
} from "../auth.mjs";
import { transaction } from "../db.mjs";
import { movieSelect, presentation } from "../catalog.mjs";

export async function reviews(
  pool,
  viewer = 0,
  where = "",
  params = [],
  limit = 20,
  offset = 0,
) {
  const [rows] = await pool.execute(
    `SELECT r.review_id AS reviewId,r.user_id AS userId,u.username,r.movie_id AS movieId,m.title AS movieTitle,r.rating,r.review_text AS text,r.create_date AS createdAt,r.update_date AS updatedAt,
    (SELECT COUNT(*) FROM review_like l WHERE l.review_id=r.review_id) AS likes,
    EXISTS(SELECT 1 FROM review_like l WHERE l.review_id=r.review_id AND l.user_id=?) AS liked,
    (SELECT COUNT(*) FROM review_comment rc WHERE rc.review_id=r.review_id) AS commentCount
    FROM review r JOIN users u USING(user_id) JOIN movie m USING(movie_id) ${where} ORDER BY r.create_date DESC,r.review_id DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    [viewer, ...params],
  );
  return rows.map((r) => ({
    ...r,
    liked: Boolean(r.liked),
    poster: presentation({ movieId: r.movieId }).poster,
  }));
}
// Comments with their like count, whether the viewer liked them, and how many direct
// replies each has. Those by members the viewer follows come first; each group runs oldest
// first.
export async function comments(pool, viewer, where, params) {
  const [rows] = await pool.execute(
    `SELECT rc.comment_id AS commentId,rc.review_id AS reviewId,rc.parent_comment_id AS parentId,rc.user_id AS userId,u.username,rc.comment_text AS text,rc.create_date AS createdAt,
    (SELECT COUNT(*) FROM comment_like cl WHERE cl.comment_id=rc.comment_id) AS likes,
    EXISTS(SELECT 1 FROM comment_like cl WHERE cl.comment_id=rc.comment_id AND cl.user_id=?) AS liked,
    (SELECT COUNT(*) FROM review_comment ch WHERE ch.parent_comment_id=rc.comment_id) AS replyCount,
    EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=? AND f.followed_id=rc.user_id) AS following
    FROM review_comment rc JOIN users u USING(user_id) ${where} ORDER BY following DESC,rc.create_date,rc.comment_id LIMIT 200`,
    [viewer, viewer, ...params],
  );
  return rows.map((c) => ({
    ...c,
    liked: Boolean(c.liked),
    following: Boolean(c.following),
  }));
}
// A comment and every reply beneath it, at any depth.
const subtreeSql = `WITH RECURSIVE sub AS (
    SELECT comment_id FROM review_comment WHERE comment_id=?
    UNION ALL
    SELECT ch.comment_id FROM review_comment ch JOIN sub ON ch.parent_comment_id=sub.comment_id
  ) SELECT comment_id AS id FROM sub`;
// A comment's chain of parents, from the top-level comment down to itself.
const pathSql = `WITH RECURSIVE chain AS (
    SELECT comment_id,parent_comment_id,0 AS depth FROM review_comment WHERE comment_id=?
    UNION ALL
    SELECT p.comment_id,p.parent_comment_id,chain.depth+1 FROM review_comment p JOIN chain ON p.comment_id=chain.parent_comment_id
  ) SELECT comment_id AS id FROM chain ORDER BY depth DESC`;
// One page of reviews plus whether more exist, for the "Show more" buttons.
export async function reviewPage(pool, viewer, where, params, range) {
  const rows = await reviews(
    pool,
    viewer,
    where,
    params,
    range.limit + 1,
    range.offset,
  );
  return { reviews: rows, more: trimPage(rows, range) };
}
export async function library(pool, userId) {
  const [watchlist] = await pool.execute(
    `${movieSelect} JOIN wants_to_watch w ON w.movie_id=m.movie_id WHERE w.user_id=? ORDER BY w.add_date DESC`,
    [userId],
  );
  const [watched] = await pool.execute(
    `${movieSelect} JOIN watches w ON w.movie_id=m.movie_id WHERE w.user_id=? ORDER BY w.watch_date DESC`,
    [userId],
  );
  const [dates] = await pool.execute(
    "SELECT movie_id,watch_date FROM watches WHERE user_id=?",
    [userId],
  );
  return {
    watchlist: watchlist.map(presentation),
    watched: watched.map((m) => ({
      ...presentation(m),
      watchDate: dates.find((d) => d.movie_id === m.movieId).watch_date,
    })),
  };
}
function reviewValues(body) {
  const rating = Number(body.rating);
  if (
    body.rating === null ||
    body.rating === "" ||
    !Number.isFinite(rating) ||
    rating < 0 ||
    rating > 10 ||
    Math.abs(rating * 10 - Math.round(rating * 10)) > 0.00001
  )
    throw new HttpError(400, "Choose a rating from 0 to 10, in steps of 0.1.");
  return { rating, content: text(body.text, 10000) };
}
export function social(pool) {
  const router = Router();
  router.get("/reviews", async (req, res) => {
    const where = [],
      params = [];
    for (const [key, column] of [
      ["userId", "r.user_id"],
      ["movieId", "r.movie_id"],
      ["reviewId", "r.review_id"],
    ])
      if (req.query[key]) {
        where.push(`${column}=?`);
        params.push(id(req.query[key]));
      }
    // Reviews by the members the visitor follows.
    if (req.query.following === "1") {
      if (!req.session.userId) throw new HttpError(401, "Sign in to continue.");
      where.push(
        "r.user_id IN (SELECT followed_id FROM follows WHERE follower_id=?)",
      );
      params.push(req.session.userId);
    }
    res.json(
      await reviewPage(
        pool,
        req.session.userId || 0,
        where.length ? "WHERE " + where.join(" AND ") : "",
        params,
        page(req.query, 10),
      ),
    );
  });
  router.put("/movies/:id/my-review", requireUser, async (req, res) => {
    const movieId = id(req.params.id),
      { rating, content } = reviewValues(req.body);
    const reviewId = await transaction(pool, async (c) => {
      await c.execute("SELECT user_id FROM users WHERE user_id=? FOR UPDATE", [
        req.session.userId,
      ]);
      const [[movie]] = await c.execute(
        "SELECT movie_id FROM movie WHERE movie_id=?",
        [movieId],
      );
      if (!movie) throw new HttpError(404, "Film not found.");
      const [[existing]] = await c.execute(
        "SELECT review_id FROM review WHERE user_id=? AND movie_id=? ORDER BY review_id LIMIT 1 FOR UPDATE",
        [req.session.userId, movieId],
      );
      if (existing) {
        await c.execute(
          "UPDATE review SET rating=?,review_text=? WHERE review_id=?",
          [rating, content, existing.review_id],
        );
        return existing.review_id;
      }
      const [result] = await c.execute(
        "INSERT INTO review(user_id,movie_id,rating,review_text) VALUES(?,?,?,?)",
        [req.session.userId, movieId, rating, content],
      );
      return result.insertId;
    });
    res.json({
      review: (
        await reviews(
          pool,
          req.session.userId,
          "WHERE r.review_id=?",
          [reviewId],
          1,
        )
      )[0],
    });
  });
  router.patch("/reviews/:id", requireUser, async (req, res) => {
    const reviewId = id(req.params.id),
      { rating, content } = reviewValues(req.body);
    const [[review]] = await pool.execute(
      "SELECT user_id FROM review WHERE review_id=?",
      [reviewId],
    );
    if (!review) throw new HttpError(404, "Review not found.");
    if (review.user_id !== req.session.userId)
      throw new HttpError(403, "You can only edit your own review.");
    await pool.execute(
      "UPDATE review SET rating=?,review_text=? WHERE review_id=? AND user_id=?",
      [rating, content, reviewId, req.session.userId],
    );
    res.json({
      review: (
        await reviews(
          pool,
          req.session.userId,
          "WHERE r.review_id=?",
          [reviewId],
          1,
        )
      )[0],
    });
  });
  router.delete("/reviews/:id", requireUser, async (req, res) => {
    await transaction(pool, async (c) => {
      const [[r]] = await c.execute(
        "SELECT user_id FROM review WHERE review_id=? FOR UPDATE",
        [id(req.params.id)],
      );
      if (!r) throw new HttpError(404, "Review not found.");
      if (r.user_id !== req.session.userId)
        throw new HttpError(403, "You can only delete your own review.");
      await c.execute("DELETE FROM review_like WHERE review_id=?", [
        id(req.params.id),
      ]);
      await c.execute(
        "DELETE FROM comment_like WHERE comment_id IN (SELECT comment_id FROM review_comment WHERE review_id=?)",
        [id(req.params.id)],
      );
      await c.execute(
        "DELETE FROM review_comment WHERE review_id=? ORDER BY comment_id DESC",
        [id(req.params.id)],
      );
      await c.execute("DELETE FROM review WHERE review_id=?", [
        id(req.params.id),
      ]);
    });
    res.json({ ok: true });
  });
  for (const method of ["put", "delete"])
    router[method]("/reviews/:id/like", requireUser, async (req, res) => {
      const reviewId = id(req.params.id);
      await transaction(pool, async (c) => {
        const [[r]] = await c.execute(
          "SELECT user_id FROM review WHERE review_id=? FOR UPDATE",
          [reviewId],
        );
        if (!r) throw new HttpError(404, "Review not found.");
        if (method === "put") {
          if (r.user_id === req.session.userId)
            throw new HttpError(400, "You can like reviews by other members.");
          await c.execute(
            "INSERT INTO review_like(user_id,review_id) VALUES(?,?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)",
            [req.session.userId, reviewId],
          );
        } else
          await c.execute(
            "DELETE FROM review_like WHERE user_id=? AND review_id=?",
            [req.session.userId, reviewId],
          );
      });
      res.json({ ok: true });
    });
  // One level of a conversation: the review's own comments, or the replies to one comment
  // (?parent=<commentId>).
  router.get("/reviews/:id/comments", async (req, res) => {
    const reviewId = id(req.params.id),
      parent = req.query.parent ? id(req.query.parent) : null;
    const [[review]] = await pool.execute(
      "SELECT review_id FROM review WHERE review_id=?",
      [reviewId],
    );
    if (!review) throw new HttpError(404, "Review not found.");
    if (parent) {
      const [[found]] = await pool.execute(
        "SELECT comment_id FROM review_comment WHERE comment_id=? AND review_id=?",
        [parent, reviewId],
      );
      if (!found) throw new HttpError(404, "That comment is no longer here.");
    }
    res.json({
      comments: await comments(
        pool,
        req.session.userId || 0,
        "WHERE rc.review_id=? AND rc.parent_comment_id <=> ?",
        [reviewId, parent],
      ),
    });
  });
  // The chain from a top-level comment down to this one, for opening a conversation at it.
  router.get("/comments/:id/path", async (req, res) => {
    const [chain] = await pool.execute(pathSql, [id(req.params.id)]);
    if (!chain.length)
      throw new HttpError(404, "That comment is no longer here.");
    const found = await comments(
      pool,
      req.session.userId || 0,
      `WHERE rc.comment_id IN(${chain.map(() => "?").join(",")})`,
      chain.map((c) => c.id),
    );
    res.json({
      comments: chain.map((c) => found.find((f) => f.commentId === c.id)),
    });
  });
  router.post("/reviews/:id/comments", requireUser, async (req, res) => {
    const reviewId = id(req.params.id),
      parent = req.body.parentId == null ? null : id(req.body.parentId),
      body = text(req.body.text, 1000, true);
    const commentId = await transaction(pool, async (c) => {
      const [[review]] = await c.execute(
        "SELECT review_id FROM review WHERE review_id=? FOR UPDATE",
        [reviewId],
      );
      if (!review) throw new HttpError(404, "Review not found.");
      if (parent) {
        const [[found]] = await c.execute(
          "SELECT comment_id FROM review_comment WHERE comment_id=? AND review_id=? FOR UPDATE",
          [parent, reviewId],
        );
        if (!found) throw new HttpError(404, "That comment is no longer here.");
      }
      const [result] = await c.execute(
        "INSERT INTO review_comment(review_id,parent_comment_id,user_id,comment_text) VALUES(?,?,?,?)",
        [reviewId, parent, req.session.userId, body],
      );
      return result.insertId;
    });
    res.status(201).json({
      comment: (
        await comments(pool, req.session.userId, "WHERE rc.comment_id=?", [
          commentId,
        ])
      )[0],
    });
  });
  for (const method of ["put", "delete"])
    router[method]("/comments/:id/like", requireUser, async (req, res) => {
      const commentId = id(req.params.id);
      await transaction(pool, async (c) => {
        const [[comment]] = await c.execute(
          "SELECT user_id FROM review_comment WHERE comment_id=? FOR UPDATE",
          [commentId],
        );
        if (!comment)
          throw new HttpError(404, "That comment is no longer here.");
        if (method === "put") {
          if (comment.user_id === req.session.userId)
            throw new HttpError(400, "You can like comments by other members.");
          await c.execute(
            "INSERT INTO comment_like(user_id,comment_id) VALUES(?,?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)",
            [req.session.userId, commentId],
          );
        } else
          await c.execute(
            "DELETE FROM comment_like WHERE user_id=? AND comment_id=?",
            [req.session.userId, commentId],
          );
      });
      res.json({ ok: true });
    });
  // The comment's author, or the author of the review it sits under, may remove it. Its
  // replies go with it, replies first, together with their likes.
  router.delete("/comments/:id", requireUser, async (req, res) => {
    const commentId = id(req.params.id);
    const removed = await transaction(pool, async (c) => {
      const [[comment]] = await c.execute(
        "SELECT rc.user_id AS author,r.user_id AS reviewAuthor FROM review_comment rc JOIN review r USING(review_id) WHERE rc.comment_id=? FOR UPDATE",
        [commentId],
      );
      if (!comment) throw new HttpError(404, "Comment not found.");
      if (![comment.author, comment.reviewAuthor].includes(req.session.userId))
        throw new HttpError(403, "You can only remove your own comments.");
      const [subtree] = await c.execute(subtreeSql, [commentId]);
      const ids = subtree.map((row) => row.id),
        marks = ids.map(() => "?").join(",");
      await c.execute(
        `DELETE FROM comment_like WHERE comment_id IN(${marks})`,
        ids,
      );
      await c.execute(
        `DELETE FROM review_comment WHERE comment_id IN(${marks}) ORDER BY comment_id DESC`,
        ids,
      );
      return ids.length;
    });
    res.json({ ok: true, removed });
  });
  router.get("/me/library", requireUser, async (req, res) =>
    res.json(await library(pool, req.session.userId)),
  );
  for (const kind of ["watchlist", "watched"])
    for (const method of ["put", "delete"])
      router[method](`/me/${kind}/:id`, requireUser, async (req, res) => {
        const movieId = id(req.params.id),
          table = kind === "watched" ? "watches" : "wants_to_watch";
        let date;
        if (kind === "watched" && method === "put") {
          const today = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Hong_Kong",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date());
          date = req.body.date || today;
          const parsed = new Date(`${date}T00:00:00Z`);
          if (
            typeof date !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            !Number.isFinite(parsed.getTime()) ||
            parsed.toISOString().slice(0, 10) !== date ||
            date > today
          )
            throw new HttpError(400, "Choose a valid date on or before today.");
        }
        await transaction(pool, async (c) => {
          const [[m]] = await c.execute(
            "SELECT movie_id,release_date FROM movie WHERE movie_id=?",
            [movieId],
          );
          if (!m) throw new HttpError(404, "Film not found.");
          // A film cannot have been watched before it was released.
          if (date && m.release_date && date < m.release_date)
            throw new HttpError(
              400,
              `Choose a date on or after the film’s release (${m.release_date.slice(0, 4)}).`,
            );
          if (method === "delete")
            await c.execute(
              `DELETE FROM ${table} WHERE user_id=? AND movie_id=?`,
              [req.session.userId, movieId],
            );
          else if (kind === "watched") {
            await c.execute(
              "INSERT INTO watches VALUES(?,?,?) ON DUPLICATE KEY UPDATE watch_date=VALUES(watch_date)",
              [req.session.userId, movieId, `${date} 12:00:00`],
            );
            await c.execute(
              "DELETE FROM wants_to_watch WHERE user_id=? AND movie_id=?",
              [req.session.userId, movieId],
            );
          } else
            await c.execute(
              "INSERT INTO wants_to_watch(user_id,movie_id) VALUES(?,?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)",
              [req.session.userId, movieId],
            );
        });
        res.json({ ok: true });
      });
  // Members, most reviews first. `q` finds members by username; `followersOf` and
  // `followedBy` list who follows a member and whom they follow, most recent first.
  router.get("/users", async (req, res) => {
    const range = page(req.query, 20),
      q = text(req.query.q, 40),
      params = [req.session.userId || 0],
      where = ["u.deleted_date IS NULL"];
    let join = "",
      order = "reviews DESC,u.user_id";
    const relation = [
      ["followersOf", "follower_id", "followed_id"],
      ["followedBy", "followed_id", "follower_id"],
    ].find(([key]) => req.query[key] !== undefined);
    if (relation) {
      const [key, mine, theirs] = relation;
      join = `JOIN follows rel ON rel.${mine}=u.user_id AND rel.${theirs}=?`;
      params.push(id(req.query[key]));
      order = "rel.follow_date DESC,u.user_id";
    }
    if (q) {
      where.push("u.username LIKE ?");
      params.push(`%${q.replace(/[\\%_]/g, "\\$&")}%`);
    }
    const [users] = await pool.execute(
      `SELECT u.user_id AS userId,u.username,(SELECT COUNT(*) FROM review r WHERE r.user_id=u.user_id) AS reviews,(SELECT COUNT(*) FROM follows f WHERE f.followed_id=u.user_id) AS followers,EXISTS(SELECT 1 FROM follows f WHERE f.followed_id=u.user_id AND f.follower_id=?) AS following FROM users u ${join} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ${range.limit + 1} OFFSET ${range.offset}`,
      params,
    );
    const more = trimPage(users, range);
    res.json({
      users: users.map((u) => ({ ...u, following: Boolean(u.following) })),
      more,
    });
  });
  for (const method of ["put", "delete"])
    router[method]("/users/:id/follow", requireUser, async (req, res) => {
      const target = id(req.params.id);
      if (target === req.session.userId)
        throw new HttpError(400, "Choose another member to follow.");
      const [[user]] = await pool.execute(
        "SELECT user_id FROM users WHERE user_id=? AND deleted_date IS NULL",
        [target],
      );
      if (!user) throw new HttpError(404, "Member not found.");
      if (method === "put")
        await pool.execute(
          "INSERT INTO follows(follower_id,followed_id) VALUES(?,?) ON DUPLICATE KEY UPDATE follower_id=VALUES(follower_id)",
          [req.session.userId, target],
        );
      else
        await pool.execute(
          "DELETE FROM follows WHERE follower_id=? AND followed_id=?",
          [req.session.userId, target],
        );
      res.json({ ok: true });
    });
  return router;
}
