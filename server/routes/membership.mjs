import { Router } from "express";
import { requireUser, userInfo, HttpError } from "../auth.mjs";
import { transaction } from "../db.mjs";
import { premiumPlan } from "../catalog.mjs";

// Regular and premium members are disjoint subtypes of users. users.user_type says which one a
// member is, and each subtype row must match it (composite foreign keys), so moving a member
// between the two is one transaction: remove the old subtype row, change the type, add the new
// row. Nothing else refers to either subtype table, so the member's reviews, lists and tickets
// are untouched.

// Starts a premium membership from today for a member the caller has locked, or makes a new
// account premium when it has no subtype row yet.
export async function becomePremium(c, userId) {
  await c.execute("DELETE FROM regular_user WHERE user_id=?", [userId]);
  await c.execute("UPDATE users SET user_type='premium' WHERE user_id=?", [
    userId,
  ]);
  await c.execute(
    "INSERT INTO premium_user(user_id,start_date,expiry_date,discount_rate) VALUES(?,CURRENT_DATE,DATE_SUB(DATE_ADD(CURRENT_DATE,INTERVAL ? MONTH),INTERVAL 1 DAY),?)",
    [userId, premiumPlan.months, premiumPlan.discountRate],
  );
}

// Premium members whose membership ended before today become regular members again. Runs when
// the server starts and every hour; until then, pricing already treats them as regular.
export async function expireMemberships(pool) {
  const [expired] = await pool.query(
    "SELECT user_id AS userId FROM premium_user WHERE expiry_date<CURRENT_DATE",
  );
  for (const { userId } of expired)
    await transaction(pool, async (c) => {
      const [[still]] = await c.execute(
        "SELECT 1 AS expired FROM users u JOIN premium_user p USING(user_id) WHERE u.user_id=? AND p.expiry_date<CURRENT_DATE FOR UPDATE",
        [userId],
      );
      if (!still) return;
      await c.execute("DELETE FROM premium_user WHERE user_id=?", [userId]);
      await c.execute("UPDATE users SET user_type='regular' WHERE user_id=?", [
        userId,
      ]);
      await c.execute("INSERT INTO regular_user(user_id) VALUES(?)", [userId]);
    });
  return expired.length;
}

export function membership(pool) {
  const router = Router();
  router.post("/me/membership", requireUser, async (req, res) => {
    const userId = req.session.userId;
    await transaction(pool, async (c) => {
      const [[member]] = await c.execute(
        `SELECT u.user_type AS type, p.start_date<=CURRENT_DATE AND p.expiry_date>=CURRENT_DATE AS current,
           p.expiry_date<=DATE_ADD(CURRENT_DATE,INTERVAL 7 DAY) AS ending
         FROM users u LEFT JOIN premium_user p USING(user_id) WHERE u.user_id=? FOR UPDATE`,
        [userId],
      );
      if (!member) throw new HttpError(401, "Sign in to continue.");
      // In its last week a membership can be extended by another term from its last day.
      if (member.current && member.ending)
        await c.execute(
          "UPDATE premium_user SET expiry_date=DATE_SUB(DATE_ADD(DATE_ADD(expiry_date,INTERVAL 1 DAY),INTERVAL ? MONTH),INTERVAL 1 DAY) WHERE user_id=?",
          [premiumPlan.months, userId],
        );
      else if (member.current)
        throw new HttpError(409, "You are already a premium member.");
      // A membership that ended but has not been moved back yet is renewed in place (the
      // row is written even if it went missing, so the member is never premium without one).
      else if (member.type === "premium")
        await c.execute(
          `INSERT INTO premium_user(user_id,start_date,expiry_date,discount_rate)
           VALUES(?,CURRENT_DATE,DATE_SUB(DATE_ADD(CURRENT_DATE,INTERVAL ? MONTH),INTERVAL 1 DAY),?)
           ON DUPLICATE KEY UPDATE start_date=VALUES(start_date),expiry_date=VALUES(expiry_date),discount_rate=VALUES(discount_rate)`,
          [userId, premiumPlan.months, premiumPlan.discountRate],
        );
      else await becomePremium(c, userId);
    });
    res.json({ user: await userInfo(pool, userId) });
  });
  return router;
}
