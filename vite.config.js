import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
export default defineConfig(({ mode }) => {
  // Same settings as the backend: the shell environment first, then .env. The proxy follows
  // PORT, the backend's port, unless API_PORT points it elsewhere (as the browser tests do).
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  return {
    plugins: [vue()],
    server: {
      port: Number(env.VITE_PORT || 5173),
      strictPort: true,
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${env.API_PORT || env.PORT || 3001}`,
          changeOrigin: false,
        },
      },
    },
    build: { chunkSizeWarningLimit: 700 },
  };
});
