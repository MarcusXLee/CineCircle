<script setup>
import { ref, computed, nextTick, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Plus,
  Pencil,
  Trash2,
  Lock,
  Globe2,
  Star,
  Bookmark,
} from "@lucide/vue";
import {
  api,
  state,
  notify,
  confirmAction,
  imageFallback,
  displayName,
  signedIn,
} from "../api";
import FilmPicker from "../components/FilmPicker.vue";
import ListEditor from "../components/ListEditor.vue";
const route = useRoute(),
  router = useRouter(),
  data = ref(null),
  pickerOpen = ref(false),
  addTrigger = ref(null),
  error = ref(""),
  loading = ref(true),
  busy = ref(false),
  editor = ref(false);
const own = computed(() =>
  Boolean(state.user && state.user.userId === data.value?.list.userId),
);
const path = computed(
  () => `/lists/${route.params.userId}/${route.params.listId}`,
);
let loadId = 0;
async function load() {
  const token = ++loadId;
  try {
    const result = await api(path.value);
    if (token === loadId) {
      data.value = result;
      error.value = "";
    }
  } catch (e) {
    if (token === loadId) error.value = e.message;
  } finally {
    if (token === loadId) loading.value = false;
  }
}
watch(
  () => route.fullPath,
  () => {
    pickerOpen.value = false;
    loading.value = true;
    load();
  },
  { immediate: true },
);
watch(() => state.user?.userId, load);
// Bookmarking keeps another member's public list in your corner, under Saved.
function bookmark(save = !data.value.list.bookmarked) {
  if (!signedIn(() => bookmark(true))) return;
  action(
    () => api(`${path.value}/bookmark`, { method: save ? "PUT" : "DELETE" }),
    save ? "Saved to your corner." : "Removed from your saved lists.",
  );
}
async function action(fn, message) {
  busy.value = true;
  try {
    await fn();
    await load();
    if (message) notify(message);
  } catch (e) {
    notify(e.message, "error");
  } finally {
    busy.value = false;
  }
}
async function addFilm(movie) {
  const target = path.value;
  await api(target + "/movies", {
    method: "POST",
    body: { movieId: movie.movieId },
  });
  if (
    path.value === target &&
    own.value &&
    !data.value.movies.some((m) => m.movieId === movie.movieId)
  ) {
    data.value.movies.push(movie);
  }
}
async function closePicker() {
  pickerOpen.value = false;
  await nextTick();
  addTrigger.value?.focus();
}
function remove(movieId) {
  action(
    () => api(path.value + "/movies/" + movieId, { method: "DELETE" }),
    "Film removed.",
  );
}
function move(index, direction) {
  const ids = data.value.movies.map((m) => m.movieId);
  [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
  action(
    () =>
      api(path.value + "/order", { method: "PUT", body: { movieIds: ids } }),
    "Order saved.",
  );
}
async function deleteList() {
  if (
    !(await confirmAction(
      "Delete this list?",
      "The collection will be removed. The films themselves will stay.",
    ))
  )
    return;
  busy.value = true;
  try {
    await api(path.value, { method: "DELETE" });
    notify("List deleted.");
    router.push("/circle?tab=lists");
  } catch (e) {
    notify(e.message, "error");
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="page-shell list-page">
    <RouterLink :to="own ? '/circle?tab=lists' : '/community'" class="back-link"
      ><ArrowLeft :size="16" />{{ own ? "My lists" : "The circle" }}</RouterLink
    >
    <div v-if="loading" class="loading-state">Opening this collection…</div>
    <div v-else-if="error" class="error-panel" role="alert">{{ error }}</div>
    <template v-else-if="data"
      ><div class="list-heading">
        <div>
          <p class="list-owner">
            <Lock v-if="data.list.visibility === 'private'" :size="14" /><Globe2
              v-else
              :size="14"
            />{{
              data.list.visibility === "private"
                ? "A private collection"
                : "A public collection"
            }}
            by
            <RouterLink :to="`/members/${data.list.userId}`">{{
              displayName(data.list.username)
            }}</RouterLink>
          </p>
          <h1>{{ data.list.name }}</h1>
          <p v-if="data.list.description" class="muted list-description">
            {{ data.list.description }}
          </p>
          <p class="small muted">
            {{ data.movies.length }}
            {{ data.movies.length === 1 ? "film" : "films"
            }}<template v-if="data.list.bookmarks">
              · saved by {{ data.list.bookmarks }}
              {{ data.list.bookmarks === 1 ? "member" : "members" }}</template
            >
          </p>
        </div>
        <button
          v-if="!own && data.list.visibility === 'public'"
          class="button secondary small list-bookmark"
          :class="{ saved: data.list.bookmarked }"
          :aria-pressed="data.list.bookmarked"
          :disabled="busy"
          @click="bookmark()"
        >
          <Bookmark
            :size="15"
            :fill="data.list.bookmarked ? 'currentColor' : 'none'"
          />{{ data.list.bookmarked ? "Saved" : "Bookmark" }}
        </button>
        <div v-if="own" class="list-owner-actions">
          <button
            ref="addTrigger"
            class="button primary small"
            :disabled="busy"
            aria-haspopup="dialog"
            @click="pickerOpen = true"
          >
            <Plus :size="16" aria-hidden="true" />Add films
          </button>
          <button class="button secondary small" @click="editor = true">
            <Pencil :size="15" />Edit list</button
          ><button
            class="icon-button"
            aria-label="Delete list"
            :disabled="busy"
            @click="deleteList"
          >
            <Trash2 :size="19" />
          </button>
        </div>
      </div>
      <div v-if="!data.movies.length" class="empty-state">
        <template v-if="own">
          <button
            class="add-first-film"
            type="button"
            aria-haspopup="dialog"
            @click="pickerOpen = true"
          >
            <span class="medallion"
              ><Plus :size="30" aria-hidden="true"
            /></span>
            <span>Add your first film</span>
          </button>
          <p>Search by title to find a film for this list.</p>
        </template>
        <p v-else>This collection is waiting for its first film.</p>
      </div>
      <FilmPicker
        v-if="pickerOpen && own"
        :list="data.list"
        :members="data.movies"
        :add-film="addFilm"
        @close="closePicker" />
      <div class="list-films">
        <article
          v-for="(movie, index) in data.movies"
          :key="movie.movieId"
          class="list-film"
        >
          <span class="list-position">{{ index + 1 }}</span
          ><RouterLink :to="`/films/${movie.movieId}`" class="list-film-poster"
            ><img :src="movie.poster" :alt="movie.title" @error="imageFallback"
          /></RouterLink>
          <div class="list-film-details">
            <RouterLink :to="`/films/${movie.movieId}`"
              ><h2>{{ movie.title }}</h2></RouterLink
            >
            <p class="muted">
              {{ movie.year }}
              <span class="list-director"
                >Directed by {{ movie.director }}</span
              >
            </p>
            <p class="list-film-synopsis">{{ movie.description }}</p>
            <span v-if="movie.rating != null" class="rating"
              ><Star :size="13" fill="currentColor" />{{
                Number(movie.rating).toFixed(1)
              }}</span
            >
          </div>
          <div v-if="own" class="list-film-tools">
            <button
              class="icon-button"
              :aria-label="`Move ${movie.title} up`"
              :disabled="busy || index === 0"
              @click="move(index, -1)"
            >
              <ArrowUp :size="18" /></button
            ><button
              class="icon-button"
              :aria-label="`Move ${movie.title} down`"
              :disabled="busy || index === data.movies.length - 1"
              @click="move(index, 1)"
            >
              <ArrowDown :size="18" /></button
            ><button
              class="icon-button"
              :aria-label="`Remove ${movie.title}`"
              :disabled="busy"
              @click="remove(movie.movieId)"
            >
              <Trash2 :size="17" />
            </button>
          </div>
        </article>
      </div>
      <ListEditor
        v-if="editor"
        :list="data.list"
        @close="editor = false"
        @saved="load"
    /></template>
  </div>
</template>
