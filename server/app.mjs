import express from "express";
import session from "express-session";
import { existsSync } from "node:fs";
import path from "node:path";
import { root } from "./config.mjs";
import { accounts } from "./routes/accounts.mjs";
import { social, reviews, reviewPage, library } from "./routes/social.mjs";
import { lists, listCards } from "./routes/lists.mjs";
import { booking, screeningRows } from "./routes/booking.mjs";
import { notifications } from "./routes/notifications.mjs";
import { membership } from "./routes/membership.mjs";
import { movieSelect, presentation } from "./catalog.mjs";
import { HttpError, id, text, userInfo, page, trimPage } from "./auth.mjs";

export function createApp({ pool, sessionSecret }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    req.body ??= {};
    if (
      req.path.startsWith("/api/") &&
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin
    ) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host)
          throw new Error();
      } catch {
        return next(new HttpError(403, "Reload CineCircle and try again."));
      }
    }
    next();
  });
  app.use(
    session({
      name: "cinecircle.sid",
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: "lax", maxAge: 12 * 60 * 60 * 1000 },
    }),
  );
  app.get("/api/health", async (req, res) => {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  });
  app.use("/api", accounts(pool));
  app.use("/api", membership(pool));
  app.get("/api/genres", async (req, res) => {
    const [genres] = await pool.query(
      "SELECT genre_id AS genreId,genre_name AS name FROM genre ORDER BY genre_name",
    );
    res.json({ genres });
  });
  app.get("/api/movies", async (req, res) => {
    const where = [],
      params = [],
      q = text(req.query.q, 100),
      genre = text(req.query.genre, 100);
    if (q) {
      where.push("m.title LIKE ?");
      params.push(`%${q}%`);
    }
    if (genre) {
      where.push(
        "EXISTS(SELECT 1 FROM movie_genre mg JOIN genre g USING(genre_id) WHERE mg.movie_id=m.movie_id AND g.genre_name=?)",
      );
      params.push(genre);
    }
    const sortModes = new Map(
      Object.entries({
        popular: "reviewCount DESC,rating DESC,m.movie_id",
        rating: "rating DESC,reviewCount DESC,m.movie_id",
        newest: "m.release_date DESC,m.movie_id",
        title: "m.title",
      }),
    );
    const sort = sortModes.get(req.query.sort || "popular");
    if (!sort) throw new HttpError(400, "Choose a valid film sort order.");
    const range = page(req.query, 100),
      filter = where.length ? "WHERE " + where.join(" AND ") : "";
    const [rows] = await pool.execute(
      `${movieSelect} ${filter} ORDER BY ${sort} LIMIT ${range.limit + 1} OFFSET ${range.offset}`,
      params,
    );
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM movie m ${filter}`,
      params,
    );
    const more = trimPage(rows, range);
    res.json({ movies: rows.map(presentation), total, more });
  });
  app.get("/api/movies/:id", async (req, res) => {
    const movieId = id(req.params.id),
      [[movie]] = await pool.execute(`${movieSelect} WHERE m.movie_id=?`, [
        movieId,
      ]);
    if (!movie) throw new HttpError(404, "Film not found.");
    const userId = req.session.userId || 0,
      [[flags]] = await pool.execute(
        "SELECT EXISTS(SELECT 1 FROM wants_to_watch WHERE user_id=? AND movie_id=?) AS watchlisted,(SELECT watch_date FROM watches WHERE user_id=? AND movie_id=?) AS watchDate",
        [userId, movieId, userId, movieId],
      );
    const { reviews: movieReviews, more } = await reviewPage(
      pool,
      userId,
      "WHERE r.movie_id=?",
      [movieId],
      page({}, 10),
    );
    const [myReview] = userId
      ? await reviews(
          pool,
          userId,
          "WHERE r.movie_id=? AND r.user_id=?",
          [movieId, userId],
          1,
        )
      : [];
    res.json({
      movie: presentation(movie),
      reviews: movieReviews,
      myReview: myReview || null,
      more: { reviews: more },
      screenings: (await screeningRows(pool, { movieId })).rows,
      watchlisted: Boolean(flags.watchlisted),
      watchDate: flags.watchDate,
    });
  });
  app.get("/api/users/:id", async (req, res) => {
    const userId = id(req.params.id),
      u = await userInfo(pool, userId);
    if (!u) throw new HttpError(404, "Member not found.");
    const viewer = req.session.userId || 0;
    const [[counts]] = await pool.execute(
      "SELECT (SELECT COUNT(*) FROM follows WHERE followed_id=?) AS followers,(SELECT COUNT(*) FROM follows WHERE follower_id=?) AS followingCount,EXISTS(SELECT 1 FROM follows WHERE follower_id=? AND followed_id=?) AS following,(SELECT COUNT(*) FROM review WHERE user_id=?) AS reviewCount,(SELECT COUNT(*) FROM film_list WHERE user_id=? AND (visibility='public' OR user_id=?)) AS listCount",
      [userId, userId, viewer, userId, userId, userId, viewer],
    );
    const userLists = await listCards(pool, {
        viewer,
        owner: userId,
        range: page({}, 12),
      }),
      userReviews = await reviewPage(
        pool,
        viewer,
        "WHERE r.user_id=?",
        [userId],
        page({}, 10),
      );
    res.json({
      profile: {
        userId: u.userId,
        username: u.username,
        joined: u.joined,
        premium: u.premium,
        ...counts,
        following: Boolean(counts.following),
      },
      lists: userLists.lists,
      ...(await library(pool, userId)),
      reviews: userReviews.reviews,
      more: { lists: userLists.more, reviews: userReviews.more },
    });
  });
  app.use(
    "/api",
    social(pool),
    lists(pool),
    booking(pool),
    notifications(pool),
  );
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "This page could not be found." }),
  );
  const dist = path.join(root, "dist");
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get("/{*path}", (req, res) =>
      res.sendFile(path.join(dist, "index.html")),
    );
  }
  app.use((error, req, res, next) => {
    let status = error.status || 500,
      message = error.message;
    if (error.code === "ER_DUP_ENTRY") {
      status = 409;
      message = "That item already exists. Refresh and try again.";
    }
    // Rules the database enforces itself, reached only if a request slips past the API checks.
    if (error.code === "ER_CHECK_CONSTRAINT_VIOLATED") {
      status = 400;
      message = "That value is not allowed. Check it and try again.";
    }
    if (
      error.code === "ER_NO_REFERENCED_ROW_2" ||
      error.code === "ER_ROW_IS_REFERENCED_2"
    ) {
      status = 409;
      message =
        "That item has changed or no longer exists. Refresh and try again.";
    }
    if (
      error.code === "ER_LOCK_DEADLOCK" ||
      error.code === "ER_LOCK_WAIT_TIMEOUT"
    ) {
      status = 409;
      message = "Another update is in progress. Please try again.";
    }
    if (status >= 500) {
      console.error(error);
      message = "CineCircle could not finish that request. Please try again.";
    }
    res.status(status).json({ error: message });
  });
  return app;
}
