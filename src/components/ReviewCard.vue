<script setup>
import { ref } from "vue";
import { Heart, Star, Pencil, Trash2 } from "@lucide/vue";
import {
  api,
  state,
  signedIn,
  notify,
  confirmAction,
  displayName,
  imageFallback,
} from "../api";
const props = defineProps({
  review: Object,
  showMovie: { type: Boolean, default: true },
});
const emit = defineEmits(["refresh", "edit"]);
const busy = ref(false);
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
      "Your review and its likes will be removed.",
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
  <article class="review-card">
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
    </div>
  </article>
</template>
