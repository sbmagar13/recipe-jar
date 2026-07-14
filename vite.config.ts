import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin, type ViteDevServer } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

const MAX_BYTES = 3_000_000

// Single source of truth for the app version: package.json. Injected at build
// time as __APP_VERSION__ so the About page and the in-app "What's new" note
// always match the release that was shipped.
const APP_VERSION = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }).version

// Dev-only mirror of functions/api/proxy.ts so `npm run dev` works without wrangler.
function devProxy(): Plugin {
  return {
    name: 'recipe-jar-dev-proxy',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/proxy', async (req, res) => {
        const url = new URL(req.url ?? '', 'http://localhost').searchParams.get('url')
        const fail = (status: number, error: string) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error }))
        }
        if (!url) return fail(400, 'Missing url parameter')
        let parsed: URL
        try {
          parsed = new URL(url)
        } catch {
          return fail(400, 'Invalid URL')
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return fail(400, 'Only http(s) URLs are supported')
        if (parsed.port && parsed.port !== '80' && parsed.port !== '443') return fail(400, 'URL not allowed')
        const host = parsed.hostname
        if (host === 'localhost' || !host.includes('.') || host.includes(':') || host.endsWith('.local') || host.endsWith('.internal')) {
          return fail(400, 'URL not allowed')
        }
        try {
          const upstream = await fetch(parsed.toString(), {
            redirect: 'follow',
            signal: AbortSignal.timeout(12_000),
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml',
              'Accept-Language': 'en,sv;q=0.8,ne;q=0.6',
            },
          })
          if (!upstream.ok) return fail(502, `Site responded with ${upstream.status}`)
          const ct = upstream.headers.get('content-type') ?? ''
          if (ct && !/text\/html|application\/xhtml|\/xml|text\/plain/i.test(ct)) return fail(415, 'That link is not a web page we can read')
          const buf = Buffer.from(await upstream.arrayBuffer())
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end(buf.subarray(0, MAX_BYTES).toString('utf-8'))
        } catch {
          fail(502, 'Could not reach the site')
        }
      })
    },
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [
    svelte(),
    devProxy(),
    VitePWA({
      // 'prompt' (not autoUpdate): a new deploy shows a "Refresh" banner instead
      // of silently reloading the page, which would be jarring mid-recipe.
      registerType: 'prompt',
      // Only the app shell is precached. Recipe pages are never cached (they
      // live on other origins and go through the proxy on demand).
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The OCR engine (tesseract worker + wasm + language model) is opt-in
        // and ~6 MB. Keep it out of the precache so installing the app stays
        // light, then cache it at runtime the first time someone uses photo
        // import, so it keeps working offline after that.
        globIgnores: ['ocr/**'],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /\/ocr\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ocr-engine',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Recipe Jar',
        short_name: 'Recipe Jar',
        description: 'Paste a recipe link, get a clean card, keep it on your device. Free forever.',
        theme_color: '#33663d',
        background_color: '#f6f3ec',
        display: 'standalone',
        start_url: '/',
        // Android: lets people share a recipe URL from any app straight into
        // Recipe Jar (appears in the system share sheet once installed).
        share_target: {
          action: '/',
          method: 'GET',
          params: { url: 'url', text: 'text', title: 'title' },
        },
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
