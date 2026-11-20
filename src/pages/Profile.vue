<script setup>
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import { Plus, Check, Sparkles } from "@lucide/vue";
import { api, state, signedIn, notify, displayName } from "../api";
import PosterCard from "../components/PosterCard.vue";
import ListCard from "../components/ListCard.vue";
import ReviewCard from "../components/ReviewCard.vue";
import ReviewEditor from "../components/ReviewEditor.vue";
import Tabs from "../components/Tabs.vue";
import MoreButton from "../components/MoreButton.vue";
import MembersDialog from "../components/MembersDialog.vue";
const route = useRoute(),
  data = ref(null),
  error = ref(""),
  loading = ref(true),
  tab = ref("reviews"),
  busy = ref(false),
  editor = ref(null),
  // "followers" or "following" while that list is open.
  people = ref(null);
async function load() {
  try {
    data.value = await api("/users/" + route.params.id);
    error.value = "";
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
watch(
  () => route.params.id,
  () => {
    people.value = null;
    loading.value = true;
    load();
  },
  { immediate: true },
);
watch(() => state.user?.userId, load);
async function follow(
  method = data.value.profile.following ? "DELETE" : "PUT",
) {
  // After signing in from here, finish the follow (unless this is the member's own page).
  if (!signedIn(() => follow("PUT"))) return;
  if (state.user.userId === data.value.profile.userId) return;
  busy.value = true;
  try {
    await api(`/users/${data.value.profile.userId}/follow`, { method });
    await load();
  } catch (e) {
    notify(e.message, "error");
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="page-shell profile-page">
    <div v-if="loading" class="loading-state">Finding this member…</div>
    <div v-else-if="error" class="error-panel" role="alert">{{ error }}</div>
    <template v-else-if="data"
      ><section class="profile-heading">
        <span
          class="avatar profile-avatar"
          :data-tone="data.profile.userId % 4"
          >{{ data.profile.username.slice(0, 1).toUpperCase() }}</span
        >
        <div>
          <p class="context-label">A member of the circle</p>
          <h1>
            {{ displayName(data.profile.username)
            }}<Sparkles
              v-if="data.profile.premium"
              class="premium-star"
              :size="23"
            />
          </h1>
          <p class="muted">
            {{ data.profile.reviewCount }}
            {{ data.profile.reviewCount === 1 ? "review" : "reviews" }}
            <button
              type="button"
              class="profile-stat stat-link"
              @click="people = 'followers'"
            >
              {{ data.profile.followers }}
              {{
                data.profile.followers === 1 ? "follower" : "followers"
              }}</button
            ><button
              type="button"
              class="profile-stat stat-link"
              @click="people = 'following'"
            >
              Following {{ data.profile.followingCount }}
            </button>
          </p>
        </div>
        <RouterLink
          v-if="state.user?.userId === data.profile.userId"
          to="/circle"
          class="button secondary"
          >My circle</RouterLink
        ><button
          v-else
          class="button"
          :class="data.profile.following ? 'secondary' : 'primary'"
          :disabled="busy"
          @click="follow()"
        >
          <Check v-if="data.profile.following" :size="17" /><Plus
            v-else
            :size="17"
          />{{ data.profile.following ? "Following" : "Follow" }}
        </button>
      </section>
      <Tabs
        v-model="tab"
        label="Member’s films"
        :tabs="[
          { key: 'reviews', name: 'Reviews', count: data.profile.reviewCount },
          { key: 'lists', name: 'Lists', count: data.profile.listCount },
          { key: 'watchlist', name: 'Watchlist', count: data.watchlist.length },
          { key: 'watched', name: 'Watched', count: data.watched.length },
        ]"
        ><div v-if="!data[tab].length" class="empty-state">
          <h2>A little quiet here, for now.</h2>
          <p>
            There are no
            {{
              tab === "lists"
                ? "public lists"
                : tab === "watchlist"
                  ? "saved films"
                  : tab === "watched"
                    ? "watched films"
                    : "reviews"
            }}
            to show yet.
          </p>
        </div>
        <div v-else-if="tab === 'reviews'" class="own-reviews">
          <ReviewCard
            v-for="r in data.reviews"
            :key="r.reviewId"
            :review="r"
            @refresh="load"
            @edit="editor = $event"
          />
        </div>
        <div v-else-if="tab === 'lists'" class="list-grid">
          <ListCard v-for="l in data.lists" :key="l.listId" :list="l" />
        </div>
        <div v-else class="poster-grid">
          <PosterCard v-for="m in data[tab]" :key="m.movieId" :movie="m" />
        </div>
        <MoreButton
          v-if="tab === 'reviews'"
          :data="data"
          field="reviews"
          :path="`/reviews?userId=${data.profile.userId}`"
          :id-of="(r) => r.reviewId"
          label="Show more reviews" /><MoreButton
          v-else-if="tab === 'lists'"
          :data="data"
          field="lists"
          :path="`/lists?userId=${data.profile.userId}`"
          :id-of="(l) => l.listId"
          label="Show more lists" /></Tabs></template
    ><MembersDialog
      v-if="people && data"
      :title="
        people === 'followers'
          ? `${displayName(data.profile.username)}’s followers`
          : `${displayName(data.profile.username)} follows`
      "
      :path="`/users?${people === 'followers' ? 'followersOf' : 'followedBy'}=${data.profile.userId}`"
      :empty="
        people === 'followers'
          ? 'No one follows this member yet.'
          : 'This member doesn’t follow anyone yet.'
      "
      @close="people = null"
      @changed="load"
    /><ReviewEditor
      v-if="editor"
      :review="editor"
      @close="editor = null"
      @saved="load"
    />
  </div>
</template>
