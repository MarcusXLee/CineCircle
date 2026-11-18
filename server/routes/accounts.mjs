import { Router } from "express";
import {
  hashPassword,
  verifyPassword,
  userInfo,
  HttpError,
  text,
  regenerate,
  saveSession,
} from "../auth.mjs";

export function accounts(pool) {
  const router = Router();
  router.get("/session", async (req, res) =>
    res.json({
      user: req.session.userId
        ? await userInfo(pool, req.session.userId)
        : null,
    }),
  );
  router.post("/auth/login", async (req, res) => {
    const username = text(req.body.username, 254, true),
      password = req.body.password;
    if (
      typeof password !== "string" ||
      password.length < 1 ||
      password.length > 128
    )
      throw new HttpError(400, "Enter a password with 1–128 characters.");
    const [users] = await pool.execute(
      "SELECT DISTINCT u.user_id,u.password_hash FROM users u LEFT JOIN user_email e USING(user_id) WHERE u.username=? OR e.email=? LIMIT 2",
      [username, username],
    );
    if (
      users.length !== 1 ||
      !(await verifyPassword(password, users[0].password_hash))
    )
      throw new HttpError(401, "The username or password does not match.");
    await regenerate(req);
    req.session.userId = users[0].user_id;
    await saveSession(req);
    res.json({ user: await userInfo(pool, req.session.userId) });
  });
  router.post("/auth/register", async (req, res) => {
    const username = text(req.body.username, 40, true),
      email = text(req.body.email, 254, true).toLowerCase();
    const password =
      typeof req.body.password === "string" ? req.body.password : "";
    if (!/^[a-zA-Z0-9_]{3,40}$/.test(username))
      throw new HttpError(
        400,
        "Use 3–40 letters, numbers or underscores for your username.",
      );
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new HttpError(400, "Enter a valid email address.");
    if (password.length < 8 || password.length > 128)
      throw new HttpError(400, "Use a password with 8–128 characters.");
    const hash = await hashPassword(password);
    const c = await pool.getConnection();
    let locked = false,
      userId;
    try {
      const [[lock]] = await c.query(
        "SELECT GET_LOCK('cinecircle-register',5) AS acquired",
      );
      if (!lock.acquired)
        throw new HttpError(503, "Registration is busy. Please try again.");
      locked = true;
      await c.beginTransaction();
      const [existing] = await c.execute(
        "SELECT u.user_id FROM users u LEFT JOIN user_email e USING(user_id) WHERE u.username=? OR e.email=? LIMIT 1",
        [username, email],
      );
      if (existing.length)
        throw new HttpError(409, "That username or email is already in use.");
      const [result] = await c.execute(
        "INSERT INTO users(username,password_hash) VALUES(?,?)",
        [username, hash],
      );
      userId = result.insertId;
      await c.execute("INSERT INTO user_email VALUES(?,?)", [userId, email]);
      await c.execute("INSERT INTO regular_user VALUES(?)", [userId]);
      await c.commit();
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      if (locked) await c.query("SELECT RELEASE_LOCK('cinecircle-register')");
      c.release();
    }
    await regenerate(req);
    req.session.userId = userId;
    await saveSession(req);
    res.status(201).json({ user: await userInfo(pool, userId) });
  });
  router.post("/auth/logout", (req, res, next) =>
    req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie("cinecircle.sid");
      res.json({ ok: true });
    }),
  );
  return router;
}
