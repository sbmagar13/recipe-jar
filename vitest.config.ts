import { defineConfig } from 'vitest/config'

// Unit tests only. Kept separate from vite.config.ts so the PWA/Svelte plugins
// don't load, and scoped to test/ so Playwright's e2e/*.spec.ts are never picked
// up by the Node test runner.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
})
