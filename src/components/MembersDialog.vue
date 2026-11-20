<script setup>
import { ref, onMounted } from "vue";
import { Plus, Check } from "@lucide/vue";
import Modal from "./Modal.vue";
import MoreButton from "./MoreButton.vue";
import { api, state, signedIn, notify, displayName } from "../api";
// A member's followers, or the members they follow, with a follow button on each row.
const props = defineProps({ title: String, path: String, empty: String });
const emit = defineEmits(["close", "changed"]);
const data = ref(null),
  error = ref(""),
  busy = ref(null);
onMounted(async () => {
  try {
    const { users, more } = await api(props.path);
    data.value = { users, more: { users: more } };
  } catch (e) {
    error.value = e.message;
  }
});
async function follow(user, method = user.following ? "DELETE" : "PUT") {
  if (!signedIn(() => follow(user, "PUT"))) return;
  if (state.user.userId === user.userId) return;
  busy.value = user.userId;
  try {
    await api(`/users/${user.userId}/follow`, { method });
    if (user.following !== (method === "PUT"))
      user.followers += method === "PUT" ? 1 : -1;
    user.following = method === "PUT";
    emit("changed");
  } catch (e) {
    notify(e.message, "error");
  } finally {
    busy.value = null;
  }
}
</script>
<template>
  <Modal :title="title" @close="emit('close')"
    ><p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-else-if="!data" class="small muted">Finding them…</p>
    <p v-else-if="!data.users.length" class="muted modal-intro">{{ empty }}</p>
    <div v-else class="members-dialog">
      <div v-for="u in data.users" :key="u.userId" class="member-row">
        <RouterLink
          :to="`/members/${u.userId}`"
          class="member-profile-link"
          @click="emit('close')"
          ><span class="avatar" :data-tone="u.userId % 4">{{
            u.username.slice(0, 1).toUpperCase()
          }}</span
          ><span
            ><strong>{{ displayName(u.username) }}</strong
            ><small
              >{{ u.reviews }} {{ u.reviews === 1 ? "review" : "reviews" }} ·
              {{ u.followers }}
              {{ u.followers === 1 ? "follower" : "followers" }}</small
            ></span
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
        :path="path"
        :id-of="(u) => u.userId"
        label="Show more"
      /></div
  ></Modal>
</template>
