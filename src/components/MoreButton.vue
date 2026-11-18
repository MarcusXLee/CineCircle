<script setup>
import { ref } from "vue";
import { loadMore, notify } from "../api";
// `data` holds the loaded rows under `field` and a `more` map from the server.
const props = defineProps({
  data: Object,
  field: String,
  path: String,
  idOf: Function,
  label: String,
});
const busy = ref(false);
async function more() {
  busy.value = true;
  try {
    await loadMore(props.data, props.field, props.path, props.idOf);
  } catch (e) {
    notify(e.message, "error");
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div v-if="data.more?.[field]" class="show-more">
    <button class="button secondary small" :disabled="busy" @click="more">
      {{ busy ? "Loading…" : label }}
    </button>
  </div>
</template>
