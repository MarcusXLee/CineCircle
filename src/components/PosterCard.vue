<script setup>
import { ArrowUpRight, Star } from "@lucide/vue";
import { imageFallback } from "../api";
defineProps({ movie: { type: Object, required: true } });
</script>

<template>
  <article class="poster-card">
    <RouterLink
      :to="'/films/' + movie.movieId"
      :aria-label="movie.title"
      class="poster-link"
    >
      <div class="poster-art" :style="{ '--poster-color': movie.color }">
        <img
          :src="movie.poster"
          alt=""
          width="300"
          height="450"
          loading="lazy"
          @error="imageFallback"
        />
        <span
          v-if="movie.rating != null"
          class="poster-score"
          aria-hidden="true"
        >
          <Star :size="12" fill="currentColor" aria-hidden="true" />{{
            Number(movie.rating).toFixed(1)
          }}
        </span>
        <span v-if="movie.director" class="poster-credit"
          >{{ movie.director }}<ArrowUpRight :size="16" aria-hidden="true"
        /></span>
      </div>
      <h3>{{ movie.title }}</h3>
    </RouterLink>
    <p class="poster-meta">
      <span v-if="movie.year">{{ movie.year }}</span
      ><span v-if="movie.genres?.length">{{ movie.genres[0] }}</span
      ><span v-if="movie.rating == null">Unrated</span>
    </p>
    <span v-if="movie.rating != null" class="sr-only"
      >Circle rating {{ Number(movie.rating).toFixed(1) }} out of 10.</span
    >
  </article>
</template>

<style scoped>
.poster-card {
  position: relative;
  min-width: 0;
}
.poster-link {
  display: block;
  border-radius: 8px;
}
.poster-art {
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  aspect-ratio: 2/3;
  background: var(--poster-color, var(--surface));
  box-shadow: 0 6px 16px #0b091722;
}
.poster-art > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.poster-score {
  position: absolute;
  right: 8px;
  bottom: 8px;
  border-radius: 99px;
  padding: 4px 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  background: #19171ded;
  color: #fff5db;
  font-size: 12px;
  font-weight: 650;
  line-height: 1.25;
  font-variant-numeric: tabular-nums;
}
.poster-score svg {
  color: var(--amber);
}
.poster-credit {
  display: flex;
  position: absolute;
  inset: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 5px;
  padding: 12px 10px 24px;
  color: white;
  background: linear-gradient(180deg, #141219ec, transparent);
  font-size: 12px;
  line-height: 1.4;
  font-weight: 550;
  opacity: 0;
}
.poster-link:focus-visible .poster-credit {
  opacity: 1;
}
.poster-card h3 {
  font-family: "DM Sans Variable", sans-serif;
  font-size: clamp(14px, 1.08vw, 17px);
  font-weight: 580;
  letter-spacing: -0.014em;
  line-height: 1.32;
  margin: 12px 0 6px;
  overflow-wrap: anywhere;
}
.poster-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 3px 8px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
}
.poster-meta > span + span {
  padding-inline-start: 8px;
  border-inline-start: 1px solid var(--line);
}
@media (hover: hover) and (pointer: fine) {
  .poster-link:hover .poster-credit {
    opacity: 1;
  }
  .poster-link:hover h3 {
    color: var(--accent);
  }
}
@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
  .poster-art img,
  .poster-credit {
    transition:
      transform 0.24s ease-out,
      opacity 0.17s ease-out;
  }
  .poster-link:hover .poster-art img {
    transform: scale(1.035);
  }
  .poster-credit {
    transform: translateY(-4px);
  }
  .poster-link:hover .poster-credit,
  .poster-link:focus-visible .poster-credit {
    transform: translateY(0);
  }
}
@media (max-width: 600px) {
  .poster-card h3 {
    font-size: 14px;
    margin-top: 9px;
  }
  .poster-meta {
    font-size: 11px;
  }
  .poster-score {
    font-size: 11px;
    padding: 3px 7px;
    right: 6px;
    bottom: 6px;
  }
}
</style>
