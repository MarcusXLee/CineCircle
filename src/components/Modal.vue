<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { X } from "@lucide/vue";
defineProps({ title: String, wide: Boolean });
const emit = defineEmits(["close"]);
const dialog = ref();
let previous;
onMounted(() => {
  previous = document.activeElement;
  dialog.value.showModal();
  document.body.style.overflow = "hidden";
});
onBeforeUnmount(() => {
  document.body.style.overflow = "";
  previous?.focus?.();
});
</script>
<template>
  <Teleport to="body"
    ><dialog
      ref="dialog"
      class="modal"
      :class="{ 'modal-wide': wide }"
      aria-labelledby="modal-title"
      @cancel.prevent="emit('close')"
      @click="
        (e) => {
          if (e.target === dialog) emit('close');
        }
      "
    >
      <div class="modal-inner">
        <div class="modal-heading">
          <h2 id="modal-title">{{ title }}</h2>
          <button
            class="icon-button"
            aria-label="Close dialog"
            @click="emit('close')"
          >
            <X :size="20" />
          </button>
        </div>
        <slot />
      </div></dialog
  ></Teleport>
</template>
