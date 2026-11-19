<script setup>
import { Lock, Globe2, Bookmark } from "@lucide/vue";
import { poster, imageFallback } from "../api";
defineProps({ list: Object });
</script>
<template>
  <RouterLink :to="`/lists/${list.userId}/${list.listId}`" class="list-card"
    ><div class="list-covers">
      <div
        v-for="movieId in list.covers"
        :key="movieId"
        class="list-cover"
        :style="{ '--poster-art': `url(${poster(movieId)})` }"
      >
        <img :src="poster(movieId)" alt="" loading="lazy" @error="imageFallback" />
      </div>
      <div v-if="!list.covers?.length" class="empty-covers">
        A new collection, waiting for its first film.
      </div>
    </div>
    <div class="list-card-info">
      <h3>{{ list.name }}</h3>
      <Lock
        v-if="list.visibility === 'private'"
        :size="14"
        aria-label="Private list"
      /><Globe2 v-else :size="14" aria-label="Public list" />
    </div>
    <p class="small muted">
      {{ list.movieCount }} {{ list.movieCount === 1 ? "film" : "films"
      }}<span v-if="list.username"> curated by {{ list.username }}</span
      ><span
        v-if="list.bookmarks"
        class="list-saves"
        :aria-label="`Bookmarked by ${list.bookmarks} ${list.bookmarks === 1 ? 'member' : 'members'}`"
        ><Bookmark
          :size="12"
          :fill="list.bookmarked ? 'currentColor' : 'none'"
          aria-hidden="true"
        />{{ list.bookmarks }}</span
      >
    </p></RouterLink
  >
</template>
