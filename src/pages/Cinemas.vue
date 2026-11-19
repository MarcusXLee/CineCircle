<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { MapPin, Ticket, CalendarDays } from "@lucide/vue";
import {
  api,
  dateLabel,
  timeLabel,
  shortMoney,
  imageFallback,
  poster,
} from "../api";
import ChoiceMenu from "../components/ChoiceMenu.vue";
import MoreButton from "../components/MoreButton.vue";
const route = useRoute(),
  router = useRouter(),
  data = ref({ screenings: [], more: {} }),
  cinemas = ref([]),
  // The filters live in the address so that a refresh or the Back button keeps them.
  date = ref(String(route.query.date || "")),
  cinema = ref(String(route.query.cinemaId || "")),
  movie = ref(String(route.query.movieId || "")),
  loading = ref(true),
  error = ref("");
const screenings = computed(() => data.value.screenings);
const dates = computed(() => [
  ...new Set(screenings.value.map((s) => s.startTime.slice(0, 10))),
]);
const movieOptions = computed(() => {
  const options = new Map(
    screenings.value.map((s) => [
      String(s.movieId),
      { movieId: s.movieId, title: s.movieTitle },
    ]),
  );
  if (movie.value && !options.has(movie.value))
    options.set(movie.value, { movieId: movie.value, title: "Selected film" });
  return [...options.values()];
});
const filmChoices = computed(() => [
  { value: "all", label: "All films" },
  ...movieOptions.value.map((m) => ({
    value: String(m.movieId),
    label: m.title,
    poster: poster(m.movieId),
  })),
]);
const matchesPlace = (s) =>
  (!cinema.value || s.cinemaId === Number(cinema.value)) &&
  (!movie.value || s.movieId === Number(movie.value));
