import { Router } from "express";
import {
  HttpError,
  id,
  requireUser,
  userInfo,
  page,
  trimPage,
} from "../auth.mjs";
import { transaction } from "../db.mjs";
import { basePrice, presentation, premiumPlan } from "../catalog.mjs";

const screeningSelect = `SELECT s.screening_id AS screeningId,s.movie_id AS movieId,s.cinema_id AS cinemaId,s.hall_id AS hallId,s.start_time AS startTime,s.end_time AS endTime,m.title AS movieTitle,m.duration,c.cinema_name AS cinemaName,c.district,c.street,c.building,h.hall_name AS hallName,
  (SELECT COUNT(*) FROM screening_seat ss WHERE ss.screening_id=s.screening_id AND ss.status='available' AND NOT EXISTS(SELECT 1 FROM ticket t WHERE t.screening_id=ss.screening_id AND t.screening_seat_id=ss.screening_seat_id)) AS available
  FROM screening s JOIN movie m USING(movie_id) JOIN cinema c USING(cinema_id) JOIN hall h ON h.cinema_id=s.cinema_id AND h.hall_id=s.hall_id`;
const seatsSelect = `SELECT ss.screening_seat_id AS screeningSeatId,s.seat_number AS number,s.seat_type AS type,
  CASE WHEN EXISTS(SELECT 1 FROM ticket t WHERE t.screening_id=ss.screening_id AND t.screening_seat_id=ss.screening_seat_id) THEN 'booked' ELSE ss.status END AS status
  FROM screening_seat ss JOIN seat s ON s.cinema_id=ss.cinema_id AND s.hall_id=ss.hall_id AND s.seat_id=ss.seat_id`;
