import { Router } from "express";
import { HttpError, id, text, requireUser, page, trimPage } from "../auth.mjs";
import { transaction } from "../db.mjs";
import { movieSelect, presentation } from "../catalog.mjs";

// A page of list cards: public lists plus the viewer's own private ones, unless publicOnly.
// One member's lists run newest first; browsing everyone's, the most bookmarked lead; a
// member's bookmarks (savedBy) run in the order they were saved.
export async function listCards(
  pool,
  {
    viewer = 0,
    owner = null,
    savedBy = null,
    range = page({}, 100),
    publicOnly = false,
  },
) {
  const order = savedBy
    ? "saved.bookmark_date DESC,saved.owner_id,saved.list_id"
    : owner
      ? "f.update_date DESC,f.list_id DESC"
      : "bookmarks DESC,f.update_date DESC,f.user_id,f.list_id DESC";
  const [rows] = await pool.execute(
    `SELECT f.user_id AS userId,f.list_id AS listId,f.list_name AS name,f.description,f.visibility,f.update_date AS updatedAt,u.username,
    (SELECT COUNT(*) FROM film_list_movie lm WHERE lm.user_id=f.user_id AND lm.list_id=f.list_id) AS movieCount,
    (SELECT GROUP_CONCAT(lm.movie_id ORDER BY lm.position SEPARATOR ',') FROM film_list_movie lm WHERE lm.user_id=f.user_id AND lm.list_id=f.list_id) AS covers,
    (SELECT COUNT(*) FROM list_bookmark b WHERE b.owner_id=f.user_id AND b.list_id=f.list_id) AS bookmarks,
    EXISTS(SELECT 1 FROM list_bookmark b WHERE b.owner_id=f.user_id AND b.list_id=f.list_id AND b.user_id=?) AS bookmarked
    FROM film_list f JOIN users u USING(user_id)
    ${savedBy ? "JOIN list_bookmark saved ON saved.owner_id=f.user_id AND saved.list_id=f.list_id AND saved.user_id=?" : ""}
    WHERE (f.visibility='public' OR f.user_id=?) ${owner ? "AND f.user_id=?" : ""} ORDER BY ${order} LIMIT ${range.limit + 1} OFFSET ${range.offset}`,
    [
      viewer,
      ...(savedBy ? [savedBy] : []),
      publicOnly ? 0 : viewer,
      ...(owner ? [owner] : []),
    ],
  );
  const more = trimPage(rows, range);
  return {
    lists: rows.map((r) => ({
      ...r,
      bookmarked: Boolean(r.bookmarked),
      covers: (r.covers || "")
        .split(",")
        .filter(Boolean)
        .slice(0, 4)
        .map(Number),
    })),
    more,
  };
}
async function owner(c, req) {
  const userId = id(req.params.userId),
    listId = id(req.params.listId);
  if (userId !== req.session.userId)
    throw new HttpError(403, "You can only change your own lists.");
  const [[list]] = await c.execute(
    "SELECT * FROM film_list WHERE user_id=? AND list_id=? FOR UPDATE",
    [userId, listId],
  );
  if (!list) throw new HttpError(404, "List not found.");
  return { userId, listId, list };
}
const touch = (c, u, l) =>
  c.execute(
    "UPDATE film_list SET update_date=CURRENT_TIMESTAMP WHERE user_id=? AND list_id=?",
    [u, l],
  );
