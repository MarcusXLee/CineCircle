<script setup>
import { useId } from "vue";
// The CineCircle wordmark, shared by the header and the footer.
const gilt = useId();
</script>
<template>
  <span class="brand-mark"
    ><svg class="brand-symbol" viewBox="0 0 40 32" aria-hidden="true">
      <defs>
        <linearGradient :id="gilt" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f7e9c9" />
          <stop offset="0.55" stop-color="#d9b77a" />
          <stop offset="1" stop-color="#a98450" />
        </linearGradient>
      </defs>
      <circle
        cx="15"
        cy="16"
        r="12"
        fill="none"
        :stroke="`url(#${gilt})`"
        stroke-width="2.6"
      />
      <circle
        cx="25"
        cy="16"
        r="12"
        fill="none"
        :stroke="`url(#${gilt})`"
        stroke-width="1.2"
      /></svg
    ><span class="brand-word">CineCircle</span></span
  >
</template>
