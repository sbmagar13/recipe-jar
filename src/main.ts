import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

// Ask the browser to keep our IndexedDB data from being evicted. This is the
// core "your recipes stay" promise; installed PWAs are granted it automatically.
if (navigator.storage?.persist) {
  navigator.storage.persisted().then((already) => {
    if (!already) navigator.storage.persist().catch(() => {})
  })
}

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
