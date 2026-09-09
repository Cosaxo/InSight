// One name, one meaning, across functions/src.
//
// WHY THIS EXISTS. `utcDayKey` was exported by FOUR modules in two
// incompatible families: pure.ts and paid.ts took an OFFSET IN DAYS,
// logic.ts and velocity.ts took a MILLISECOND TIMESTAMP. So `utcDayKey(0)`
// meant today in one family and 1970-01-01 in the other, and
// `utcDayKey(Date.now())` meant a date about 46 million years out.
//
// It never fired, because nothing imported across the families — every
// module used its own local copy. That is exactly what makes it worth a
// gate rather than a fix alone: the failure was waiting for the first
// person to reach for the nearer import, and it would have type-checked,
// since both families are `(number) => string`.
//
// Nothing else in functions/src shared a name when this was written, so
// the rule costs nothing today and refuses the shape from coming back.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const modules = readdirSync(here)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.endsWith(".d.ts"));

// `export function x`, `export async function x`, `export const x = (`,
// `export const x = async`. Deliberately NOT types or interfaces: two
// modules may legitimately describe the same shape, and a type cannot be
// called with the wrong argument.
const EXPORTED = /^export (?:async )?function (\w+)|^export const (\w+) = (?:\(|async|<)/gm;

describe("functions/src exports", () => {
  it("finds modules and exports at all — the rule is vacuous otherwise", () => {
    expect(modules.length).toBeGreaterThan(5);
    const total = modules.reduce((n, f) => {
      const src = readFileSync(resolve(here, f), "utf8");
      return n + [...src.matchAll(EXPORTED)].length;
    }, 0);
    expect(total, "no exports parsed — the pattern stopped matching this codebase").toBeGreaterThan(50);
  });

  it("exports no callable name from two modules", () => {
    const byName = new Map<string, string[]>();
    for (const f of modules) {
      const src = readFileSync(resolve(here, f), "utf8");
      for (const m of src.matchAll(EXPORTED)) {
        const name = m[1] ?? m[2];
        byName.set(name, [...(byName.get(name) ?? []), f]);
      }
    }
    const clashes = [...byName.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([name, files]) => `${name} — ${files.join(", ")}`);
    expect(
      clashes,
      "two modules export the same callable name. Either they are the same "
      + "function twice (import one) or they are different functions wearing "
      + "one name, which is how `utcDayKey` came to mean both an offset and "
      + "a timestamp — a mistake that type-checks.",
    ).toEqual([]);
  });
});
