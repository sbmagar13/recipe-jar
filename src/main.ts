import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { initTelemetry } from './lib/telemetry'
import { initPwaUpdates } from './lib/pwa.svelte'

initTelemetry()
initPwaUpdates()

// Persistence (keeping IndexedDB from being evicted) is requested from the first
// save instead of here, so prompt-showing browsers don't nag on every cold boot.
// See autoRequestPersistOnce in ./lib/storage.

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
