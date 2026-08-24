// The client's query shapes, held to firestore.indexes.json.
//
// WHY THIS EXISTS. D101's Circle shipped `fetchAnswersOf` — a
// collection-scope query filtering answers on `surface` — while
// firestore.indexes.json still carried D64's exemption deleting every
// single-field index on that exact field (`"indexes": []`). In production
// that is FAILED_PRECONDITION on every member fetch; loadCircle swallows
// it per member (`.catch(() => null)`) and the stop renders "you follow
// nobody" to someone with thirty follows. Every suite stayed green,
// because the emulator does not enforce index configuration — rules tests,
// e2e, everything runs as if all indexes exist. D64 predicted the failure
// by name ("filtering answers by `surface` … will not be possible without
// re-enabling that field first"); D101 never mentioned indexes.
//
// So this file is the missing compiler between two artifacts that only
// meet in production: the queries data/ modules issue, and the index file
// the deploy ships. It cannot prove a query runs — only production
// Firestore can — but it can prove the KNOWN shapes have their entries,
// and fail the moment someone re-exempts a field a query depends on or
// edits a query away from its index. Every case names the module whose
// query it pins; a new filtered query in data/ should add a case here.
//
// (Single-field indexes are automatic UNLESS exempted, so for fields like
// `answeredAt` the thing to assert is the absence of an exemption.)

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface FieldIndex { queryScope: string; order?: string; arrayConfig?: string }
interface Composite { collectionGroup: string; queryScope: string; fields: Array<{ fieldPath: string; order: string }> }
interface Override { collectionGroup: string; fieldPath: string; indexes: FieldIndex[] }

const cfg = JSON.parse(
  readFileSync(resolve(__dirname, "../../../firestore.indexes.json"), "utf8"),
) as { indexes: Composite[]; fieldOverrides: Override[] };

const override = (group: string, field: string): Override | undefined =>
  cfg.fieldOverrides.find((o) => o.collectionGroup === group && o.fieldPath === field);

