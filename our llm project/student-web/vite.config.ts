import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split stable vendor code into its own chunk(s) so an app-code-only
        // deploy doesn't bust the browser's cache for React/Supabase, which
        // rarely change between releases. Function form (not the object
        // shorthand) — this project's rolldown-vite build only accepts it.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (/[\\/](react|react-dom|react-router-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
            if (id.includes('@supabase')) return 'vendor-supabase';
          }
        },
      },
    },
  },
})
