<script lang="ts">
  interface Props {
    /** Only consider showing once the user has saved something (earned the nudge). */
    active: boolean
  }
  let { active }: Props = $props()

  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: string }>
  }

  const DISMISS_KEY = 'recipe-jar:installTipDismissed'

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true

  const ua = navigator.userAgent
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document)

  let deferred = $state<BeforeInstallPromptEvent | null>(null)
  // iOS never fires beforeinstallprompt, so offer instructions there instead.
  let mode = $state<'none' | 'android' | 'ios'>(isIOS && !isStandalone ? 'ios' : 'none')
  let dismissed = $state(localStorage.getItem(DISMISS_KEY) === '1')

  $effect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      deferred = e as BeforeInstallPromptEvent
      mode = 'android'
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  })

  const visible = $derived(active && !dismissed && !isStandalone && mode !== 'none')

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    deferred = null
    dismiss()
  }

  function dismiss() {
    dismissed = true
    localStorage.setItem(DISMISS_KEY, '1')
  }
</script>

{#if visible}
  <div class="install-tip" role="dialog" aria-label="Add Recipe Jar to your home screen">
    <span class="install-jar" aria-hidden="true">🫙</span>
    {#if mode === 'android'}
      <span class="install-text">Keep Recipe Jar one tap away, and safe from being cleared.</span>
      <button class="install-go" onclick={install}>Install</button>
    {:else}
      <span class="install-text">
        Add to your home screen so your jar stays put: tap
        <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
      </span>
    {/if}
    <button class="install-x" onclick={dismiss} aria-label="Not now">✕</button>
  </div>
{/if}
