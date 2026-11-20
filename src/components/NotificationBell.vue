<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Bell,
  MessageCircle,
  UserPlus,
  Ticket,
  Clock,
  Heart,
  Star,
  Sparkles,
} from "@lucide/vue";
import {
  api,
  state,
  notify,
  displayName,
  dateLabel,
  timeLabel,
  parseDate,
  todayHK,
} from "../api";

// The notification centre: a bell with an unread count and a panel of recent activity.
// It checks every 45 seconds (and when the tab regains focus); see popUp for what also
// arrives as a toast.
const POLL_MS = 45000;
const items = ref([]),
  unread = ref(0),
  open = ref(false),
  button = ref(null),
  panel = ref(null);
let known = null,
  timer;
const icons = {
  comment: MessageCircle,
  reply: MessageCircle,
  like: Heart,
  "review-like": Heart,
  review: Star,
  follow: UserPlus,
  ticket: Ticket,
  reminder: Clock,
  membership: Sparkles,
};
// Kinds that also pop up as a toast when they arrive; likes and bookings stay in the panel.
const popUp = new Set([
  "comment",
  "reply",
  "review",
  "follow",
  "reminder",
  "membership",
]);

function describe(n) {
  const who = displayName(n.actor);
  const thread = `/films/${n.movieId}?thread=${n.reviewId}`;
  const at = n.focusId ? `${thread}&comment=${n.focusId}` : thread;
  if (n.kind === "comment")
    return {
      text: `${who} commented on your review of ${n.movieTitle}`,
      quote: n.detail,
      to: thread,
    };
  if (n.kind === "reply")
    return {
      text: `${who} replied to your comment on ${n.movieTitle}`,
      quote: n.detail,
      to: at,
    };
  if (n.kind === "like")
    return {
      text: `${who} liked your comment on ${n.movieTitle}`,
      quote: n.detail,
      to: at,
    };
  if (n.kind === "review-like")
    return {
      text: `${who} liked your review of ${n.movieTitle}`,
      quote: n.detail,
      to: `/films/${n.movieId}`,
    };
  if (n.kind === "review")
    return {
      text: `${who} reviewed ${n.movieTitle}`,
      quote: n.detail,
      to: thread,
    };
  if (n.kind === "follow")
    return {
      text: `${who} started following you`,
      to: `/members/${n.actorId}`,
    };
  if (n.kind === "ticket") {
    const [count, start] = n.detail.split("|");
    return {
      text: `${count === "1" ? "Your ticket" : `Your ${count} tickets`} for ${n.movieTitle} ${count === "1" ? "is" : "are"} booked`,
      quote: `${dateLabel(start)} at ${timeLabel(start)}`,
      to: "/circle?tab=tickets",
    };
  }
  if (n.kind === "membership") {
    const ended = n.detail < todayHK();
    return {
      text: ended
        ? "Your premium membership has ended"
        : `Your premium membership ends on ${dateLabel(n.detail, true)}`,
      quote: ended
        ? "Renew in My circle for member prices again."
        : "Renew in My circle to keep your member price.",
      to: "/circle",
    };
  }
  const [time, cinema] = n.detail.split("|");
  return {
    text: `${n.movieTitle} starts at ${time} at ${cinema}`,
    quote: "Within the hour. Enjoy the film.",
    to: "/circle?tab=tickets",
  };
}
const entries = computed(() =>
  items.value.map((n) => ({ ...n, ...describe(n) })),
);

