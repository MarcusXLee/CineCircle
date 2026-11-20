<script setup>
import { useId } from "vue";
import { Globe2, Lock } from "@lucide/vue";
const visibility = defineModel({ type: String, required: true });
const name = useId();
const choices = [
  { value: "private", label: "Private", detail: "Only me", icon: Lock },
  { value: "public", label: "Public", detail: "Everyone", icon: Globe2 },
];
</script>
<template>
  <fieldset class="visibility-field">
    <legend>Who can see this list?</legend>
    <div class="visibility-choices">
      <label v-for="choice in choices" :key="choice.value">
        <input
          type="radio"
          :name="name"
          :aria-label="choice.label"
          :value="choice.value"
          v-model="visibility"
        />
        <span class="visibility-tile"
          ><component :is="choice.icon" :size="16" aria-hidden="true" />
          <span
            ><strong>{{ choice.label }}</strong
            ><small>{{ choice.detail }}</small></span
          >
        </span>
      </label>
    </div>
  </fieldset>
</template>
<style scoped>
.visibility-field {
  border: 0;
  padding: 0;
  min-width: 0;
  margin: 0 0 20px;
}
legend {
  padding: 0;
  margin-bottom: 9px;
  color: var(--body-copy);
  font-size: 12px;
}
.visibility-choices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.visibility-choices label {
  position: relative;
  cursor: pointer;
}
.visibility-choices input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  opacity: 0;
}
.visibility-tile {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--deep);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--muted);
}
.visibility-tile strong,
.visibility-tile small {
  display: block;
}
.visibility-tile strong {
  color: var(--pearl);
  font-size: 13px;
}
.visibility-tile small {
  font-size: 11px;
  margin-top: 2px;
}
input:checked + .visibility-tile {
  border-color: var(--gilt);
  background: var(--accent-surface);
}
input:checked + .visibility-tile svg,
input:checked + .visibility-tile strong {
  color: var(--gilt);
}
input:focus-visible + .visibility-tile {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
