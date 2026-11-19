import { Router } from "express";
import { requireUser, HttpError } from "../auth.mjs";

// Notifications are not stored: each one is a fact the database already records, gathered
// for the signed-in member with one UNION query, newest first.
// - comment:     someone commented on your review
// - reply:       someone replied to your comment
// - like:        someone liked your comment
// - review-like: someone liked your review
// - follow:      someone started following you
// - review:      someone you follow reviewed a film (only reviews written since you followed)
// - ticket:      you booked tickets (one notice per screening and booking time)
// - reminder:    a screening you hold tickets for starts within the hour (dated an hour before,
//                or at the booking if that was later, so it is never older than the booking)
// focusId is the comment whose replies show the item, so a link opens that level.
// users.notifications_read_at is the time of the newest notification the member has seen;
// later ones are unread.
const notificationSql = `
SELECT * FROM (
  SELECT 'comment' AS kind, rc.create_date AS at, rc.comment_id AS refId, rc.user_id AS actorId,
    u.username AS actor, r.movie_id AS movieId, m.title AS movieTitle, r.review_id AS reviewId,
    NULL AS focusId, LEFT(rc.comment_text, 140) AS detail
  FROM review_comment rc JOIN review r USING(review_id) JOIN users u ON u.user_id = rc.user_id
    JOIN movie m ON m.movie_id = r.movie_id
  WHERE r.user_id = ? AND rc.user_id <> ? AND rc.parent_comment_id IS NULL
  UNION ALL
  SELECT 'reply', rc.create_date, rc.comment_id, rc.user_id, u.username, r.movie_id, m.title,
    r.review_id, rc.parent_comment_id, LEFT(rc.comment_text, 140)
  FROM review_comment rc JOIN review_comment parent ON parent.comment_id = rc.parent_comment_id
    JOIN review r ON r.review_id = rc.review_id JOIN users u ON u.user_id = rc.user_id
    JOIN movie m ON m.movie_id = r.movie_id
  WHERE parent.user_id = ? AND rc.user_id <> ?
  UNION ALL
  SELECT 'like', cl.like_date, cl.comment_id, cl.user_id, u.username, r.movie_id, m.title,
    r.review_id, rc.parent_comment_id, LEFT(rc.comment_text, 140)
  FROM comment_like cl JOIN review_comment rc ON rc.comment_id = cl.comment_id
    JOIN review r ON r.review_id = rc.review_id JOIN users u ON u.user_id = cl.user_id
    JOIN movie m ON m.movie_id = r.movie_id
  WHERE rc.user_id = ? AND cl.user_id <> ?
  UNION ALL
  SELECT 'review-like', rl.like_date, rl.review_id, rl.user_id, u.username, r.movie_id, m.title,
    r.review_id, NULL, LEFT(r.review_text, 140)
  FROM review_like rl JOIN review r ON r.review_id = rl.review_id JOIN users u ON u.user_id = rl.user_id
    JOIN movie m ON m.movie_id = r.movie_id
  WHERE r.user_id = ? AND rl.user_id <> ?
  UNION ALL
  SELECT 'review', r.create_date, r.review_id, r.user_id, u.username, r.movie_id, m.title,
    r.review_id, NULL, LEFT(r.review_text, 140)
  FROM follows f JOIN review r ON r.user_id = f.followed_id AND r.create_date > f.follow_date
    JOIN users u ON u.user_id = r.user_id JOIN movie m ON m.movie_id = r.movie_id
  WHERE f.follower_id = ?
  UNION ALL
  SELECT 'follow', f.follow_date, f.follower_id, f.follower_id, u.username, NULL, NULL, NULL, NULL, NULL
  FROM follows f JOIN users u ON u.user_id = f.follower_id
  WHERE f.followed_id = ?
  UNION ALL
  SELECT 'ticket', MIN(t.booking_date), MIN(t.ticket_id), NULL, NULL, s.movie_id, m.title, NULL, NULL,
    CONCAT(COUNT(*), '|', DATE_FORMAT(s.start_time, '%Y-%m-%d %H:%i'))
  FROM ticket t JOIN screening s USING(screening_id) JOIN movie m ON m.movie_id = s.movie_id
  WHERE t.user_id = ?
  GROUP BY t.screening_id, s.movie_id, m.title, s.start_time,
    DATE_FORMAT(t.booking_date, '%Y-%m-%d %H:%i')
  UNION ALL
  SELECT 'reminder', GREATEST(DATE_SUB(s.start_time, INTERVAL 1 HOUR), mine.booked), s.screening_id,
    NULL, NULL, s.movie_id, m.title, NULL, NULL,
    CONCAT(DATE_FORMAT(s.start_time, '%H:%i'), '|', c.cinema_name)
  FROM screening s
    JOIN (SELECT screening_id, MIN(booking_date) AS booked FROM ticket WHERE user_id = ?
      GROUP BY screening_id) mine ON mine.screening_id = s.screening_id
    JOIN movie m ON m.movie_id = s.movie_id JOIN cinema c ON c.cinema_id = s.cinema_id
  WHERE s.start_time > NOW() AND s.start_time <= DATE_ADD(NOW(), INTERVAL 1 HOUR)
) n
ORDER BY at DESC, kind
LIMIT 30`;
// Every placeholder is the signed-in member's id.
const placeholders = notificationSql.split("?").length - 1;

export function notifications(pool) {
  const router = Router();
  router.get("/me/notifications", requireUser, async (req, res) => {
    const me = req.session.userId;
    const [[user]] = await pool.execute(
      "SELECT notifications_read_at AS readAt FROM users WHERE user_id=?",
      [me],
    );
    const [rows] = await pool.query(
      notificationSql,
      Array(placeholders).fill(me),
    );
    const items = rows.map((n) => ({
      ...n,
      // The time is part of the key, so a repeated event (following again) counts as new.
      key: `${n.kind}-${n.refId}-${n.actorId ?? ""}-${n.at}`,
      unread: !user.readAt || n.at > user.readAt,
    }));
    res.json({
      notifications: items,
      unread: items.filter((n) => n.unread).length,
      readAt: user.readAt,
    });
  });
  // Marks notifications read up to `upTo`, the time of the newest one the member was shown
  // (or now, without it). Anything that arrived after it stays unread; the mark never moves
  // backwards or past the present.
  router.post("/me/notifications/read", requireUser, async (req, res) => {
    const upTo = req.body?.upTo;
    if (upTo != null && !/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(upTo))
      throw new HttpError(
        400,
        "Give the time of the newest notification seen.",
      );
    await pool.execute(
      "UPDATE users SET notifications_read_at=GREATEST(COALESCE(notifications_read_at,'1000-01-01'),LEAST(COALESCE(CAST(? AS DATETIME),NOW()),NOW())) WHERE user_id=?",
      [upTo ?? null, req.session.userId],
    );
    res.json({ ok: true });
  });
  return router;
}
