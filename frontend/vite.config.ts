import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Django runs on :8000. Proxying these paths makes the API, uploaded media and
// the Django admin share the dev server's origin, so session + CSRF cookies work.
const backend = 'http://127.0.0.1:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': backend,
      '/admin': backend,
      '/media': backend,
      '/static': backend,
    },
  },
})
