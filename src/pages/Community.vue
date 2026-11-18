<script setup>
import { ref, onMounted, watch } from "vue";
import { Plus, Check } from "@lucide/vue";
import { api, state, signedIn, notify, displayName } from "../api";
import ReviewCard from "../components/ReviewCard.vue";
import ReviewEditor from "../components/ReviewEditor.vue";
import ListCard from "../components/ListCard.vue";
import MoreButton from "../components/MoreButton.vue";
const data = ref(null),
  loading = ref(true),
  error = ref(""),
  editor = ref(null),
  busy = ref(null);
async function load() {
  try {
    const [r, u, l] = await Promise.all([
      api("/reviews"),
      api("/users"),
      api("/lists?public=1"),
    ]);
    data.value = {
      reviews: r.reviews,
      users: u.users,
      lists: l.lists,
      more: { reviews: r.more, users: u.more, lists: l.more },
    };
    error.value = "";
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
async function follow(user, method = user.following ? "DELETE" : "PUT") {
  // After signing in from here, finish the follow the visitor asked for.
  if (!signedIn(() => follow(user, "PUT"))) return;
  if (state.user.userId === user.userId) return;
  busy.value = user.userId;
  try {
    await api(`/users/${user.userId}/follow`, { method });
    await load();
  } catch (e) {
    notify(e.message, "error");
  } finally {
    busy.value = null;
  }
}
onMounted(load);
watch(() => state.user?.userId, load);
</script>
<template>
  <div class="page-shell community-page">
    <div class="page-heading">
      <div>
        <h1>The circle</h1>
      </div>
      <span class="community-orbits" aria-hidden="true"
        ><i></i><i></i><i></i
      ></span>
    </div>
    <div v-if="loading" class="loading-state">Finding your people…</div>
    <div v-else-if="error" class="error-panel" role="alert">
      {{ error }}<button class="text-button" @click="load">Try again</button>
    </div>
    <template v-else-if="data"
      ><section class="community-layout">
        <div>
          <div class="section-heading">
            <h2>Recent reviews</h2>
          </div>
          <ReviewCard
            v-for="review in data.reviews"
            :key="review.reviewId"
            :review="review"
            @refresh="load"
            @edit="editor = $event"
          />
          <MoreButton
            :data="data"
            field="reviews"
            path="/reviews"
            :id-of="(r) => r.reviewId"
            label="Show more reviews"
          />
        </div>
        <aside class="members-panel">
          <h2>Members</h2>
          <div v-for="u in data.users" :key="u.userId" class="member-row">
            <RouterLink :to="`/members/${u.userId}`" class="member-profile-link"
              ><span class="avatar" :data-tone="u.userId % 4">{{
                u.username.slice(0, 1).toUpperCase()
              }}</span
              ><span
                ><strong>{{ displayName(u.username) }}</strong
                ><small>{{ u.reviews }} reviews</small></span
              ></RouterLink
            ><button
              v-if="state.user?.userId !== u.userId"
              class="follow-button"
              :class="{ following: u.following }"
              :disabled="busy === u.userId"
              :aria-label="`${u.following ? 'Unfollow' : 'Follow'} ${u.username}`"
              @click="follow(u)"
            >
              <Check v-if="u.following" :size="15" /><Plus
                v-else
                :size="15"
              /><span>{{ u.following ? "Following" : "Follow" }}</span>
            </button>
          </div>
          <MoreButton
            :data="data"
            field="users"
            path="/users"
            :id-of="(u) => u.userId"
            label="Show more members"
          />
        </aside>
      </section>
      <section class="public-lists-section">
        <div class="section-heading">
          <div>
            <h2>Public collections</h2>
          </div>
        </div>
        <div class="list-grid">
          <ListCard
            v-for="list in data.lists"
            :key="`${list.userId}/${list.listId}`"
            :list="list"
          />
        </div>
        <MoreButton
          :data="data"
          field="lists"
          path="/lists?public=1"
          :id-of="(l) => `${l.userId}/${l.listId}`"
          label="Show more collections"
        /></section></template
    ><ReviewEditor
      v-if="editor"
      :review="editor"
      @close="editor = null"
      @saved="load"
    />
  </div>
</template>
