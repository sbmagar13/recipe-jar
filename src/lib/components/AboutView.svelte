<script lang="ts">
  import { CONTACT_EMAIL, REPO_URL, LEGAL_UPDATED, APP_VERSION } from '../site'

  interface Props {
    onback: () => void
  }
  let { onback }: Props = $props()
</script>

<section class="legal">
  <button class="back linklike" onclick={onback}>← Back</button>
  <h1>About &amp; Privacy</h1>
  <p class="lede">
    Recipe Jar is a free tool that turns a recipe link into a clean card and keeps it on your
    device. It's free and open source, made for everyone who cooks. No account, no ads, ever.
  </p>

  <h2>Your privacy</h2>
  <ul>
    <li>
      <strong>Your recipes stay on your device.</strong> Everything you save lives in your
      browser's own storage (IndexedDB). It is never uploaded to us, and there is no account and
      no server-side copy. Clear your browser and it's gone — so keep a backup from
      <strong>My Jar</strong> now and then.
    </li>
    <li>
      <strong>Fetching a link.</strong> When you paste a URL, our proxy fetches
      <em>that page</em> on your behalf (so it works around sites that block browsers) and hands
      the HTML straight back to you. It doesn't store the page, and it only reads recipe markup.
    </li>
    <li>
      <strong>What we measure.</strong> To keep the app working we log two things, and only these:
      the <em>hostname</em> of a page we couldn't read (e.g. <code>example.com</code>, so the
      parser can be fixed) and uncaught error messages from our own code. Never the recipe, the
      full address, or anything that identifies you. This is switched off entirely if your browser
      sends “Do Not Track” or Global Privacy Control.
    </li>
    <li>
      <strong>Hosting.</strong> The site runs on Cloudflare Pages, which processes requests to
      serve the app; see Cloudflare's privacy terms for their handling.
    </li>
  </ul>

  <h2>Recipes &amp; copyright</h2>
  <p>
    Recipe Jar is a reader tool, like a browser's reading mode. When you ask for a link, the
    recipe is fetched from its original site <em>at your request</em> and shown to you; every card
    links back to the source and keeps the author's name. Recipe Jar does not host, index, or
    republish anyone's recipes — the copy that's saved is <em>your</em> copy, on your own device,
    for personal use.
  </p>
  <p>
    If you own a recipe site and would like it excluded, email
    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and it will be added to a fetch
    blocklist. Recipe names, ingredients, and the recipes you type in yourself belong to their
    respective authors — please cook, share, and credit kindly.
  </p>

  <h2>Open source</h2>
  <p>
    Recipe Jar is open source under the MIT licence. Read the code, file an issue, or fork it at
    <a href={REPO_URL} target="_blank" rel="noopener">{REPO_URL.replace('https://', '')}</a>.
  </p>

  <h2>Who made this</h2>
  <p>
    One person: Sagar Budhathoki, a DevOps engineer in Kathmandu, Nepal, who got tired of
    scrolling past life stories to reach the ingredients. No company, no investors, no growth
    team. That's also why nothing here needs to make money. Say hi:
    <a href="https://github.com/sbmagar13" target="_blank" rel="noopener">github.com/sbmagar13</a>
    or <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
  </p>

  <p class="updated">
    Recipe Jar v{APP_VERSION} · Last updated: {LEGAL_UPDATED} · Questions?
    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
  </p>
</section>
