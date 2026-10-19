import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      // Prevent Vite from treating the empty repository-level package.json as a PostCSS config.
      plugins: [],
    },
  },
})