function ago(value) {
  const minutes = Math.round((Date.now() - parseDate(value).getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} h ago`;
  return dateLabel(value);
}

// Marks read up to the newest notification on screen, so anything that arrives afterwards
// stays unread (the server keeps the later of this and its current mark). Times are kept to
// the second, so the ones shown from that last second are remembered: another arriving in
// the same second still counts as new.
let boundary = { at: null, keys: new Set() };
function markRead() {
  const newest = items.value[0]?.at;
  if (!newest) return;
  boundary = {
    at: newest,
    keys: new Set(items.value.filter((n) => n.at === newest).map((n) => n.key)),
  };
  return api("/me/notifications/read", {
    method: "POST",
    body: { upTo: newest },
  }).catch(() => {});
}
const unseenAtBoundary = (n, readAt) =>
  n.at === readAt && n.at === boundary.at && !boundary.keys.has(n.key);
async function load() {
  if (!state.user || document.hidden) return;
  try {
    const data = await api("/me/notifications");
    for (const n of data.notifications)
      if (!n.unread && unseenAtBoundary(n, data.readAt)) n.unread = true;
    const unreadCount = data.notifications.filter((n) => n.unread).length;
    // While the panel is open, new items appear in it instead of popping up.
    const fresh =
      known && !open.value
        ? data.notifications.filter(
            (n) => n.unread && !known.has(n.key) && popUp.has(n.kind),
          )
        : [];
    known = new Set(data.notifications.map((n) => n.key));
    items.value = data.notifications;
    if (open.value) {
      unread.value = 0;
      if (unreadCount) await markRead();
    } else unread.value = unreadCount;
    if (fresh.length === 1) notify(describe(fresh[0]).text + ".");
    else if (fresh.length > 1)
      notify(`You have ${fresh.length} new notifications.`);
  } catch {
    /* A missed check is retried on the next one. */
  }
}
// Opening shows the list at once, then refreshes it and marks what it shows as read.
async function toggle() {
  open.value = !open.value;
  if (!open.value) return;
  unread.value = 0;
  await load();
}
const route = useRoute(),
  router = useRouter();
// Following a link to the page already showing changes nothing in the address, so tell the
// page directly (it reopens a conversation that was closed since).
function visit(n) {
  if (router.resolve(n.to).fullPath === route.fullPath) state.revisits++;
  close();
}
function close(focusButton = false) {
  if (!open.value) return;
  open.value = false;
  items.value = items.value.map((n) => ({ ...n, unread: false }));
  if (focusButton) button.value?.focus();
}
function onDocumentClick(event) {
  if (
    !panel.value?.contains(event.target) &&
    !button.value?.contains(event.target)
  )
    close();
}
onMounted(() => {
  load();
  timer = setInterval(load, POLL_MS);
  window.addEventListener("focus", load);
  document.addEventListener("click", onDocumentClick);
});
onBeforeUnmount(() => {
  clearInterval(timer);
  window.removeEventListener("focus", load);
  document.removeEventListener("click", onDocumentClick);
});
</script>
<template>
  <div class="notify" @keydown.esc="close(true)">
    <button
      ref="button"
      type="button"
      class="icon-button notify-bell"
      :aria-label="unread ? `Notifications, ${unread} new` : 'Notifications'"
      :aria-expanded="open"
      aria-controls="notification-panel"
      @click="toggle"
    >
      <Bell :size="19" aria-hidden="true" /><span
        v-if="unread"
        class="notify-count"
        aria-hidden="true"
        >{{ unread > 9 ? "9+" : unread }}</span
      >
    </button>
    <section
      v-show="open"
      id="notification-panel"
      ref="panel"
      class="notify-panel"
      aria-label="Notifications"
    >
      <h2>Notifications</h2>
      <ol v-if="entries.length">
        <li v-for="n in entries" :key="n.key" :class="{ unread: n.unread }">
          <RouterLink :to="n.to" @click="visit(n)">
            <span class="medallion small"
              ><component :is="icons[n.kind]" :size="14" aria-hidden="true"
            /></span>
            <span class="notify-body">
              <span class="notify-text">{{ n.text }}</span>
              <span v-if="n.quote" class="notify-quote">{{ n.quote }}</span>
              <time :datetime="n.at">{{ ago(n.at) }}</time>
            </span>
          </RouterLink>
        </li>
      </ol>
      <p v-else class="notify-empty">You are all caught up.</p>
    </section>
  </div>
</template>
