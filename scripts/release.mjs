#!/usr/bin/env node
// Cut a release in one gated step.
//
//   node scripts/release.mjs <version | major | minor | patch> [--dry-run] [--skip-gates]
//
// It will, in order:
//   1. Refuse to run unless you are on `main` with a clean working tree.
//   2. Run the quality gates: typecheck, unit tests, production build, size budget.
//   3. Bump package.json to the new version.
//   4. Stamp CHANGELOG.md: turn "## [Unreleased]" into the new version + date,
//      leave a fresh empty Unreleased, and fix up the link references.
//   5. Commit "Release vX.Y.Z", create an annotated tag, push both.
//   6. Publish a GitHub release whose notes are that version's changelog section.
//
// --dry-run does everything up to step 4 and prints the result, changing nothing
// that leaves your machine. Always dry-run first if you are unsure.

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = 'sbmagar13/recipe-jar'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const skipGates = args.includes('--skip-gates')
const spec = args.find((a) => !a.startsWith('--'))

const c = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', dim: '\x1b[2m', reset: '\x1b[0m', bold: '\x1b[1m' }
const say = (m) => console.log(m)
const step = (m) => console.log(`\n${c.bold}▶ ${m}${c.reset}`)
const ok = (m) => console.log(`${c.green}✓${c.reset} ${m}`)
function die(m) {
  console.error(`${c.red}✗ ${m}${c.reset}`)
  process.exit(1)
}

const sh = (cmd, opts = {}) => execSync(cmd, { cwd: ROOT, encoding: 'utf-8', ...opts }).trim()
const shInherit = (cmd) => execSync(cmd, { cwd: ROOT, stdio: 'inherit' })

if (!spec) {
  die('Usage: node scripts/release.mjs <version | major | minor | patch> [--dry-run] [--skip-gates]')
}

// --- version math ---------------------------------------------------------
const pkgPath = join(ROOT, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
const cur = pkg.version
const curParts = cur.split('.').map(Number)
if (curParts.length !== 3 || curParts.some(Number.isNaN)) die(`Current package.json version "${cur}" is not semver.`)

let next
if (spec === 'major') next = `${curParts[0] + 1}.0.0`
else if (spec === 'minor') next = `${curParts[0]}.${curParts[1] + 1}.0`
else if (spec === 'patch') next = `${curParts[0]}.${curParts[1]}.${curParts[2] + 1}`
else if (/^\d+\.\d+\.\d+$/.test(spec)) next = spec
else die(`"${spec}" is not a version or one of: major, minor, patch.`)

const cmp = (a, b) => {
  const A = a.split('.').map(Number)
  const B = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (A[i] !== B[i]) return A[i] - B[i]
  return 0
}
if (cmp(next, cur) <= 0) die(`New version ${next} must be greater than current ${cur}.`)

const tag = `v${next}`
const date = new Date().toISOString().slice(0, 10)

say(`${c.bold}Release ${cur} → ${next}${c.reset}  ${c.dim}(${date})${dryRun ? c.yellow + '  [dry run]' + c.reset : ''}`)

// --- preflight ------------------------------------------------------------
step('Preflight')
const branch = sh('git rev-parse --abbrev-ref HEAD')
if (branch !== 'main') die(`On branch "${branch}". Releases are cut from main.`)
ok('on main')
const dirty = sh('git status --porcelain')
if (dirty) die(`Working tree is not clean. Commit or stash first:\n${dirty}`)
ok('clean working tree')
if (!dryRun) {
  try {
    sh('gh auth status', { stdio: 'pipe' })
    ok('gh authenticated')
  } catch {
    die('gh CLI is not authenticated (needed to publish the GitHub release). Run: gh auth login')
  }
}

// --- quality gates --------------------------------------------------------
if (skipGates) {
  say(`${c.yellow}! skipping quality gates (--skip-gates)${c.reset}`)
} else {
  for (const [label, cmd] of [
    ['typecheck', 'npm run check'],
    ['unit tests', 'npm run test:unit'],
    ['production build', 'npm run build'],
    ['size budget', 'npm run size'],
  ]) {
    step(`Gate: ${label}`)
    try {
      shInherit(cmd)
    } catch {
      die(`Gate failed: ${label}. Nothing was changed.`)
    }
    ok(label)
  }
}

// --- edit package.json ----------------------------------------------------
step('Bump version')
pkg.version = next
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
ok(`package.json ${cur} → ${next}`)

// --- stamp CHANGELOG ------------------------------------------------------
step('Stamp CHANGELOG')
const clPath = join(ROOT, 'CHANGELOG.md')
let cl = readFileSync(clPath, 'utf-8')

const unreleasedHead = /^## \[Unreleased\]\s*$/m
if (!unreleasedHead.test(cl)) die('CHANGELOG.md has no "## [Unreleased]" heading to stamp.')

// Grab what is under Unreleased so we can sanity-check it is non-empty and reuse
// it as the release notes.
const secMatch = cl.match(/^## \[Unreleased\]\s*\n([\s\S]*?)(?=^## \[|\Z)/m)
const unreleasedBody = (secMatch ? secMatch[1] : '').trim()
if (!unreleasedBody) die('The [Unreleased] section is empty. Add changelog entries before releasing.')

// Unreleased -> fresh empty Unreleased + the new version heading.
cl = cl.replace(unreleasedHead, `## [Unreleased]\n\n## [${next}] - ${date}`)

// Link references at the foot of the file.
const compareLine = new RegExp(`^\\[Unreleased\\]:.*$`, 'm')
if (compareLine.test(cl)) {
  cl = cl.replace(compareLine, `[Unreleased]: https://github.com/${REPO}/compare/${tag}...HEAD`)
  // Insert the new version's tag link right below the Unreleased line.
  cl = cl.replace(
    /^\[Unreleased\]:.*$/m,
    (m) => `${m}\n[${next}]: https://github.com/${REPO}/releases/tag/${tag}`,
  )
} else {
  say(`${c.yellow}! no [Unreleased] link reference found; skipping link bookkeeping${c.reset}`)
}
writeFileSync(clPath, cl)
ok(`changelog now lists [${next}] - ${date}`)

// The notes we will publish: the Unreleased body we just promoted.
const notes = unreleasedBody

// --- dry run stops here ---------------------------------------------------
if (dryRun) {
  step('Dry run: release notes preview')
  say(`${c.dim}--- GitHub release notes for ${tag} ---${c.reset}`)
  say(notes)
  say(`${c.dim}--- end notes ---${c.reset}`)
  step('Dry run: pending file changes')
  shInherit('git --no-pager diff --stat')
  say(`\n${c.yellow}Dry run complete. No commit, tag, push, or release was made.${c.reset}`)
  say(`${c.dim}Reverting the working-tree edits so a real run starts clean...${c.reset}`)
  shInherit('git checkout -- package.json CHANGELOG.md')
  process.exit(0)
}

// --- commit, tag, push, release ------------------------------------------
step('Commit + tag')
shInherit('git add -A')
shInherit(`git commit -m "Release ${tag}"`)
shInherit(`git tag -a ${tag} -m "${tag}"`)
ok(`committed and tagged ${tag}`)

step('Push')
shInherit('git push origin main')
shInherit(`git push origin ${tag}`)
ok('pushed main + tag')

step('GitHub release')
const notesPath = join(ROOT, '.release-notes.tmp.md')
writeFileSync(notesPath, notes + '\n')
try {
  shInherit(`gh release create ${tag} --repo ${REPO} --title "${tag}" --notes-file ${notesPath}`)
  ok('GitHub release published')
} finally {
  try {
    execSync(`rm -f ${notesPath}`, { cwd: ROOT })
  } catch {
    /* leave the temp file if cleanup fails */
  }
}

say(`\n${c.green}${c.bold}Released ${tag}.${c.reset}`)
say(`${c.dim}Cloudflare Pages will build and deploy from main. Returning cooks see the`)
say(`"What's new" note after the update prompt refreshes them onto ${next}.${c.reset}`)
