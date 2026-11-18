<script setup>
import { ref, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Search, Menu, X, Ticket, Check, TriangleAlert } from "@lucide/vue";
import {
  state,
  refreshSession,
  displayName,
  resolveConfirmation,
  openAuth,
} from "./api";
import AuthModal from "./components/AuthModal.vue";
import Modal from "./components/Modal.vue";
import BrandMark from "./components/BrandMark.vue";
const search = ref(""),
  mobileNav = ref(false),
  menuToggle = ref(null),
  route = useRoute(),
  router = useRouter();
onMounted(() => refreshSession().catch(() => {}));
watch(
  () => route.fullPath,
  () => (mobileNav.value = false),
);
function find() {
  router.push({
    path: "/films",
    query: search.value.trim() ? { q: search.value.trim() } : {},
  });
  search.value = "";
}
function closeMenu() {
  if (!mobileNav.value) return;
  mobileNav.value = false;
  menuToggle.value?.focus();
}
</script>
<template>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header" @keydown.esc="closeMenu">
    <div class="header-inner">
      <RouterLink to="/" class="brand" aria-label="CineCircle home"
        ><BrandMark
      /></RouterLink>
      <nav
        id="main-navigation"
        class="main-nav"
        :class="{ open: mobileNav }"
        aria-label="Main navigation"
      >
        <RouterLink to="/" exact-active-class="active">Discover</RouterLink
        ><RouterLink to="/films" active-class="active">Films</RouterLink
        ><RouterLink to="/cinemas" active-class="active">Cinemas</RouterLink
        ><RouterLink to="/community" active-class="active"
          >Community</RouterLink
        >
      </nav>
      <div class="header-actions">
        <form class="header-search" role="search" @submit.prevent="find">
          <Search :size="16" aria-hidden="true" /><input
            v-model="search"
            name="q"
            type="search"
            aria-label="Search all films"
            placeholder="Find a film…"
          />
        </form>
        <template v-if="state.user"
          ><RouterLink
            to="/tickets"
            class="icon-button ticket-nav"
            aria-label="My tickets"
            ><Ticket :size="20" /></RouterLink
          ><RouterLink to="/circle" class="account-link" aria-label="My circle"
            ><span class="avatar small-avatar">{{
              state.user.username.slice(0, 1).toUpperCase()
            }}</span
            ><span>{{ displayName(state.user.username) }}</span></RouterLink
          ></template
        ><button v-else class="button small primary" @click="openAuth()">
          Sign in</button
        ><button
          ref="menuToggle"
          class="icon-button mobile-menu"
          aria-controls="main-navigation"
          :aria-expanded="mobileNav"
          aria-label="Toggle navigation"
          @click="mobileNav = !mobileNav"
        >
          <X v-if="mobileNav" :size="22" /><Menu v-else :size="22" />
        </button>
      </div>
    </div>
  </header>
  <main id="main"><RouterView /></main>
  <footer class="site-footer">
    <div class="footer-inner">
      <RouterLink class="brand footer-brand" to="/" aria-label="CineCircle home"
        ><BrandMark
      /></RouterLink>
      <div>
        <RouterLink to="/films">Find a film</RouterLink
        ><RouterLink to="/circle">My circle</RouterLink>
      </div>
    </div>
  </footer>
  <AuthModal v-if="state.authOpen" /><Modal
    v-if="state.confirmation"
    :title="state.confirmation.title"
    @close="resolveConfirmation(false)"
    ><p class="muted modal-intro">{{ state.confirmation.message }}</p>
    <div class="modal-actions">
      <button class="button secondary" @click="resolveConfirmation(false)">
        Keep it</button
      ><button class="button danger" @click="resolveConfirmation(true)">
        Delete
      </button>
    </div></Modal
  ><Transition name="toast"
    ><div
      v-if="state.toast"
      class="toast-message"
      :class="state.toast.type"
      :role="state.toast.type === 'error' ? 'alert' : 'status'"
    >
      <TriangleAlert v-if="state.toast.type === 'error'" :size="19" /><Check
        v-else
        :size="19"
      /><span>{{ state.toast.message }}</span
      ><button
        class="icon-button"
        aria-label="Dismiss notification"
        @click="state.toast = null"
      >
        <X :size="17" />
      </button></div
  ></Transition>
</template>
