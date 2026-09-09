// siteOrigin.test.ts — the "single edit" is a PROMISE, so something has
// to keep it.
//
// `siteOrigin.ts` says: "If a real domain ever replaces the .web.app
// default, this is the single edit (D3's 'no code change beyond LP_SITE'
// promise, widened to every consumer by making them all read the same
// constant)." It was false on the day it was widened — the consent
// wall's Terms and Privacy Policy links carried the origin as a literal,
// dated to D413, and D421 wrote the claim over code that already
// contradicted it. Those two are not incidental: they are the URLs the
// store forms require to resolve, and a domain move that misses them
// points the app's own consent notice at a host nobody owns.
//
// No gate covered it. `check:policy-claims` and `check:store-forms`
// mention neither file.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_ORIGIN } from "./siteOrigin";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OWNER = join("v2", "data", "siteOrigin.ts");

/** Every source file under src/, recursively. */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** Comment lines blanked. Crude — whole-line `//` and block-comment
 *  continuations only — and deliberately so: the rule is about a URL a
 *  BROWSER would fetch, and `links.ts`'s header legitimately quotes the
 *  invite URL's shape to explain what it parses. A literal on a line of
 *  code is what this catches. */
const codeOf = (src: string) =>
  src.split("\n")
    .map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? "" : l))
    .join("\n");

describe("SITE_ORIGIN is the single edit it says it is", () => {
  it("finds the files to check — vacuous otherwise", () => {
    const files = walk(SRC);
    expect(files.length, "the walk found nothing — this rule went vacuous").toBeGreaterThan(50);
    expect(files.some((f) => f.endsWith(OWNER))).toBe(true);
  });

  it("no other file under src/ writes the origin as a literal", () => {
    // Derived from the constant, never restated: a hand-kept copy of the
    // host here would be the very thing the rule forbids.
    const offenders = walk(SRC)
      .filter((f) => !f.endsWith(OWNER) && !/\.test\.tsx?$/.test(f))
      .filter((f) => codeOf(readFileSync(f, "utf8")).includes(SITE_ORIGIN))
      .map((f) => f.slice(SRC.length + 1));
    expect(
      offenders,
      "these files carry the hosting origin as a literal, so a domain move would miss them — "
        + "import SITE_ORIGIN from data/siteOrigin instead",
    ).toEqual([]);
  });

  it("the rule can fail — a positive control on the matcher", () => {
    // Without this, a `codeOf` that blanked everything would make the
    // sweep above pass forever.
    expect(codeOf(`const a = "${SITE_ORIGIN}/x";`).includes(SITE_ORIGIN)).toBe(true);
    expect(codeOf(`// ${SITE_ORIGIN}/x`).includes(SITE_ORIGIN)).toBe(false);
  });

  it("the consent wall's two links are built from it", () => {
    // Named, so a revert is loud rather than a number moving by one.
    const gate = readFileSync(join(SRC, "v2", "ui", "LiveSignInGate.tsx"), "utf8");
    expect(gate, "the Terms link stopped reading the constant").toContain("${SITE_ORIGIN}/terms.html");
    expect(gate, "the Privacy link stopped reading the constant").toContain("${SITE_ORIGIN}/privacy.html");
  });
});
