import { describe, expect, it } from 'vitest'
import { parseRecipeText } from '../src/lib/textparse'
import {
  descriptionLines,
  isYouTubeUrl,
  normalizeYouTubeWatchUrl,
  rescueFromYouTube,
  rescueFromYouTubeText,
  youtubeDescription,
  youtubeThumbnail,
} from '../src/lib/youtube'

const WATCH = 'https://www.youtube.com/watch?v=abcdefghijk'
const rescue = (html: string) => rescueFromYouTube(html, WATCH)

// A watch page reduced to what matters: the player JSON inside a script, and
// the og:image. The descriptions are made up, in the shapes creators use.
function watchPage(title: string, description: string): string {
  const player = JSON.stringify({ videoDetails: { videoId: 'abcdefghijk', title, shortDescription: description } })
  return `<!DOCTYPE html><html><head><title>${title} - YouTube</title>
<meta property="og:image" content="https://i.ytimg.com/vi/abcdefghijk/maxresdefault.jpg">
</head><body><script nonce="x">var ytInitialPlayerResponse = ${player};var other = {"a":"}"};</script></body></html>`
}

// Macros line, "cookbook in bio", a one-line "Ingredients:" header with a
// yield note, numbered directions, a social footer and hashtags.
const SALMON = [
  '480 cals 36g protein 18g fat 30g carbs',
  '',
  'Cookbook in bio 🔗',
  '',
  'Ingredients: this makes 4 meals',
  '',
  '1 lb salmon fillet',
  '8 oz dry pasta',
  '1 (5 oz) herb cheese',
  '2 cups cherry tomatoes',
  '1 shallot, thinly sliced',
  '1 tbsp olive oil',
  '½ tsp salt, or to taste',
  '',
  'Directions:',
  '',
  '1. Preheat oven to 400°F. Put the cheese in the middle of a baking dish, add the salmon, tomatoes and shallot, drizzle with oil.',
  '',
  '2. Bake 25 minutes, until the salmon flakes.',
  '',
  '3. Cook the pasta, then toss everything together until creamy.',
  '',
  '4. Divide into 4 containers and enjoy!',
  '',
  'Follow for more',
  '',
  '#cooking #salmon #mealprep',
].join('\n')

describe('youtube urls', () => {
  it('detects watch, Shorts, mobile and youtu.be links', () => {
    expect(isYouTubeUrl('https://www.youtube.com/watch?v=abcdefghijk')).toBe(true)
    expect(isYouTubeUrl('https://www.youtube.com/shorts/abcdefghijk')).toBe(true)
    expect(isYouTubeUrl('https://m.youtube.com/watch?v=abcdefghijk')).toBe(true)
    expect(isYouTubeUrl('https://youtu.be/abcdefghijk')).toBe(true)
    expect(isYouTubeUrl('https://www.bbcgoodfood.com/recipes/x')).toBe(false)
    expect(isYouTubeUrl('not a url')).toBe(false)
  })

  it('normalizes every form of a video link to one watch URL', () => {
    const watch = 'https://www.youtube.com/watch?v=abcdefghijk'
    expect(normalizeYouTubeWatchUrl('https://youtu.be/abcdefghijk?t=12')).toBe(watch)
    expect(normalizeYouTubeWatchUrl('https://www.youtube.com/shorts/abcdefghijk')).toBe(watch)
    expect(normalizeYouTubeWatchUrl('https://m.youtube.com/watch?v=abcdefghijk&list=PL1')).toBe(watch)
    expect(normalizeYouTubeWatchUrl('https://www.youtube.com/embed/abcdefghijk')).toBe(watch)
  })

  it('leaves other sites alone, even ones that mention youtube', () => {
    expect(normalizeYouTubeWatchUrl('https://example.com/blog?ref=youtube.com/watch?v=abcdefghijk')).toBeNull()
    expect(normalizeYouTubeWatchUrl('https://notyoutube.com/shorts/abcdefghijk')).toBeNull()
    expect(normalizeYouTubeWatchUrl('https://www.youtube.com/@somechannel')).toBeNull()
  })
})