export function lists(pool) {
  const router = Router();
  router.get("/lists", async (req, res) =>
    res.json(
      await listCards(pool, {
        viewer: req.session.userId || 0,
        owner: req.query.userId ? id(req.query.userId) : null,
        range: page(req.query, 12),
        publicOnly: req.query.public === "1",
      }),
    ),
  );
  router.get("/me/lists", requireUser, async (req, res) =>
    res.json(
      await listCards(pool, {
        viewer: req.session.userId,
        owner: req.session.userId,
        range: page(req.query, 12),
      }),
    ),
  );
  // Saved lists still visible to the member (a list made private drops out), with their count.
  router.get("/me/bookmarks", requireUser, async (req, res) => {
    const [[{ total }]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM list_bookmark b JOIN film_list f ON f.user_id=b.owner_id AND f.list_id=b.list_id WHERE b.user_id=? AND f.visibility='public'",
      [req.session.userId],
    );
    res.json({
      ...(await listCards(pool, {
        viewer: req.session.userId,
        savedBy: req.session.userId,
        range: page(req.query, 12),
      })),
      total,
    });
  });
  // Bookmark another member's public list, or remove the bookmark.
  router.put(
    "/lists/:userId/:listId/bookmark",
    requireUser,
    async (req, res) => {
      const userId = id(req.params.userId),
        listId = id(req.params.listId);
      if (userId === req.session.userId)
        throw new HttpError(400, "Your own lists are already in your corner.");
      await transaction(pool, async (c) => {
        const [[list]] = await c.execute(
          "SELECT visibility FROM film_list WHERE user_id=? AND list_id=? FOR UPDATE",
          [userId, listId],
        );
        if (!list || list.visibility !== "public")
          throw new HttpError(404, "This list is private or no longer exists.");
        await c.execute(
          "INSERT INTO list_bookmark(user_id,owner_id,list_id) VALUES(?,?,?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)",
          [req.session.userId, userId, listId],
        );
      });
      res.json({ ok: true });
    },
  );
  router.delete(
    "/lists/:userId/:listId/bookmark",
    requireUser,
    async (req, res) => {
      await pool.execute(
        "DELETE FROM list_bookmark WHERE user_id=? AND owner_id=? AND list_id=?",
        [req.session.userId, id(req.params.userId), id(req.params.listId)],
      );
      res.json({ ok: true });
    },
  );
  router.post("/lists", requireUser, async (req, res) => {
    // `movieId` optionally starts the list with a film, in the same transaction.
    const name = text(req.body.name, 255, true),
      description = text(req.body.description, 3000),
      visibility = req.body.visibility || "private",
      firstMovie = req.body.movieId == null ? null : id(req.body.movieId);
    if (!["public", "private"].includes(visibility))
      throw new HttpError(400, "Choose public or private visibility.");
    const listId = await transaction(pool, async (c) => {
      await c.execute("SELECT user_id FROM users WHERE user_id=? FOR UPDATE", [
        req.session.userId,
      ]);
      const [[{ next }]] = await c.execute(
        "SELECT COALESCE(MAX(list_id),0)+1 AS next FROM film_list WHERE user_id=?",
        [req.session.userId],
      );
      await c.execute(
        "INSERT INTO film_list(user_id,list_id,list_name,description,visibility) VALUES(?,?,?,?,?)",
        [req.session.userId, next, name, description, visibility],
      );
      if (firstMovie) {
        const [[m]] = await c.execute(
          "SELECT movie_id FROM movie WHERE movie_id=?",
          [firstMovie],
        );
        if (!m) throw new HttpError(404, "Film not found.");
        await c.execute("INSERT INTO film_list_movie VALUES(?,?,?,1)", [
          req.session.userId,
          next,
          firstMovie,
        ]);
      }
      return next;
    });
    res.status(201).json({
      list: {
        userId: req.session.userId,
        listId,
        name,
        description,
        visibility,
      },
    });
  });
  router.get("/lists/:userId/:listId", async (req, res) => {
    const u = id(req.params.userId),
      l = id(req.params.listId);
    const [[list]] = await pool.execute(
      `SELECT f.user_id AS userId,f.list_id AS listId,f.list_name AS name,f.description,f.visibility,u.username,
      (SELECT COUNT(*) FROM list_bookmark b WHERE b.owner_id=f.user_id AND b.list_id=f.list_id) AS bookmarks,
      EXISTS(SELECT 1 FROM list_bookmark b WHERE b.owner_id=f.user_id AND b.list_id=f.list_id AND b.user_id=?) AS bookmarked
      FROM film_list f JOIN users u USING(user_id) WHERE f.user_id=? AND f.list_id=? AND (f.visibility='public' OR f.user_id=?)`,
      [req.session.userId || 0, u, l, req.session.userId || 0],
    );
    if (!list)
      throw new HttpError(404, "This list is private or no longer exists.");
    const [movies] = await pool.execute(
      `${movieSelect} JOIN film_list_movie lm ON lm.movie_id=m.movie_id WHERE lm.user_id=? AND lm.list_id=? ORDER BY lm.position,lm.movie_id`,
      [u, l],
    );
    res.json({
      list: { ...list, bookmarked: Boolean(list.bookmarked) },
      movies: movies.map(presentation),
    });
  });
  router.patch("/lists/:userId/:listId", requireUser, async (req, res) => {
    await transaction(pool, async (c) => {
      const { userId, listId, list } = await owner(c, req);
      const name =
          req.body.name === undefined
            ? list.list_name
            : text(req.body.name, 255, true),
        description =
          req.body.description === undefined
            ? list.description
            : text(req.body.description, 3000),
        visibility = req.body.visibility || list.visibility;
      if (!["public", "private"].includes(visibility))
        throw new HttpError(400, "Choose public or private visibility.");
      await c.execute(
        "UPDATE film_list SET list_name=?,description=?,visibility=? WHERE user_id=? AND list_id=?",
        [name, description, visibility, userId, listId],
      );
    });
    res.json({ ok: true });
  });
  router.delete("/lists/:userId/:listId", requireUser, async (req, res) => {
    await transaction(pool, async (c) => {
      const { userId, listId } = await owner(c, req);
      await c.execute(
        "DELETE FROM list_bookmark WHERE owner_id=? AND list_id=?",
        [userId, listId],
      );
      await c.execute(
        "DELETE FROM film_list_movie WHERE user_id=? AND list_id=?",
        [userId, listId],
      );
      await c.execute("DELETE FROM film_list WHERE user_id=? AND list_id=?", [
        userId,
        listId,
      ]);
    });
    res.json({ ok: true });
  });
  router.post(
    "/lists/:userId/:listId/movies",
    requireUser,
    async (req, res) => {
      const movieId = id(req.body.movieId);
      await transaction(pool, async (c) => {
        const { userId, listId } = await owner(c, req);
        const [[m]] = await c.execute(
          "SELECT movie_id FROM movie WHERE movie_id=?",
          [movieId],
        );
        if (!m) throw new HttpError(404, "Film not found.");
        const [[{ position }]] = await c.execute(
          "SELECT COALESCE(MAX(position),0)+1 AS position FROM film_list_movie WHERE user_id=? AND list_id=?",
          [userId, listId],
        );
        await c.execute(
          "INSERT INTO film_list_movie VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE movie_id=VALUES(movie_id)",
          [userId, listId, movieId, position],
        );
        await touch(c, userId, listId);
      });
      res.json({ ok: true });
    },
  );
  router.delete(
    "/lists/:userId/:listId/movies/:movieId",
    requireUser,
    async (req, res) => {
      await transaction(pool, async (c) => {
        const { userId, listId } = await owner(c, req);
        await c.execute(
          "DELETE FROM film_list_movie WHERE user_id=? AND list_id=? AND movie_id=?",
          [userId, listId, id(req.params.movieId)],
        );
        await touch(c, userId, listId);
      });
      res.json({ ok: true });
    },
  );
  router.put("/lists/:userId/:listId/order", requireUser, async (req, res) => {
    if (!Array.isArray(req.body.movieIds) || req.body.movieIds.length > 1000)
      throw new HttpError(400, "Provide the films in their new order.");
    const ids = req.body.movieIds.map(id);
    await transaction(pool, async (c) => {
      const { userId, listId } = await owner(c, req);
      const [current] = await c.execute(
        "SELECT movie_id FROM film_list_movie WHERE user_id=? AND list_id=?",
        [userId, listId],
      );
      if (
        ids.length !== current.length ||
        new Set(ids).size !== ids.length ||
        current.some((m) => !ids.includes(m.movie_id))
      )
        throw new HttpError(
          409,
          "This list has changed. Refresh it before reordering.",
        );
      for (const [index, movieId] of ids.entries())
        await c.execute(
          "UPDATE film_list_movie SET position=? WHERE user_id=? AND list_id=? AND movie_id=?",
          [index + 1, userId, listId, movieId],
        );
      await touch(c, userId, listId);
    });
    res.json({ ok: true });
  });
  return router;
}
