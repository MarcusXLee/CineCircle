<script setup>
import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { Settings, Sparkles, ArrowUpRight, TriangleAlert } from "@lucide/vue";
import Modal from "../components/Modal.vue";
import {
  api,
  state,
  notify,
  displayName,
  dateLabel,
  parseDate,
  openAuth,
  openPremium,
  membershipEnding,
} from "../api";
const router = useRouter(),
  username = ref(""),
  email = ref(""),
  currentPassword = ref(""),
  newPassword = ref(""),
  confirmPassword = ref(""),
  errors = ref({}),
  busy = ref(""),
  upcoming = ref(0),
  // Deleting takes two steps: what will go, then the password and the final button.
  deleting = ref(0),
  deletePassword = ref("");
// The shared demo account stays as it is (the server refuses changes too).
const demo = computed(() => state.user?.username === state.demo.username);
const until = (date) => dateLabel(date + " 12:00:00", true);

async function load() {
  if (!state.user) return;
  username.value = state.user.username;
  email.value = state.user.email || "";
  errors.value = {};
  try {
    const { tickets } = await api("/me/tickets");
    upcoming.value = tickets.filter(
      (t) => parseDate(t.startTime) > new Date(),
    ).length;
  } catch {
    upcoming.value = 0;
  }
}
watch(() => state.user?.userId, load, { immediate: true });
// Arriving signed out opens the sign-in dialog; this page fills in once signed in.
watch(
  () => state.ready,
  (ready) => ready && !state.user && openAuth(),
  { immediate: true },
);

