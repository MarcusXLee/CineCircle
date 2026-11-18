<script setup>
import { ref } from "vue";
import Modal from "./Modal.vue";
import { api, notify } from "../api";
const props = defineProps({
  review: Object,
  movieId: Number,
  movieTitle: String,
});
const emit = defineEmits(["close", "saved"]);
const rating = ref(props.review?.rating ?? 8),
  content = ref(props.review?.text || ""),
  busy = ref(false),
  error = ref("");
async function save() {
  busy.value = true;
  error.value = "";
  try {
    await api(
      props.review
        ? `/reviews/${props.review.reviewId}`
        : `/movies/${props.movieId}/my-review`,
      {
        method: props.review ? "PATCH" : "PUT",
        body: { rating: Number(rating.value), text: content.value },
      },
    );
    notify(props.review ? "Review saved." : "Review published.");
    emit("saved");
    emit("close");
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <Modal
    :title="review ? 'Edit your review' : 'What stayed with you?'"
    @close="emit('close')"
    ><p class="muted modal-intro">{{ movieTitle || review?.movieTitle }}</p>
    <form @submit.prevent="save">
      <label class="field"
        >Your rating<span class="rating-input"
          ><input
            v-model="rating"
            type="number"
            min="0"
            max="10"
            step="0.1"
            required
          /><span>out of 10</span></span
        ></label
      ><label class="field"
        >Your review<textarea
          v-model="content"
          rows="6"
          maxlength="10000"
          placeholder="A scene, a feeling, a thought you can’t shake…"
        ></textarea>
      </label>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button class="button primary full" :disabled="busy">
        {{ busy ? "Saving…" : review ? "Save review" : "Publish review" }}
      </button>
    </form></Modal
  >
</template>
