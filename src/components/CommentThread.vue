<script setup>
import { ref, computed, onMounted, nextTick, watch } from "vue";
import { Heart, MessageCircle, ArrowLeft, Trash2 } from "@lucide/vue";
import {
  api,
  state,
  signedIn,
  notify,
  confirmAction,
  displayName,
  dateLabel,
} from "../api";

// A conversation under a review, two layers at a time: the item in focus (the review, or
// the comment opened) and its direct replies. Opening a reply makes it the focus; Back
// returns one level up. Replies from members the viewer follows come first, tagged.
const props = defineProps({
  review: { type: Object, required: true },
  focusId: { type: [String, Number], default: null },
});
const emit = defineEmits(["changed"]);
const stack = ref([]),
  items = ref([]),
  loading = ref(true),
  draft = ref(""),
  posting = ref(false),
  input = ref(null),
  heading = ref(null);
const current = computed(() => stack.value.at(-1) || null);
const backLabel = computed(() => {
  const above = stack.value.at(-2);
  return above
    ? `Back to ${displayName(above.username)}'s comment`
    : "Back to the review";
});

// Only the latest load is shown, so a slower earlier one (say, from signing in while a
// comment opens) cannot replace a newer level.
let loads = 0;
async function load() {
  const request = ++loads;
  loading.value = true;
  try {
    const parent = current.value ? `?parent=${current.value.commentId}` : "";
    const { comments } = await api(
      `/reviews/${props.review.reviewId}/comments${parent}`,
    );
    if (request === loads) items.value = comments;
  } catch (e) {
    if (request === loads) notify(e.message, "error");
  } finally {
    if (request === loads) loading.value = false;
  }
}
async function openComment(comment, write = false) {
  stack.value.push(comment);
  await load();
  await nextTick();
  if (write) input.value?.focus();
  else heading.value?.focus();
}
async function back() {
  stack.value.pop();
  await load();
}
// "3 replies" opens the replies for anyone; "Reply" asks a visitor to sign in first, then
// opens the comment with the reply box ready.
function reply(comment) {
  if (comment.replyCount) return openComment(comment);
  if (signedIn(() => openComment(comment, true))) openComment(comment, true);
}
const canRemove = (comment) =>
  state.user &&
  [comment.userId, props.review.userId].includes(state.user.userId);
const canLike = (comment) => state.user?.userId !== comment.userId;

