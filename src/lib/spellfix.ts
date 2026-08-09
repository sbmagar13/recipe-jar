// Forgiving search: when a dish query finds nothing, snap each unknown word to
// the nearest common food word ("browny" becomes "brownie", "chiken" becomes
// "chicken") so one typo does not end in an empty dropdown. This module is
// imported on demand, only after a search comes back empty, so the word list
// never weighs down the entry bundle.

// Common dish and ingredient words people actually type (and mistype). Kept to
// single lowercase words because queries are corrected word by word.
const FOOD_WORDS = [
  'chicken', 'mutton', 'lamb', 'beef', 'pork', 'bacon', 'sausage', 'turkey',
  'salmon', 'tuna', 'shrimp', 'prawn', 'fish', 'crab', 'egg', 'tofu', 'paneer',
  'brownie', 'cookie', 'cake', 'cheesecake', 'muffin', 'cupcake', 'pancake',
  'waffle', 'pie', 'tart', 'pudding', 'custard', 'tiramisu', 'meringue',
  'macaron', 'croissant', 'brioche', 'baguette', 'donut', 'scone', 'fudge',
  'curry', 'masala', 'tikka', 'tandoori', 'korma', 'vindaloo', 'biryani',
  'pulao', 'dal', 'chana', 'chole', 'rajma', 'saag', 'palak', 'aloo', 'gobi',
  'matar', 'bhindi', 'baingan', 'kofta', 'samosa', 'pakora', 'dosa', 'idli',
  'sambar', 'vada', 'upma', 'poha', 'khichdi', 'paratha', 'chapati', 'roti',
  'naan', 'puri', 'lassi', 'raita', 'kheer', 'halwa', 'jalebi', 'barfi',
  'ladoo', 'gulab', 'jamun', 'chutney', 'momo', 'chowmein', 'thukpa', 'sekuwa',
  'gundruk', 'dhido', 'choila', 'pasta', 'spaghetti', 'lasagna', 'noodle',
  'ramen', 'risotto', 'gnocchi', 'polenta', 'pizza', 'bruschetta', 'ravioli',
  'macaroni', 'penne', 'carbonara', 'bolognese', 'alfredo', 'pesto',
  'burger', 'sandwich', 'burrito', 'taco', 'quesadilla', 'enchilada',
  'guacamole', 'salsa', 'tortilla', 'nachos', 'fajita', 'paella', 'gazpacho',
  'chorizo', 'hummus', 'falafel', 'shawarma', 'kebab', 'tabbouleh', 'pita',
  'sushi', 'teriyaki', 'tempura', 'katsu', 'gyoza', 'dumpling', 'bibimbap',
  'kimchi', 'pho', 'satay', 'rendang', 'laksa', 'padthai', 'spring',
  'soup', 'stew', 'salad', 'casserole', 'roast', 'grilled', 'fried', 'baked',
  'steamed', 'smoothie', 'porridge', 'oatmeal', 'granola', 'omelette',
  'quiche', 'crepe', 'souffle', 'ratatouille', 'goulash', 'chili', 'gumbo',
  'chowder', 'meatball', 'meatloaf', 'schnitzel', 'stroganoff', 'wellington',
  'chocolate', 'vanilla', 'caramel', 'banana', 'strawberry', 'blueberry',
  'raspberry', 'mango', 'apple', 'lemon', 'orange', 'coconut', 'peanut',
  'almond', 'walnut', 'pistachio', 'hazelnut', 'cinnamon', 'ginger', 'garlic',
  'turmeric', 'cardamom', 'coriander', 'cilantro', 'cumin', 'saffron',
  'basil', 'oregano', 'thyme', 'rosemary', 'parsley', 'mint', 'chilli',
  'pepper', 'onion', 'tomato', 'potato', 'carrot', 'spinach', 'mushroom',
  'broccoli', 'cauliflower', 'zucchini', 'eggplant', 'aubergine', 'okra',
  'cabbage', 'lettuce', 'cucumber', 'avocado', 'pumpkin', 'squash', 'corn',
  'lentil', 'quinoa', 'rice', 'bread', 'cheese', 'mozzarella', 'parmesan',
  'cheddar', 'yogurt', 'butter', 'cream', 'honey',
]

const KNOWN = new Set(FOOD_WORDS)

/** Edit distance with a cap: returns cap+1 as soon as it cannot stay within. */
function editDistance(a: string, b: string, cap: number): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1
  let prev: number[] = []
  for (let i = 0; i <= a.length; i++) prev[i] = i
  for (let j = 1; j <= b.length; j++) {
    const cur: number[] = [j]
    let rowMin = j
    for (let i = 1; i <= a.length; i++) {
      cur[i] = Math.min(prev[i] + 1, cur[i - 1] + 1, prev[i - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (cur[i] < rowMin) rowMin = cur[i]
    }
    if (rowMin > cap) return cap + 1
    prev = cur
  }
  return prev[a.length]
}

/** A word counts as known in its plural forms too; returns the known form. */
function knownForm(w: string): string | null {
  if (KNOWN.has(w)) return w
  const sSingular = w.replace(/s$/, '')
  if (sSingular !== w && KNOWN.has(sSingular)) return sSingular
  const esSingular = w.replace(/es$/, '')
  if (esSingular !== w && KNOWN.has(esSingular)) return esSingular
  const iesSingular = w.replace(/ies$/, 'y')
  if (iesSingular !== w && KNOWN.has(iesSingular)) return iesSingular
  return null
}

export function correctWord(word: string): string {
  const w = word.toLowerCase()
  if (w.length < 4) return word
  const known = knownForm(w)
  if (known) return known === w ? word : known
  // Typos rarely touch the first letter, so requiring it keeps snaps sane.
  const cap = w.length >= 6 ? 2 : 1
  let best: string | null = null
  let bestDistance = cap + 1
  for (const candidate of FOOD_WORDS) {
    if (candidate[0] !== w[0]) continue
    const d = editDistance(w, candidate, cap)
    if (d < bestDistance) {
      bestDistance = d
      best = candidate
      if (d === 1) break
    }
  }
  return best ?? word
}

/** "browny" -> "brownie"; words that are already food words pass through. */
export function correctQuery(query: string): string {
  return query.trim().split(/\s+/).map(correctWord).join(' ')
}
