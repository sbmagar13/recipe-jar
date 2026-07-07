import { registerSW } from 'virtual:pwa-register'

// Shared reactive flag: flips true when a newer deployed version is ready to
// activate. A `.svelte.ts` module can hold runes state and share it across
// components.
export const updateState = $state({ available: false })

let applyFn: ((reloadPage?: boolean) => Promise<void>) | null = null

// One check per hour keeps a long-open tab (someone cooking with the recipe up
// all afternoon) from missing a deploy, without hammering the network.
const UPDATE_CHECK_MS = 60 * 60 * 1000

/** Register the service worker in prompt mode so updates never reload mid-cook. */
export function initPwaUpdates(): void {
  applyFn = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateState.available = true
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      setInterval(() => {
        registration.update().catch(() => {})
      }, UPDATE_CHECK_MS)
    },
  })
}

/** Activate the waiting service worker and reload into the new version. */
export function applyUpdate(): void {
  updateState.available = false
  applyFn?.(true)
}

export function dismissUpdate(): void {
  updateState.available = false
}
