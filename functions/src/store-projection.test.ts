// The two nightly folds' stores project field by field — so the pin has
// to read the projection.
//
// WHY THIS EXISTS. Both folds were made safe to retry by stamping each
// person's record with the last day folded into it, and skipping a person
// already stamped. The guard reads that stamp off whatever the store
// hands back. Both stores name their fields ONE BY ONE, at both ends:
//
//   getProfiles → { t, n }        putProfiles → { t, n, at }
//   getUsers    → { v, n }        putUsers    → { v, n, at }
//
// `d` was in none of them. So the stamp never reached Firestore and never
// came back, the skip never fired, and both fixes were inert in
// production — while their unit tests passed, because the in-memory fakes
// hold the whole object and round-trip anything hung on it for free.
//
// A fake cannot catch this: it is a SECOND implementation, and making it
// faithful only makes it faithful. The projections live inside the
// Firestore stores, which every unit test replaces, so nothing that runs
// reaches them. Read the source, the way indexes.test.ts pins the
// rollup's ordering and check-anchors pins its own key list.
//
// `set()` is called with no merge on both write paths, so a field left
// out of the write object is not merely unwritten — it is removed.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => readFileSync(resolve(here, f), "utf8");

const between = (src: string, from: string, to: string): string => {
  const i = src.indexOf(from);
  if (i < 0) return "";
  const j = src.indexOf(to, i);
  return j < 0 ? "" : src.slice(i, j);
};

describe("the fold stores carry the retry stamp in both directions", () => {
  const cases: Array<[string, string, string, string]> = [
    // file, read method, write method, the field the guard reads
    ["taste.ts", "async getProfiles(", "async putProfiles(", "d"],
    ["patterns.ts", "async getUsers(", "async putUsers(", "d"],
  ];

  for (const [file, getFn, putFn, field] of cases) {
    it(`${file}: the READ projection names \`${field}\``, () => {
      const src = read(file);
      const body = between(src, getFn, "return out;");
      expect(body, `${getFn} moved or was renamed — this case is vacuous`).not.toBe("");
      expect(
        body,
        `${file}'s read projection drops \`${field}\`. The retry guard reads it `
        + "off this map, so the guard never fires and the fold counts a "
        + "re-read day twice — with every unit test green, because the "
        + "in-memory fake keeps the whole object.",
      ).toContain(`snap.get("${field}")`);
    });

    it(`${file}: the WRITE object names \`${field}\``, () => {
      const src = read(file);
      const body = between(src, putFn, "await batch.commit();");
      expect(body, `${putFn} moved or was renamed — this case is vacuous`).not.toBe("");
      // `set` with no merge REPLACES the document, so an unnamed field is
      // removed rather than left alone.
      expect(body, "the write stopped using batch.set — re-check whether it still replaces the doc").toContain("batch.set(");
      expect(
        body,
        `${file}'s write object drops \`${field}\`, so the stamp the fold sets `
        + "never lands. `set` here has no merge, so the field is removed on "
        + "every write.",
      ).toContain(`${field}:`);
    });
  }

  // The velocity scan's own projection, added for the same reason and
  // pinned separately because it is a `.select()` on a query rather than a
  // field-by-field read of a snapshot.
  //
  // `fromIdx` is the only thing distinguishing a D86 edit's ledger row
  // from a create, and the volume ceiling is about creates. Drop it from
  // the select and every row reads as a create again — the exact state
  // this file was written about, where the guard is dead in production
  // while the in-memory fake goes on proving it works, because
  // velocity.test.ts builds its rows by hand and never reaches the query.
  it("velocity.ts: the ledger scan selects `fromIdx`", () => {
    const src = read("velocity.ts");
    const m = /\.select\(([^)]*)\)/.exec(src);
    expect(m, "the ledger scan's .select() moved or was renamed — this case is vacuous").toBeTruthy();
    for (const field of ["uid", "qid", "at", "fromIdx"]) {
      expect(
        m[1],
        `velocity.ts's scan drops \`${field}\` from its projection`,
      ).toContain(`"${field}"`);
    }
  });
});
