// mealEstimate.ts — coax the on-device Gemma into a structured
// nutritional estimate from a free-text meal description.
//
// We avoid asking the small model for JSON (E2B is bad at strict
// JSON braces) and instead use a four-line key/value transcript it
// is much more reliable at producing:
//
//   kcal: 450
//   carbs: 60
//   protein: 30
//   fat: 12
//
// The parser is permissive — accepts trailing "g", commas in
// numbers, extra whitespace, and any ordering. If a field is
// missing or unparseable it's left as null so the UI can keep the
// existing value rather than overwrite it with 0.

export interface MealEstimate {
  kcal: number | null;
  carbs: number | null;
  protein: number | null;
  fat: number | null;
}

export function buildMealEstimatePrompt(description: string): string {
  return [
    "You are a nutrition estimator. The user describes a meal in plain language. Estimate per-serving calories and macronutrients. Be realistic — favour typical home-portion sizes.",
    "",
    "Respond with EXACTLY four lines in this format, integers only, no units, no extra text:",
    "kcal: <number>",
    "carbs: <number>",
    "protein: <number>",
    "fat: <number>",
    "",
    `Meal: ${description.trim()}`,
    "",
    "Response:",
  ].join("\n");
}

export function parseMealEstimate(raw: string): MealEstimate {
  const out: MealEstimate = { kcal: null, carbs: null, protein: null, fat: null };
  // Tolerant regex: optional bullet/dash, the key, separator, then
  // the first integer we can find on the line. "carbs: 60g" and
  // "- Carbs (g): 60" both match.
  const re = /(kcal|cal|calories|carbs?|protein|fat)\s*[^0-9-]*?(\d{1,4})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const key = m[1].toLowerCase();
    const val = Math.round(Number(m[2]));
    if (!Number.isFinite(val) || val < 0) continue;
    if ((key === "kcal" || key === "cal" || key === "calories") && out.kcal == null) {
      out.kcal = val;
    } else if ((key === "carbs" || key === "carb") && out.carbs == null) {
      out.carbs = val;
    } else if (key === "protein" && out.protein == null) {
      out.protein = val;
    } else if (key === "fat" && out.fat == null) {
      out.fat = val;
    }
  }
  // Sanity: clamp absurd kcal (>4000 per single meal is almost
  // always a parse error — the model echoed two numbers).
  if (out.kcal != null && out.kcal > 4000) out.kcal = null;
  return out;
}
