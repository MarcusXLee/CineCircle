<script setup>
import { ref, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  Bookmark,
  Plus,
  LogOut,
  Star,
  Sparkles,
  Ticket,
  Film,
  ArrowUpRight,
  Settings,
} from "@lucide/vue";
import {
  state,
  api,
  notify,
  displayName,
  dateLabel,
  parseDate,
  openAuth,
  openPremium,
  membershipEnding,
} from "../api";
import PosterCard from "../components/PosterCard.vue";
import ListCard from "../components/ListCard.vue";
import ListEditor from "../components/ListEditor.vue";
import ReviewCard from "../components/ReviewCard.vue";
import ReviewEditor from "../components/ReviewEditor.vue";
import Tabs from "../components/Tabs.vue";
import MoreButton from "../components/MoreButton.vue";
import TicketCard from "../components/TicketCard.vue";
const router = useRouter(),
  route = useRoute(),
  tab = ref(
    ["lists", "saved", "tickets"].includes(route.query.tab)
      ? route.query.tab
      : "watchlist",
  ),
  data = ref(null),
  loading = ref(true),
  error = ref(""),
  listEditor = ref(false),
  reviewEditor = ref(null);
async function load() {
  if (!state.user) {
    loading.value = false;
    data.value = null;
    return;
  }
  loading.value = true;
  try {
    const [lib, lists, saved, profile, tickets] = await Promise.all([
      api("/me/library"),
      api("/me/lists"),
      api("/me/bookmarks"),
      api("/users/" + state.user.userId),
      api("/me/tickets"),
    ]);
    data.value = {
      ...lib,
      // Upcoming tickets, soonest first; the full history stays on My tickets.
      tickets: tickets.tickets
        .filter((t) => parseDate(t.startTime) > new Date())
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
      lists: lists.lists,
      saved: saved.lists,
      savedCount: saved.total,
      reviews: profile.reviews,
      profile: profile.profile,
      more: {
        lists: lists.more,
        saved: saved.more,
        reviews: profile.more.reviews,
      },
    };
    error.value = "";
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
watch(() => state.user?.userId, load, { immediate: true });
// Arriving signed out opens the sign-in dialog; this page fills in once signed in.
watch(
  () => state.ready,
  (ready) => ready && !state.user && openAuth(),
  { immediate: true },
);
async function logout() {
  try {
    await api("/auth/logout", { method: "POST" });
    state.user = null;
    notify("You’re signed out.");
    router.push("/");
  } catch (e) {
    notify(e.message, "error");
  }
}
async function removeWatchlist(movieId) {
  try {
    await api("/me/watchlist/" + movieId, { method: "DELETE" });
    await load();
    notify("Removed from your watchlist.");
  } catch (e) {
    notify(e.message, "error");
  }
}
function newListSaved(list) {
  router.push(`/lists/${list.userId}/${list.listId}`);
}
</script>
<template>
  <div class="page-shell library-page">
    <div v-if="!state.user && state.ready" class="empty-state account-empty">
      <Bookmark :size="40" />
      <h1>Your films belong here.</h1>
      <p>
        Sign in to keep a watchlist, collect your favourites, and find your next
        movie night.
      </p>
      <button class="button primary" @click="openAuth()">Sign in</button>
    </div>
    <template v-else-if="state.user"
      ><section class="profile-heading">
        <span class="avatar profile-avatar">{{
          state.user.username.slice(0, 1).toUpperCase()
        }}</span>
        <div>
          <p class="context-label">My circle</p>
          <h1>{{ displayName(state.user.username) }}’s corner.</h1>
          <p class="muted">The films you’ve seen. The ones still waiting.</p>
          <RouterLink
            :to="`/members/${state.user.userId}`"
            class="quiet-link profile-public"
            >Your profile and followers <ArrowUpRight :size="15"
          /></RouterLink>
        </div>
        <div class="corner-actions">
          <RouterLink to="/settings" class="quiet-link signout"
            ><Settings :size="16" />Settings</RouterLink
          ><button class="quiet-link signout" @click="logout">
            <LogOut :size="16" />Sign out
          </button>
        </div>
      </section>
      <div v-if="state.user.premium" class="membership-banner">
        <Sparkles :size="22" />
        <div>
          <strong>A little more cinema, for a little less.</strong>
          <p>
            Your premium membership gives you
            {{ Math.round((1 - state.user.discountRate) * 100) }}% off eligible
            tickets.
            {{ membershipEnding(state.user) ? "It ends on" : "Valid until" }}
            {{ dateLabel(state.user.expiryDate + " 12:00:00", true) }}.
          </p>
        </div>
        <button
          v-if="membershipEnding(state.user)"
          type="button"
          class="quiet-link premium-cta"
          @click="openPremium()"
        >
          Renew premium <ArrowUpRight :size="17" />
        </button>
        <RouterLink v-else to="/cinemas" class="quiet-link"
          >Find a screening <Ticket :size="17"
        /></RouterLink>
      </div>
      <div v-else class="membership-banner">
        <Sparkles :size="22" />
        <div>
          <strong>{{
            state.user.expiryDate
              ? "Your premium membership has ended."
              : "Make every screening a little lighter."
          }}</strong>
          <p v-if="state.user.expiryDate">
            It ran until
            {{ dateLabel(state.user.expiryDate + " 12:00:00", true) }}. Renew
            for another {{ state.premiumPlan.months }} months of member prices.
          </p>
          <p v-else>
            Premium members take {{ state.premiumPlan.percentOff }}% off their
            tickets for {{ state.premiumPlan.months }} months, applied at
            checkout.
          </p>
        </div>
        <button
          type="button"
          class="quiet-link premium-cta"
          @click="openPremium()"
        >
          {{ state.user.expiryDate ? "Renew premium" : "Go premium" }}
          <ArrowUpRight :size="17" />
        </button>
      </div>
      <Tabs
        v-model="tab"
        label="Your library"
        :tabs="[
          {
            key: 'watchlist',
            name: 'Watchlist',
            count: data?.watchlist.length,
          },
          { key: 'tickets', name: 'Tickets', count: data?.tickets.length },
          { key: 'watched', name: 'Watched', count: data?.watched.length },
          { key: 'lists', name: 'My lists', count: data?.profile.listCount },
          { key: 'saved', name: 'Saved', count: data?.savedCount },
          { key: 'reviews', name: 'Reviews', count: data?.profile.reviewCount },
        ]"
        ><div v-if="loading" class="loading-state">Finding your films…</div>
        <div v-else-if="error" class="error-panel" role="alert">
          {{ error
          }}<button class="text-button" @click="load">Try again</button>
        </div>
        <template v-else-if="data"
          ><div v-if="tab === 'watchlist'">
            <div class="section-heading">
              <h2>For another day.</h2>
              <RouterLink to="/films" class="quiet-link"
                ><Plus :size="16" />Find more films</RouterLink
              >
            </div>
            <div v-if="data.watchlist.length" class="poster-grid">
              <div
                v-for="m in data.watchlist"
                :key="m.movieId"
                class="library-poster"
              >
                <PosterCard :movie="m" /><button
                  class="remove-watchlist"
                  :aria-label="`Remove ${m.title} from watchlist`"
                  @click="removeWatchlist(m.movieId)"
                >
                  Remove
                </button>
              </div>
            </div>
            <div v-else class="empty-state">
              <Bookmark :size="34" />
              <h3>A good film is worth saving.</h3>
              <p>
                Add a film to your watchlist and find it here when the moment is
                right.
              </p>
              <RouterLink to="/films" class="button secondary"
                >Explore films</RouterLink
              >
            </div>
          </div>
          <div v-else-if="tab === 'tickets'">
            <div class="section-heading">
              <h2>Your next nights out.</h2>
              <RouterLink to="/tickets" class="quiet-link"
                >All tickets <ArrowUpRight :size="16" aria-hidden="true"
              /></RouterLink>
            </div>
            <div v-if="data.tickets.length" class="tickets-list">
              <TicketCard
                v-for="t in data.tickets"
                :key="t.ticketId"
                :ticket="t"
              />
            </div>
            <div v-else class="empty-state">
              <Ticket :size="34" />
              <h3>No upcoming tickets.</h3>
              <p>Pick a screening and your ticket will be kept here.</p>
              <RouterLink to="/cinemas" class="button primary"
                >Find a screening</RouterLink
              >
            </div>
          </div>
          <div v-else-if="tab === 'watched'">
            <div class="section-heading">
              <h2>A few good memories.</h2>
              <span class="muted small">Your watched films</span>
            </div>
            <div v-if="data.watched.length" class="poster-grid">
              <div v-for="m in data.watched" :key="m.movieId">
                <PosterCard :movie="m" />
                <p class="watched-date">Watched {{ dateLabel(m.watchDate) }}</p>
              </div>
            </div>
            <div v-else class="empty-state">
              <Film :size="34" />
              <h3>Start your film diary.</h3>
              <p>
                Mark a film as watched on its page, and record the day you saw
                it.
              </p>
              <RouterLink to="/films" class="button secondary"
                >Find a film</RouterLink
              >
            </div>
          </div>
          <div v-else-if="tab === 'lists'">
            <div class="section-heading">
              <h2>Good films, kept together.</h2>
              <button class="button secondary small" @click="listEditor = true">
                <Plus :size="16" />Create a list
              </button>
            </div>
            <div v-if="data.lists.length" class="list-grid">
              <ListCard v-for="l in data.lists" :key="l.listId" :list="l" />
            </div>
            <div v-else class="empty-state">
              <Plus :size="34" />
              <h3>Your first collection starts with a thought.</h3>
              <p>Give it a name, add a film, and make it yours.</p>
            </div>
            <MoreButton
              :data="data"
              field="lists"
              path="/me/lists"
              :id-of="(l) => l.listId"
              label="Show more lists"
            />
          </div>
          <div v-else-if="tab === 'saved'">
            <div class="section-heading">
              <h2>Collections worth keeping.</h2>
              <RouterLink to="/community" class="quiet-link"
                >Browse collections</RouterLink
              >
            </div>
            <div v-if="data.saved.length" class="list-grid">
              <ListCard
                v-for="l in data.saved"
                :key="`${l.userId}/${l.listId}`"
                :list="l"
              />
            </div>
            <div v-else class="empty-state">
              <Bookmark :size="34" />
              <h3>Nothing saved yet.</h3>
              <p>
                Bookmark a collection someone else made, and it will wait for
                you here.
              </p>
            </div>
            <MoreButton
              :data="data"
              field="saved"
              path="/me/bookmarks"
              :id-of="(l) => `${l.userId}/${l.listId}`"
              label="Show more saved collections"
            />
          </div>
          <div v-else>
            <div class="section-heading">
              <h2>Your side of the story.</h2>
              <RouterLink to="/films" class="quiet-link"
                >Find a film to review</RouterLink
              >
            </div>
            <div v-if="!data.reviews.length" class="empty-state">
              <Star :size="34" />
              <h3>Seen something worth talking about?</h3>
              <p>
                Write a review on a film’s page and share it with the circle.
              </p>
            </div>
            <div class="own-reviews">
              <ReviewCard
                v-for="r in data.reviews"
                :key="r.reviewId"
                :review="r"
                @refresh="load"
                @edit="reviewEditor = $event"
              />
            </div>
            <MoreButton
              :data="data"
              field="reviews"
              :path="`/reviews?userId=${state.user.userId}`"
              :id-of="(r) => r.reviewId"
              label="Show more reviews"
            /></div></template></Tabs></template
    ><ListEditor
      v-if="listEditor"
      @close="listEditor = false"
      @saved="newListSaved"
    /><ReviewEditor
      v-if="reviewEditor"
      :review="reviewEditor"
      @close="reviewEditor = null"
      @saved="load"
    />
  </div>
</template>
