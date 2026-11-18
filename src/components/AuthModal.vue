<script setup>
import { ref } from "vue";
import Modal from "./Modal.vue";
import { api, state, notify, displayName, finishAuth, closeAuth } from "../api";
const username = ref(""),
  password = ref(""),
  email = ref(""),
  busy = ref(false),
  error = ref("");
async function submit(demo = false) {
  busy.value = true;
  error.value = "";
  try {
    const data = await api(
      "/auth/" + (state.authMode === "register" ? "register" : "login"),
      {
        method: "POST",
        body: demo
          ? { username: "mia", password: "Cinema2026!" }
          : {
              username: username.value,
              password: password.value,
              email: email.value,
            },
      },
    );
    notify(`Good to see you, ${displayName(data.user.username)}.`);
    finishAuth(data.user);
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
function switchMode() {
  state.authMode = state.authMode === "register" ? "login" : "register";
  error.value = "";
}
</script>
<template>
  <Modal
    :title="
      state.authMode === 'register' ? 'Find your circle.' : 'Welcome back.'
    "
    @close="closeAuth"
    ><p class="muted modal-intro">
      Keep the films you love close. Find the people who love them too.
    </p>
    <form @submit.prevent="submit()">
      <label class="field"
        >{{ state.authMode === "register" ? "Username" : "Username or email"
        }}<input
          v-model="username"
          autocomplete="username"
          required
          :maxlength="state.authMode === 'register' ? 40 : 254"
          :minlength="state.authMode === 'register' ? 3 : 1"
          :pattern="state.authMode === 'register' ? '[A-Za-z0-9_]+' : null"
          :title="
            state.authMode === 'register'
              ? 'Use letters, numbers or underscores.'
              : null
          "
        /><span v-if="state.authMode === 'register'" class="small muted"
          >3–40 letters, numbers or underscores.</span
        ></label
      ><label v-if="state.authMode === 'register'" class="field"
        >Email address<input
          v-model="email"
          type="email"
          autocomplete="email"
          required
          maxlength="254" /></label
      ><label class="field"
        >Password<input
          v-model="password"
          type="password"
          :autocomplete="
            state.authMode === 'register' ? 'new-password' : 'current-password'
          "
          required
          :minlength="state.authMode === 'register' ? 8 : 1"
          maxlength="128"
        /><span v-if="state.authMode === 'register'" class="small muted"
          >At least 8 characters.</span
        ></label
      >
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button class="button primary full" :disabled="busy">
        {{
          busy
            ? "One moment…"
            : state.authMode === "register"
              ? "Create account"
              : "Sign in"
        }}
      </button>
    </form>
    <template v-if="state.authMode === 'login'"
      ><div class="or-divider"><span>Just looking around?</span></div>
      <button
        class="button secondary full"
        :disabled="busy"
        @click="submit(true)"
      >
        Continue as Mia
      </button>
      <p class="small muted center">
        Explore with a local premium demo account.
      </p></template
    >
    <p class="auth-switch">
      {{
        state.authMode === "register"
          ? "Already part of the circle?"
          : "New to CineCircle?"
      }}
      <button class="text-button" @click="switchMode">
        {{ state.authMode === "register" ? "Sign in" : "Join the circle" }}
      </button>
    </p></Modal
  >
</template>
