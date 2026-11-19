<script setup>
import { Ticket, MapPin, CalendarDays } from "@lucide/vue";
import { dateLabel, timeLabel, parseDate, money, imageFallback } from "../api";
// One booked ticket: the film beside a printed stub. Used in My tickets and My circle.
defineProps({ ticket: { type: Object, required: true } });
</script>
<template>
  <article class="ticket-card">
    <RouterLink :to="`/films/${ticket.movieId}`" class="ticket-poster"
      ><img
        :src="ticket.poster"
        :alt="ticket.movieTitle"
        @error="imageFallback"
    /></RouterLink>
    <div class="ticket-details">
      <span class="ticket-status">{{
        parseDate(ticket.startTime) > new Date()
          ? "See you at the movies"
          : "A movie night to remember"
      }}</span>
      <h2>{{ ticket.movieTitle }}</h2>
      <p>
        <MapPin :size="15" />{{ ticket.cinemaName
        }}<span class="muted">{{ ticket.hallName }}</span>
      </p>
      <p>
        <CalendarDays :size="15" />{{ dateLabel(ticket.startTime) }} at
        {{ timeLabel(ticket.startTime) }}
      </p>
      <span class="small muted"
        >Booked {{ dateLabel(ticket.bookingDate) }}</span
      >
    </div>
    <div class="ticket-stub">
      <Ticket :size="24" /><strong>Seat {{ ticket.seatNumber }}</strong
      ><span>{{ money(ticket.price) }}</span
      ><small>CC-{{ String(ticket.ticketId).padStart(6, "0") }}</small
      ><span class="stub-dots" aria-hidden="true"></span>
    </div>
  </article>
</template>
