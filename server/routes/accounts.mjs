import { Router } from "express";
import {
  hashPassword,
  verifyPassword,
  userInfo,
  requireUser,
  HttpError,
  text,
  regenerate,
  saveSession,
} from "../auth.mjs";
import { transaction } from "../db.mjs";
import { premiumPlan } from "../catalog.mjs";
import { becomePremium } from "./membership.mjs";

// The shared demo account behind "Continue as Mia". Its name, email and password stay fixed
// and it cannot be deleted, so the button keeps working for everyone.
export const demoUsername = "mia";

function newUsername(value) {
  const username = text(value, 40, true);
  if (!/^[a-zA-Z0-9_]{3,40}$/.test(username))
    throw new HttpError(
      400,
      "Use 3–40 letters, numbers or underscores for your username.",
    );
  return username;
}
function newEmail(value) {
  const email = text(value, 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new HttpError(400, "Enter a valid email address.");
  return email;
}
function newPassword(value) {
  const password = typeof value === "string" ? value : "";
  if (password.length < 8 || password.length > 128)
    throw new HttpError(400, "Use a password with 8–128 characters.");
  return password;
}
// A unique key taken by someone else between the check and the write still gets a clear answer.
const taken = (message) => (error) => {
  throw error.code === "ER_DUP_ENTRY" ? new HttpError(409, message) : error;
};
// Signs the member out everywhere except, optionally, the current browser.
function endSessions(req, userId, keep = null) {
  return new Promise((resolve) =>
    req.sessionStore.all((error, sessions) => {
      if (error || !sessions) return resolve();
      const ids = Object.entries(sessions)
        .filter(([sid, s]) => s?.userId === userId && sid !== keep)
        .map(([sid]) => sid);
      let pending = ids.length;
      if (!pending) return resolve();
      for (const sid of ids)
        req.sessionStore.destroy(sid, () => --pending || resolve());
    }),
  );
}

export function accounts(pool) {
  const router = Router();
  router.get("/session", async (req, res) => {
    const [[demo]] = await pool.execute(
      "SELECT p.expiry_date AS premiumUntil FROM users u JOIN premium_user p USING(user_id) WHERE u.username=? AND p.start_date<=CURRENT_DATE AND p.expiry_date>=CURRENT_DATE",
      [demoUsername],
    );
    res.json({
      user: req.session.userId
        ? await userInfo(pool, req.session.userId)
        : null,
      premiumPlan: {
        percentOff: Math.round((1 - premiumPlan.discountRate) * 100),
        months: premiumPlan.months,
      },
      demo: {
        username: demoUsername,
        premiumUntil: demo?.premiumUntil ?? null,
      },
    });
  });
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
      "SELECT DISTINCT u.user_id,u.password_hash FROM users u LEFT JOIN user_email e USING(user_id) WHERE (u.username=? OR e.email=?) AND u.deleted_date IS NULL LIMIT 2",
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
    const username = newUsername(req.body.username),
      email = newEmail(req.body.email),
      password = newPassword(req.body.password);
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
      // A new member starts as regular, or straight away as premium if they chose it.
      if (req.body.premium === true) await becomePremium(c, userId);
      else
        await c.execute("INSERT INTO regular_user(user_id) VALUES(?)", [
          userId,
        ]);
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
  // Account settings. Each change locks the member's row; the shared demo account is fixed.
  async function lockMember(c, userId) {
    const [[member]] = await c.execute(
      "SELECT username,password_hash AS hash FROM users WHERE user_id=? AND deleted_date IS NULL FOR UPDATE",
      [userId],
    );
    if (!member) throw new HttpError(401, "Sign in to continue.");
    if (member.username === demoUsername)
      throw new HttpError(
        403,
        "The shared demo account can’t be changed. Create your own account to try this.",
      );
    return member;
  }
  router.put("/me/username", requireUser, async (req, res) => {
    const username = newUsername(req.body.username),
      userId = req.session.userId;
    await transaction(pool, async (c) => {
      await lockMember(c, userId);
      const [[other]] = await c.execute(
        "SELECT user_id FROM users WHERE username=? AND user_id<>?",
        [username, userId],
      );
      if (other)
        throw new HttpError(
          409,
          `The username “${username}” is already taken.`,
        );
      await c
        .execute("UPDATE users SET username=? WHERE user_id=?", [
          username,
          userId,
        ])
        .catch(taken(`The username “${username}” is already taken.`));
    });
    res.json({ user: await userInfo(pool, userId) });
  });
  // Replaces the email shown in settings (the member's first, if they have several).
  router.put("/me/email", requireUser, async (req, res) => {
    const email = newEmail(req.body.email),
      userId = req.session.userId;
    await transaction(pool, async (c) => {
      await lockMember(c, userId);
      const [[owner]] = await c.execute(
        "SELECT user_id AS userId FROM user_email WHERE email=?",
        [email],
      );
      if (owner && owner.userId !== userId)
        throw new HttpError(409, `The email ${email} is already in use.`);
      const [[current]] = await c.execute(
        "SELECT email FROM user_email WHERE user_id=? ORDER BY email LIMIT 1",
        [userId],
      );
      if (current?.email === email) return;
      if (current)
        await c.execute("DELETE FROM user_email WHERE user_id=? AND email=?", [
          userId,
          current.email,
        ]);
      if (!owner)
        await c
          .execute("INSERT INTO user_email VALUES(?,?)", [userId, email])
          .catch(taken(`The email ${email} is already in use.`));
    });
    res.json({ user: await userInfo(pool, userId) });
  });
  // Needs the current password; other browsers signed in as the member are signed out.
  router.put("/me/password", requireUser, async (req, res) => {
    const userId = req.session.userId,
      next = newPassword(req.body.newPassword);
    if (req.body.confirmPassword !== next)
      throw new HttpError(400, "The new passwords don’t match.");
    await transaction(pool, async (c) => {
      const member = await lockMember(c, userId);
      if (
        typeof req.body.currentPassword !== "string" ||
        !(await verifyPassword(req.body.currentPassword, member.hash))
      )
        throw new HttpError(400, "Your current password is not correct.");
      if (await verifyPassword(next, member.hash))
        throw new HttpError(
          400,
          "Choose a new password, different from your current one.",
        );
      await c.execute("UPDATE users SET password_hash=? WHERE user_id=?", [
        await hashPassword(next),
        userId,
      ]);
    });
    await endSessions(req, userId, req.sessionID);
    res.json({ ok: true });
  });
  // Deletes the account in one transaction: comments it wrote and the conversations under them
  // and under its reviews, likes, lists and their bookmarks, follows, watch records, emails and
  // membership. Tickets stay as anonymous sales records (seats stay sold), so the users row is
  // kept but anonymised: a name no one can register (it has hyphens), a password that matches
  // nothing, no email, regular type, and deleted_date set, which hides it everywhere. Its old
  // name and email can be registered again. Needs the current password; cannot be undone.
  router.delete("/me", requireUser, async (req, res) => {
    const userId = req.session.userId;
    await transaction(pool, async (c) => {
      const member = await lockMember(c, userId);
      if (
        typeof req.body.password !== "string" ||
        !(await verifyPassword(req.body.password, member.hash))
      )
        throw new HttpError(400, "Your password is not correct.");
      const [doomed] = await c.execute(
        `WITH RECURSIVE sub AS (
           SELECT comment_id FROM review_comment
           WHERE user_id=? OR review_id IN (SELECT review_id FROM review WHERE user_id=?)
           UNION
           SELECT ch.comment_id FROM review_comment ch JOIN sub ON ch.parent_comment_id=sub.comment_id
         ) SELECT comment_id AS id FROM sub ORDER BY comment_id DESC`,
        [userId, userId],
      );
      const ids = doomed.map((d) => d.id);
      await c.execute("DELETE FROM comment_like WHERE user_id=?", [userId]);
      for (const commentId of ids) {
        await c.execute("DELETE FROM comment_like WHERE comment_id=?", [
          commentId,
        ]);
        await c.execute("DELETE FROM review_comment WHERE comment_id=?", [
          commentId,
        ]);
      }
      // Every placeholder below is the member's id.
      for (const sql of [
        "DELETE FROM review_like WHERE user_id=? OR review_id IN (SELECT review_id FROM review WHERE user_id=?)",
        "DELETE FROM review WHERE user_id=?",
        "DELETE FROM list_bookmark WHERE user_id=? OR owner_id=?",
        "DELETE FROM film_list_movie WHERE user_id=?",
        "DELETE FROM film_list WHERE user_id=?",
        "DELETE FROM follows WHERE follower_id=? OR followed_id=?",
        "DELETE FROM wants_to_watch WHERE user_id=?",
        "DELETE FROM watches WHERE user_id=?",
        "DELETE FROM user_email WHERE user_id=?",
        // A premium member becomes regular, the same move as when a membership ends.
        "DELETE FROM premium_user WHERE user_id=?",
        "UPDATE users SET user_type='regular' WHERE user_id=?",
        "INSERT INTO regular_user(user_id) SELECT ? FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM regular_user WHERE user_id=?)",
        "UPDATE users SET username=CONCAT('deleted-member-',user_id),password_hash='deleted',notifications_read_at=NULL,deleted_date=NOW() WHERE user_id=?",
      ])
        await c.execute(sql, Array(sql.split("?").length - 1).fill(userId));
    });
    await endSessions(req, userId, req.sessionID);
    req.session.destroy(() => {
      res.clearCookie("cinecircle.sid");
      res.json({ ok: true });
    });
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
