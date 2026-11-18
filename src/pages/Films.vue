<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Film, Search, SlidersHorizontal, X } from "@lucide/vue";
import { api, imageFallback } from "../api";
import PosterCard from "../components/PosterCard.vue";
import MoreButton from "../components/MoreButton.vue";

const route = useRoute();
const router = useRouter();
const queryText = computed(() =>
  typeof route.query.q === "string" ? route.query.q : "",
);
const genre = computed(() =>
  typeof route.query.genre === "string" ? route.query.genre : "",
);
const sort = computed(() =>
  ["rating", "newest", "title"].includes(route.query.sort)
    ? route.query.sort
    : "popular",
);
const draft = ref(queryText.value);
const request = () =>
  "/movies?" +
  new URLSearchParams({
    q: queryText.value,
    genre: genre.value,
    sort: sort.value,
    limit: 24,
  });
// One page of films; MoreButton appends the next page and updates `more`.
const result = ref({ movies: [], total: 0, more: {} });
const movies = computed(() => result.value.movies);
const genres = ref([]);
const genreError = ref("");
const loading = ref(true);
const error = ref("");
let searchTimer;
let latestRequest = 0;

function filterBy(patch, replace = false) {
  clearTimeout(searchTimer);
  const query = {
    q: draft.value.trim(),
    genre: genre.value,
    sort: sort.value,
    ...patch,
  };
  if (!query.q) delete query.q;
  if (!query.genre) delete query.genre;
  if (query.sort === "popular") delete query.sort;
  return router[replace ? "replace" : "push"]({ path: "/films", query });
}
function search(value) {
  draft.value = value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => filterBy({}, true), 160);
}
async function load() {
  const token = ++latestRequest;
  loading.value = true;
  try {
    const data = await api(request());
    if (token === latestRequest) {
      result.value = {
        movies: data.movies,
        total: data.total,
        more: { movies: data.more },
      };
      error.value = "";
    }
  } catch (e) {
    if (token === latestRequest) error.value = e.message;
  } finally {
    if (token === latestRequest) loading.value = false;
  }
}
watch(
  [queryText, genre, sort],
  () => {
    clearTimeout(searchTimer);
    draft.value = queryText.value;
    load();
  },
  { immediate: true },
);
async function loadGenres() {
  try {
    genres.value = (await api("/genres")).genres;
    genreError.value = "";
  } catch {
    genreError.value = "Genre filters could not be loaded.";
  }
}
onMounted(loadGenres);
onBeforeUnmount(() => {
  clearTimeout(searchTimer);
  latestRequest++;
});
</script>

<template>
  <div class="page-shell catalog-page">
    <header class="catalog-mast">
      <h1>Film catalogue</h1>
      <div class="catalog-prints" aria-hidden="true">
        <img
          v-for="movie in movies.slice(0, 3)"
          :key="movie.movieId"
          :src="movie.poster"
          alt=""
          width="86"
          height="129"
          @error="imageFallback"
        />
      </div>
    </header>
    <div class="catalog-toolbar">
      <div class="catalog-search">
        <Search :size="19" aria-hidden="true" />
        <input
          :value="draft"
          type="search"
          name="q"
          aria-label="Search films"
          placeholder="Search by film title…"
          @input="search($event.target.value)"
          @keydown.enter.prevent="filterBy({}, true)"
        />
        <button
          v-if="draft"
          class="icon-button"
          aria-label="Clear search"
          @click="
            draft = '';
            filterBy({}, true);
          "
        >
          <X :size="17" aria-hidden="true" />
        </button>
      </div>
      <label class="sort-control"
        ><SlidersHorizontal :size="16" aria-hidden="true" /><span
          class="sr-only"
          >Sort films</span
        >
        <select :value="sort" @change="filterBy({ sort: $event.target.value })">
          <option value="popular">Popular in the circle</option>
          <option value="rating">Highest rated</option>
          <option value="newest">Newest releases</option>
          <option value="title">Title, A to Z</option>
        </select>
      </label>
    </div>
    <div class="genre-filters" role="group" aria-label="Filter by genre">
      <button
        :class="{ selected: !genre }"
        :aria-pressed="!genre"
        @click="filterBy({ genre: '' })"
      >
        All films
      </button>
      <button
        v-for="g in genres"
        :key="g.genreId"
        :class="{ selected: genre === g.name }"
        :aria-pressed="genre === g.name"
        @click="filterBy({ genre: genre === g.name ? '' : g.name })"
      >
        {{ g.name }}
      </button>
    </div>
    <p v-if="genreError" class="small muted" role="alert">
      {{ genreError }}
      <button class="text-button" @click="loadGenres">Retry filters</button>
    </p>
    <div v-if="error" class="error-panel" role="alert">
      {{ error }} <button class="text-button" @click="load">Try again</button>
    </div>
    <div
      v-else-if="loading && !movies.length"
      class="poster-grid"
      aria-label="Loading films"
    >
      <div v-for="n in 6" :key="n" class="poster-skeleton"></div>
    </div>
    <template v-else>
      <p class="result-count" role="status">
        {{ result.total }} {{ result.total === 1 ? "film" : "films"
        }}{{ genre ? " in " + genre : ""
        }}{{ queryText ? " matching “" + queryText + "”" : "" }}
      </p>
      <div
        v-if="movies.length"
        class="poster-grid catalog-grid"
        :aria-busy="loading"
      >
        <PosterCard
          v-for="movie in movies"
          :key="movie.movieId"
          :movie="movie"
        />
      </div>
      <MoreButton
        v-if="movies.length"
        :data="result"
        field="movies"
        :path="request()"
        :id-of="(m) => m.movieId"
        label="Show more films"
      />
      <div v-else class="empty-state">
        <Film :size="34" aria-hidden="true" />
        <h2>No films found.</h2>
        <p>Try a different title or genre.</p>
        <button
          class="button secondary"
          @click="
            draft = '';
            filterBy({ q: '', genre: '' });
          "
        >
          Show all films
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.catalog-mast {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  padding: clamp(28px, 4.2vw, 60px) 0 clamp(22px, 3vw, 42px);
}
.catalog-mast h1 {
  margin: 0;
  font-family: "Baskervville", Georgia, serif;
  font-size: clamp(46px, 5.6vw, 80px);
  font-weight: 400;
  letter-spacing: -0.035em;
  line-height: 1.02;
}
.catalog-prints {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 100px;
  padding: 0 16px;
}
.catalog-prints img {
  height: 88px;
  width: 61px;
  object-fit: cover;
  border: 3px solid #f2eae5;
  border-radius: 3px;
  box-shadow: 0px 4px 10px #0005;
  margin-right: -9px;
  transform: rotate(-9deg);
}
.catalog-prints img:nth-child(2) {
  transform: rotate(2deg) translateY(-4px);
}
.catalog-prints img:nth-child(3) {
  transform: rotate(10deg);
}
.catalog-search:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
.catalog-search input:focus-visible {
  outline: none;
}
@media (max-width: 600px) {
  .catalog-mast {
    gap: 9px;
    padding: 27px 0 22px;
  }
  .catalog-mast h1 {
    max-width: 7ch;
  }
  .catalog-prints {
    min-height: 75px;
    padding: 0 7px 0 0;
  }
  .catalog-prints img {
    height: 55px;
    width: 37px;
    border-width: 2px;
  }
}
</style>
