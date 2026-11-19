<script setup>
import { ref, computed, watch } from "vue";
import { useRoute } from "vue-router";
import {
  ArrowLeft,
  Bookmark,
  Check,
  Star,
  Plus,
  Ticket,
  CalendarDays,
} from "@lucide/vue";
import {
  api,
  state,
  signedIn,
  notify,
  imageFallback,
  movieTime,
  dateLabel,
  timeLabel,
  shortMoney,
  todayHK,
} from "../api";
import ReviewCard from "../components/ReviewCard.vue";
import ReviewEditor from "../components/ReviewEditor.vue";
import ListVisibility from "../components/ListVisibility.vue";
import ChoiceMenu from "../components/ChoiceMenu.vue";
import Modal from "../components/Modal.vue";
import MoreButton from "../components/MoreButton.vue";
import { printFor } from "../film-programme";
const route = useRoute(),
  data = ref(null),
  loading = ref(true),
  error = ref(""),
  busy = ref(false),
  editor = ref(false),
  editingReview = ref(null),
  watchModal = ref(false),
  watchDate = ref(todayHK()),
  listModal = ref(false),
  lists = ref([]),
  selectedList = ref("");
let requestId = 0;
const ownReview = computed(() => (state.user ? data.value?.myReview : null));
const filmPrint = computed(() => printFor(data.value?.movie.title));
async function load() {
  const current = ++requestId;
  try {
    const next = await api("/movies/" + route.params.id);
    if (current === requestId) {
      data.value = next;
      error.value = "";
      findLinked();
    }
  } catch (e) {
    if (current === requestId) error.value = e.message;
  } finally {
    if (current === requestId) loading.value = false;
  }
}
watch(
  () => route.params.id,
  () => {
    loading.value = true;
    load();
  },
  { immediate: true },
);
watch(() => state.user?.userId, load);
// A link to one review's conversation (?thread=) may point past the first page of reviews.
// That review is fetched and shown first, apart from the paged list so paging stays exact;
// once a page brings it into the list, it shows there instead.
const linked = ref(null);
async function findLinked() {
  const reviewId = route.query.thread;
  if (
    !reviewId ||
    !data.value ||
    data.value.reviews.some((r) => String(r.reviewId) === String(reviewId))
  )
    return;
  try {
    linked.value =
      (
        await api(
          `/reviews?reviewId=${encodeURIComponent(reviewId)}&movieId=${data.value.movie.movieId}`,
        )
      ).reviews[0] || null;
  } catch {
    linked.value = null;
  }
}
const linkedReview = computed(() =>
  linked.value &&
  String(linked.value.reviewId) === String(route.query.thread) &&
  !data.value?.reviews.some((r) => r.reviewId === linked.value.reviewId)
    ? linked.value
    : null,
);
watch(() => route.query.thread, findLinked);
// Actions started while signed out continue after sign-in, once this member's
// watchlist, watched date and review for the film have been loaded.
const afterSignIn = (action) => async () => {
  await load();
  action();
};
async function toggleWatchlist() {
  if (
    !signedIn(
      afterSignIn(() => {
        if (!data.value.watchlisted) toggleWatchlist();
        else notify("This film is already in your watchlist.");
      }),
    )
  )
    return;
  busy.value = true;
  try {
    await api(`/me/watchlist/${data.value.movie.movieId}`, {
      method: data.value.watchlisted ? "DELETE" : "PUT",
    });
    notify(
      data.value.watchlisted
        ? "Removed from your watchlist."
        : "Added to your watchlist.",
    );
    await load();
  } catch (e) {
    notify(e.message, "error");
  } finally {
    busy.value = false;
  }
}
function write(review = ownReview.value) {
  if (!signedIn(afterSignIn(() => write()))) return;
  editingReview.value = review || null;
  editor.value = true;
}
function openWatched() {
  if (!signedIn(afterSignIn(openWatched))) return;
  watchDate.value = data.value.watchDate?.slice(0, 10) || todayHK();
  watchModal.value = true;
}
async function saveWatched(remove = false) {
  busy.value = true;
  try {
    await api(`/me/watched/${data.value.movie.movieId}`, {
      method: remove ? "DELETE" : "PUT",
      ...(remove ? {} : { body: { date: watchDate.value } }),
    });
    notify(remove ? "Watched mark removed." : "Added to your watched films.");
    watchModal.value = false;
    await load();
  } catch (e) {
    notify(e.message, "error");
  } finally {
    busy.value = false;
  }
}
async function openLists() {
  if (!signedIn(openLists)) return;
  try {
    lists.value = (await api("/me/lists?limit=100")).lists;
    selectedList.value = lists.value[0]
      ? `${lists.value[0].userId}/${lists.value[0].listId}`
      : "";
    newList.value = { name: "", visibility: "private" };
    creating.value = !lists.value.length;
    listModal.value = true;
  } catch (e) {
    notify(e.message, "error");
  }
}
// A new list can be made from the same dialog, starting with this film.
const creating = ref(false),
  newList = ref({ name: "", visibility: "private" });
