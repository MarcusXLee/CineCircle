<script setup>
import { ref, useId } from "vue";
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from "reka-ui";
import { Check, ChevronDown } from "@lucide/vue";
import { imageFallback } from "../api";

defineProps({
  label: { type: String, required: true },
  options: { type: Array, required: true },
  showLabel: Boolean,
  disabled: Boolean,
});
const value = defineModel({ type: String, required: true });
const triggerId = useId();
const open = ref(false);
function dismissMenu(event) {
  // Escape closes the active listbox before the surrounding native dialog.
  event.preventDefault();
  open.value = false;
}
</script>

<template>
  <div class="choice-menu">
    <label v-if="showLabel" class="choice-label" :for="triggerId">{{
      label
    }}</label>
    <SelectRoot
      v-model="value"
      v-model:open="open"
      :disabled="disabled || !options.length"
    >
      <SelectTrigger
        :id="triggerId"
        type="button"
        class="choice-trigger"
        :aria-label="label"
      >
        <slot name="icon" /><SelectValue class="choice-value" /><ChevronDown
          class="choice-chevron"
          :size="16"
          aria-hidden="true"
        />
      </SelectTrigger>
      <!-- Keep the pop-up inside its native dialog when used in a form. -->
      <SelectContent
        class="choice-popup"
        position="popper"
        align="start"
        :side-offset="6"
        :collision-padding="10"
        :body-lock="false"
        :disable-outside-pointer-events="false"
        @escape-key-down="dismissMenu"
      >
        <SelectViewport class="choice-viewport">
          <SelectItem
            v-for="option in options"
            :key="option.value"
            :value="option.value"
            :text-value="option.label"
            class="choice-option"
          >
            <img
              v-if="option.poster"
              :src="option.poster"
              alt=""
              width="24"
              height="34"
              loading="lazy"
              @error="imageFallback"
            />
            <SelectItemText>{{ option.label }}</SelectItemText>
            <SelectItemIndicator class="choice-check"
              ><Check :size="16" aria-hidden="true"
            /></SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectRoot>
  </div>
</template>

<!-- The popup's inner elements sit below Reka's positioning wrapper. -->
<style>
.choice-menu {
  min-width: 0;
  max-width: 100%;
}
.choice-label {
  display: block;
  margin: 0 0 9px;
  color: var(--body-copy);
  font-size: 12px;
}
.choice-trigger {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: 42px;
  padding: 9px 13px;
  background: var(--deep);
  color: var(--pearl);
  border: 1px solid var(--line-strong);
  border-radius: 9px;
  font-size: 13px;
  text-align: start;
}
.choice-trigger:hover,
.choice-trigger[data-state="open"] {
  border-color: var(--gilt);
}
.choice-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.choice-trigger > svg {
  color: var(--gilt);
}
.choice-trigger[data-state="open"] .choice-chevron {
  transform: rotate(180deg);
}
.choice-popup {
  z-index: 30;
  width: var(--reka-select-trigger-width);
  min-width: min(12rem, calc(100vw - 22px));
  max-width: calc(100vw - 22px);
  max-height: min(20rem, var(--reka-select-content-available-height));
  overflow: hidden;
  border: 1px solid var(--gilt-line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--pearl);
  box-shadow: 0 9px 32px #0006;
}
.choice-viewport {
  padding: 4px;
  max-height: inherit;
  overscroll-behavior: contain;
}
.choice-option {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  min-height: 37px;
  font-size: 13px;
  border-radius: 6px;
  overflow-wrap: anywhere;
  line-height: 1.4;
  cursor: pointer;
}
.choice-option img {
  border-radius: 3px;
  object-fit: cover;
  flex-shrink: 0;
}
.choice-option[data-state="checked"] {
  color: var(--gilt);
}
.choice-option[data-highlighted] {
  background: var(--accent-surface);
  outline: 1px solid var(--gilt-line);
  outline-offset: -1px;
}
.choice-check {
  margin-inline-start: auto;
  display: inline-flex;
  flex-shrink: 0;
  color: var(--gilt);
}
</style>
