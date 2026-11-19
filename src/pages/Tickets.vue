<script setup>
import { ref, computed, watch } from "vue";
import { Ticket, ArrowUpRight } from "@lucide/vue";
import { api, state, notify, parseDate, openAuth } from "../api";
import Tabs from "../components/Tabs.vue";
import TicketCard from "../components/TicketCard.vue";
const tickets = ref([]),
  loading = ref(true),
  error = ref(""),
  tab = ref("upcoming");
const filtered = computed(() =>
  tickets.value.filter(
    (t) =>
      tab.value === "all" ||
      parseDate(t.startTime) > new Date() === (tab.value === "upcoming"),
  ),
);
async function load() {
  if (!state.user) {
    tickets.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    tickets.value = (await api("/me/tickets")).tickets;
    error.value = "";
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
watch(() => state.user?.userId, load, { immediate: true });
// Arriving signed out opens the sign-in dialog; this page fills in once signed in.
watch(
  () => state.ready,
  (ready) => ready && !state.user && openAuth(),
  { immediate: true },
);
</script>
<template>
  <div class="page-shell tickets-page">
    <div class="page-heading">
      <div>
        <h1>My tickets</h1>
      </div>
      <RouterLink to="/cinemas" class="button secondary"
        >Find another screening <ArrowUpRight :size="17"
      /></RouterLink>
    </div>
    <div v-if="!state.user && state.ready" class="empty-state">
      <Ticket :size="38" />
      <h2>Your movie nights live here.</h2>
      <p>Sign in to see your booked tickets.</p>
      <button class="button primary" @click="openAuth()">Sign in</button>
    </div>
    <template v-else-if="state.user"
      ><Tabs
        v-model="tab"
        label="Ticket history"
        :tabs="[
          { key: 'upcoming', name: 'Upcoming' },
          { key: 'past', name: 'Past screenings' },
          { key: 'all', name: 'All tickets' },
        ]"
        ><div v-if="loading" class="loading-state">Finding your tickets…</div>
        <div v-else-if="error" class="error-panel" role="alert">
          {{ error
          }}<button class="text-button" @click="load">Try again</button>
        </div>
        <div v-else-if="!filtered.length" class="empty-state">
          <Ticket :size="36" />
          <h2>
            {{
              tab === "past"
                ? "The memories are still to come."
                : "Your next movie night is waiting."
            }}
          </h2>
          <p>Find a screening, pick your favourite seat, and make a plan.</p>
          <RouterLink to="/cinemas" class="button primary"
            >Find a screening</RouterLink
          >
        </div>
        <div v-else class="tickets-list">
          <TicketCard
            v-for="t in filtered"
            :key="t.ticketId"
            :ticket="t"
          /></div
      ></Tabs>
      <p class="local-cinema-note">
        Local demo bookings. No payment was taken. These tickets do not issue
        admission to a real cinema.
      </p></template
    >
  </div>
</template>
