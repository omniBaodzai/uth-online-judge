import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind mounts from Windows into Docker do not emit file events, leaving Vite serving stale modules.
    watch: { usePolling: true, interval: 300 },
  },
  css: {
    postcss: {
      // Prevent Vite from treating the empty repository-level package.json as a PostCSS config.
      plugins: [],
    },
  },
})