describe("firestore.indexes.json vs the data layer's query shapes", () => {
  it("circle.ts fetchAnswersOf: answers.surface keeps a COLLECTION-scope index", () => {
    // The query: collection(v2_users/{uid}/answers), where surface in [...],
    // limit — needs the single-field index on `surface` at collection
    // scope. The D64 exemption must therefore carry a re-enable entry, not
    // an empty list. (The `where` itself is not optional: the rules grant
    // the cross-user read as a value test on `surface`, so dropping the
    // filter to dodge the index is refused wholesale — D65.)
    const o = override("answers", "surface");
    expect(o, "the answers.surface override vanished — if the exemption was removed entirely, automatic indexing covers this and this case can be inverted").toBeDefined();
    expect(
      o!.indexes.some((i) => i.queryScope === "COLLECTION" && i.order === "ASCENDING"),
      "answers.surface has no COLLECTION-scope ascending index. Circle's "
      + "fetchAnswersOf fails FAILED_PRECONDITION in production (and only "
      + "production — the emulator does not enforce index config), and "
      + "loadCircle swallows the error into an empty stop.",
    ).toBe(true);
  });

  it("voters.ts fetchVoters: the collection-group composite exists, fields in query order", () => {
    // where qid ==, where surface in, orderBy answeredAt desc, at
    // COLLECTION_GROUP scope. Equality fields first, the orderBy field
    // last-and-descending — reordering any of these breaks the named
    // who-voted sheet in production only.
    const hit = cfg.indexes.find(
      (ix) =>
        ix.collectionGroup === "answers"
        && ix.queryScope === "COLLECTION_GROUP"
        && JSON.stringify(ix.fields) === JSON.stringify([
          { fieldPath: "qid", order: "ASCENDING" },
          { fieldPath: "surface", order: "ASCENDING" },
          { fieldPath: "answeredAt", order: "DESCENDING" },
        ]),
    );
    expect(hit, "the answers (qid, surface, answeredAt DESC) collection-group composite is missing or reshaped").toBeDefined();
  });

  it("circle.ts fetchFollowersOf: following.to keeps its collection-group index", () => {
    // One collection-group query on `to` serves both the mutual flag and
    // deleteAccount's erasure sweep — losing it breaks the second one
    // silently, which is the worse half.
    const o = override("following", "to");
    expect(o).toBeDefined();
    expect(o!.indexes.some((i) => i.queryScope === "COLLECTION_GROUP" && i.order === "ASCENDING")).toBe(true);
  });

  it("voters.ts fetchVoters(city): the city-scoped narrowing has its composite", () => {
    // D276 adds a fourth clause to the voter query — equality on the
    // frozen `anchors.city` — so it needs its own composite. Without it
    // the query is FAILED_PRECONDITION in production and nowhere else:
    // this file's header records why (the emulator does not enforce index
    // configuration, so rules tests and e2e both pass regardless).
    //
    // Note the single-field EXEMPTION on anchors.city stays (D64 removed
    // fourteen indexes nobody queried, and this does not put them back).
    // A composite is declared explicitly and is not affected by a
    // single-field exemption — which is the documented behaviour, not
    // something these tests can prove, so the deploy is where it is
    // confirmed.
    const hit = cfg.indexes.find((ix) =>
      ix.collectionGroup === "answers"
      && ix.queryScope === "COLLECTION_GROUP"
      && JSON.stringify(ix.fields) === JSON.stringify([
        { fieldPath: "qid", order: "ASCENDING" },
        { fieldPath: "surface", order: "ASCENDING" },
        { fieldPath: "anchors.city", order: "ASCENDING" },
        { fieldPath: "answeredAt", order: "DESCENDING" },
      ]),
    );
    expect(hit, "the answers (qid, surface, anchors.city, answeredAt DESC) composite is missing or reshaped").toBeDefined();
    // The unscoped query still has to work — this is an ADDITIONAL shape,
    // because the People lens ranks strangers from anywhere.
    expect(cfg.indexes.some((ix) =>
      ix.collectionGroup === "answers"
      && JSON.stringify(ix.fields) === JSON.stringify([
        { fieldPath: "qid", order: "ASCENDING" },
        { fieldPath: "surface", order: "ASCENDING" },
        { fieldPath: "answeredAt", order: "DESCENDING" },
      ]),
    )).toBe(true);
  });

  it("engagement.ts rollupPage: engagement.folded keeps its collection-group index", () => {
    // This one was in the file and NOT in the deployment. firestore.indexes.json
    // carried two top-level "fieldOverrides" keys; JSON.parse keeps the last,
    // so the first block — whose only entry was this override — was discarded
    // on every read, including by firebase deploy. rollupPage's
    // collectionGroup("engagement").where("folded","==",false) has therefore
    // been querying an index that does not exist.
    //
    // A duplicate key is invisible to every other gate: the file is valid
    // JSON, the emulator does not enforce index configuration (see this
    // file's header), and the override reads correctly to anyone opening it.
    // The cheapest durable guard is to assert the entry SURVIVES A PARSE,
    // which is precisely what a re-duplicated key would break.
    const o = override("engagement", "folded");
    expect(o, "engagement.folded override is missing from the PARSED config — check for a duplicate top-level key").toBeDefined();
    expect(o!.indexes.some((i) => i.queryScope === "COLLECTION_GROUP" && i.order === "ASCENDING")).toBe(true);
  });

  it("firestore.indexes.json declares each top-level key exactly once", () => {
    // The general form of the bug above. JSON.parse silently keeps the LAST
    // of a duplicated key, so a second "indexes" or "fieldOverrides" block
    // deletes the first one's entire contents with no error anywhere — not
    // from the parser, not from the emulator, not from firebase deploy.
    //
    // Depth-aware rather than a line regex: "indexes" is also a key INSIDE
    // every fieldOverride, so matching it anywhere counts 21 and proves
    // nothing. Only depth 1 is a top-level declaration.
    const raw = readFileSync(resolve(__dirname, "../../../firestore.indexes.json"), "utf8");
    const seen: string[] = [];
    let depth = 0;
    let inStr = false;
    let esc = false;
    let start = 0;
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') {
          inStr = false;
          // A string that closes at depth 1 and is followed by a colon is
          // a top-level key.
          if (depth === 1) {
            const rest = raw.slice(i + 1).match(/^\s*:/);
            if (rest) seen.push(raw.slice(start + 1, i));
          }
        }
        continue;
      }
      if (c === '"') { inStr = true; esc = false; start = i; continue; }
      if (c === "{" || c === "[") depth++;
      else if (c === "}" || c === "]") depth--;
    }
    const dupes = seen.filter((k, i) => seen.indexOf(k) !== i);
    expect(dupes, `duplicated top-level key(s) in firestore.indexes.json: ${dupes.join(", ")} — JSON.parse keeps only the last`).toEqual([]);
    expect(seen.sort()).toEqual(["fieldOverrides", "indexes"]);
  });

  it("live.ts's own-answer delta cursors: answeredAt and editedAt stay unexempted", () => {
    // hydrate() pages the viewer's own answers with `answeredAt >` and
    // `editedAt >` range filters. Both ride the AUTOMATIC single-field
    // index, so what this asserts is the absence of an exemption — adding
    // either field to the override list with `"indexes": []` would break
    // boot's vote hydration, in production only, for every returning user.
    expect(override("answers", "answeredAt")).toBeUndefined();
    expect(override("answers", "editedAt")).toBeUndefined();
  });
});
