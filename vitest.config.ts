import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

// Mirror vite.config.ts's version injection so modules that read __APP_VERSION__
// (e.g. src/lib/site.ts) can be imported from unit tests without crashing.
const APP_VERSION = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }).version

// Unit tests only. Kept separate from vite.config.ts so the PWA/Svelte plugins
// don't load, and scoped to test/ so Playwright's e2e/*.spec.ts are never picked
// up by the Node test runner.
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
})
