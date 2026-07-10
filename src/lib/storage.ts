/**
 * Persistent storage: ask the browser not to evict our IndexedDB. Browsers
 * clear "best-effort" storage under pressure, and iOS Safari wipes
 * script-writable storage after ~7 idle days. Persisted storage is exempt.
 * This is the technical half of the "your recipes stay" promise; the backup
 * nudge in My Jar is the sure safety net when the browser says no.
 */

export type PersistState = 'unsupported' | 'persisted' | 'best-effort'

function canPersist(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.storage &&
    typeof navigator.storage.persist === 'function' &&
    typeof navigator.storage.persisted === 'function'
  )
}

/** Whether the browser has already granted persistent storage. */
export async function persistState(): Promise<PersistState> {
  if (!canPersist()) return 'unsupported'
  try {
    return (await navigator.storage.persisted()) ? 'persisted' : 'best-effort'
  } catch {
    return 'unsupported'
  }
}

/**
 * Ask the browser to keep our data, e.g. from a deliberate button press.
 * Chrome grants silently on engagement, Firefox prompts, Safari grants quietly.
 */
export async function requestPersist(): Promise<PersistState> {
  if (!canPersist()) return 'unsupported'
  try {
    const granted = await navigator.storage.persist()
    return granted ? 'persisted' : 'best-effort'
  } catch {
    return 'unsupported'
  }
}

const ASKED_KEY = 'recipe-jar:persistAsked'

/**
 * Ask for persistence at most once, ever, and only if not already granted.
 * Called from the first save (when there's real data to protect) rather than
 * on every cold boot, so prompt-showing browsers like Firefox don't nag on each
 * visit. Users can still enable it deliberately from My Jar later.
 */
export async function autoRequestPersistOnce(): Promise<void> {
  if (!canPersist()) return
  try {
    if (localStorage.getItem(ASKED_KEY)) return
    if (await navigator.storage.persisted()) return
    localStorage.setItem(ASKED_KEY, '1')
    await navigator.storage.persist()
  } catch {
    /* storage locked down (private mode, etc.): nothing we can do */
  }
}
