import { reactive } from "vue";
export const state = reactive({
  user: null,
  ready: false,
  authOpen: false,
  authMode: "login",
  premiumOpen: false,
  // The premium offer, as the server prices it (replaced by /session).
  premiumPlan: { percentOff: 20, months: 12 },
  // The shared demo account and the last day of its membership (replaced by /session).
  demo: { username: "mia", premiumUntil: null },
  toast: null,
  confirmation: null,
  // Counts notification links followed to the page already showing, which change nothing
  // in the address; a review card reopens its conversation when this changes.
  revisits: 0,
});
let toastTimer;
export function notify(message, type = "success") {
  clearTimeout(toastTimer);
  state.toast = { message, type };
  toastTimer = setTimeout(() => (state.toast = null), 5500);
}
export async function api(path, options = {}) {
  const response = await fetch("/api" + path, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  });
  const data = await response.json().catch(() => ({
    error: "The connection was interrupted. Please try again.",
  }));
  if (!response.ok) {
    if (response.status === 401) {
      state.user = null;
      openAuth();
    }
    const error = new Error(data.error || "Please try again.");
    error.status = response.status;
    throw error;
  }
  return data;
}
export async function refreshSession() {
  try {
    const session = await api("/session");
    state.user = session.user;
    state.premiumPlan = session.premiumPlan;
    state.demo = session.demo;
  } finally {
    state.ready = true;
  }
}
let resumeAfterSignIn = null;
// True when signed in. Otherwise opens the sign-in dialog; `resume` runs after a
// successful sign-in so the action the visitor started (follow, review…) carries on.
export function signedIn(resume) {
  if (state.user) return true;
  openAuth("login", resume);
  return false;
}
export function openAuth(mode = "login", resume = null) {
  resumeAfterSignIn = resume;
  state.authMode = mode;
  state.authOpen = true;
}
export function closeAuth() {
  resumeAfterSignIn = null;
  state.authOpen = false;
}
export function finishAuth(user) {
  const resume = resumeAfterSignIn;
  resumeAfterSignIn = null;
  state.user = user;
  state.authOpen = false;
  resume?.();
}
// A premium membership in its last week (from the day the bell says it ends), which can be
// renewed for another term.
export function membershipEnding(user) {
  if (!user?.premium || !user.expiryDate) return false;
  const week = new Date(todayHK() + "T12:00:00Z");
  week.setUTCDate(week.getUTCDate() + 7);
  return user.expiryDate <= week.toISOString().slice(0, 10);
}
let resumeAfterPremium = null;
// Offers premium membership to a signed-in member (a visitor signs in first); `resume` runs
// once they have upgraded.
export function openPremium(resume = null) {
  if (!signedIn(() => !state.user.premium && openPremium(resume))) return;
  resumeAfterPremium = resume;
  state.premiumOpen = true;
}
export function closePremium() {
  resumeAfterPremium = null;
  state.premiumOpen = false;
}
export function finishPremium(user) {
  const resume = resumeAfterPremium;
  resumeAfterPremium = null;
  state.user = user;
  state.premiumOpen = false;
  resume?.();
}
// Appends the next page of data[key] from `path`; data.more[key] says if more remain.
export async function loadMore(data, key, path, idOf) {
  const next = await api(
    `${path}${path.includes("?") ? "&" : "?"}offset=${data[key].length}`,
  );
  const seen = new Set(data[key].map(idOf));
  data[key] = [...data[key], ...next[key].filter((x) => !seen.has(idOf(x)))];
  data.more = { ...data.more, [key]: next.more };
}
export function confirmAction(title, message) {
  return new Promise(
    (resolve) => (state.confirmation = { title, message, resolve }),
  );
}
export function resolveConfirmation(value) {
  const c = state.confirmation;
  state.confirmation = null;
  c?.resolve(value);
}
export const money = (value) => "HK$" + Number(value || 0).toFixed(2);
export const shortMoney = (value) =>
  "HK$" + Number(value || 0).toFixed(Number(value) % 1 ? 2 : 0);
export const movieTime = (n) => `${Math.floor(n / 60)}h ${n % 60}m`;
export const parseDate = (value) =>
  new Date(
    String(value).replace(" ", "T") +
      (String(value).includes("Z") || String(value).includes("+")
        ? ""
        : "+08:00"),
  );
export const dateLabel = (value, withYear = false) =>
  parseDate(
    value.length === 10 ? value + " 12:00:00" : value,
  ).toLocaleDateString("en-GB", {
    timeZone: "Asia/Hong_Kong",
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  });
export const timeLabel = (value) =>
  parseDate(value).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
  });
export const todayHK = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const displayName = (name) =>
  name ? name.charAt(0).toUpperCase() + name.slice(1) : "Member";
export const poster = (id) => `/images/poster-${id}.jpg`;
export function imageFallback(event) {
  if (!event.target.src.endsWith("placeholder.svg"))
    event.target.src = "/images/placeholder.svg";
}
