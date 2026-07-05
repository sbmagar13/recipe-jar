export interface Ingredient {
  /** Raw text as written on the site */
  raw: string
  /** Parsed leading quantity, if any (e.g. 1.5 for "1 1/2 cups flour") */
  qty: number | null
  /** Second quantity for ranges (e.g. 3 for "2-3 cloves") */
  qtyEnd: number | null
  /** Text after the quantity (e.g. "cups flour") */
  rest: string
}

export interface Recipe {
  title: string
  description: string
  image: string | null
  author: string | null
  sourceUrl: string
  /** Base servings parsed from recipeYield, defaults to 4 when unknown */
  servings: number | null
  yieldText: string | null
  totalTime: string | null
  prepTime: string | null
  cookTime: string | null
  ingredients: Ingredient[]
  steps: string[]
}