async function createWithFilm() {
  busy.value = true;
  try {
    const { list } = await api("/lists", {
      method: "POST",
      body: { ...newList.value, movieId: data.value.movie.movieId },
    });
    notify(`${data.value.movie.title} is the first film in ${list.name}.`);
    listModal.value = false;
  } catch (e) {
    notify(e.message, "error");
  } finally {
    busy.value = false;
  }
}
async function saveToList() {
  if (!selectedList.value) return;
  busy.value = true;
  try {
    await api(`/lists/${selectedList.value}/movies`, {
      method: "POST",
      body: { movieId: data.value.movie.movieId },
    });
    notify("Film added to your list.");
    listModal.value = false;
  } catch (e) {
    notify(e.message, "error");
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div v-if="loading" class="page-shell loading-state">Finding your film…</div>
  <div v-else-if="error" class="page-shell error-panel" role="alert">
    {{ error }} <RouterLink to="/films">Browse films</RouterLink>
  </div>
  <template v-else-if="data">
    <div class="page-shell movie-page">
      <RouterLink to="/films" class="back-link"
        ><ArrowLeft :size="16" />All films</RouterLink
      >
      <section
        class="movie-overview film-dossier"
        :class="{ 'with-still': filmPrint }"
        :style="{ '--film-tint': filmPrint?.paper || data.movie.color }"
      >
        <div
          class="dossier-image"
          aria-hidden="true"
          :style="{
            backgroundImage:
              'url(' + (filmPrint?.image || data.movie.poster) + ')',
            backgroundPosition: filmPrint?.focus || '50% 35%',
          }"
        ></div>
        <div class="detail-poster">
          <img
            width="300"
            height="450"
            fetchpriority="high"
            :src="data.movie.poster"
            :alt="`${data.movie.title} poster`"
            @error="imageFallback"
          />
        </div>
        <div class="movie-intro">
          <div class="genre-inline">
            <RouterLink
              v-for="g in data.movie.genres"
              :key="g"
              :to="{ path: '/films', query: { genre: g } }"
              >{{ g }}</RouterLink
            >
          </div>
          <h1>{{ data.movie.title }}</h1>
          <p class="movie-credits">
            {{ data.movie.year
            }}<span>{{ movieTime(data.movie.duration) }}</span
            ><span>{{ data.movie.language }}</span>
          </p>
          <p class="director-line">
            Directed by <strong>{{ data.movie.director }}</strong>
          </p>
          <p class="synopsis">{{ data.movie.description }}</p>
          <div class="movie-rating">
            <Star :size="27" fill="currentColor" /><strong>{{
              data.movie.rating != null
                ? Number(data.movie.rating).toFixed(1)
                : "—"
            }}</strong
            ><span
              >out of 10<br /><small
                >{{ data.movie.reviewCount }}
                {{ data.movie.reviewCount === 1 ? "review" : "reviews" }} from
                the circle</small
              ></span
            >
          </div>
          <div class="movie-main-actions">
            <button
              class="button primary"
              :disabled="busy"
              :aria-pressed="data.watchlisted"
              @click="toggleWatchlist"
            >
              <Check v-if="data.watchlisted" :size="17" /><Bookmark
                v-else
                :size="17"
              />{{
                data.watchlisted ? "In your watchlist" : "Add to watchlist"
              }}</button
            ><button class="button secondary" @click="write()">
              {{ ownReview ? "Edit your review" : "Write a review" }}
            </button>
          </div>
          <div class="movie-quiet-actions">
            <button :disabled="busy" @click="openWatched">
              <Check :size="16" />{{
                data.watchDate
                  ? "Watched on " + dateLabel(data.watchDate)
                  : "Mark as watched"
              }}</button
            ><button @click="openLists">
              <Plus :size="16" />Add to a list
            </button>
          </div>
        </div>
      </section>
      <div class="movie-lower">
        <section id="reviews" class="movie-reviews">
          <div class="section-heading">
            <div>
              <h2>Member reviews</h2>
            </div>
            <span class="count-label"
              >{{ data.movie.reviewCount }}
              {{ data.movie.reviewCount === 1 ? "review" : "reviews" }}</span
            >
          </div>
          <div v-if="!data.reviews.length" class="empty-state compact">
            <Star :size="30" />
            <h3>The first word could be yours.</h3>
            <p>Share a rating or a thought about this film.</p>
          </div>
          <ReviewCard
            v-if="linkedReview"
            :key="`linked-${linkedReview.reviewId}`"
            :review="linkedReview"
            :show-movie="false"
            @refresh="load"
            @edit="write($event)"
          />
          <ReviewCard
            v-for="review in data.reviews"
            :key="review.reviewId"
            :review="review"
            :show-movie="false"
            @refresh="load"
            @edit="write($event)"
          />
          <MoreButton
            :data="data"
            field="reviews"
            :path="`/reviews?movieId=${data.movie.movieId}`"
            :id-of="(r) => r.reviewId"
            label="Show more reviews"
          />
        </section>
        <aside class="movie-screenings">
          <div class="screenings-heading">
            <Ticket :size="20" />
            <h2>Upcoming screenings</h2>
          </div>
          <RouterLink
            v-for="s in data.screenings.slice(0, 4)"
            :key="s.screeningId"
            :to="`/screenings/${s.screeningId}`"
            class="showtime-card"
            ><div>
              <strong>{{ s.cinemaName }}</strong
              ><span>{{ s.district }}</span>
            </div>
            <div class="showtime-date">
              <span>{{ dateLabel(s.startTime) }}</span
              ><b>{{ timeLabel(s.startTime) }}</b>
            </div>
            <small>From {{ shortMoney(s.fromPrice) }}</small></RouterLink
          >
          <p v-if="!data.screenings.length" class="muted small">
            No upcoming screenings yet. Save it to your watchlist for another
            day.
          </p>
          <RouterLink
            :to="{ path: '/cinemas', query: { movieId: data.movie.movieId } }"
            class="quiet-link"
            >See all screenings</RouterLink
          >
        </aside>
      </div>
    </div>
    <ReviewEditor
      v-if="editor"
      :review="editingReview"
      :movie-id="data.movie.movieId"
      :movie-title="data.movie.title"
      @close="editor = false"
      @saved="load"
    /><Modal
      v-if="watchModal"
      title="A film to remember."
      @close="watchModal = false"
      ><p class="muted modal-intro">
        When did you watch {{ data.movie.title }}?
      </p>
      <form @submit.prevent="saveWatched()">
        <label class="field"
          >Date watched<input
            v-model="watchDate"
            type="date"
            required
            :min="data.movie.releaseDate || undefined"
            :max="todayHK()" /></label
        ><button class="button primary full" :disabled="busy">
          Save watched date</button
        ><button
          v-if="data.watchDate"
          type="button"
          class="text-button danger-text full spaced"
          :disabled="busy"
          @click="saveWatched(true)"
        >
          Remove watched mark
        </button>
      </form></Modal
    ><Modal
      v-if="listModal"
      title="Keep good films together."
      @close="listModal = false"
      ><p class="muted modal-intro">
        Add {{ data.movie.title }} to one of your collections.
      </p>
      <form v-if="lists.length && !creating" @submit.prevent="saveToList">
        <ChoiceMenu
          class="field"
          label="Your list"
          show-label
          v-model="selectedList"
          :options="
            lists.map((l) => ({
              value: l.userId + '/' + l.listId,
              label: l.name,
            }))
          "
        />
        <button class="button primary full" :disabled="busy">
          Add to list
        </button>
        <button
          type="button"
          class="text-button new-list-toggle"
          @click="creating = true"
        >
          <Plus :size="15" aria-hidden="true" />New list
        </button>
      </form>
      <form v-else @submit.prevent="createWithFilm">
        <p v-if="!lists.length" class="small muted">
          Your first collection starts here.
        </p>
        <label class="field"
          >List name<input
            v-model="newList.name"
            required
            maxlength="255"
            placeholder="Films for a rainy Sunday"
        /></label>
        <ListVisibility v-model="newList.visibility" />
        <button
          class="button primary full"
          :disabled="busy || !newList.name.trim()"
        >
          Create list and add
        </button>
        <button
          v-if="lists.length"
          type="button"
          class="text-button new-list-toggle"
          @click="creating = false"
        >
          Back to my lists
        </button>
      </form></Modal
    ></template
  >
</template>
