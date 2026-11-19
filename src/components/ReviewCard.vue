<script setup>
import { ref, watch, onMounted, nextTick } from "vue";
import { useRoute } from "vue-router";
import { Heart, Star, Pencil, Trash2, MessageCircle } from "@lucide/vue";
import {
  api,
  state,
  signedIn,
  notify,
  confirmAction,
  displayName,
  imageFallback,
} from "../api";
import CommentThread from "./CommentThread.vue";
const props = defineProps({
  review: Object,
  showMovie: { type: Boolean, default: true },
});
const emit = defineEmits(["refresh", "edit"]);
const busy = ref(false);
// The conversation under the review opens on demand; the count follows changes made in it.
const route = useRoute(),
  card = ref(null),
  open = ref(false),
  count = ref(props.review.commentCount || 0),
  focusId = ref(null);
watch(
  () => props.review.commentCount,
  (n) => (count.value = n || 0),
);
function toggleThread() {
  open.value = !open.value;
}
// A link from a notification (?thread=<reviewId>&comment=<commentId>) opens this review's
// conversation, at the comment whose replies hold the item when one is given. It applies
// when the card appears and when a link changes the address while the page is open.
async function followLink() {
  if (String(route.query.thread) !== String(props.review.reviewId)) return;
  focusId.value = route.query.comment || null;
  open.value = true;
  await nextTick();
  card.value?.scrollIntoView({ block: "center" });
}
onMounted(followLink);
watch(
  () => [route.query.thread, route.query.comment, state.revisits],
  followLink,
);
async function like(method = props.review.liked ? "DELETE" : "PUT") {
  // After signing in from here, finish the like (members cannot like their own review).
  if (!signedIn(() => like("PUT"))) return;
  if (state.user.userId === props.review.userId) return;
  busy.value = true;
  try {
    await api(`/reviews/${props.review.reviewId}/like`, { method });
    emit("refresh");
  } catch (e) {
    notify(e.message, "error");
  } finally {
    busy.value = false;
  }
}
async function remove() {
  if (
    !(await confirmAction(
      "Delete this review?",
      "Your review, its likes and its conversation will be removed.",
    ))
  )
    return;
  busy.value = true;
  try {
    await api(`/reviews/${props.review.reviewId}`, { method: "DELETE" });
    notify("Review deleted.");
    emit("refresh");
  } catch (e) {
    notify(e.message, "error");
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <article ref="card" class="review-card">
    <RouterLink
      v-if="showMovie"
      :to="`/films/${review.movieId}`"
      class="review-poster"
      ><img
        :src="review.poster"
        :alt="review.movieTitle"
        loading="lazy"
        @error="imageFallback"
    /></RouterLink>
    <div class="review-content">
      <RouterLink
        v-if="showMovie"
        :to="`/films/${review.movieId}`"
        class="review-film"
        >{{ review.movieTitle }}</RouterLink
      >
      <div class="review-byline">
        <RouterLink :to="`/members/${review.userId}`" class="member-inline"
          ><span class="avatar tiny" :data-tone="review.userId % 4">{{
            review.username.slice(0, 1).toUpperCase()
          }}</span
          >{{ displayName(review.username) }}</RouterLink
        ><span class="rating"
          ><Star :size="13" fill="currentColor" />{{
            Number(review.rating).toFixed(1)
          }}<span class="muted">/10</span></span
        >
      </div>
      <p v-if="review.text" class="review-text">{{ review.text }}</p>
      <p v-else class="muted small">Rated this film.</p>
      <div class="review-actions">
        <button
          v-if="state.user?.userId !== review.userId"
          class="like-button"
          :class="{ liked: review.liked }"
          :aria-pressed="review.liked"
          :aria-label="`${review.liked ? 'Unlike' : 'Like'} review by ${review.username}`"
          :disabled="busy"
          @click="like()"
        >
          <Heart :size="15" :fill="review.liked ? 'currentColor' : 'none'" />{{
            review.likes || "Like"
          }}</button
        ><span v-else class="small muted"
          >{{ review.likes }} {{ review.likes === 1 ? "like" : "likes" }}</span
        ><button
          class="like-button comment-button"
          :aria-expanded="open"
          :aria-controls="`comments-${review.reviewId}`"
          @click="toggleThread"
        >
          <MessageCircle :size="15" />{{
            count
              ? `${count} ${count === 1 ? "comment" : "comments"}`
              : "Comment"
          }}</button
        ><template v-if="state.user?.userId === review.userId"
          ><button
            class="icon-button small-icon"
            aria-label="Edit review"
            @click="emit('edit', review)"
          >
            <Pencil :size="15" /></button
          ><button
            class="icon-button small-icon"
            aria-label="Delete review"
            :disabled="busy"
            @click="remove"
          >
            <Trash2 :size="15" /></button
        ></template>
      </div>
      <CommentThread
        v-if="open"
        :id="`comments-${review.reviewId}`"
        :review="review"
        :key="focusId || 'top'"
        :focus-id="focusId"
        @changed="count += $event"
      />
    </div>
  </article>
</template>
