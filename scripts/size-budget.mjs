#!/usr/bin/env node
// Fails the build if the shipped bundle grows past budget. Runs on the real
// production output (dist/), measuring gzipped bytes — what users actually
// download. Keep Recipe Jar light: it should open instantly on a phone.
//
// Usage: npm run build && npm run size

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const ASSETS = 'dist/assets'

// Budgets in KB of gzipped output. Set with ~15% headroom over current size so
// they catch real regressions without nagging on small, deliberate additions.
// Raised once for the Phase 1 cook features (timers + focus cook mode). Still
// lean for a full offline capture/cook/share app; catches real regressions.
const BUDGETS = [
  { label: 'entry JS  (gz)', match: (f) => /^index-.*\.js$/.test(f), maxKB: 78 },
  { label: 'entry CSS (gz)', match: (f) => /^index-.*\.css$/.test(f), maxKB: 12 },
  { label: 'all assets (gz)', match: (f) => /\.(js|css)$/.test(f), maxKB: 92 },
]

if (!existsSync(ASSETS)) {
  console.error(`✗ ${ASSETS} not found — run \`npm run build\` first.`)
  process.exit(1)
}

const files = readdirSync(ASSETS)
const gzKB = (f) => gzipSync(readFileSync(join(ASSETS, f))).length / 1024

let failed = false
const rows = []
for (const { label, match, maxKB } of BUDGETS) {
  const matched = files.filter(match)
  const kb = matched.reduce((sum, f) => sum + gzKB(f), 0)
  const ok = kb <= maxKB
  if (!ok) failed = true
  const pct = Math.round((kb / maxKB) * 100)
  rows.push({ label, size: `${kb.toFixed(1)} KB`, budget: `${maxKB} KB`, used: `${pct}%`, status: ok ? '✓' : '✗ OVER' })
}

const pad = (s, n) => String(s).padEnd(n)
console.log('')
console.log(`  ${pad('bundle', 16)}${pad('size', 12)}${pad('budget', 10)}${pad('used', 8)}status`)
console.log(`  ${'-'.repeat(52)}`)
for (const r of rows) {
  console.log(`  ${pad(r.label, 16)}${pad(r.size, 12)}${pad(r.budget, 10)}${pad(r.used, 8)}${r.status}`)
}
console.log('')

if (failed) {
  console.error('✗ Bundle over budget. Trim it, or bump the budget in scripts/size-budget.mjs on purpose.')
  process.exit(1)
}
console.log('✓ Bundle within budget.')
