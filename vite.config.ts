import { defineConfig, type Plugin, type ViteDevServer } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

const MAX_BYTES = 3_000_000

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
  plugins: [svelte(), devProxy()],
})
