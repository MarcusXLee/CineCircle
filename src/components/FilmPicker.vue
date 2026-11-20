<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Check, Plus, Search } from "@lucide/vue";
import Modal from "./Modal.vue";
import { api, imageFallback } from "../api";

const props = defineProps({
  list: { type: Object, required: true },
  members: { type: Array, required: true },
  addFilm: { type: Function, required: true },
});
const emit = defineEmits(["close"]);
const query = ref("");
const searchTerm = computed(() => query.value.trim());
const inList = computed(() => new Set(props.members.map((m) => m.movieId)));
const films = ref([]);
const hasMore = ref(false);
const searching = ref(true);
const searchError = ref("");
const adding = ref(null);
const addError = ref("");
const status = ref("");
let generation = 0;

async function fetchPage(term, offset, token) {
  searching.value = true;
  searchError.value = "";
  try {
    const params = new URLSearchParams({
      q: term,
      sort: term ? "title" : "popular",
      limit: 8,
      offset,
    });
    const page = await api("/movies?" + params);
    if (token !== generation) return;
    films.value = offset ? [...films.value, ...page.movies] : page.movies;
    hasMore.value = page.more;
  } catch (e) {
    if (token === generation) searchError.value = e.message;
  } finally {
    if (token === generation) searching.value = false;
  }
}
watch(
  searchTerm,
  (term, previous, onCleanup) => {
    const token = ++generation;
    films.value = [];
    hasMore.value = false;
    searching.value = true;
    searchError.value = "";
    const timer = setTimeout(() => fetchPage(term, 0, token), term ? 150 : 0);
    onCleanup(() => clearTimeout(timer));
  },
  { immediate: true, flush: "sync" },
);
onBeforeUnmount(() => generation++);

async function add(movie) {
  if (adding.value !== null || inList.value.has(movie.movieId)) return;
  adding.value = movie.movieId;
  addError.value = "";
  try {
    await props.addFilm(movie);
    status.value = movie.title + " added to your list.";
  } catch (e) {
    addError.value = e.message;
  } finally {
    adding.value = null;
  }
}
</script>
<template>
  <Modal title="Add films" wide @close="emit('close')">
    <p class="picker-destination">{{ list.name }}</p>
    <label class="picker-search">
      <Search :size="19" aria-hidden="true" />
      <input
        v-model="query"
        type="search"
        maxlength="100"
        aria-label="Search films"
        placeholder="Search by film title…"
        autofocus
        autocomplete="off"
      />
    </label>
    <div class="picker-body" :aria-busy="searching">
      <p v-if="searching && !films.length" class="picker-state" role="status">
        Finding films…
      </p>
      <p
        v-if="!searching && !searchError && !films.length"
        class="picker-state"
        role="status"
      >
        No films found.
      </p>
      <ul v-if="films.length" class="picker-grid" aria-label="Films to add">
        <li v-for="film in films" :key="film.movieId">
          <img
            :src="film.poster"
            alt=""
            width="150"
            height="225"
            loading="lazy"
            @error="imageFallback"
          />
          <strong>{{ film.title }}</strong
          ><small>{{
            [film.year, film.genres?.[0]].filter(Boolean).join(" · ")
          }}</small>
          <button
            type="button"
            :class="{ 'in-list': inList.has(film.movieId) }"
            :disabled="inList.has(film.movieId) || adding !== null"
            :aria-label="
              inList.has(film.movieId)
                ? film.title + ' already in this list'
                : 'Add ' + film.title
            "
            @click="add(film)"
          >
            <Check
              v-if="inList.has(film.movieId)"
              :size="15"
              aria-hidden="true"
            /><Plus v-else :size="15" aria-hidden="true" />
            {{
              inList.has(film.movieId)
                ? "In list"
                : adding === film.movieId
                  ? "Adding…"
                  : "Add"
            }}
          </button>
        </li>
      </ul>
      <p v-if="searchError" class="form-error" role="alert">
        {{ searchError }}
        <button
          class="text-button"
          @click="fetchPage(searchTerm, films.length, generation)"
        >
          Try again
        </button>
      </p>
      <button
        v-else-if="hasMore"
        type="button"
        class="button secondary small picker-more"
        :disabled="searching"
        @click="fetchPage(searchTerm, films.length, generation)"
      >
        {{ searching ? "Loading…" : "Show more films" }}
      </button>
    </div>
    <p v-if="addError" class="form-error" role="alert">{{ addError }}</p>
    <div class="picker-footer">
      <span role="status">{{ status }}</span
      ><button
        type="button"
        class="button primary small"
        @click="emit('close')"
      >
        Done
      </button>
    </div>
  </Modal>
</template>
<style scoped>
.picker-destination {
  color: var(--muted);
  font-size: 13px;
  margin: -5px 0 14px;
  overflow-wrap: anywhere;
}
.picker-search {
  display: flex;
  align-items: center;
  gap: 9px;
  padding-inline: 13px;
  color: var(--gilt);
  background: var(--deep);
  border: 1px solid var(--line-strong);
  border-radius: 9px;
}
.picker-search:focus-within {
  border-color: var(--gilt);
  outline: 2px solid var(--gilt-line);
  outline-offset: 2px;
}
.picker-search input {
  flex: 1;
  width: 100%;
  border: 0;
  background: transparent;
  padding: 12px 0;
  font-size: 15px;
}
.picker-search input:focus-visible {
  outline: none;
}
.picker-body {
  max-height: min(49dvh, 470px);
  overflow: auto;
  overscroll-behavior: contain;
  padding: 4px;
  margin: 15px -4px;
}
.picker-state {
  color: var(--muted);
  text-align: center;
  padding: 30px 8px;
}
.picker-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px 12px;
  list-style: none;
  margin: 0;
  padding: 0;
}
.picker-grid li {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-width: 0;
}
.picker-grid img {
  width: 100%;
  height: auto;
  aspect-ratio: 2/3;
  border-radius: 5px;
  background: var(--deep);
  object-fit: contain;
}
.picker-grid strong {
  font-size: 13px;
  line-height: 1.35;
  margin: 8px 0 3px;
  overflow-wrap: anywhere;
}
.picker-grid small {
  color: var(--muted);
  font-size: 11px;
  margin-bottom: auto;
}
.picker-grid button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin-top: 8px;
  min-height: 34px;
  border-radius: 6px;
  border: 1px solid var(--gilt-line);
  background: var(--accent-surface);
  color: var(--gilt);
  font-size: 12px;
}
.picker-grid button:hover:enabled {
  border-color: var(--gilt);
}
.picker-grid button.in-list {
  color: var(--muted);
  background: var(--deep);
  opacity: 1;
  border-color: var(--line);
}
.picker-more {
  display: flex;
  margin: 16px auto 4px;
}
.picker-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid var(--line);
  padding-top: 14px;
}
.picker-footer span {
  color: var(--gilt);
  font-size: 12px;
}
@media (max-width: 560px) {
  .picker-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 440px) {
  .picker-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
