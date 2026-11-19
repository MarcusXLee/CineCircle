<script setup>
import { ref } from "vue";
import ListVisibility from "./ListVisibility.vue";
import Modal from "./Modal.vue";
import { api, notify } from "../api";
const props = defineProps({ list: Object });
const emit = defineEmits(["close", "saved"]);
const name = ref(props.list?.name || ""),
  description = ref(props.list?.description || ""),
  visibility = ref(props.list?.visibility || "private"),
  busy = ref(false),
  error = ref("");
async function save() {
  busy.value = true;
  error.value = "";
  try {
    const data = await api(
      props.list
        ? `/lists/${props.list.userId}/${props.list.listId}`
        : "/lists",
      {
        method: props.list ? "PATCH" : "POST",
        body: {
          name: name.value,
          description: description.value,
          visibility: visibility.value,
        },
      },
    );
    notify(props.list ? "List saved." : "Your new list is ready.");
    emit("saved", data.list);
    emit("close");
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <Modal
    :title="list ? 'Shape your collection.' : 'A collection of your own.'"
    @close="emit('close')"
    ><p class="muted modal-intro">
      A mood, a memory, a very specific obsession. There’s a list for that.
    </p>
    <form @submit.prevent="save">
      <label class="field"
        >List name<input
          v-model="name"
          required
          maxlength="255"
          placeholder="Films for a rainy Sunday" /></label
      ><label class="field"
        >Description<textarea
          v-model="description"
          rows="3"
          maxlength="3000"
          placeholder="What brings these films together?"
        ></textarea>
      </label>
      <ListVisibility v-model="visibility" />
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button class="button primary full" :disabled="busy">
        {{ busy ? "Saving…" : list ? "Save list" : "Create list" }}
      </button>
    </form></Modal
  >
</template>
