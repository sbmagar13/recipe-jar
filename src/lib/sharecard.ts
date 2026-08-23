// Share a recipe as a picture: the whole card drawn onto a canvas in the
// brand's light look, so it lands beautifully in WhatsApp, Instagram, or a
// print queue where a 2,000-character link would be awkward. Typography only,
// no remote photo: a cross-origin image would taint the canvas, and the card's
// beauty is the type anyway. Loaded on demand; the entry bundle never pays.

import type { Recipe } from './types'

const W = 1080
const PAD = 84
const PAPER = '#f6f3ec'
const INK = '#2a2a25'
const GREEN = '#275231'
const TOMATO = '#b8402e'
const MUTED = '#726c5c'
const RULE = '#ddd7c7'

const DISPLAY = 'Georgia, serif'
const BODY = "system-ui, -apple-system, 'Segoe UI', sans-serif"

/** Greedy word wrap against a pixel measurer. Overlong single words are kept
 *  whole on their own line (canvas clips gracefully). Pure, for tests. */
export function wrapLines(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (line && measure(candidate) > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

interface Ctx2D extends CanvasRenderingContext2D {}

function measurer(ctx: Ctx2D, font: string): (s: string) => number {
  return (s) => {
    ctx.font = font
    return ctx.measureText(s).width
  }
}

/** Draw wrapped text, returns the y after the block. */
function drawWrapped(
  ctx: Ctx2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: string,
  color: string,
  lineHeight: number,
): number {
  ctx.font = font
  ctx.fillStyle = color
  for (const line of wrapLines(text, maxWidth, measurer(ctx, font))) {
    ctx.fillText(line, x, y)
    y += lineHeight
  }
  return y
}

function heightOfWrapped(ctx: Ctx2D, text: string, maxWidth: number, font: string, lineHeight: number): number {
  return wrapLines(text, maxWidth, measurer(ctx, font)).length * lineHeight
}

function metaLine(r: Recipe): string {
  const parts: string[] = []
  if (r.servings) parts.push(`${r.servings} servings`)
  if (r.totalTime) parts.push(r.totalTime)
  if (r.author) parts.push(`by ${r.author}`)
  else if (r.sourceUrl) {
    try {
      parts.push(new URL(r.sourceUrl).hostname.replace(/^www\./, ''))
    } catch {}
  }
  return parts.join(' · ')
}

/** Render the recipe as a PNG blob, 1080 wide, height to fit. */
export async function renderRecipeCard(recipe: Recipe): Promise<Blob> {
  const probe = document.createElement('canvas').getContext('2d')
  if (!probe) throw new Error('canvas unavailable')
  const content = W - PAD * 2

  const TITLE_FONT = `bold 66px ${DISPLAY}`
  const META_FONT = `30px ${BODY}`
  const HEAD_FONT = `bold 40px ${DISPLAY}`
  const ITEM_FONT = `32px ${BODY}`
  const NUM_FONT = `bold 34px ${DISPLAY}`

  // Measure pass: how tall does this recipe need to be?
  let h = 96 // top margin + wordmark line
  h += 60
  h += heightOfWrapped(probe, recipe.title, content, TITLE_FONT, 78)
  h += 34 // tomato stroke + air
  const meta = metaLine(recipe)
  if (meta) h += 48
  h += 40
  if (recipe.ingredients.length > 0) {
    h += 64 // heading
    for (const ing of recipe.ingredients) h += heightOfWrapped(probe, ing.raw, content - 40, ITEM_FONT, 46) + 8
    h += 28
  }
  if (recipe.steps.length > 0) {
    h += 64
    for (const step of recipe.steps) h += heightOfWrapped(probe, step, content - 64, ITEM_FONT, 46) + 22
  }
  h += 110 // footer

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = Math.ceil(h)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')

  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, canvas.height)
  ctx.textBaseline = 'alphabetic'

  let y = 96
  // Wordmark
  ctx.font = `bold 34px ${DISPLAY}`
  ctx.fillStyle = GREEN
  ctx.fillText('Recipe Jar', PAD, y)
  y += 60

  // Title with the hand-drawn tomato line under it
  y = drawWrapped(ctx, recipe.title, PAD, y, content, TITLE_FONT, GREEN, 78)
  ctx.strokeStyle = TOMATO
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(PAD + 2, y - 44)
  ctx.quadraticCurveTo(PAD + 130, y - 52, PAD + 260, y - 46)
  ctx.stroke()
  y += 34
  if (meta) {
    ctx.font = META_FONT
    ctx.fillStyle = MUTED
    ctx.fillText(meta, PAD, y)
    y += 48
  }
  y += 40

  if (recipe.ingredients.length > 0) {
    ctx.font = HEAD_FONT
    ctx.fillStyle = INK
    ctx.fillText('Ingredients', PAD, y)
    y += 64
    for (const ing of recipe.ingredients) {
      ctx.fillStyle = TOMATO
      ctx.font = ITEM_FONT
      ctx.fillText('•', PAD, y)
      y = drawWrapped(ctx, ing.raw, PAD + 40, y, content - 40, ITEM_FONT, INK, 46) + 8
    }
    y += 28
  }

  if (recipe.steps.length > 0) {
    ctx.font = HEAD_FONT
    ctx.fillStyle = INK
    ctx.fillText('Method', PAD, y)
    y += 64
    let n = 1
    for (const step of recipe.steps) {
      const isSection = /^— .* —$/.test(step)
      if (isSection) {
        ctx.font = `italic 32px ${DISPLAY}`
        ctx.fillStyle = MUTED
        ctx.fillText(step.replace(/^— | —$/g, ''), PAD, y)
        y += 46 + 22
        continue
      }
      ctx.font = NUM_FONT
      ctx.fillStyle = TOMATO
      ctx.fillText(String(n++), PAD, y)
      y = drawWrapped(ctx, step, PAD + 64, y, content - 64, ITEM_FONT, INK, 46) + 22
    }
  }

  // Footer
  const fy = canvas.height - 52
  ctx.strokeStyle = RULE
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(PAD, fy - 40)
  ctx.lineTo(W - PAD, fy - 40)
  ctx.stroke()
  ctx.font = `bold 30px ${DISPLAY}`
  const brandWidth = ctx.measureText('recipejar.app').width
  ctx.fillStyle = GREEN
  ctx.fillText('recipejar.app', PAD, fy)
  ctx.font = `28px ${BODY}`
  ctx.fillStyle = MUTED
  ctx.fillText('· just the recipe, yours to keep', PAD + brandWidth + 16, fy)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  })
}