// Problems show beside the form and pop up, so a name or email already in use is hard to miss.
function fail(field, message) {
  errors.value = { ...errors.value, [field]: message };
  notify(message, "error");
}
async function save(field, path, body, done) {
  errors.value = { ...errors.value, [field]: "" };
  busy.value = field;
  try {
    const result = await api(path, { method: "PUT", body });
    done(result);
  } catch (e) {
    fail(field, e.message);
  } finally {
    busy.value = "";
  }
}
function saveUsername() {
  save("username", "/me/username", { username: username.value }, ({ user }) => {
    state.user = user;
    username.value = user.username;
    notify(`You’re now ${displayName(user.username)}.`);
  });
}
function saveEmail() {
  save("email", "/me/email", { email: email.value }, ({ user }) => {
    state.user = user;
    email.value = user.email;
    notify(`Your email is now ${user.email}.`);
  });
}
function savePassword() {
  if (newPassword.value.length < 8)
    return fail("password", "Use a new password with at least 8 characters.");
  if (newPassword.value !== confirmPassword.value)
    return fail("password", "The new passwords don’t match.");
  save(
    "password",
    "/me/password",
    {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
      confirmPassword: confirmPassword.value,
    },
    () => {
      currentPassword.value = newPassword.value = confirmPassword.value = "";
      notify(
        "Password changed. Anywhere else you were signed in has been signed out.",
      );
    },
  );
}
function startDelete() {
  deletePassword.value = "";
  errors.value = { ...errors.value, delete: "" };
  deleting.value = 1;
}
async function deleteAccount() {
  busy.value = "delete";
  errors.value = { ...errors.value, delete: "" };
  try {
    await api("/me", {
      method: "DELETE",
      body: { password: deletePassword.value },
    });
    deleting.value = 0;
    state.user = null;
    notify("Your account has been deleted.");
    router.push("/");
  } catch (e) {
    fail("delete", e.message);
  } finally {
    busy.value = "";
  }
}
</script>
<template>
  <div class="page-shell settings-page">
    <div class="page-heading">
      <div>
        <p class="context-label">My circle</p>
        <h1>Account settings</h1>
      </div>
      <RouterLink v-if="state.user" to="/circle" class="button secondary"
        >Back to my corner <ArrowUpRight :size="17"
      /></RouterLink>
    </div>
    <div v-if="!state.user && state.ready" class="empty-state">
      <Settings :size="38" />
      <h2>Your account lives here.</h2>
      <p>Sign in to change your name, email or password.</p>
      <button class="button primary" @click="openAuth()">Sign in</button>
    </div>
    <template v-else-if="state.user">
      <p v-if="demo" class="settings-demo" role="note">
        <Sparkles :size="18" aria-hidden="true" /><span
          >This is the shared demo account, so its name, email and password stay
          as they are and it can’t be deleted. Create your own account to try
          these settings.</span
        >
      </p>
      <div class="settings-grid">
        <section class="settings-card" aria-labelledby="settings-name">
          <h2 id="settings-name">Username</h2>
          <p class="muted small">
            How you appear on reviews, comments and lists. You can also sign in
            with it.
          </p>
          <form @submit.prevent="saveUsername">
            <fieldset :disabled="demo">
              <label class="field"
                >Username<input
                  v-model="username"
                  autocomplete="username"
                  required
                  minlength="3"
                  maxlength="40"
                  pattern="[A-Za-z0-9_]+"
                  title="Use letters, numbers or underscores."
                /><span class="small muted"
                  >3–40 letters, numbers or underscores.</span
                ></label
              >
              <p v-if="errors.username" class="form-error" role="alert">
                {{ errors.username }}
              </p>
              <button
                class="button primary small"
                :disabled="
                  busy === 'username' || username.trim() === state.user.username
                "
              >
                {{ busy === "username" ? "Saving…" : "Save username" }}
              </button>
            </fieldset>
          </form>
        </section>
        <section class="settings-card" aria-labelledby="settings-email">
          <h2 id="settings-email">Email</h2>
          <p class="muted small">
            You can sign in with your email instead of your username.
          </p>
          <form @submit.prevent="saveEmail">
            <fieldset :disabled="demo">
              <label class="field"
                >Email address<input
                  v-model="email"
                  type="email"
                  autocomplete="email"
                  required
                  maxlength="254"
              /></label>
              <p v-if="errors.email" class="form-error" role="alert">
                {{ errors.email }}
              </p>
              <button
                class="button primary small"
                :disabled="
                  busy === 'email' ||
                  email.trim().toLowerCase() === (state.user.email || '')
                "
              >
                {{ busy === "email" ? "Saving…" : "Save email" }}
              </button>
            </fieldset>
          </form>
        </section>
        <section class="settings-card" aria-labelledby="settings-password">
          <h2 id="settings-password">Password</h2>
          <p class="muted small">
            Changing it signs you out anywhere else you’re signed in.
          </p>
          <form @submit.prevent="savePassword">
            <fieldset :disabled="demo">
              <input
                class="sr-only"
                :value="state.user.username"
                autocomplete="username"
                tabindex="-1"
                aria-hidden="true"
                readonly
              /><label class="field"
                >Current password<input
                  v-model="currentPassword"
                  type="password"
                  autocomplete="current-password"
                  required
                  maxlength="128" /></label
              ><label class="field"
                >New password<input
                  v-model="newPassword"
                  type="password"
                  autocomplete="new-password"
                  required
                  minlength="8"
                  maxlength="128"
                /><span class="small muted">At least 8 characters.</span></label
              ><label class="field"
                >Confirm new password<input
                  v-model="confirmPassword"
                  type="password"
                  autocomplete="new-password"
                  required
                  maxlength="128"
                /><span
                  v-if="confirmPassword && confirmPassword !== newPassword"
                  class="small settings-mismatch"
                  >Doesn’t match the new password yet.</span
                ></label
              >
              <p v-if="errors.password" class="form-error" role="alert">
                {{ errors.password }}
              </p>
              <button
                class="button primary small"
                :disabled="busy === 'password'"
              >
                {{ busy === "password" ? "Saving…" : "Change password" }}
              </button>
            </fieldset>
          </form>
        </section>
        <section class="settings-card" aria-labelledby="settings-membership">
          <h2 id="settings-membership">Membership</h2>
          <p v-if="state.user.premium" class="settings-status">
            <Sparkles :size="17" aria-hidden="true" /><span
              >Premium, {{ Math.round((1 - state.user.discountRate) * 100) }}%
              off tickets until {{ until(state.user.expiryDate) }}.</span
            >
          </p>
          <p v-else class="settings-status">
            <span
              >Regular.
              {{
                state.user.expiryDate
                  ? `Your premium membership ended on ${until(state.user.expiryDate)}.`
                  : `Premium takes ${state.premiumPlan.percentOff}% off tickets for ${state.premiumPlan.months} months.`
              }}</span
            >
          </p>
          <button
            v-if="!state.user.premium || membershipEnding(state.user)"
            type="button"
            class="button secondary small"
            @click="openPremium()"
          >
            {{
              state.user.premium || state.user.expiryDate
                ? "Renew premium"
                : "Go premium"
            }}
          </button>
        </section>
        <section
          class="settings-card settings-danger"
          aria-labelledby="settings-delete"
        >
          <h2 id="settings-delete">Delete account</h2>
          <p class="muted small">
            Removes your account and everything in it for good. This can’t be
            undone.
          </p>
          <button
            type="button"
            class="button danger small"
            :disabled="demo"
            @click="startDelete"
          >
            Delete account…
          </button>
        </section>
      </div>
    </template>
    <Modal
      v-if="deleting === 1 && state.user"
      title="Delete your account?"
      @close="deleting = 0"
      ><p class="muted modal-intro">
        Deleting {{ displayName(state.user.username) }} removes, for everyone:
      </p>
      <ul class="delete-list">
        <li>
          your reviews, with their likes and every conversation under them;
        </li>
        <li>your comments, and the replies under them;</li>
        <li>your lists and who bookmarked them, and your own bookmarks;</li>
        <li>
          your watchlist, watched films and who you follow and who follows you;
        </li>
        <li v-if="state.user.premium">your premium membership;</li>
        <li>your name, email and password.</li>
      </ul>
      <p class="muted modal-intro">
        Your tickets stay as sales records without your name or email{{
          upcoming
            ? `. ${upcoming === 1 ? "The ticket for an upcoming screening" : `The ${upcoming} tickets for upcoming screenings`} can’t be used or refunded afterwards`
            : ""
        }}.
      </p>
      <div class="modal-actions">
        <button class="button secondary" @click="deleting = 0">
          Keep my account</button
        ><button class="button danger" @click="deleting = 2">Continue</button>
      </div></Modal
    >
    <Modal
      v-if="deleting === 2 && state.user"
      title="This can’t be undone."
      @close="deleting = 0"
      ><p class="muted modal-intro">
        <TriangleAlert :size="16" aria-hidden="true" class="inline-icon" />
        Enter your password to delete
        {{ displayName(state.user.username) }} permanently.
      </p>
      <form @submit.prevent="deleteAccount">
        <input
          class="sr-only"
          :value="state.user.username"
          autocomplete="username"
          tabindex="-1"
          aria-hidden="true"
          readonly
        /><label class="field"
          >Password<input
            v-model="deletePassword"
            type="password"
            autocomplete="current-password"
            required
            maxlength="128"
        /></label>
        <p v-if="errors.delete" class="form-error" role="alert">
          {{ errors.delete }}
        </p>
        <div class="modal-actions">
          <button type="button" class="button secondary" @click="deleting = 0">
            Keep my account</button
          ><button
            class="button danger"
            :disabled="busy === 'delete' || !deletePassword"
          >
            {{ busy === "delete" ? "Deleting…" : "Delete permanently" }}
          </button>
        </div>
      </form></Modal
    >
  </div>
</template>
