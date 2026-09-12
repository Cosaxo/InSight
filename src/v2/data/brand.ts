// The app's name, in one place.
//
// WHY A MODULE. The owner's 2026-09-12 upload (design/standalone-2026-09-12/,
// D-2026-09-12d) renames the app: *Doxa*, drawn in a serif, with *Endoxa*
// and *inSight* kept behind a Tweaks radio while the name settles — the
// owner's ruling of the same day is "Doxa for now, inSight was too
// crowded". A name lives in more places than a wordmark: the tab title,
// the boot splash, the walkthrough's first line, the sign-in wall, the
// demographics cards' titles ("Who's on Doxa in Oslo"), the cost-pause
// notice. Each of those read the literal "InSight" from its own string,
// which is how a rename becomes a sweep with a miss in it. They read this
// module now, so the pick is one line — `BRAND_DEFAULT` — and the DEV
// radio (app-shell's DevTweaks, `import.meta.env.DEV` only, D223) moves
// the same line at runtime for a screenshot or a comparison.
//
// WHAT DOES NOT MOVE WITH IT, stated so nobody expects it to: the bundle
// id `com.cosaxo.insight` (an identifier, never renamed), the Firebase
// project and hosting domain, the `insight.*` device keys (renaming them
// is the purge's problem, D51, for no gain), console prefixes, and the
// iris mark itself — D302's canvas specifies the mark and its lockups
// with the wordmark, so a new name is a new lockup, not a new mark. The
// shells' display names, the store listing and the web pages are the
// owner's next click (VISION-2026-09-12 §1.3): outward-facing, held by
// their own gates, and "for now" is not a store submission.
//
// NOTHING IS PERSISTED. The design remembered the radio's pick in
// `insight.brand.v2` so its boot splash could match; here the pick is
// tweak state like density (reset on reload), the splash always says the
// shipped name, and no `insight.*` key means no purge listener to owe
// (check:purge).

export type BrandId = "doxa" | "endoxa" | "insight";

export interface Brand {
  id: BrandId;
  /** The wordmark's three runs: before the accent, the accented run, after. */
  parts: readonly [string, string, string];
  /** Drawn in DM Serif Display (styles.css `.wm-serif`) rather than the sans. */
  serif: boolean;
}

export const BRANDS: Readonly<Record<BrandId, Brand>> = {
  doxa: { id: "doxa", parts: ["Do", "x", "a"], serif: true },
  endoxa: { id: "endoxa", parts: ["En", "doxa", ""], serif: false },
  insight: { id: "insight", parts: ["in", "Sight", ""], serif: false },
};

/** The shipped name. The one line a rename moves. */
export const BRAND_DEFAULT: BrandId = "doxa";

/** The tab title's second half; the name goes in front of it. */
export const TAGLINE = "a journal of the people around you";

export function isBrandId(v: unknown): v is BrandId {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(BRANDS, v);
}

/** A brand by id; anything unknown is the shipped one, never a crash. */
export function brandOf(id?: unknown): Brand {
  return BRANDS[isBrandId(id) ? id : current];
}

/** The name as one word — what copy says ("How Doxa works"). */
export function brandName(id?: unknown): string {
  return brandOf(id).parts.join("");
}

/** `document.title`'s shape, and index.html's static one. */
export function pageTitle(id?: unknown): string {
  return `${brandName(id)} — ${TAGLINE}`;
}

// The name in force. Module state rather than React state because the
// readers are not all components: demographics.js builds its card titles
// at module load, budgetMode.ts is a string table, and a push body is
// written on the server from the same word. Starts at the shipped name;
// the DEV radio is the only writer.
let current: BrandId = BRAND_DEFAULT;

export function currentBrand(): Brand {
  return BRANDS[current];
}

/**
 * Make `id` the name in force. Returns the brand so a caller can render
 * it in the same tick. Unknown ids fall back to the shipped name, so a
 * stale tweak value cannot blank the wordmark.
 */
export function setBrand(id: unknown): Brand {
  current = isBrandId(id) ? id : BRAND_DEFAULT;
  if (typeof document !== "undefined") document.title = pageTitle(current);
  return BRANDS[current];
}
