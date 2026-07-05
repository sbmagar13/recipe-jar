// Run the parser across fixture HTML files and print a compact report.
// Usage: npx tsx scripts/test-parse.ts
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseRecipeFromHtml } from '../src/lib/parse'
import { formatQty } from '../src/lib/quantity'

const dir = join(import.meta.dirname, '..', 'fixtures')
let pass = 0
let fail = 0

for (const file of readdirSync(dir).filter((f) => f.endsWith('.html')).sort()) {
  const html = readFileSync(join(dir, file), 'utf-8')
  const recipe = parseRecipeFromHtml(html, `fixture://${file}`)
  if (!recipe) {
    console.log(`✗ ${file}: no recipe found`)
    fail++
    continue
  }
  const withQty = recipe.ingredients.filter((i) => i.qty !== null).length
  console.log(`✓ ${file}`)
  console.log(`   title:       ${recipe.title}`)
  console.log(`   servings:    ${recipe.servings ?? '?'} (yield: ${recipe.yieldText ?? '-'})  time: ${recipe.totalTime ?? '-'}`)
  console.log(`   ingredients: ${recipe.ingredients.length} (${withQty} with parsed qty)`)
  console.log(`   steps:       ${recipe.steps.length}`)
  console.log(`   image:       ${recipe.image ? 'yes' : 'MISSING'}`)
  const sample = recipe.ingredients[0]
  if (sample) {
    const scaled = sample.qty !== null ? `${formatQty(sample.qty * 1.5)} ${sample.rest}` : '(unscalable)'
    console.log(`   sample:      "${sample.raw}"  x1.5 -> "${scaled}"`)
  }
  pass++
}

console.log(`\n${pass} parsed, ${fail} skipped (expected for bot-walled fixtures)`)