export async function screeningRows(pool, filters = {}, range = page({}, 200)) {
  const where = ["s.start_time>NOW()"],
    params = [];
  if (filters.movieId) {
    where.push("s.movie_id=?");
    params.push(id(filters.movieId));
  }
  if (filters.cinemaId) {
    where.push("s.cinema_id=?");
    params.push(id(filters.cinemaId));
  }
  if (filters.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.date))
      throw new HttpError(400, "Choose a valid date.");
    where.push("DATE(s.start_time)=?");
    params.push(filters.date);
  }
  const [rows] = await pool.execute(
    `${screeningSelect} WHERE ${where.join(" AND ")} ORDER BY s.start_time,s.screening_id LIMIT ${range.limit + 1} OFFSET ${range.offset}`,
    params,
  );
  const more = trimPage(rows, range);
  return {
    rows: rows.map((s) => ({
      ...s,
      poster: presentation(s).poster,
      fromPrice: basePrice(s, { type: "standard" }),
    })),
    more,
  };
}
async function getScreening(c, screeningId) {
  const [[screening]] = await c.execute(
    `${screeningSelect} WHERE s.screening_id=?`,
    [screeningId],
  );
  if (!screening) throw new HttpError(404, "Screening not found.");
  return screening;
}
function selection(body) {
  const screeningId = id(body.screeningId);
  if (
    !Array.isArray(body.seatIds) ||
    !body.seatIds.length ||
    body.seatIds.length > 6
  )
    throw new HttpError(400, "Choose between 1 and 6 seats.");
  const seatIds = body.seatIds.map(id).sort((a, b) => a - b);
  if (new Set(seatIds).size !== seatIds.length)
    throw new HttpError(400, "Choose each seat only once.");
  return { screeningId, seatIds };
}
async function selectedSeats(c, screeningId, seatIds) {
  const [rows] = await c.execute(
    `${seatsSelect} WHERE ss.screening_id=? AND ss.screening_seat_id IN(${seatIds.map(() => "?").join(",")}) ORDER BY ss.screening_seat_id`,
    [screeningId, ...seatIds],
  );
  if (rows.length !== seatIds.length)
    throw new HttpError(
      400,
      "One of these seats does not belong to this screening.",
    );
  if (rows.some((s) => s.status !== "available"))
    throw new HttpError(
      409,
      "One of those seats was just taken. Choose another seat.",
    );
  return rows;
}
async function quote(c, screening, seats, userId) {
  if (
    new Date(screening.startTime.replace(" ", "T") + "+08:00").getTime() <=
    Date.now()
  )
    throw new HttpError(409, "Booking has closed for this screening.");
  const user = await userInfo(c, userId);
  if (!user) throw new HttpError(401, "Sign in to continue.");
  const weekday = new Date(
    screening.startTime.slice(0, 10) + "T12:00:00Z",
  ).getUTCDay();
  const eligible =
    weekday > 0 &&
    weekday < 6 &&
    Number(screening.startTime.slice(11, 13)) < 17;
  const [discounts] = await c.query(
    "SELECT discount_id AS discountId,discount_type AS label,price AS amount FROM discount WHERE discount_type='Weekday matinee' ORDER BY price DESC LIMIT 1",
  );
  const fixed = eligible ? discounts[0] : null;
  // The member saving at a payable rate, and the better of it and the fixed offer.
  const rateSaving = (original, rate) =>
    rate ? Math.round(original * (1 - rate) * 100) / 100 : 0;
  const bestSaving = (original, rate) =>
    Math.min(
      original,
      Math.max(rateSaving(original, rate), fixed?.amount || 0),
    );
  const items = seats.map((seat) => {
    const original = basePrice(screening, seat),
      memberSaving = rateSaving(original, user.premium && user.discountRate);
    const saving = bestSaving(original, user.premium && user.discountRate);
    const member = memberSaving > 0 && memberSaving >= (fixed?.amount || 0);
    return {
      ...seat,
      original,
      price: Math.round((original - saving) * 100) / 100,
      saving,
      offer: member
        ? "CineCircle member price"
        : fixed && saving > 0
          ? fixed.label
          : null,
      discountId: !member && saving > 0 ? fixed?.discountId : null,
    };
  });
  // What a premium member would pay for the same seats, shown to regular members.
  const memberTotal = user.premium
    ? null
    : Math.round(
        seats.reduce((n, seat) => {
          const original = basePrice(screening, seat);
          return n + original - bestSaving(original, premiumPlan.discountRate);
        }, 0) * 100,
      ) / 100;
  return {
    items,
    memberTotal,
    total: Math.round(items.reduce((n, s) => n + s.price, 0) * 100) / 100,
    subtotal: items.reduce((n, s) => n + s.original, 0),
    savings: Math.round(items.reduce((n, s) => n + s.saving, 0) * 100) / 100,
    currency: "HKD",
    premium: user.premium,
  };
}
export async function ticketRows(pool, userId) {
  const [rows] = await pool.execute(
    `SELECT t.ticket_id AS ticketId,t.user_id AS userId,t.price,t.booking_date AS bookingDate,t.screening_id AS screeningId,s.start_time AS startTime,m.movie_id AS movieId,m.title AS movieTitle,c.cinema_name AS cinemaName,c.district,h.hall_name AS hallName,st.seat_number AS seatNumber
    FROM ticket t JOIN screening s USING(screening_id) JOIN movie m USING(movie_id) JOIN cinema c ON c.cinema_id=s.cinema_id JOIN hall h ON h.cinema_id=s.cinema_id AND h.hall_id=s.hall_id
    JOIN screening_seat ss ON ss.screening_id=t.screening_id AND ss.screening_seat_id=t.screening_seat_id JOIN seat st ON st.cinema_id=ss.cinema_id AND st.hall_id=ss.hall_id AND st.seat_id=ss.seat_id WHERE t.user_id=? ORDER BY t.booking_date DESC,t.ticket_id DESC`,
    [userId],
  );
  return rows.map((t) => ({ ...t, poster: presentation(t).poster }));
}
// Books seats for a member inside the caller's transaction, priced exactly as at checkout:
// locks the screening and seats, checks availability, writes tickets, the discount each one
// used, and the seat status. Returns the new ticket ids. The demo seed uses it too.
export async function bookSeats(c, userId, screeningId, seatIds) {
  // Serialize updates for this screening, including availability checks and all seat writes.
  await c.execute(
    "SELECT screening_id FROM screening WHERE screening_id=? FOR UPDATE",
    [screeningId],
  );
  const screening = await getScreening(c, screeningId);
  await c.execute(
    `SELECT screening_seat_id FROM screening_seat WHERE screening_id=? AND screening_seat_id IN(${seatIds.map(() => "?").join(",")}) ORDER BY screening_seat_id FOR UPDATE`,
    [screeningId, ...seatIds],
  );
  const seats = await selectedSeats(c, screeningId, seatIds),
    priced = await quote(c, screening, seats, userId),
    ticketIds = [];
  for (const item of priced.items) {
    const [result] = await c.execute(
      "INSERT INTO ticket(user_id,screening_id,screening_seat_id,price) VALUES(?,?,?,?)",
      [userId, screeningId, item.screeningSeatId, item.price],
    );
    ticketIds.push(result.insertId);
    if (item.discountId)
      await c.execute("INSERT INTO ticket_discount VALUES(?,?)", [
        result.insertId,
        item.discountId,
      ]);
    await c.execute(
      "UPDATE screening_seat SET status='booked' WHERE screening_id=? AND screening_seat_id=?",
      [screeningId, item.screeningSeatId],
    );
  }
  return ticketIds;
}
export function booking(pool) {
  const router = Router();
  router.get("/cinemas", async (req, res) => {
    const [cinemas] = await pool.query(
      "SELECT cinema_id AS cinemaId,cinema_name AS name,district,street,building,phone_number AS phone FROM cinema ORDER BY cinema_id",
    );
    res.json({ cinemas });
  });
  router.get("/screenings", async (req, res) => {
    const { rows, more } = await screeningRows(
      pool,
      req.query,
      page(req.query, 200, 200),
    );
    res.json({ screenings: rows, more });
  });
  router.get("/screenings/:id", async (req, res) => {
    const screening = await getScreening(pool, id(req.params.id));
    const [seats] = await pool.execute(
      `${seatsSelect} WHERE ss.screening_id=? ORDER BY ss.screening_seat_id`,
      [screening.screeningId],
    );
    res.json({
      screening: {
        ...screening,
        poster: presentation(screening).poster,
        fromPrice: basePrice(screening, { type: "standard" }),
      },
      seats: seats.map((s) => ({ ...s, price: basePrice(screening, s) })),
    });
  });
  router.post("/bookings/quote", requireUser, async (req, res) => {
    const { screeningId, seatIds } = selection(req.body),
      screening = await getScreening(pool, screeningId),
      seats = await selectedSeats(pool, screeningId, seatIds);
    res.json(await quote(pool, screening, seats, req.session.userId));
  });
  router.post("/bookings", requireUser, async (req, res) => {
    const { screeningId, seatIds } = selection(req.body);
    const ticketIds = await transaction(pool, (c) =>
      bookSeats(c, req.session.userId, screeningId, seatIds),
    );
    res.status(201).json({
      tickets: (await ticketRows(pool, req.session.userId)).filter((t) =>
        ticketIds.includes(t.ticketId),
      ),
    });
  });
  router.get("/me/tickets", requireUser, async (req, res) =>
    res.json({ tickets: await ticketRows(pool, req.session.userId) }),
  );
  return router;
}
