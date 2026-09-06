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
    // The answer map (D395): the compaction MERGES into what getUsers hands
    // back, so a read that dropped it would refit the candidate on
    // yesterday alone every night — with every unit test green, for the
    // same reason as `d`.
    ["patterns.ts", "async getUsers(", "async putUsers(", "a"],
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

  // The loadings document itself is read and written WHOLE since D395 —
  // the fix for the hazard the two cases here used to pin. `getModel`
  // named `k`, `q`, `lastDay`, `series` and `quality` one at a time, and
  // `putModel` is a `set` with NO merge, so a field the read forgot was a
  // field the next replace DELETED; `quality` nearly went that way. The
  // document has since grown a second engine, item metadata and a device
  // ridge, so the projection that cannot drop anything is `snap.data()`.
  // These pin that it stays whole at both ends.
  it("patterns.ts: getModel reads the document whole, not field by field", () => {
    const src = read("patterns.ts");
    const body = between(src, "async getModel(", "async putModel(");
    expect(body, "getModel moved or was renamed — this case is vacuous").not.toBe("");
    expect(body, "getModel went back to a field-by-field projection").toContain("snap.data()");
    expect(body, "a projection of the quality block is the hazard this file exists for").not.toMatch(/quality:\s*snap\.get\("quality"\)/);
  });

  it("patterns.ts: putModel writes the publication whole, with the server clock", () => {
    const src = read("patterns.ts");
    const body = between(src, "async putModel(", "await db.collection(\"v2_meta\")");
    expect(body, "putModel moved or was renamed — this case is vacuous").not.toBe("");
    expect(body).toContain("modelRef.set({ ...dropUndefined(pub), at: FieldValue.serverTimestamp() })");
  });

  // The scan the candidate engine reads people through (D395) projects the
  // same four fields the per-uid read does — a fifth field added to one
  // and not the other is the D197 shape, two copies of one reader.
  it("patterns.ts: scanUsers and getUsers project the same fields", () => {
    const src = read("patterns.ts");
    const get = between(src, "async getUsers(", "return out;");
    const scan = between(src, "async scanUsers(", "if (snap.size < PAGE) break;");
    expect(get).not.toBe("");
    expect(scan).not.toBe("");
    for (const field of ["v", "n", "d", "a"]) {
      expect(get, `getUsers dropped ${field}`).toContain(`get("${field}")`);
      expect(scan, `scanUsers dropped ${field}`).toContain(`get("${field}")`);
    }
  });

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

  it("velocity.ts: the scan maps `fromIdx` onto `isEdit`", () => {
    // The OTHER end, which selecting the field does not give you — the
    // shape ledger.test.ts already asserts for the twin reader ("copies
    // fromIdx out of the snapshot, not just off the wire").
    //
    // Deleting this one line makes every ledger row read as a create
    // again, which is the whole D86 false-positive bug back, and the
    // handler it lives in is executed by no test: the scan body is
    // uncovered end to end.
    const src = read("velocity.ts");
    const body = between(src, "const pageRows: LedgerRow[] = []", "foldInto(fold, pageRows)");
    expect(body, "the scan's page loop moved or was renamed — this case is vacuous").not.toBe("");
    expect(
      body,
      "velocity.ts reads `fromIdx` and never marks the row an edit, so every "
      + "row counts toward a ceiling that is about creates.",
    ).toMatch(/fromIdx[\s\S]{0,80}isEdit:\s*true/);
  });
});
