import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import Home from "./pages/Home.vue";
import Films from "./pages/Films.vue";
import Movie from "./pages/Movie.vue";
import Cinemas from "./pages/Cinemas.vue";
import Booking from "./pages/Booking.vue";
import Library from "./pages/Library.vue";
import List from "./pages/List.vue";
import Community from "./pages/Community.vue";
import Profile from "./pages/Profile.vue";
import Tickets from "./pages/Tickets.vue";
import NotFound from "./pages/NotFound.vue";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/dm-sans";
import "@fontsource/baskervville/latin-400.css";
import "@fontsource/cinzel/latin-500.css";
import "@fontsource/cinzel/latin-600.css";
import "./style.css";
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Home },
    { path: "/films", component: Films },
    { path: "/films/:id", component: Movie },
    { path: "/cinemas", component: Cinemas },
    { path: "/screenings/:id", component: Booking },
    { path: "/circle", component: Library },
    { path: "/lists/:userId/:listId", component: List },
    { path: "/community", component: Community },
    { path: "/members/:id", component: Profile },
    { path: "/tickets", component: Tickets },
    { path: "/:pathMatch(.*)*", component: NotFound },
  ],
  scrollBehavior(to, from, saved) {
    if (saved) return saved;
    if (to.path === from.path) return;
    return { top: 0 };
  },
});
router.afterEach((to) => {
  document.title =
    to.path === "/" ? "CineCircle — A home for movie people" : "CineCircle";
});
createApp(App).use(router).mount("#app");