describe('youtubeDescription', () => {
  it('reads the title and description out of the player JSON', () => {
    const got = youtubeDescription(watchPage('Salmon Meal Prep', SALMON))
    expect(got?.title).toBe('Salmon Meal Prep')
    expect(got?.description).toMatch(/^480 cals/)
    expect(got?.description).toMatch(/#mealprep$/)
  })

  it('copes with braces and quotes inside the strings', () => {
    const got = youtubeDescription(watchPage('Bowl } of "noodles" {', 'Ingredients: {2 eggs}\nMethod: "Boil."'))
    expect(got?.title).toBe('Bowl } of "noodles" {')
    expect(got?.description).toBe('Ingredients: {2 eggs}\nMethod: "Boil."')
  })

  it('returns null without player JSON', () => {
    expect(youtubeDescription('<html><body>nope</body></html>')).toBeNull()
    expect(youtubeDescription('<script>var ytInitialPlayerResponse = {"videoDetails":{"title":"x"}};</script>')).toBeNull()
  })
})

describe('descriptionLines', () => {
  it('splits a one-line header and carries the yield note above it', () => {
    expect(descriptionLines('Ingredients: this makes 4 meals\n1 lb salmon\nDirections: 1. Bake it.')).toEqual([
      'this makes 4 meals',
      'Ingredients',
      '1 lb salmon',
      'Directions',
      '1. Bake it.',
    ])
  })

  it('drops the social footer and hashtag lines, keeps a serving step', () => {
    const text = [
      'Ingredients',
      '1 egg',
      'Method',
      'Serve with rice.',
      'Follow for more',
      'Thanks for watching!',
      "🔔 Don't forget to LIKE and SUBSCRIBE!",
      '#eggs #rice',
      'viral egg recipe 🍳 #recipe #egg #shorts',
    ].join('\n')
    expect(descriptionLines(text)).toEqual(['Ingredients', '1 egg', 'Method', 'Serve with rice.'])
  })

  it('leaves "Beef: 2 lbs" lines as typed', () => {
    expect(descriptionLines('Beef: 2 lbs\nSalt: 1 tsp')).toEqual(['Beef: 2 lbs', 'Salt: 1 tsp'])
  })
})

describe('rescueFromYouTube', () => {
  it('turns a recipe description into editor text, title and thumbnail kept', () => {
    const r = rescue(watchPage('Salmon Meal Prep', SALMON))
    expect(r).not.toBeNull()
    expect(r!.title).toBe('Salmon Meal Prep')
    expect(r!.image).toBe('https://i.ytimg.com/vi/abcdefghijk/maxresdefault.jpg')
    expect(r!.text).not.toMatch(/cals|bio|Follow|#/)

    // What the editor makes of it.
    const parsed = parseRecipeText(r!.text)
    expect(parsed.title).toBe('Salmon Meal Prep')
    expect(parsed.servings).toBe('4')
    expect(parsed.ingredients.split('\n')).toEqual([
      '1 lb salmon fillet',
      '8 oz dry pasta',
      '1 (5 oz) herb cheese',
      '2 cups cherry tomatoes',
      '1 shallot, thinly sliced',
      '1 tbsp olive oil',
      '½ tsp salt, or to taste',
    ])
    const steps = parsed.steps.split('\n')
    expect(steps).toHaveLength(4)
    expect(steps[0]).toMatch(/^Preheat oven to 400°F\./)
    expect(steps[3]).toBe('Divide into 4 containers and enjoy!')
  })

  it('reads emoji headers and bullets, and prefers the English block of a bilingual description', () => {
    const description = [
      'The easiest one-pot kabsa!',
      '',
      '🛒 المقادير',
      '* بصلة كبيرة مفرومة',
      '* كيلو لحم',
      '👩‍🍳 طريقة التحضير',
      '* اطبخ اللحم.',
      '',
      '🛒 INGREDIENTS LIST',
      '* 1 large onion, chopped',
      '* 1 kg lamb',
      '* 3 cups basmati rice',
      '',
      '👩‍🍳 QUICK STEPS',
      '* Sauté the onion until soft.',
      '* Brown the lamb and pressure cook for 25 mins.',
      '* Add the rice and cook for 12 mins.',
      '',
      "🔔 Don't forget to LIKE and SUBSCRIBE!",
    ].join('\n')
    const r = rescue(watchPage('Easy Instant Pot Kabsa', description))
    expect(r).not.toBeNull()
    expect(r!.text).not.toMatch(/[\u0600-\u06FF]|SUBSCRIBE/)
    const parsed = parseRecipeText(r!.text)
    expect(parsed.title).toBe('Easy Instant Pot Kabsa')
    expect(parsed.servings).toBe('') // "cook for 25 mins" is a time, not a serving count
    expect(parsed.ingredients.split('\n')).toEqual(['1 large onion, chopped', '1 kg lamb', '3 cups basmati rice'])
    expect(parsed.steps.split('\n')).toEqual([
      'Sauté the onion until soft.',
      'Brown the lamb and pressure cook for 25 mins.',
      'Add the rice and cook for 12 mins.',
    ])
  })

  it('reads Markdown headers and labelled lines as typed, and stops at the divider before the outro', () => {
    const description = [
      '### Ingredients:',
      '',
      '#### Beef and Marinade:',
      '- **Beef**: 2 lbs (lean cut)',
      '- **Baking Soda**: 1.5 tsp',
      '',
      '---',
      '',
      '### Cooking Steps:',
      '',
      '#### 1. **Prepare the Beef**:',
      '- Slice against the grain into thin pieces.',
      '',
      '---',
      '',
      'This recipe ensures tender beef. Enjoy!',
    ].join('\n')
    const r = rescue(watchPage('Restaurant Style Beef', description))
    expect(r).not.toBeNull()
    const parsed = parseRecipeText(r!.text)
    expect(parsed.ingredients.split('\n')).toEqual(['Beef and Marinade:', 'Beef: 2 lbs (lean cut)', 'Baking Soda: 1.5 tsp'])
    expect(parsed.steps.split('\n')).toEqual(['Prepare the Beef:', 'Slice against the grain into thin pieces.'])
    expect(parsed.steps).not.toMatch(/tender beef/)
  })

  it('accepts a list with prose steps and no steps header, when the lines read like a recipe', () => {
    const r = rescue(
      watchPage('Oat Pancakes', 'Ingredients\n1 cup oats\n1 banana\n2 eggs\nBlend everything and fry small pancakes in butter.'),
    )
    expect(r).not.toBeNull()
    // The gate accepts it; where the prose line lands is the editor's call
    // (the paste parser only starts the steps at a numbered line when there
    // is no steps header), and the cook's to fix.
    expect(r!.text.split('\n')).toEqual([
      'Oat Pancakes',
      'Ingredients',
      '1 cup oats',
      '1 banana',
      '2 eggs',
      'Blend everything and fry small pancakes in butter.',
    ])
  })

  it('returns null when the description is not a recipe', () => {
    expect(rescue(watchPage('Vlog', 'Cookbook in bio 🔗\n\n#cooking'))).toBeNull()
    expect(
      rescue(
        watchPage('Weekly vlog', 'New vlog out now\nCamera: Sony A7\nMusic: Epidemic Sound\nThanks so much for watching and see you next week.'),
      ),
    ).toBeNull()
    expect(
      rescue(watchPage('My setup', 'Gear I use:\nCamera: Sony A7IV\nLens: 24-70mm\nMic: Rode Wireless\nSubscribe for more!')),
    ).toBeNull()
    // A header with a list under it, but no method at all.
    expect(rescue(watchPage('Shopping', 'Ingredients\n1 cup oats\n1 banana\n2 eggs'))).toBeNull()
  })

  it('returns null for a page that is not a watch page', () => {
    expect(rescue('<html><body><h1>Hello</h1></body></html>')).toBeNull()
  })
})

// What YouTube serves behind its "confirm you're not a bot" wall: a player
// JSON stub and no og:image, but the page data still carries the description.
function botPage(title: string, description: string): string {
  const player = JSON.stringify({ responseContext: {}, playabilityStatus: { status: 'LOGIN_REQUIRED', reason: 'Sign in to confirm you’re not a bot' } })
  const data = JSON.stringify({
    contents: {
      twoColumnWatchNextResults: {
        results: {
          results: {
            contents: [
              { videoPrimaryInfoRenderer: { title: { runs: [{ text: title }] } } },
              { videoSecondaryInfoRenderer: { attributedDescription: { content: description } } },
            ],
          },
        },
      },
    },
  })
  return `<!DOCTYPE html><html><head><title> - YouTube</title></head><body><script>var ytInitialPlayerResponse = ${player};</script><script>var ytInitialData = ${data};</script></body></html>`
}

describe('behind the bot wall', () => {
  it('reads the title and description from the page data when the player JSON is a stub', () => {
    const got = youtubeDescription(botPage('Salmon Meal Prep', SALMON))
    expect(got?.title).toBe('Salmon Meal Prep')
    expect(got?.description).toMatch(/^480 cals/)
  })

  it("rescues the recipe, with YouTube's own thumbnail for the id", () => {
    const r = rescueFromYouTube(botPage('Salmon Meal Prep', SALMON), 'https://youtu.be/abcdefghijk')
    expect(r).not.toBeNull()
    expect(r!.title).toBe('Salmon Meal Prep')
    expect(r!.image).toBe('https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg')
    expect(parseRecipeText(r!.text).ingredients.split('\n')).toHaveLength(7)
  })

  it('returns null when YouTube refused the server outright', () => {
    const stub = '<html><script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"LOGIN_REQUIRED"}};</script></html>'
    expect(youtubeDescription(stub)).toBeNull()
    expect(rescueFromYouTube(stub, WATCH)).toBeNull()
  })
})

describe('rescueFromYouTubeText (the bookmarklet path)', () => {
  it('reads the lifted description, drops the " - YouTube" title suffix, and uses the thumbnail for the id', () => {
    const r = rescueFromYouTubeText(SALMON, 'Salmon Meal Prep - YouTube', 'https://www.youtube.com/shorts/abcdefghijk')
    expect(r).not.toBeNull()
    expect(r!.title).toBe('Salmon Meal Prep')
    expect(r!.image).toBe('https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg')
    expect(parseRecipeText(r!.text).steps.split('\n')).toHaveLength(4)
  })

  it('returns null for a description that is not a recipe', () => {
    expect(rescueFromYouTubeText('Cookbook in bio 🔗\n\n#cooking', 'Vlog - YouTube', WATCH)).toBeNull()
  })
})

describe('youtubeThumbnail', () => {
  it('builds the thumbnail from any video link form, null otherwise', () => {
    expect(youtubeThumbnail('https://youtu.be/abcdefghijk?t=1')).toBe('https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg')
    expect(youtubeThumbnail('https://m.youtube.com/watch?v=abcdefghijk')).toBe('https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg')
    expect(youtubeThumbnail('https://example.com/x')).toBeNull()
  })
})
