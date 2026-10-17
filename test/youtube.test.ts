import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseImportedHtml } from '../src/lib/importRecipe'
import {
  extractYouTubeDescription,
  isYouTubeUrl,
  normalizeYouTubeWatchUrl,
  tryParseYouTubeRecipe,
} from '../src/lib/youtube'

describe('youtube urls', () => {
  it('detects watch, shorts, youtu.be', () => {
    expect(isYouTubeUrl('https://www.youtube.com/watch?v=V4i77gmd-vI')).toBe(true)
    expect(isYouTubeUrl('https://www.youtube.com/shorts/V4i77gmd-vI')).toBe(true)
    expect(isYouTubeUrl('https://youtu.be/V4i77gmd-vI')).toBe(true)
    expect(isYouTubeUrl('https://www.bbcgoodfood.com/recipes/x')).toBe(false)
  })

  it('normalizes to watch?v=', () => {
    expect(normalizeYouTubeWatchUrl('https://youtu.be/V4i77gmd-vI')).toBe(
      'https://www.youtube.com/watch?v=V4i77gmd-vI',
    )
    expect(normalizeYouTubeWatchUrl('https://www.youtube.com/shorts/V4i77gmd-vI')).toBe(
      'https://www.youtube.com/watch?v=V4i77gmd-vI',
    )
    expect(normalizeYouTubeWatchUrl('https://m.youtube.com/watch?v=V4i77gmd-vI')).toBe(
      'https://www.youtube.com/watch?v=V4i77gmd-vI',
    )
  })

  it('does not normalize non-YouTube hosts that embed a watch link', () => {
    expect(
      normalizeYouTubeWatchUrl(
        'https://example.com/blog?ref=youtube.com/watch?v=abcdefghijk',
      ),
    ).toBeNull()
    expect(normalizeYouTubeWatchUrl('https://notyoutube.com/shorts/abcdefghijk')).toBeNull()
  })
})

describe('extractYouTubeDescription', () => {
  it('reads title and shortDescription from fixture', () => {
    const html = readFileSync('fixtures/youtube-salmon-meal-prep.html', 'utf8')
    const got = extractYouTubeDescription(html)
    expect(got?.title).toMatch(/Salmon Meal Prep/i)
    expect(got?.description).toMatch(/Ingredients:/i)
    expect(got?.description).toMatch(/Directions:/i)
  })

  it('returns null when player JSON is missing', () => {
    expect(extractYouTubeDescription('<html><body>nope</body></html>')).toBeNull()
  })
})

describe('parseImportedHtml', () => {
  it('prefers JSON-LD over YouTube description on a structured page', async () => {
    const html = `<!doctype html><html><head>
      <script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Tomato Soup',
        recipeIngredient: ['2 tomatoes', 'salt'],
        recipeInstructions: ['Simmer.'],
      })}</script>
      <script>var ytInitialPlayerResponse = ${JSON.stringify({
        videoDetails: { title: 'Wrong', shortDescription: 'not a recipe' },
      })};</script>
      </head><body></body></html>`
    const r = await parseImportedHtml(html, 'https://www.youtube.com/watch?v=abc12345678')
    expect(r?.title).toBe('Tomato Soup')
  })

  it('falls back to YouTube description when structured data is missing', async () => {
    const html = readFileSync('fixtures/youtube-salmon-meal-prep.html', 'utf8')
    const recipe = await parseImportedHtml(html, 'https://www.youtube.com/watch?v=V4i77gmd-vI')
    expect(recipe).not.toBeNull()
    expect(recipe!.title).toMatch(/Salmon/i)
  })

  it('returns null for non-recipe pages', async () => {
    expect(await parseImportedHtml('<html><body>hello</body></html>', 'https://example.com/x')).toBeNull()
  })
})

