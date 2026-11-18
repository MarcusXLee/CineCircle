import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(password, stored) {
  const [algorithm, salt, hex] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !hex) return false;
  const expected = Buffer.from(hex, "hex");
  const actual = await scrypt(password, salt, 64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function id(value) {
  if (
    !/^\d+$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < 1
  )
    throw new HttpError(400, "Choose a valid item.");
  return Number(value);
}
export function text(value, max, required = false) {
  if (value !== undefined && typeof value !== "string")
    throw new HttpError(400, "Enter valid text.");
  const result = (value || "").trim();
  if ((required && !result) || result.length > max)
    throw new HttpError(
      400,
      `Enter ${required ? "1" : "0"}–${max} characters.`,
    );
  return result;
}
// Reads ?offset= and ?limit= for list endpoints. Callers fetch limit + 1 rows so that
// `trimPage` can tell the browser whether another page exists.
export function page(query = {}, size, max = 100) {
  const number = (value) => Number.parseInt(String(value ?? ""), 10);
  return {
    limit: Math.min(max, Math.max(1, number(query.limit) || size)),
    offset: Math.max(0, number(query.offset) || 0),
  };
}
export function trimPage(rows, { limit }) {
  const more = rows.length > limit;
  if (more) rows.length = limit;
  return more;
}
export function requireUser(req, res, next) {
  if (!req.session.userId)
    return next(new HttpError(401, "Sign in to continue."));
  next();
}
export async function userInfo(pool, userId) {
  const [[user]] = await pool.execute(
    `SELECT u.user_id AS userId,u.username,u.register_date AS joined,
    (SELECT email FROM user_email WHERE user_id=u.user_id ORDER BY email LIMIT 1) AS email,
    p.expiry_date AS expiryDate, COALESCE(p.start_date<=CURRENT_DATE AND p.expiry_date>=CURRENT_DATE,0) AS premium,
    p.discount_rate AS discountRate FROM users u LEFT JOIN premium_user p USING(user_id) WHERE u.user_id=?`,
    [userId],
  );
  return user ? { ...user, premium: Boolean(user.premium) } : null;
}
export const regenerate = (req) =>
  new Promise((resolve, reject) =>
    req.session.regenerate((error) => (error ? reject(error) : resolve())),
  );
export const saveSession = (req) =>
  new Promise((resolve, reject) =>
    req.session.save((error) => (error ? reject(error) : resolve())),
  );
