<script setup>
import { ref, computed, watch } from "vue";
import { useRoute } from "vue-router";
import {
  ArrowLeft,
  MapPin,
  CalendarDays,
  Ticket,
  Check,
  Sparkles,
  X,
  RefreshCw,
} from "@lucide/vue";
import {
  api,
  state,
  signedIn,
  notify,
  dateLabel,
  timeLabel,
  money,
  imageFallback,
} from "../api";
const route = useRoute(),
  data = ref(null),
  selected = ref([]),
  priced = ref(null),
  loading = ref(true),
  error = ref(""),
  quoteError = ref(""),
  quoting = ref(false),
  busy = ref(false),
  tickets = ref(null);
let quoteRequest = 0,
  loadRequest = 0;
const rows = computed(() =>
  data.value
    ? [
        ...new Set(
          data.value.seats.map((s) => s.number.match(/^[A-Za-z]+/)?.[0] || ""),
        ),
      ].map((letter) => ({
        letter,
        seats: data.value.seats.filter((s) => s.number.startsWith(letter)),
      }))
    : [],
);
const chosen = computed(
  () =>
    data.value?.seats.filter((s) =>
      selected.value.includes(s.screeningSeatId),
    ) || [],
);
const estimate = computed(() =>
  chosen.value.reduce((sum, s) => sum + s.price, 0),
);
const total = computed(() => priced.value?.total ?? estimate.value);
const canBook = computed(
  () =>
    !busy.value &&
    selected.value.length > 0 &&
    !quoting.value &&
    (!state.user || !!priced.value),
);
const bookLabel = computed(() =>
  busy.value
    ? "Booking your seats…"
    : state.user
      ? "Confirm booking"
      : "Sign in to book",
);
// Back to the screening list the visitor came from, keeping their filters.
const screeningsLink = computed(() => {
  const back = window.history.state?.back;
  if (typeof back === "string" && back.startsWith("/cinemas")) return back;
  return data.value
    ? {
        path: "/cinemas",
        query: {
          movieId: data.value.screening.movieId,
          date: data.value.screening.startTime.slice(0, 10),
        },
      }
    : "/cinemas";
});
function seatLabel(seat) {
  if (seat.status !== "available") return `Seat ${seat.number}, taken`;
  return `Seat ${seat.number}, ${seat.type}, ${money(seat.price)}`;
}
async function load() {
  const token = ++loadRequest;
  try {
    const next = await api("/screenings/" + route.params.id);
    if (token === loadRequest) {
      data.value = next;
      error.value = "";
    }
  } catch (e) {
    if (token === loadRequest) error.value = e.message;
  } finally {
    if (token === loadRequest) loading.value = false;
  }
}
watch(
  () => route.params.id,
  () => {
    selected.value = [];
    priced.value = null;
    tickets.value = null;
    loading.value = true;
    load();
  },
  { immediate: true },
);
watch([selected, () => state.user?.userId], updateQuote, { deep: true });
async function updateQuote() {
  const token = ++quoteRequest;
  priced.value = null;
  quoteError.value = "";
  if (!selected.value.length || !state.user) {
    quoting.value = false;
    return;
  }
  quoting.value = true;
  try {
    const result = await api("/bookings/quote", {
      method: "POST",
      body: {
        screeningId: Number(route.params.id),
        seatIds: [...selected.value],
      },
    });
    if (token === quoteRequest) priced.value = result;
  } catch (e) {
    if (token === quoteRequest) quoteError.value = e.message;
  } finally {
    if (token === quoteRequest) quoting.value = false;
  }
}
function toggle(seat) {
  if (busy.value) return;
  if (selected.value.includes(seat.screeningSeatId))
    selected.value = selected.value.filter((s) => s !== seat.screeningSeatId);
  else if (selected.value.length < 6)
    selected.value = [...selected.value, seat.screeningSeatId];
  else notify("Choose up to 6 seats per booking.", "error");
}
async function book() {
  // The chosen seats stay selected while the visitor signs in; their price then updates.
  if (
    !signedIn(() =>
      notify("You’re signed in. Check your price, then confirm your seats."),
    ) ||
    !selected.value.length
  )
    return;
  busy.value = true;
  try {
    tickets.value = (
      await api("/bookings", {
        method: "POST",
        body: {
          screeningId: Number(route.params.id),
          seatIds: [...selected.value],
        },
      })
    ).tickets;
    notify("Your seats are booked.");
  } catch (e) {
    notify(e.message, "error");
    await load();
    selected.value = [];
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="page-shell booking-page">
    <RouterLink :to="screeningsLink" class="back-link"
      ><ArrowLeft :size="16" />All screenings</RouterLink
    >
    <div v-if="loading" class="loading-state">Finding your seat…</div>
    <div v-else-if="error" class="error-panel" role="alert">
      {{ error }}<button class="text-button" @click="load">Try again</button>
    </div>
    <section v-else-if="tickets" class="booking-success">
      <span class="success-stamp"><Check :size="35" /></span>
      <h1>You’re going to the movies.</h1>
      <p class="muted">{{ data.screening.movieTitle }} awaits.</p>
      <div class="success-booking">
        <img
          :src="data.screening.poster"
          :alt="data.screening.movieTitle"
          @error="imageFallback"
        />
        <div>
          <h2>{{ data.screening.movieTitle }}</h2>
          <p>{{ data.screening.cinemaName }}</p>
          <p>
            {{ dateLabel(data.screening.startTime) }} at
            {{ timeLabel(data.screening.startTime) }}
          </p>
          <strong>{{
            tickets.map((t) => "Seat " + t.seatNumber).join(", ")
          }}</strong>
          <p class="small muted">
            {{ money(tickets.reduce((n, t) => n + t.price, 0)) }} total
          </p>
        </div>
      </div>
      <RouterLink to="/tickets" class="button primary"
        >View my tickets <Ticket :size="18"
      /></RouterLink>
      <p class="small muted success-footnote">
        A local demo booking. No payment has been taken.
      </p>
    </section>
    <template v-else-if="data"
      ><div class="booking-heading">
        <div>
          <h1>{{ data.screening.movieTitle }}</h1>
          <div class="booking-meta">
            <span><MapPin :size="15" />{{ data.screening.cinemaName }}</span
            ><span
              ><CalendarDays :size="15" />{{
                dateLabel(data.screening.startTime)
              }}
              at {{ timeLabel(data.screening.startTime) }}</span
            >
          </div>
        </div>
        <RouterLink :to="`/films/${data.screening.movieId}`" class="quiet-link"
          >About the film</RouterLink
        >
      </div>
      <div class="booking-layout">
        <section class="seat-map-panel">
          <div class="seat-map-heading">
            <h2>Choose your seats</h2>
            <button class="quiet-link small" :disabled="busy" @click="load">
              <RefreshCw :size="14" />Refresh seats
            </button>
          </div>
          <p class="small muted">
            {{ data.screening.hallName }}. Select up to 6 seats.
          </p>
          <div class="cinema-screen">
            <svg viewBox="0 0 400 64" aria-hidden="true">
              <defs>
                <linearGradient id="screen-gilt" x1="0" x2="1">
                  <stop offset="0" stop-color="#a98450" stop-opacity="0.2" />
                  <stop offset="0.5" stop-color="#f3e2bd" />
                  <stop offset="1" stop-color="#a98450" stop-opacity="0.2" />
                </linearGradient>
                <radialGradient id="screen-glow" cx="0.5" cy="0" r="0.6">
                  <stop offset="0" stop-color="#e9d6f5" stop-opacity="0.22" />
                  <stop offset="1" stop-color="#e9d6f5" stop-opacity="0" />
                </radialGradient>
              </defs>
              <path
                d="M14 16 Q200 -2 386 16 L360 64 Q200 50 40 64 Z"
                fill="url(#screen-glow)"
              />
              <path
                d="M14 16 Q200 -2 386 16"
                fill="none"
                stroke="url(#screen-gilt)"
                stroke-width="3.2"
                stroke-linecap="round"
              />
              <path
                d="M40 25 Q200 10 360 25"
                fill="none"
                stroke="url(#screen-gilt)"
                stroke-width="0.8"
                stroke-opacity="0.6"
              />
            </svg>
            <span>Screen</span>
          </div>
          <div class="seat-rows">
            <div v-for="row in rows" :key="row.letter" class="seat-row">
              <span class="row-label">{{ row.letter }}</span>
              <div class="seat-row-seats">
                <button
                  v-for="(seat, index) in row.seats"
                  :key="seat.screeningSeatId"
                  class="seat"
                  :class="{
                    selected: selected.includes(seat.screeningSeatId),
                    taken: seat.status !== 'available',
                    premium: seat.type === 'premium',
                    aisle: index === 3,
                  }"
                  :disabled="seat.status !== 'available' || busy"
                  :aria-label="seatLabel(seat)"
                  :aria-pressed="selected.includes(seat.screeningSeatId)"
                  :title="seatLabel(seat)"
                  @click="toggle(seat)"
                >
                  <Check
                    v-if="selected.includes(seat.screeningSeatId)"
                    :size="15"
                    :stroke-width="2.8"
                    aria-hidden="true"
                  />
                  <X
                    v-else-if="seat.status !== 'available'"
                    :size="13"
                    aria-hidden="true"
                  />
                  <span v-else>{{
                    seat.number.replace(/^[A-Za-z]+/, "")
                  }}</span>
                </button>
              </div>
              <span class="row-label">{{ row.letter }}</span>
            </div>
          </div>
          <div class="seat-legend">
            <span><i></i>Available</span
            ><span
              ><i class="selected"><Check :size="10" aria-hidden="true" /></i
              >Selected</span
            ><span
              ><i class="taken"><X :size="10" aria-hidden="true" /></i
              >Taken</span
            ><span><i class="premium"></i>Premium</span>
          </div>
          <p class="seat-note">
            Seats are confirmed when you complete your booking.
          </p>
        </section>
        <aside class="booking-summary" aria-label="Booking summary">
          <div class="summary-film">
            <img
              :src="data.screening.poster"
              :alt="data.screening.movieTitle"
              @error="imageFallback"
            />
            <div>
              <span class="small muted">Your screening</span>
              <h2>{{ data.screening.movieTitle }}</h2>
              <p>{{ data.screening.hallName }}</p>
              <p>
                {{ timeLabel(data.screening.startTime) }} —
                {{ timeLabel(data.screening.endTime) }}
              </p>
            </div>
          </div>
          <div class="summary-seats">
            <span class="small muted">Your seats</span>
            <div v-if="chosen.length" class="chosen-seats">
              <span v-for="s in chosen" :key="s.number">{{ s.number }}</span>
            </div>
            <p v-else class="muted small">
              Pick a seat on the map to get started.
            </p>
          </div>
          <div v-if="state.user?.premium" class="member-price-note">
            <Sparkles :size="17" /><span
              >Your member price is applied automatically.</span
            >
          </div>
          <div v-if="quoting" class="small muted quote-loading">
            Finding your best price…
          </div>
          <div v-if="quoteError" class="form-error" role="alert">
            {{ quoteError
            }}<button
              class="text-button"
              @click="
                load();
                selected = [];
              "
            >
              Refresh seats
            </button>
          </div>
          <template v-if="priced"
            ><div class="price-line">
              <span
                >{{ chosen.length }}
                {{ chosen.length === 1 ? "ticket" : "tickets" }}</span
              ><span>{{ money(priced.subtotal) }}</span>
            </div>
            <div v-if="priced.savings" class="price-line saving">
              <span>{{ priced.items[0]?.offer || "Your offers" }}</span
              ><span>−{{ money(priced.savings) }}</span>
            </div></template
          >
          <div class="booking-total">
            <span>{{
              !state.user && chosen.length ? "Estimated total" : "Total"
            }}</span
            ><strong data-testid="booking-total">{{ money(total) }}</strong>
          </div>
          <button
            class="button ticket-button full"
            :disabled="!canBook"
            @click="book"
          >
            {{ bookLabel }}<Ticket :size="18" />
          </button>
          <p v-if="!state.user" class="small muted center">
            Sign in to see your eligible offers.
          </p>
          <p class="booking-disclaimer">
            This is a local cinema demo. No payment is collected and these
            tickets do not admit you to a real cinema.
          </p>
        </aside>
      </div>
      <div v-if="chosen.length" class="booking-bar">
        <div>
          <strong>{{ money(total) }}</strong
          ><span
            >{{ chosen.length }} {{ chosen.length === 1 ? "seat" : "seats" }}:
            {{ chosen.map((s) => s.number).join(", ") }}</span
          >
        </div>
        <button
          class="button ticket-button"
          :disabled="!canBook"
          tabindex="-1"
          aria-hidden="true"
          @click="book"
        >
          {{ bookLabel }}
        </button>
      </div></template
    >
  </div>
</template>
