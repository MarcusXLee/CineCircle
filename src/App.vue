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
import NotificationBell from "./components/NotificationBell.vue";
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
  <!-- Shared paint for the rating stars (dark golden foil, with brass as an alternative);
       kept out of view but not display:none, which would stop it from rendering. -->
  <svg
    class="paint-defs"
    width="0"
    height="0"
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      <!-- Polished brass: a diagonal with a bright band through the middle. -->
      <linearGradient id="cc-brass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff0c4" />
        <stop offset="0.22" stop-color="#d9ae63" />
        <stop offset="0.46" stop-color="#8f6730" />
        <stop offset="0.6" stop-color="#f3d998" />
        <stop offset="0.8" stop-color="#b58a45" />
        <stop offset="1" stop-color="#7c5826" />
      </linearGradient>
      <!-- Metal: fine horizontal brushing, then a raised highlight from a light at the upper
           left, clipped to the shape, and a hairline shadow beneath. -->
      <filter id="cc-metal" x="-20%" y="-20%" width="140%" height="150%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="1.6 0.12"
          numOctaves="2"
          seed="7"
          result="grain"
        />
        <feColorMatrix
          in="grain"
          type="matrix"
          values="0 0 0 0 1  0 0 0 0 0.92  0 0 0 0 0.75  0 0 0 0.18 0"
          result="streaks"
        />
        <feComposite
          in="streaks"
          in2="SourceAlpha"
          operator="in"
          result="brushed"
        />
        <feGaussianBlur in="SourceAlpha" stdDeviation="0.7" result="bump" />
        <feSpecularLighting
          in="bump"
          surfaceScale="2"
          specularConstant="1"
          specularExponent="34"
          lighting-color="#fff4d6"
          result="shine"
        >
          <feDistantLight azimuth="225" elevation="40" />
        </feSpecularLighting>
        <feComposite
          in="shine"
          in2="SourceAlpha"
          operator="in"
          result="shineIn"
        />
        <feComposite
          in="SourceGraphic"
          in2="shineIn"
          operator="arithmetic"
          k1="0"
          k2="1"
          k3="0.42"
          k4="0"
          result="lit"
        />
        <feComposite in="brushed" in2="lit" operator="over" result="metal" />
        <feDropShadow
          dx="0"
          dy="0.8"
          stdDeviation="0.4"
          flood-color="#000"
          flood-opacity="0.55"
        />
        <feMerge>
          <feMergeNode />
          <feMergeNode in="metal" />
        </feMerge>
      </filter>
      <!-- Dark golden foil: deep gold with bright foil bands and a fine flat grain. -->
      <linearGradient id="cc-foil" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#a27a33" />
        <stop offset="0.3" stop-color="#d8b062" />
        <stop offset="0.5" stop-color="#6b4e18" />
        <stop offset="0.7" stop-color="#bf9442" />
        <stop offset="1" stop-color="#5a4112" />
      </linearGradient>
      <filter id="cc-foil-grain" x="-20%" y="-20%" width="140%" height="150%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="2.2"
          numOctaves="1"
          seed="11"
          result="grain"
        />
        <feColorMatrix
          in="grain"
          type="matrix"
          values="0 0 0 0 0.98  0 0 0 0 0.84  0 0 0 0 0.52  0 0 0 0.16 0"
          result="flecks"
        />
        <feComposite
          in="flecks"
          in2="SourceAlpha"
          operator="in"
          result="foilGrain"
        />
        <feComposite
          in="foilGrain"
          in2="SourceGraphic"
          operator="over"
          result="foil"
        />
        <feDropShadow
          dx="0"
          dy="0.6"
          stdDeviation="0.3"
          flood-color="#000"
          flood-opacity="0.45"
        />
        <feMerge>
          <feMergeNode />
          <feMergeNode in="foil" />
        </feMerge>
      </filter>
    </defs>
  </svg>
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
          ><NotificationBell /><RouterLink
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
        ><button v-else class="button small concierge" @click="openAuth()">
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
