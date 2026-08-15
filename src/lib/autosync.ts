// Own-cloud auto-backup: the cook picks a file once (typically inside a folder
// their own cloud already syncs: iCloud Drive, Dropbox, Syncthing, a NAS
// share), and Recipe Jar rewrites that file after every change to the jar.
// Their cloud moves the bytes between devices; nothing here talks to a server,
// which keeps the free-forever promise intact.
//
// Built on the File System Access API, so this is Chromium-only for now; the
// UI simply does not appear elsewhere and the manual backup buttons remain for
// everyone. This module is imported on demand (setup click, or boot when
// already enabled) so the entry bundle does not pay for it.

import { db, exportJar, jarCount } from './db'

export type AutosyncState = 'off' | 'on' | 'reconnect'

export interface AutosyncStatus {
  state: AutosyncState
  /** Backup file name, when a file is connected. */
  name?: string
  /** Epoch millis of the last successful write. */
  lastWrite?: number
}

const ENABLED_KEY = 'recipe-jar:autosync'
const LAST_WRITE_KEY = 'recipe-jar:autosyncLast'
// Reuse the manual-backup bookkeeping so the "back up your jar" nudge knows
// an automatic backup counts.
const LAST_BACKUP_KEY = 'recipe-jar:lastBackup'
const LAST_BACKUP_COUNT_KEY = 'recipe-jar:lastBackupCount'
const HANDLE_KEY = 'autosync-file'
const DEBOUNCE_MS = 1_500

type WritableHandle = FileSystemFileHandle & {
  queryPermission?: (opts: { mode: string }) => Promise<PermissionState>
  requestPermission?: (opts: { mode: string }) => Promise<PermissionState>
}

let handle: WritableHandle | null = null
let state: AutosyncState = 'off'
let timer: ReturnType<typeof setTimeout> | undefined
let hooked = false
let writing = false
let queued = false
const listeners = new Set<(s: AutosyncStatus) => void>()

export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window
}

export function getStatus(): AutosyncStatus {
  if (state === 'off') return { state }
  const last = Number(localStorage.getItem(LAST_WRITE_KEY) ?? 0)
  return { state, name: handle?.name, lastWrite: last || undefined }
}

/** Watch for status changes (JarView renders from this). */
export function onStatus(fn: (s: AutosyncStatus) => void): () => void {
  listeners.add(fn)
  fn(getStatus())
  return () => listeners.delete(fn)
}

function emit() {
  for (const fn of listeners) fn(getStatus())
}

function setState(s: AutosyncState) {
  state = s
  emit()
}

/** Ask for a backup file and start keeping it current. Needs a user gesture. */
export async function setupAutoBackup(): Promise<AutosyncStatus> {
  const picker = (
    window as unknown as {
      showSaveFilePicker: (opts: unknown) => Promise<WritableHandle>
    }
  ).showSaveFilePicker
  handle = await picker({
    suggestedName: 'recipe-jar-backup.json',
    types: [{ description: 'Recipe Jar backup', accept: { 'application/json': ['.json'] } }],
  })
  try {
    await db.meta.put({ key: HANDLE_KEY, value: handle })
  } catch {
    // Could not persist the handle (exotic browser): auto-backup still runs
    // for this session and asks to reconnect after the next reload.
  }
  localStorage.setItem(ENABLED_KEY, '1')
  attachHooks()
  setState('on')
  await writeNow()
  return getStatus()
}

/** Stop auto-backup and forget the file. The file itself is left alone. */
export async function disableAutoBackup(): Promise<void> {
  clearTimeout(timer)
  handle = null
  await db.meta.delete(HANDLE_KEY)
  localStorage.removeItem(ENABLED_KEY)
  localStorage.removeItem(LAST_WRITE_KEY)
  setState('off')
}

/** Re-grant access after a browser restart. Needs a user gesture. */
export async function reconnect(): Promise<AutosyncStatus> {
  if (!handle?.requestPermission) return getStatus()
  const perm = await handle.requestPermission({ mode: 'readwrite' })
  if (perm === 'granted') {
    setState('on')
    await writeNow()
  }
  return getStatus()
}

/**
 * Boot path: when auto-backup was enabled in an earlier session, load the
 * stored handle and resume. Browsers usually re-ask for permission after a
 * restart, which surfaces as the "reconnect" state until the cook taps once.
 */
export async function startAutosync(): Promise<AutosyncStatus> {
  if (localStorage.getItem(ENABLED_KEY) !== '1') return getStatus()
  try {
    const row = await db.meta.get(HANDLE_KEY)
    const stored = row?.value as WritableHandle | undefined
    if (!stored || typeof stored.createWritable !== 'function') throw new Error('no handle')
    handle = stored
    attachHooks()
    const perm = (await stored.queryPermission?.({ mode: 'readwrite' })) ?? 'prompt'
    setState(perm === 'granted' ? 'on' : 'reconnect')
  } catch {
    // The stored handle is gone or unusable: ask for one tap to set up again.
    handle = null
    attachHooks()
    setState('reconnect')
  }
  return getStatus()
}

/** Debounced "something changed, rewrite the backup soon". */
export function scheduleWrite(): void {
  if (state !== 'on') return
  clearTimeout(timer)
  timer = setTimeout(() => void writeNow(), DEBOUNCE_MS)
}

async function writeNow(): Promise<void> {
  if (!handle || state !== 'on') return
  if (writing) {
    queued = true
    return
  }
  writing = true
  try {
    const [json, count] = await Promise.all([exportJar(), jarCount()])
    const writable = await handle.createWritable()
    await writable.write(json)
    await writable.close()
    const now = Date.now()
    localStorage.setItem(LAST_WRITE_KEY, String(now))
    localStorage.setItem(LAST_BACKUP_KEY, String(now))
    localStorage.setItem(LAST_BACKUP_COUNT_KEY, String(count))
    emit()
  } catch {
    // Lost permission mid-flight (or the file moved): ask for a tap.
    setState('reconnect')
  } finally {
    writing = false
    if (queued) {
      queued = false
      scheduleWrite()
    }
  }
}

/** Rewrite the backup after any change to the jar, from any screen. */
function attachHooks(): void {
  if (hooked) return
  hooked = true
  db.recipes.hook('creating', () => {
    scheduleWrite()
  })
  db.recipes.hook('updating', () => {
    scheduleWrite()
  })
  db.recipes.hook('deleting', () => {
    scheduleWrite()
  })
}