// Likes, following tags and the order all depend on who is signed in.
async function refresh() {
  if (current.value) await openPath(current.value.commentId);
  await load();
}
watch(() => state.user?.userId, refresh);
async function like(comment, method = comment.liked ? "DELETE" : "PUT") {
  // Signed out: like after signing in, then show the counts as they now stand.
  if (
    !signedIn(async () => {
      if (!canLike(comment)) return;
      await api(`/comments/${comment.commentId}/like`, { method: "PUT" }).catch(
        (e) => notify(e.message, "error"),
      );
      await refresh();
    })
  )
    return;
  if (!canLike(comment)) return;
  try {
    await api(`/comments/${comment.commentId}/like`, { method });
    comment.liked = method === "PUT";
    comment.likes += comment.liked ? 1 : -1;
  } catch (e) {
    notify(e.message, "error");
  }
}
async function post() {
  if (!signedIn(() => input.value?.focus())) return;
  if (!draft.value.trim()) return;
  posting.value = true;
  try {
    const { comment } = await api(
      `/reviews/${props.review.reviewId}/comments`,
      {
        method: "POST",
        body: { text: draft.value, parentId: current.value?.commentId },
      },
    );
    items.value.push(comment);
    if (current.value) current.value.replyCount++;
    draft.value = "";
    emit("changed", 1);
  } catch (e) {
    notify(e.message, "error");
  } finally {
    posting.value = false;
  }
}
async function remove(comment) {
  if (
    comment.replyCount &&
    !(await confirmAction(
      "Remove this comment?",
      `Its ${comment.replyCount === 1 ? "reply" : "replies"} will be removed with it.`,
    ))
  )
    return;
  try {
    const { removed } = await api(`/comments/${comment.commentId}`, {
      method: "DELETE",
    });
    emit("changed", -removed);
    if (current.value?.commentId === comment.commentId) {
      stack.value.pop();
      if (current.value) current.value.replyCount--;
      await load();
    } else {
      items.value = items.value.filter(
        (c) => c.commentId !== comment.commentId,
      );
      if (current.value) current.value.replyCount--;
    }
  } catch (e) {
    notify(e.message, "error");
  }
}
// Opens the conversation at a comment: the chain from its top-level comment down to it. A
// comment that is gone, or belongs to another review, leaves the conversation at the top.
async function openPath(commentId) {
  try {
    const chain = (await api(`/comments/${commentId}/path`)).comments;
    stack.value = chain.every((c) => c.reviewId === props.review.reviewId)
      ? chain
      : [];
  } catch {
    stack.value = [];
  }
}
// A link from a notification opens the conversation at the comment whose replies hold it.
onMounted(async () => {
  if (props.focusId) await openPath(props.focusId);
  await load();
});
</script>
<template>
  <section
    class="review-thread"
    :aria-label="`Conversation on ${displayName(review.username)}'s review`"
  >
    <div v-if="current" class="thread-focus">
      <button type="button" class="text-button thread-back" @click="back">
        <ArrowLeft :size="14" aria-hidden="true" />{{ backLabel }}
      </button>
      <article class="thread-main">
        <header>
          <RouterLink :to="`/members/${current.userId}`" class="member-inline"
            ><span class="avatar tiny" :data-tone="current.userId % 4">{{
              current.username.slice(0, 1).toUpperCase()
            }}</span
            ><span ref="heading" tabindex="-1">{{
              displayName(current.username)
            }}</span></RouterLink
          ><time class="small muted" :datetime="current.createdAt">{{
            dateLabel(current.createdAt)
          }}</time>
        </header>
        <p>{{ current.text }}</p>
        <div class="thread-actions">
          <button
            v-if="canLike(current)"
            type="button"
            class="like-button"
            :class="{ liked: current.liked }"
            :aria-pressed="current.liked"
            :aria-label="`${current.liked ? 'Unlike' : 'Like'} comment by ${displayName(current.username)}`"
            @click="like(current)"
          >
            <Heart
              :size="14"
              :fill="current.liked ? 'currentColor' : 'none'"
            />{{ current.likes || "Like" }}</button
          ><span v-else class="small muted"
            >{{ current.likes }}
            {{ current.likes === 1 ? "like" : "likes" }}</span
          ><button
            v-if="canRemove(current)"
            type="button"
            class="like-button"
            :aria-label="`Remove comment by ${displayName(current.username)}`"
            @click="remove(current)"
          >
            <Trash2 :size="14" />
          </button>
        </div>
      </article>
    </div>
    <p v-if="loading" class="small muted">Opening the conversation…</p>
    <ol v-else-if="items.length" class="thread-list">
      <li v-for="c in items" :key="c.commentId" class="thread-comment">
        <header>
          <RouterLink :to="`/members/${c.userId}`" class="member-inline"
            ><span class="avatar tiny" :data-tone="c.userId % 4">{{
              c.username.slice(0, 1).toUpperCase()
            }}</span
            >{{ displayName(c.username) }}</RouterLink
          ><time class="small muted" :datetime="c.createdAt">{{
            dateLabel(c.createdAt)
          }}</time
          ><span v-if="c.following" class="following-tag">Following</span>
        </header>
        <p>{{ c.text }}</p>
        <div class="thread-actions">
          <button
            v-if="canLike(c)"
            type="button"
            class="like-button"
            :class="{ liked: c.liked }"
            :aria-pressed="c.liked"
            :aria-label="`${c.liked ? 'Unlike' : 'Like'} comment by ${displayName(c.username)}`"
            @click="like(c)"
          >
            <Heart :size="14" :fill="c.liked ? 'currentColor' : 'none'" />{{
              c.likes || "Like"
            }}</button
          ><span v-else-if="c.likes" class="small muted"
            >{{ c.likes }} {{ c.likes === 1 ? "like" : "likes" }}</span
          ><button
            type="button"
            class="like-button"
            :aria-label="
              c.replyCount
                ? `Open ${c.replyCount} ${c.replyCount === 1 ? 'reply' : 'replies'} to ${displayName(c.username)}`
                : `Reply to ${displayName(c.username)}`
            "
            @click="reply(c)"
          >
            <MessageCircle :size="14" />{{
              c.replyCount
                ? `${c.replyCount} ${c.replyCount === 1 ? "reply" : "replies"}`
                : "Reply"
            }}</button
          ><button
            v-if="canRemove(c)"
            type="button"
            class="like-button"
            :aria-label="`Remove comment by ${displayName(c.username)}`"
            @click="remove(c)"
          >
            <Trash2 :size="14" />
          </button>
        </div>
      </li>
    </ol>
    <p v-else class="small muted">
      {{
        current ? "No replies yet." : "No comments yet. Start the conversation."
      }}
    </p>
    <form v-if="state.user" class="thread-form" @submit.prevent="post">
      <label class="sr-only" :for="`reply-${review.reviewId}`">{{
        current ? `Reply to ${displayName(current.username)}` : "Your comment"
      }}</label>
      <textarea
        :id="`reply-${review.reviewId}`"
        ref="input"
        v-model="draft"
        rows="2"
        maxlength="1000"
        :placeholder="
          current
            ? `Reply to ${displayName(current.username)}`
            : 'Add to the conversation'
        "
      ></textarea>
      <button class="button primary small" :disabled="posting || !draft.trim()">
        Post
      </button>
    </form>
    <button v-else type="button" class="text-button" @click="post">
      Sign in to join the conversation
    </button>
  </section>
</template>