describe('tryParseYouTubeRecipe', () => {
  it('builds a recipe from the salmon description fixture', () => {
    const html = readFileSync('fixtures/youtube-salmon-meal-prep.html', 'utf8')
    const recipe = tryParseYouTubeRecipe(html, 'https://www.youtube.com/watch?v=V4i77gmd-vI')
    expect(recipe).not.toBeNull()
    expect(recipe!.title).toMatch(/Salmon/i)
    expect(recipe!.ingredients.length).toBeGreaterThanOrEqual(8)
    expect(recipe!.steps.length).toBe(6)
    expect(recipe!.servings).toBe(6)
    expect(recipe!.sourceUrl).toBe('https://www.youtube.com/watch?v=V4i77gmd-vI')
    // Yield / CTA / hashtag footer must not pollute the card
    expect(recipe!.ingredients.map((i) => i.raw)).not.toContain('this makes 6 meals')
    expect(recipe!.ingredients[0]?.raw).toMatch(/sockeye salmon/i)
    expect(recipe!.steps.some((s) => /follow for more/i.test(s))).toBe(false)
    expect(recipe!.steps.some((s) => /#cooking/i.test(s))).toBe(false)
  })

  it('rejects a YouTube page whose description is not a recipe', () => {
    const html = `<html><script>var ytInitialPlayerResponse = ${JSON.stringify({
      videoDetails: {
        title: 'Vlog',
        shortDescription: 'Cookbook in bio\n\n#cooking',
      },
    })};</script></html>`
    expect(tryParseYouTubeRecipe(html, 'https://www.youtube.com/watch?v=aaaaaaaaaaa')).toBeNull()
  })

  it('rejects vlog-style descriptions without recipe headers', () => {
    const html = `<html><script>var ytInitialPlayerResponse = ${JSON.stringify({
      videoDetails: {
        title: 'Weekly vlog',
        shortDescription:
          'New vlog out now\nCamera: Sony A7\nMusic: Epidemic Sound\nThanks so much for watching and see you next week.',
      },
    })};</script></html>`
    expect(tryParseYouTubeRecipe(html, 'https://www.youtube.com/watch?v=aaaaaaaaaaa')).toBeNull()
  })

  it('rejects gear-list descriptions without recipe headers', () => {
    const html = `<html><script>var ytInitialPlayerResponse = ${JSON.stringify({
      videoDetails: {
        title: 'My setup',
        shortDescription:
          'Gear I use:\nCamera: Sony A7IV\nLens: 24-70mm\nMic: Rode Wireless\nSubscribe for more!',
      },
    })};</script></html>`
    expect(tryParseYouTubeRecipe(html, 'https://www.youtube.com/watch?v=aaaaaaaaaaa')).toBeNull()
  })

  it('drops section labels, merges titled steps, and strips unicode hashtags', () => {
    const description = [
      'Easy Kabsa',
      '',
      'Ingredients:',
      'For sautéing:',
      'Two cinnamon sticks',
      'One large onion, chopped (300g)',
      'For the meat:',
      'One kilogram beef',
      'For garnish:',
      'Fresh coriander, chopped',
      '',
      'Instructions:',
      '1. Prepare the Instant Pot:',
      'Turn on sauté mode and cook the onions.',
      '2. Cook the Meat:',
      'Add the beef and spices, then pressure cook.',
      '',
      '#cooking #kabsa',
      '#طبخ #كبسة_لحم',
    ].join('\n')
    const html = `<html><script>var ytInitialPlayerResponse = ${JSON.stringify({
      videoDetails: { title: 'Easy Instant Pot Kabsa', shortDescription: description },
    })};</script></html>`
    const recipe = tryParseYouTubeRecipe(html, 'https://www.youtube.com/watch?v=lrLKZWFHcBI')
    expect(recipe).not.toBeNull()
    const rawIngredients = recipe!.ingredients.map((i) => i.raw)
    expect(rawIngredients).not.toContain('For sautéing:')
    expect(rawIngredients).not.toContain('For the meat:')
    expect(rawIngredients).not.toContain('For garnish:')
    expect(rawIngredients).toContain('Two cinnamon sticks')
    expect(rawIngredients).toContain('One kilogram beef')
    expect(recipe!.steps).toEqual([
      'Prepare the Instant Pot: Turn on sauté mode and cook the onions.',
      'Cook the Meat: Add the beef and spices, then pressure cook.',
    ])
    expect(recipe!.steps.some((s) => /#/.test(s))).toBe(false)
  })

  it('parses Ingredients + How to make it headers', () => {
    const description = [
      'Homemade Mutabal',
      '',
      'Ingredients:',
      '• 2 medium eggplants',
      '• 2 tbsp tahini',
      '• 1 garlic clove (crushed)',
      '• Juice of ½ lemon',
      '',
      'How to make it:',
      ' 1. Roast the eggplants until the skin is charred',
      ' 2. Peel and mash the flesh',
      ' 3. Mix in tahini, garlic, lemon juice, and salt',
      '',
      '#Mutabal #MiddleEasternFood #Homemade',
    ].join('\n')
    const html = `<html><script>var ytInitialPlayerResponse = ${JSON.stringify({
      videoDetails: {
        title: 'Homemade Mutabal',
        shortDescription: description,
      },
    })};</script></html>`
    const recipe = tryParseYouTubeRecipe(html, 'https://www.youtube.com/watch?v=GNSrbqV3d9Y')
    expect(recipe).not.toBeNull()
    expect(recipe!.ingredients.map((i) => i.raw)).toEqual([
      '2 medium eggplants',
      '2 tbsp tahini',
      '1 garlic clove (crushed)',
      'Juice of ½ lemon',
    ])
    expect(recipe!.steps).toEqual([
      'Roast the eggplants until the skin is charred',
      'Peel and mash the flesh',
      'Mix in tahini, garlic, lemon juice, and salt',
    ])
  })

  it('parses Ingredients + bare RECIPE method headers with prose steps', () => {
    const description = [
      'Amazing Potato Gratin',
      '',
      '#potato #gratin #dinner #lunch #recipeideas #homefood',
      '',
      'Looking for more delicious recipes? Follow @chef!',
      '',
      'INGREDIENTS',
      '700-800g peeled potatoes',
      '4 cloves of garlic',
      '250ml sweet cream',
      'Salt and pepper to taste',
      '',
      'RECIPE',
      'Cut the potatoes into thin slices. Grease the baking dish and put the potatoes in it. Chop onions and garlic. Add them to the sweet cream. Add salt and pepper and pour mixture over the potatoes. Grate the cheese, pour over the potatoes and bake in an oven heated to 200 degrees for about 40-50 minutes.',
      '',
      'Enjoy 😊',
    ].join('\n')
    const html = `<html><script>var ytInitialPlayerResponse = ${JSON.stringify({
      videoDetails: { title: 'Amazing Potato Gratin', shortDescription: description },
    })};</script></html>`
    const recipe = tryParseYouTubeRecipe(html, 'https://www.youtube.com/watch?v=fevtsW8lcQk')
    expect(recipe).not.toBeNull()
    expect(recipe!.ingredients.map((i) => i.raw)).toEqual([
      '700-800g peeled potatoes',
      '4 cloves of garlic',
      '250ml sweet cream',
      'Salt and pepper to taste',
    ])
    expect(recipe!.steps.length).toBeGreaterThanOrEqual(4)
    expect(recipe!.steps[0]).toMatch(/Cut the potatoes/i)
    expect(recipe!.steps.some((s) => /Looking for more|Follow @|#potato/i.test(s))).toBe(false)
  })

  it('splits prose instructions into sentences and drops hashtag SEO trailers', () => {
    const description = [
      'CHOCOLATE NUT BARS',
      '',
      'Ingredients:',
      '1 cup raw almonds',
      '1 cup raw cashews',
      '2-3 tbs maple syrup',
      '3 dark chocolate bars',
      '',
      'Instructions:',
      'Mix all nuts in a large mixing bowl with maple syrup, then transfer to a parchment-lined baking dish. Bake at 350° for 15-20 minutes until nuts are golden, then immediately top with dark chocolate bars. Place back in the oven for 2-3 minutes if needed to melt completely, then spread evenly over the baked nuts. Allow to cool in fridge for 10-15 minutes until chocolate has hardened, then slice into bars and enjoy! 😋',
      '',
      'viral chocolate nut bars recipe 🍫 #recipe #chocolate #dessert #almond #food #baking #shorts #viral',
    ].join('\n')
    const html = `<html><script>var ytInitialPlayerResponse = ${JSON.stringify({
      videoDetails: {
        title: 'viral chocolate nut bars recipe 🍫 #recipe #chocolate #dessert',
        shortDescription: description,
      },
    })};</script></html>`
    const recipe = tryParseYouTubeRecipe(html, 'https://www.youtube.com/watch?v=HZ0hm8mhmRc')
    expect(recipe).not.toBeNull()
    expect(recipe!.steps).toEqual([
      'Mix all nuts in a large mixing bowl with maple syrup, then transfer to a parchment-lined baking dish.',
      'Bake at 350° for 15-20 minutes until nuts are golden, then immediately top with dark chocolate bars.',
      'Place back in the oven for 2-3 minutes if needed to melt completely, then spread evenly over the baked nuts.',
      'Allow to cool in fridge for 10-15 minutes until chocolate has hardened, then slice into bars and enjoy! 😋',
    ])
    expect(recipe!.steps.some((s) => /#recipe|#shorts/i.test(s))).toBe(false)
  })

  it('drops bare category labels like Meat sauce: from ingredients', () => {
    const description = [
      'High-protein lasagna',
      'Ingredients',
      'Meat sauce:',
      '530g extra-lean beef mince',
      '1,275g passata',
      'Creamy layer:',
      '500g low-fat cottage cheese',
      'Pasta + cheese:',
      '190g dry lasagne sheets',
      'Method:',
      '1. Brown the beef.',
      '2. Assemble and bake.',
    ].join('\n')
    const html = `<html><script>var ytInitialPlayerResponse = ${JSON.stringify({
      videoDetails: { title: 'Low-Calorie Lasagna', shortDescription: description },
    })};</script></html>`
    const recipe = tryParseYouTubeRecipe(html, 'https://www.youtube.com/watch?v=2xuMuNzCyGk')
    expect(recipe).not.toBeNull()
    const raw = recipe!.ingredients.map((i) => i.raw)
    expect(raw).toEqual([
      '530g extra-lean beef mince',
      '1,275g passata',
      '500g low-fat cottage cheese',
      '190g dry lasagne sheets',
    ])
    const passata = recipe!.ingredients.find((i) => /passata/i.test(i.raw))
    expect(passata?.qty).toBe(1275)
    expect(passata?.rest).toBe('g passata')
  })

  it('prefers English in bilingual Arabic-first descriptions', () => {
    const description = [
      'كبسة لحم سهلة',
      '',
      'المكونات',
      'للتقليب:',
      'عودان من القرفة',
      'بصلة كبيرة مفرومة',
      'لتحضير اللحم:',
      'كيلوغرام واحد من لحم البقر',
      '',
      'الطريقة',
      '١. تحضير القدر:',
      'قم بتشغيل وضع التقليب وأضف البصل.',
      '٢. طهي اللحم:',
      'أضف اللحم والتوابل واطبخ تحت الضغط.',
      'قدّم كبسة اللحم اللذيذة!',
      '',
      'Ingredients:',
      'For sautéing:',
      'Two cinnamon sticks',
      'One large onion, chopped',
      'For the meat:',
      'One kilogram beef',
      '',
      'Instructions:',
      '1. Prepare the pot:',
      'Sauté the onions.',
      '2. Cook the meat:',
      'Pressure cook until tender.',
      '',
      'Serve your delicious kabsa with rice!',
      '',
      '#طبخ #كبسة_لحم',
    ].join('\n')
    const html = `<html><script>var ytInitialPlayerResponse = ${JSON.stringify({
      videoDetails: {
        title: 'Easy Instant Pot Arabian Meat Kabsa',
        shortDescription: description,
      },
    })};</script></html>`
    const recipe = tryParseYouTubeRecipe(html, 'https://www.youtube.com/watch?v=WIPIdiwfPto')
    expect(recipe).not.toBeNull()
    const rawIngredients = recipe!.ingredients.map((i) => i.raw)
    expect(rawIngredients).toEqual([
      'Two cinnamon sticks',
      'One large onion, chopped',
      'One kilogram beef',
    ])
    expect(rawIngredients.some((l) => /[\u0600-\u06FF]/.test(l))).toBe(false)
    expect(recipe!.steps).toEqual([
      'Prepare the pot: Sauté the onions.',
      'Cook the meat: Pressure cook until tender.',
    ])
    expect(recipe!.steps.some((s) => /Serve your|قدّم|#/.test(s))).toBe(false)
  })

  it('parses emoji Ingredients List / Quick Steps descriptions', () => {
    const description = [
      'The easiest one-pot Kabsa!',
      '',
      '✨ Why You’ll Love This Recipe:',
      ' * Simple one-pot method',
      '',
      '🛒 INGREDIENTS LIST',
      ' * The Base: 1 large onion (chopped), 1–2 tbsp oil.',
      ' * Whole Spices: 6 cardamom pods, 8 cloves.',
      ' * The Meat: 1kg Lamb, 6 cups hot water, 1 tbsp salt.',
      ' * The Rice: 3 cups Basmati rice, 2 whole chili peppers.',
      '',
      '👩‍🍳 QUICK STEPS',
      ' * Sauté onions and whole spices until fragrant.',
      ' * Brown the lamb, add water/salt, and pressure cook for 25 mins.',
      ' * Add soaked rice and chilies.',
      ' * Cook for 12 mins, fluff, and serve!',
      '',
      '💬 Join the Conversation:',
      'Where are you watching from?',
      "🔔 Don't forget to LIKE and SUBSCRIBE for more easy authentic recipes!",
      '',
      '🛒 المقادير',
      ' *بصلة كبيرة مفرومة',
      '👩‍🍳 طريقة التحضير في قدر الضغط الكهربائي',
      ' * اختر وضعية Sauté',
    ].join('\n')
    const html = `<html><script>var ytInitialPlayerResponse = ${JSON.stringify({
      videoDetails: {
        title: 'Easy Instant Pot Arabian Meat Kabsa',
        shortDescription: description,
      },
    })};</script></html>`
    const recipe = tryParseYouTubeRecipe(html, 'https://www.youtube.com/watch?v=sOxIYX64xQM')
    expect(recipe).not.toBeNull()
    expect(recipe!.ingredients.map((i) => i.raw)).toEqual([
      'The Base: 1 large onion (chopped), 1–2 tbsp oil.',
      'Whole Spices: 6 cardamom pods, 8 cloves.',
      'The Meat: 1kg Lamb, 6 cups hot water, 1 tbsp salt.',
      'The Rice: 3 cups Basmati rice, 2 whole chili peppers.',
    ])
    expect(recipe!.steps).toEqual([
      'Sauté onions and whole spices until fragrant.',
      'Brown the lamb, add water/salt, and pressure cook for 25 mins.',
      'Add soaked rice and chilies.',
      'Cook for 12 mins, fluff, and serve!',
    ])
    expect(recipe!.ingredients.some((i) => /[\u0600-\u06FF]/.test(i.raw))).toBe(false)
  })

  it('parses Markdown Ingredients / Cooking Steps descriptions', () => {
    const description = [
      '### Ingredients:',
      '',
      '#### Beef and Marinade:',
      '- **Beef**: 2 lbs (lean cut)',
      '- **Baking Soda**: 1.5 tsp',
      '- **Cornstarch**: 3 tbsp',
      '',
      '#### Sauce:',
      '- **Soy Sauce**: 1 tbsp',
      '- **Oyster Sauce**: 1/2 tbsp',
      '',
      '---',
      '',
      '### Cooking Steps:',
      '',
      '#### 1. **Prepare the Beef**:',
      '- Slice against the grain into thin pieces.',
      '',
      '#### 2. **Marinate the Beef**:',
      '- Mix the marinade and coat the beef.',
      '',
      '#### 3. **Cook the Beef**:',
      '- Sear, then stir-fry with the sauce.',
      '',
      '---',
      '',
      'This recipe ensures tender beef. Enjoy!',
    ].join('\n')
    const html = `<html><script>var ytInitialPlayerResponse = ${JSON.stringify({
      videoDetails: {
        title: 'Chinese Restaurant Beef',
        shortDescription: description,
      },
    })};</script></html>`
    const recipe = tryParseYouTubeRecipe(html, 'https://www.youtube.com/watch?v=I4Szo0odIDo')
    expect(recipe).not.toBeNull()
    const raw = recipe!.ingredients.map((i) => i.raw)
    expect(raw).not.toContain('Beef and Marinade:')
    expect(raw).not.toContain('Sauce:')
    expect(raw).toContain('2 lbs (lean cut) Beef')
    expect(raw).toContain('1.5 tsp Baking Soda')
    expect(raw).toContain('1 tbsp Soy Sauce')
    expect(recipe!.steps.length).toBeGreaterThanOrEqual(3)
    expect(recipe!.steps.some((s) => /Slice against the grain/i.test(s))).toBe(true)
    expect(recipe!.steps.some((s) => /This recipe ensures/i.test(s))).toBe(false)
  })

  it('still parses Arabic-only descriptions', () => {
    const description = [
      'كبسة دجاج',
      'المكونات',
      'دجاجة كاملة',
      'كوبان أرز',
      'الطريقة',
      '١. اغسل الأرز.',
      '٢. اطبخ الدجاج.',
    ].join('\n')
    const html = `<html><script>var ytInitialPlayerResponse = ${JSON.stringify({
      videoDetails: { title: 'كبسة دجاج', shortDescription: description },
    })};</script></html>`
    const recipe = tryParseYouTubeRecipe(html, 'https://www.youtube.com/watch?v=bbbbbbbbbbb')
    expect(recipe).not.toBeNull()
    expect(recipe!.ingredients.map((i) => i.raw)).toEqual(['دجاجة كاملة', 'كوبان أرز'])
    expect(recipe!.steps).toEqual(['اغسل الأرز.', 'اطبخ الدجاج.'])
  })
})
