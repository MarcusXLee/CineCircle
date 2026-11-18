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
    EXISTS(SELECT 1 FROM review_like l WHERE l.review_id=r.review_id AND l.user_id=?) AS liked
    FROM review r JOIN users u USING(user_id) JOIN movie m USING(movie_id) ${where} ORDER BY r.create_date DESC,r.review_id DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    [viewer, ...params],
  );
  return rows.map((r) => ({
    ...r,
    liked: Boolean(r.liked),
    poster: presentation({ movieId: r.movieId }).poster,
  }));
}
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
    ])
      if (req.query[key]) {
        where.push(`${column}=?`);
        params.push(id(req.query[key]));
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
            "SELECT movie_id FROM movie WHERE movie_id=?",
            [movieId],
          );
          if (!m) throw new HttpError(404, "Film not found.");
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
  router.get("/users", async (req, res) => {
    const range = page(req.query, 20);
    const [users] = await pool.execute(
      `SELECT u.user_id AS userId,u.username,(SELECT COUNT(*) FROM review r WHERE r.user_id=u.user_id) AS reviews,(SELECT COUNT(*) FROM follows f WHERE f.followed_id=u.user_id) AS followers,EXISTS(SELECT 1 FROM follows f WHERE f.followed_id=u.user_id AND f.follower_id=?) AS following FROM users u ORDER BY reviews DESC,u.user_id LIMIT ${range.limit + 1} OFFSET ${range.offset}`,
      [req.session.userId || 0],
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
        "SELECT user_id FROM users WHERE user_id=?",
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
