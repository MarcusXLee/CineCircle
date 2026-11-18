<script setup>
import { nextTick, useId } from "vue";
// Accessible tabs: arrow keys, Home and End move between tabs; the slot is the panel.
const props = defineProps({ tabs: Array, label: String });
const model = defineModel({ type: String });
const uid = useId(),
  tabId = (key) => `${uid}-tab-${key}`;
function onKey(event, index) {
  const last = props.tabs.length - 1;
  const next = {
    ArrowRight: index === last ? 0 : index + 1,
    ArrowLeft: index === 0 ? last : index - 1,
    Home: 0,
    End: last,
  }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  model.value = props.tabs[next].key;
  nextTick(() => document.getElementById(tabId(model.value))?.focus());
}
</script>
<template>
  <div class="library-tabs" role="tablist" :aria-label="label">
    <button
      v-for="(t, index) in tabs"
      :id="tabId(t.key)"
      :key="t.key"
      type="button"
      role="tab"
      :aria-selected="model === t.key"
      :aria-controls="`${uid}-panel`"
      :tabindex="model === t.key ? 0 : -1"
      :class="{ active: model === t.key }"
      @click="model = t.key"
      @keydown="onKey($event, index)"
    >
      {{ t.name }}<span v-if="t.count != null">{{ t.count }}</span>
    </button>
  </div>
  <div
    :id="`${uid}-panel`"
    class="tab-panel"
    role="tabpanel"
    :aria-labelledby="tabId(model)"
    tabindex="0"
  >
    <slot />
  </div>
</template>
