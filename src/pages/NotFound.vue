<script setup>
import { Film } from "@lucide/vue";
</script>
<template>
  <div class="page-shell">
    <div class="empty-state">
      <Film :size="38" />
      <h1>This page isn’t showing.</h1>
      <p>The link may be old or mistyped.</p>
      <RouterLink to="/films" class="button primary">Browse films</RouterLink>
    </div>
  </div>
</template>
