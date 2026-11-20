<script setup>
import { ref, computed } from "vue";
import { Sparkles, Ticket, CalendarDays } from "@lucide/vue";
import Modal from "./Modal.vue";
import {
  api,
  state,
  notify,
  dateLabel,
  refreshSession,
  membershipEnding,
  closePremium,
  finishPremium,
} from "../api";
const busy = ref(false),
  error = ref("");
// Joining, extending a membership in its last week, or coming back after one has ended.
const mode = computed(() =>
  membershipEnding(state.user)
    ? "extend"
    : state.user?.expiryDate && !state.user.premium
      ? "return"
      : "join",
);
const until = (date) => dateLabel(date + " 12:00:00", true);
async function upgrade() {
  busy.value = true;
  error.value = "";
  try {
    const { user } = await api("/me/membership", { method: "POST" });
    notify(
      `${mode.value === "extend" ? "Renewed." : "Welcome to Premium."} Your member price applies until ${until(user.expiryDate)}.`,
    );
    finishPremium(user);
  } catch (e) {
    // Already premium (say, upgraded in another tab): show the membership as it stands.
    if (e.status === 409) {
      await refreshSession().catch(() => {});
      notify(e.message);
      closePremium();
    } else error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <Modal
    :title="
      mode === 'extend'
        ? 'Keep your member price.'
        : mode === 'return'
          ? 'Welcome back to Premium.'
          : 'A little more cinema.'
    "
    @close="closePremium"
    ><p class="muted modal-intro">
      Premium is the same CineCircle, for a little less at the box office.
    </p>
    <ul class="premium-perks">
      <li>
        <Sparkles :size="18" aria-hidden="true" /><span
          ><strong>{{ state.premiumPlan.percentOff }}% off</strong> every
          ticket. When the weekday matinee offer saves more, you get that
          instead.</span
        >
      </li>
      <li>
        <Ticket :size="18" aria-hidden="true" /><span
          >Your member price is applied automatically at checkout.</span
        >
      </li>
      <li>
        <CalendarDays :size="18" aria-hidden="true" /><span
          >{{
            mode === "extend"
              ? `${state.premiumPlan.months} more months after your membership ends on ${until(state.user.expiryDate)}.`
              : `${state.premiumPlan.months} months from today.`
          }}
          Your reviews, lists and tickets stay as they are.</span
        >
      </li>
    </ul>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <div class="modal-actions">
      <button class="button secondary" :disabled="busy" @click="closePremium">
        Not now</button
      ><button class="button primary" :disabled="busy" @click="upgrade">
        {{
          busy
            ? "One moment…"
            : mode === "join"
              ? "Become premium"
              : "Renew premium"
        }}
      </button>
    </div>
    <p class="small muted center">
      This is a local demo. No payment is collected.
    </p></Modal
  >
</template>