const groups = computed(() => {
  const groups = new Map();
  for (const s of screenings.value.filter(
    (s) =>
      (!date.value || s.startTime.startsWith(date.value)) && matchesPlace(s),
  )) {
    const key = `${s.movieId}/${s.cinemaId}`;
    if (!groups.has(key)) groups.set(key, { ...s, times: [] });
    groups.get(key).times.push(s);
  }
  return [...groups.values()];
});
// When the chosen day has nothing for this film or cinema, offer the next day that
// does, or the closest earlier one.
const nextMatch = computed(
  () =>
    screenings.value.find(
      (s) => matchesPlace(s) && s.startTime.slice(0, 10) > date.value,
    ) || screenings.value.findLast(matchesPlace),
);
const matchingDates = computed(
  () =>
    new Set(
      screenings.value
        .filter(matchesPlace)
        .map((s) => s.startTime.slice(0, 10)),
    ),
);
const chosenFilm = computed(
  () =>
    movieOptions.value.find((m) => String(m.movieId) === movie.value)?.title,
);
const chosenCinema = computed(
  () => cinemas.value.find((c) => String(c.cinemaId) === cinema.value)?.name,
);
// Both watchers ignore the moment this page is being left for another route.
watch([date, cinema, movie], () => {
  if (route.path !== "/cinemas") return;
  router.replace({
    query: Object.fromEntries(
      Object.entries({
        date: date.value,
        cinemaId: cinema.value,
        movieId: movie.value,
      }).filter(([, value]) => value),
    ),
  });
});
watch(
  () => route.query,
  (query) => {
    if (route.path !== "/cinemas") return;
    date.value = String(query.date || "");
    cinema.value = String(query.cinemaId || "");
    movie.value = String(query.movieId || "");
  },
);
async function load() {
  loading.value = true;
  try {
    const [s, c] = await Promise.all([api("/screenings"), api("/cinemas")]);
    data.value = { screenings: s.screenings, more: { screenings: s.more } };
    cinemas.value = c.cinemas;
    // Choose a day when none is set, or when the saved day has no screenings left.
    if (!dates.value.includes(date.value)) {
      const relevant =
        s.screenings.find(matchesPlace) || s.screenings[0] || null;
      date.value = relevant?.startTime.slice(0, 10) || "";
    }
    error.value = "";
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>
<template>
  <div class="page-shell cinemas-page">
    <div class="page-heading">
      <div>
        <h1>Cinema programme</h1>
      </div>
      <span class="catalog-decoration" aria-hidden="true"
        ><Ticket :size="86" :stroke-width="0.8"
      /></span>
    </div>
    <div class="cinema-locations">
      <button
        v-for="c in cinemas"
        :key="c.cinemaId"
        class="cinema-location"
        :class="{ selected: cinema === String(c.cinemaId) }"
        :aria-pressed="cinema === String(c.cinemaId)"
        @click="
          cinema = cinema === String(c.cinemaId) ? '' : String(c.cinemaId)
        "
      >
        <MapPin :size="21" />
        <div>
          <strong>{{ c.name }}</strong
          ><span
            >{{ c.district
            }}<span class="location-address">{{ c.street }}</span></span
          >
        </div>
        <span class="location-select">{{
          cinema === String(c.cinemaId) ? "Selected" : "Show times"
        }}</span>
      </button>
    </div>
    <div v-if="loading" class="loading-state">Finding the next show…</div>
    <div v-else-if="error" class="error-panel" role="alert">
      {{ error }}<button class="text-button" @click="load">Try again</button>
    </div>
    <template v-else
      ><div class="screening-filters">
        <div class="date-strip" role="group" aria-label="Choose screening date">
          <button
            v-for="d in dates"
            :key="d"
            :class="{ selected: date === d, quiet: !matchingDates.has(d) }"
            :aria-pressed="date === d"
            @click="date = d"
          >
            <span>{{ dateLabel(d).split(",")[0].split(" ")[0] }}</span
            ><strong>{{ dateLabel(d).replace(/^\w+,?\s*/, "") }}</strong>
          </button>
        </div>
        <ChoiceMenu
          class="film-filter"
          label="Filter screenings by film"
          :model-value="movie || 'all'"
          @update:model-value="movie = $event === 'all' ? '' : $event"
          :options="filmChoices"
        />
      </div>
      <p class="small muted schedule-note">
        All times in Hong Kong time. Choose a showtime to see available seats.
      </p>
      <div v-if="!screenings.length" class="empty-state">
        <CalendarDays :size="34" />
        <h2>No upcoming screenings right now.</h2>
        <p>
          The demo schedule is topped up each time CineCircle starts. Restart it
          to add the next ten days of showtimes.
        </p>
        <RouterLink to="/films" class="button secondary"
          >Browse films instead</RouterLink
        >
      </div>
      <div v-else-if="!groups.length && nextMatch" class="empty-state">
        <Ticket :size="34" />
        <h2>Not showing on {{ dateLabel(date) }}.</h2>
        <p>
          The
          {{ nextMatch.startTime.slice(0, 10) > date ? "next" : "closest" }}
          showing{{ chosenFilm ? ` of ${chosenFilm}` : ""
          }}{{ chosenCinema ? ` at ${chosenCinema}` : "" }} is on
          {{ dateLabel(nextMatch.startTime) }}.
        </p>
        <button
          class="button secondary"
          @click="date = nextMatch.startTime.slice(0, 10)"
        >
          Go to {{ dateLabel(nextMatch.startTime) }}
        </button>
      </div>
      <div v-else-if="!groups.length" class="empty-state">
        <Ticket :size="34" />
        <h2>
          {{
            chosenFilm && chosenCinema
              ? `${chosenFilm} isn’t scheduled at ${chosenCinema}.`
              : chosenFilm
                ? "This film has no upcoming screenings."
                : "Nothing is scheduled here yet."
          }}
        </h2>
        <p>
          Try another cinema or film, or save it to your watchlist for later.
        </p>
        <button
          class="button secondary"
          @click="
            cinema = '';
            movie = '';
          "
        >
          Show all films and cinemas
        </button>
      </div>
      <article
        v-for="g in groups"
        :key="`${g.movieId}/${g.cinemaId}`"
        class="screening-row"
      >
        <RouterLink :to="`/films/${g.movieId}`" class="screening-poster"
          ><img :src="g.poster" :alt="g.movieTitle" @error="imageFallback"
        /></RouterLink>
        <div class="screening-film-info">
          <RouterLink :to="`/films/${g.movieId}`"
            ><h2>{{ g.movieTitle }}</h2></RouterLink
          >
          <p class="muted">{{ g.duration }} min</p>
          <span><MapPin :size="14" />{{ g.cinemaName }}</span
          ><small>{{ g.hallName }}</small>
        </div>
        <div class="screening-times">
          <RouterLink
            v-for="s in g.times"
            :key="s.screeningId"
            :to="`/screenings/${s.screeningId}`"
            class="time-option"
            ><strong>{{ timeLabel(s.startTime) }}</strong
            ><span>From {{ shortMoney(s.fromPrice) }}</span
            ><small>{{ s.available }} seats left</small></RouterLink
          >
        </div>
      </article>
      <MoreButton
        :data="data"
        field="screenings"
        path="/screenings"
        :id-of="(s) => s.screeningId"
        label="Show later screenings"
      />
      <p class="local-cinema-note">
        These local demo screenings use sample cinema inventory. Bookings do not
        issue admission to a real cinema.
      </p></template
    >
  </div>
</template>
