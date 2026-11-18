<script setup>
import { ref, computed, onMounted, watch } from "vue";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Aperture,
  Star,
} from "@lucide/vue";
import {
  api,
  state,
  dateLabel,
  timeLabel,
  shortMoney,
  movieTime,
  notify,
} from "../api";
import { printFor, spotlightTitles } from "../film-programme";
import PosterCard from "../components/PosterCard.vue";
import ReviewCard from "../components/ReviewCard.vue";
import ReviewEditor from "../components/ReviewEditor.vue";
import ListCard from "../components/ListCard.vue";
const movies = ref([]),
  spotlight = ref([]),
  current = ref(0),
  reviews = ref([]),
  screenings = ref([]),
  lists = ref([]),
  loading = ref(true),
  error = ref(""),
  sort = ref("popular"),
  editor = ref(null),
  tabs = ref([]);
const orders = [
  { key: "popular", label: "Popular" },
  { key: "rating", label: "Top rated" },
  { key: "newest", label: "Newest" },
];
const featured = computed(() => spotlight.value[current.value]);
// The ticket follows the film in the spotlight: its next screening, if it has one.
const nextFor = (film) =>
  screenings.value.find((s) => s.movieId === film?.movieId);
const next = computed(() => nextFor(featured.value));
const publicList = computed(() => lists.value[0]);
let shelfRequest = 0;
async function load() {
  try {
    const [m, r, s, l] = await Promise.all([
      api("/movies?sort=" + sort.value),
      api("/reviews"),
      api("/screenings"),
      api("/lists?public=1&limit=1"),
    ]);
    movies.value = m.movies;
    spotlight.value = spotlightTitles
      .map((title) => m.movies.find((x) => x.title === title))
      .filter(Boolean)
      .map((movie) => ({ ...movie, print: printFor(movie.title) }));
    if (current.value >= spotlight.value.length) current.value = 0;
    reviews.value = r.reviews;
    screenings.value = s.screenings;
    lists.value = l.lists;
    error.value = "";
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
function show(index, focus = false) {
  const count = spotlight.value.length;
  current.value = (index + count) % count;
  if (focus) tabs.value[current.value]?.focus();
}
function onTabKey(event) {
  const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
  if (step) show(current.value + step, true);
  else if (event.key === "Home") show(0, true);
  else if (event.key === "End") show(spotlight.value.length - 1, true);
  else return;
  event.preventDefault();
}
// Ignores a slow response if the visitor has already picked another order.
async function changeSort(value) {
  const token = ++shelfRequest;
  sort.value = value;
  try {
    const result = await api("/movies?sort=" + value);
    if (token === shelfRequest) movies.value = result.movies;
  } catch (e) {
    if (token === shelfRequest) notify(e.message, "error");
  }
}
onMounted(load);
watch(() => state.user?.userId, load);
</script>
<template>
  <div class="page-shell home-page">
    <div v-if="error" class="error-panel" role="alert">
      {{ error }} <button class="text-button" @click="load">Try again</button>
    </div>
    <div
      v-else-if="loading"
      class="hero-loading"
      aria-label="Loading featured films"
    ></div>
    <template v-else
      ><section class="lobby-grid" aria-label="Film spotlight">
        <article
          v-if="featured"
          :id="`spotlight-panel-${featured.movieId}`"
          class="feature-film"
          role="tabpanel"
          :aria-labelledby="`spotlight-tab-${featured.movieId}`"
          :style="{ '--film-tint': featured.print?.paper || featured.color }"
        >
          <div class="feature-backdrop">
            <img
              v-for="(film, index) in spotlight"
              :key="film.movieId"
              :class="{ current: index === current }"
              :src="film.print?.image || film.poster"
              :alt="
                index === current
                  ? film.print?.alt || film.title + ' poster'
                  : ''
              "
              :style="{
                objectPosition: film.print?.focus || '65% center',
                transform: `scale(${film.print?.scale || 1})`,
              }"
            />
          </div>
          <div class="feature-content">
            <span class="feature-kicker"
              ><span class="medallion small"
                ><Aperture :size="14" aria-hidden="true" /></span
              >Film spotlight</span
            >
            <!-- Every film's text shares one grid cell, so the card keeps the height of the
                 longest one and does not jump when the spotlight changes. -->
            <div class="feature-stack">
              <div
                v-for="(film, index) in spotlight"
                :key="film.movieId"
                class="feature-copy"
                :class="{ current: index === current }"
                :aria-hidden="index !== current"
                :inert="index !== current"
              >
                <h1>{{ film.title }}</h1>
                <div class="feature-meta">
                  <span v-if="film.director">{{ film.director }}</span
                  ><span v-if="film.year">{{ film.year }}</span
                  ><span>{{ movieTime(film.duration) }}</span
                  ><span v-if="film.rating != null" class="rating"
                    ><Star
                      :size="13"
                      fill="currentColor"
                      aria-hidden="true"
                    />{{ Number(film.rating).toFixed(1) }}</span
                  >
                </div>
                <p v-if="film.description">{{ film.description }}</p>
                <RouterLink
                  :to="`/films/${film.movieId}`"
                  class="button primary"
                  >Film details <ArrowUpRight :size="18" aria-hidden="true"
                /></RouterLink>
              </div>
            </div>
          </div>
          <div class="spotlight-reel">
            <button
              type="button"
              class="reel-step"
              aria-label="Previous film"
              @click="show(current - 1)"
            >
              <ArrowLeft :size="16" aria-hidden="true" />
            </button>
            <div class="reel-frames" role="tablist" aria-label="Featured films">
              <button
                v-for="(film, index) in spotlight"
                :id="`spotlight-tab-${film.movieId}`"
                :key="film.movieId"
                :ref="(el) => (tabs[index] = el)"
                type="button"
                role="tab"
                :aria-selected="index === current"
                :aria-controls="`spotlight-panel-${film.movieId}`"
                :aria-label="film.title"
                :tabindex="index === current ? 0 : -1"
                @click="show(index)"
                @keydown="onTabKey"
              >
                <img :src="film.print?.image || film.poster" alt="" />
              </button>
            </div>
            <button
              type="button"
              class="reel-step"
              aria-label="Next film"
              @click="show(current + 1)"
            >
              <ArrowRight :size="16" aria-hidden="true" />
            </button>
            <span class="reel-count" aria-hidden="true"
              >{{ String(current + 1).padStart(2, "0") }} /
              {{ String(spotlight.length).padStart(2, "0") }}</span
            >
          </div>
        </article>
        <aside class="admission" aria-label="Next screening">
          <div class="admission-paper">
            <header class="admission-head">
              <span class="admission-house">CineCircle</span>
              <span class="admission-admit">Admit one</span>
            </header>
            <div class="admission-stack">
              <div
                v-for="(film, index) in spotlight"
                :key="film.movieId"
                class="admission-copy"
                :class="{ current: index === current }"
                :aria-hidden="index !== current"
              >
                <p class="admission-kind">
                  {{ nextFor(film) ? "Next screening" : "Not yet scheduled" }}
                </p>
                <div class="admission-film">
                  <img :src="film.poster" alt="" width="58" height="87" />
                  <div>
                    <h2>{{ film.title }}</h2>
                    <span
                      >{{ movieTime(film.duration) }} · {{ film.year }}</span
                    >
                  </div>
                </div>
                <dl v-if="nextFor(film)" class="admission-fields">
                  <div>
                    <dt>Date</dt>
                    <dd>{{ dateLabel(nextFor(film).startTime) }}</dd>
                  </div>
                  <div>
                    <dt>Time</dt>
                    <dd class="admission-time">
                      {{ timeLabel(nextFor(film).startTime) }}
                    </dd>
                  </div>
                  <div>
                    <dt>Cinema</dt>
                    <dd>{{ nextFor(film).cinemaName }}</dd>
                  </div>
                  <div>
                    <dt>Hall</dt>
                    <dd>{{ nextFor(film).hallName }}</dd>
                  </div>
                </dl>
                <p v-else class="admission-empty">
                  This film has no screening in the next ten days.
                </p>
              </div>
            </div>
          </div>
          <div class="admission-stub">
            <RouterLink
              v-if="next"
              :to="`/screenings/${next.screeningId}`"
              class="button admission-button"
              >Choose seats <ArrowRight :size="17" aria-hidden="true"
            /></RouterLink>
            <RouterLink v-else to="/cinemas" class="button admission-button"
              >See all screenings <ArrowRight :size="17" aria-hidden="true"
            /></RouterLink>
            <div class="admission-serial">
              <span class="admission-barcode" aria-hidden="true"></span>
              <span v-if="next"
                >From {{ shortMoney(next.fromPrice) }} ·
                {{ next.available }} seats left</span
              >
              <span aria-hidden="true"
                >No. {{ String(next?.screeningId || 0).padStart(6, "0") }}</span
              >
            </div>
          </div>
        </aside>
      </section>
      <section class="poster-section" aria-labelledby="shelf-heading">
        <div class="section-heading">
          <h2 id="shelf-heading">The film shelf</h2>
          <RouterLink to="/films" class="quiet-link"
            >All films <ArrowUpRight :size="17" aria-hidden="true"
          /></RouterLink>
        </div>
        <div class="satin-tabs" role="group" aria-label="Sort the film shelf">
          <button
            v-for="order in orders"
            :key="order.key"
            type="button"
            :aria-pressed="sort === order.key"
            @click="changeSort(order.key)"
          >
            {{ order.label }}
          </button>
        </div>
        <div class="poster-grid home-posters">
          <PosterCard
            v-for="movie in movies.slice(0, 6)"
            :key="movie.movieId"
            :movie="movie"
          />
        </div>
      </section>
      <section class="home-community" aria-label="From the community">
        <div class="community-reviews">
          <div class="section-heading">
            <h2>Recent reviews</h2>
            <RouterLink to="/community" class="quiet-link"
              >Community <ArrowUpRight :size="17" aria-hidden="true"
            /></RouterLink>
          </div>
          <div v-if="reviews.length" class="home-review-grid">
            <ReviewCard
              v-for="review in reviews.slice(0, 2)"
              :key="review.reviewId"
              :review="review"
              @refresh="load"
              @edit="editor = $event"
            />
          </div>
          <p v-else class="muted">
            No reviews yet. Choose a film to add yours.
          </p>
        </div>
        <aside v-if="publicList" class="home-collection">
          <h2>Community collection</h2>
          <ListCard :list="publicList" />
        </aside></section></template
    ><ReviewEditor
      v-if="editor"
      :review="editor"
      @close="editor = null"
      @saved="load"
    />
  </div>
</template>

<style scoped>
.home-page {
  padding-top: clamp(20px, 2.6vw, 34px);
}
.lobby-grid {
  display: grid;
  grid-template-columns: minmax(0, 2.6fr) minmax(280px, 1fr);
  gap: 22px;
}
/* Fade 1: the still dissolves into the page on the left, behind the title. */
.feature-film {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 500px;
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid var(--line);
  background:
    radial-gradient(
      circle at 12% 28%,
      color-mix(in srgb, var(--film-tint) 16%, transparent),
      transparent 55%
    ),
    var(--deep);
  isolation: isolate;
}
.feature-backdrop {
  position: absolute;
  inset: 0 0 0 auto;
  width: 72%;
  overflow: hidden;
  z-index: -1;
  -webkit-mask-image:
    linear-gradient(90deg, transparent 0%, rgb(0 0 0 / 0.55) 30%, #000 58%),
    linear-gradient(0deg, transparent 0%, #000 36%);
  -webkit-mask-composite: source-in;
  mask-image:
    linear-gradient(90deg, transparent 0%, rgb(0 0 0 / 0.55) 30%, #000 58%),
    linear-gradient(0deg, transparent 0%, #000 36%);
  mask-composite: intersect;
}
/* The still is enlarged inside its frame to crop its letterbox edge. */
.feature-backdrop img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform-origin: 60% 55%;
  opacity: 0;
  transition: opacity 0.7s ease;
}
.feature-backdrop img.current {
  opacity: 1;
}
.feature-content {
  position: relative;
  padding: clamp(30px, 3.2vw, 46px) clamp(26px, 3vw, 42px) 44px;
  max-width: 600px;
}
.feature-stack,
.admission-stack {
  display: grid;
}
.feature-copy,
.admission-copy {
  grid-area: 1 / 1;
  visibility: hidden;
  opacity: 0;
  transition:
    opacity 0.45s ease,
    visibility 0.45s;
}
.feature-copy.current,
.admission-copy.current {
  visibility: visible;
  opacity: 1;
}
.feature-kicker {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 650;
  color: var(--body-copy);
}
.feature-content h1 {
  font-family: "Baskervville", Georgia, serif;
  font-size: clamp(48px, 5vw, 76px);
  font-weight: 400;
  line-height: 0.99;
  letter-spacing: -0.05em;
  margin: 24px 0 18px;
  max-width: 11ch;
  text-wrap: balance;
  text-shadow: 0 2px 24px rgb(0 0 0 / 0.35);
}
.feature-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px 12px;
  font-size: 13px;
  font-weight: 540;
  color: var(--body-copy);
}
.feature-meta > span + span {
  border-inline-start: 1px solid var(--line-strong);
  padding-inline-start: 12px;
}
.feature-meta .rating {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--amber);
}
.feature-copy > p {
  max-width: 44ch;
  margin: 16px 0 24px;
  font-size: 14px;
  line-height: 1.65;
  color: var(--body-copy);
  text-wrap: pretty;
}

/* Film reel: one frame per featured film, with previous and next. */
.spotlight-reel {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: auto;
  align-self: flex-end;
  max-width: 100%;
  padding: 0 clamp(18px, 2vw, 26px) 20px;
}
.reel-frames {
  display: flex;
  gap: 8px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 3px;
}
.reel-frames button {
  flex-shrink: 0;
  width: 66px;
  height: 42px;
  padding: 0;
  overflow: hidden;
  border-radius: 5px;
  border: 1px solid rgb(255 255 255 / 0.22);
  opacity: 0.6;
  transition:
    opacity 0.2s,
    box-shadow 0.2s;
}
.reel-frames button:hover {
  opacity: 0.9;
}
.reel-frames button[aria-selected="true"] {
  opacity: 1;
  border-color: var(--gilt);
  box-shadow: 0 0 0 2px rgb(236 211 162 / 0.3);
}
.reel-frames img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.reel-step {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: var(--gilt);
  border: 1px solid var(--gilt-line);
  background: var(--grain), var(--medallion-face);
  box-shadow: var(--medallion-shadow);
}
.reel-step:hover {
  color: var(--pearl);
}
.reel-count {
  flex-shrink: 0;
  font-size: 11px;
  letter-spacing: 0.14em;
  font-variant-numeric: tabular-nums;
  color: var(--body-copy);
}

/* The next screening as a printed admission ticket: punched corners, a double
   printed border, and a stub below the tear line. */
.admission {
  display: flex;
  flex-direction: column;
  color: #2e2724;
  filter: drop-shadow(0 18px 28px rgb(0 0 0 / 0.35));
  min-width: 0;
}
.admission-paper,
.admission-stub {
  position: relative;
  background:
    radial-gradient(circle at 100% 0%, #fff8ec 0, transparent 50%),
    var(--paper-grain), #f1e7d8;
  -webkit-mask:
    radial-gradient(circle 13px at top left, #0000 98%, #000) top left,
    radial-gradient(circle 13px at top right, #0000 98%, #000) top right,
    radial-gradient(circle 13px at bottom left, #0000 98%, #000) bottom left,
    radial-gradient(circle 13px at bottom right, #0000 98%, #000) bottom right;
  -webkit-mask-size: 51% 51%;
  -webkit-mask-repeat: no-repeat;
  mask:
    radial-gradient(circle 13px at top left, #0000 98%, #000) top left / 51% 51%
      no-repeat,
    radial-gradient(circle 13px at top right, #0000 98%, #000) top right / 51%
      51% no-repeat,
    radial-gradient(circle 13px at bottom left, #0000 98%, #000) bottom left /
      51% 51% no-repeat,
    radial-gradient(circle 13px at bottom right, #0000 98%, #000) bottom right /
      51% 51% no-repeat;
}
.admission-paper {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 26px 26px 22px;
}
.admission-paper::before {
  content: "";
  position: absolute;
  inset: 10px 10px 0;
  border: 1px solid rgb(122 92 66 / 0.32);
  border-bottom: 0;
  outline: 1px solid rgb(122 92 66 / 0.16);
  outline-offset: 3px;
  pointer-events: none;
}
.admission-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 3px double rgb(122 92 66 / 0.45);
}
.admission-house {
  font-family: "Cinzel", "Baskervville", Georgia, serif;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #493445;
}
.admission-admit {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: #8a6f5c;
}
.admission-kind {
  margin: 16px 0 12px;
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #8a6f5c;
}
.admission-film {
  display: flex;
  gap: 14px;
  align-items: center;
}
.admission-film img {
  width: 58px;
  height: 87px;
  object-fit: cover;
  border-radius: 3px;
  box-shadow: 0 6px 14px rgb(48 42 41 / 0.28);
}
.admission-film h2 {
  font-family: "Baskervville", Georgia, serif;
  font-size: clamp(23px, 2vw, 28px);
  font-weight: 400;
  line-height: 1.05;
  letter-spacing: -0.02em;
  text-wrap: balance;
}
.admission-film span {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: #7b6d66;
}
.admission-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 20px 0 0;
  border-top: 1px solid rgb(122 92 66 / 0.3);
}
.admission-fields > div {
  padding: 10px 0 10px;
  border-bottom: 1px solid rgb(122 92 66 / 0.3);
  min-width: 0;
}
.admission-fields > div:nth-child(odd) {
  padding-right: 12px;
  border-right: 1px solid rgb(122 92 66 / 0.3);
}
.admission-fields > div:nth-child(even) {
  padding-left: 14px;
}
.admission-fields dt {
  font-size: 9.5px;
  font-weight: 650;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #8a6f5c;
}
.admission-fields dd {
  margin: 4px 0 0;
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.admission-fields .admission-time {
  font-size: 20px;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.admission-empty {
  margin-top: 20px;
  font-size: 14px;
  color: #5d514b;
}
.admission-stub {
  padding: 20px 26px 16px;
}
.admission-stub::before {
  content: "";
  position: absolute;
  top: 0;
  left: 18px;
  right: 18px;
  border-top: 2px dashed rgb(150 120 95 / 0.55);
}
.admission-button {
  width: 100%;
  background: #493445;
  color: #fff3e9;
}
.admission-button:hover {
  background: #594054;
}
.admission-serial {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 14px;
  font-size: 10.5px;
  color: #7b6d66;
  font-variant-numeric: tabular-nums;
}
.admission-barcode {
  width: 74px;
  height: 22px;
  flex-shrink: 0;
  opacity: 0.75;
  background: repeating-linear-gradient(
    90deg,
    #2e2724 0 2px,
    transparent 2px 3px,
    #2e2724 3px 4px,
    transparent 4px 6px,
    #2e2724 6px 9px,
    transparent 9px 10px,
    #2e2724 10px 11px,
    transparent 11px 14px
  );
}

.poster-section {
  margin-top: clamp(40px, 4vw, 58px);
}
.poster-section .section-heading,
.home-community .section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.poster-section h2,
.home-community h2 {
  font-size: clamp(28px, 2.6vw, 39px);
  line-height: 1.08;
  letter-spacing: -0.047em;
  font-weight: 560;
}
.poster-section .satin-tabs {
  margin-bottom: 24px;
}
.home-community {
  margin-top: clamp(44px, 4.4vw, 68px);
  display: grid;
  grid-template-columns: minmax(0, 1fr) 290px;
  gap: clamp(26px, 3vw, 40px);
}
.home-review-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
}
.home-review-grid :deep(.review-card) {
  padding: 0 0 18px;
  border-bottom: 0;
}
/* Fade 2: the collection's covers settle into the page at the bottom. */
.home-collection {
  border-left: 1px solid var(--line);
  padding-left: clamp(22px, 2.4vw, 32px);
  min-width: 0;
}
.home-collection > h2 {
  font-size: clamp(22px, 1.8vw, 28px);
  margin-bottom: 18px;
}
.home-collection :deep(.list-covers) {
  height: 190px;
  -webkit-mask-image: linear-gradient(180deg, #000 55%, transparent 100%);
  mask-image: linear-gradient(180deg, #000 55%, transparent 100%);
}
.hero-loading {
  height: 460px;
  background: var(--surface);
  border-radius: 14px;
}

@media (max-width: 1150px) {
  .home-review-grid {
    grid-template-columns: 1fr;
  }
  .home-community {
    grid-template-columns: minmax(0, 1fr) 250px;
  }
}
@media (max-width: 900px) {
  .lobby-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  /* Narrow screens: the still sits above the title and fades down into the card. */
  .feature-backdrop {
    inset: 0 0 auto;
    width: 100%;
    height: 320px;
    -webkit-mask-image: linear-gradient(180deg, #000 45%, transparent 100%);
    mask-image: linear-gradient(180deg, #000 45%, transparent 100%);
  }
  .feature-film {
    min-height: 0;
    padding-top: 230px;
  }
  .feature-content h1 {
    margin-top: 16px;
  }
}
@media (max-width: 800px) {
  .home-posters {
    display: grid;
    grid-template-columns: none;
    grid-auto-flow: column;
    grid-auto-columns: clamp(130px, 38vw, 172px);
    gap: 14px;
    overflow-x: auto;
    scroll-snap-type: x proximity;
    scrollbar-width: thin;
    scrollbar-color: var(--line) transparent;
    padding: 4px 3px 13px;
  }
  .home-posters > * {
    scroll-snap-align: start;
  }
  .home-community {
    grid-template-columns: minmax(0, 1fr);
  }
  .home-collection {
    border-left: 0;
    border-top: 1px solid var(--line);
    padding: 24px 0 0;
  }
}
@media (max-width: 600px) {
  .feature-backdrop {
    height: 250px;
  }
  .feature-film {
    padding-top: 170px;
  }
  .feature-content {
    padding: 22px 20px 26px;
  }
  .feature-copy > p {
    font-size: 13px;
    line-height: 1.55;
  }
  .admission-paper {
    padding: 22px 20px 18px;
  }
  .admission-stub {
    padding: 18px 20px 14px;
  }
  .reel-frames button {
    width: 54px;
    height: 36px;
  }
  .reel-count {
    display: none;
  }
}
</style>
