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

const raw = readFileSync(resolve(__dirname, "../../../firestore.indexes.json"), "utf8");

const cfg = JSON.parse(raw) as { indexes: Composite[]; fieldOverrides: Override[] };

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
    // D278 adds a fourth clause to the voter query — equality on the
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

  it("live.ts's own-answer delta cursors: answeredAt and editedAt stay unexempted", () => {
    // hydrate() pages the viewer's own answers with `answeredAt >` and
    // `editedAt >` range filters. Both ride the AUTOMATIC single-field
    // index, so what this asserts is the absence of an exemption — adding
    // either field to the override list with `"indexes": []` would break
    // boot's vote hydration, in production only, for every returning user.
    expect(override("answers", "answeredAt")).toBeUndefined();
    expect(override("answers", "editedAt")).toBeUndefined();
  });

  it("engagement.ts rollupPage: engagement.folded keeps its collection-group index", () => {
    // The nightly digest's only query: collectionGroup("engagement")
    // where folded == false, limit. A collection-group query needs its
    // single-field index declared explicitly — automatic indexing is
    // collection-scope — so this override is the whole difference between
    // digestEngagementV2 folding yesterday and throwing FAILED_PRECONDITION
    // at every run, in production only.
    //
    // It shipped in the file and out of the deployment: firestore.indexes.json
    // carried two top-level `fieldOverrides` keys, JSON.parse keeps the last,
    // and the block this override lived in was the discarded one — on every
    // read, firebase deploy included. Nothing else could see it: the file is
    // valid JSON, the emulator does not enforce index configuration (this
    // file's header), and the override reads correctly to anyone opening it.
    // Asserting the entry SURVIVES A PARSE is what a re-duplicated key breaks.
    const o = override("engagement", "folded");
    expect(o, "the engagement.folded override is missing — digestEngagementV2's collectionGroup query fails FAILED_PRECONDITION in production").toBeDefined();
    expect(
      o!.indexes.some((i) => i.queryScope === "COLLECTION_GROUP" && i.order === "ASCENDING"),
      "engagement.folded has no COLLECTION_GROUP ascending index",
    ).toBe(true);
  });

  it("the file declares each top-level key exactly once", () => {
    // NOT a style rule. `JSON.parse` — and firebase-tools with it — keeps
    // the LAST occurrence of a repeated key and discards the rest without
    // a word, so a second `"fieldOverrides"` array does not merge with the
    // first: it replaces it. That is how the engagement override above
    // shipped dead. It was added as a new block at the top of a file that
    // already carried one at the bottom, and every reader here agreed with
    // the deploy that it did not exist.
    //
    // Checked on the TEXT rather than on `cfg`, because by the time a
    // parsed object exists the evidence is already gone — which is the
    // property that let this through eslint, tsc and every case above.
    const seen = new Set<string>();
    const dupes: string[] = [];
    let depth = 0;
    let inStr = false;
    let esc = false;
    let start = -1;
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') {
          inStr = false;
          if (depth === 1 && start >= 0) {
            // A string at depth 1 is a key only if the next non-space char
            // is a colon; anything else is an array element or a value.
            let j = i + 1;
            while (j < raw.length && /\s/.test(raw[j])) j++;
            if (raw[j] === ":") {
              const name = raw.slice(start + 1, i);
              if (seen.has(name)) dupes.push(name);
              seen.add(name);
            }
          }
        }
        continue;
      }
      if (c === '"') { inStr = true; esc = false; start = i; continue; }
      if (c === "{" || c === "[") depth++;
      else if (c === "}" || c === "]") depth--;
    }
    expect(dupes, `firestore.indexes.json declares ${dupes.join(", ")} twice — JSON.parse keeps the last and silently drops the rest, so one of the blocks never deploys`).toEqual([]);
    // And that the two keys the deploy reads are the two that are there —
    // a third top-level key is either a typo firebase-tools ignores or a
    // feature this file does not know it is shipping.
    expect([...seen].sort()).toEqual(["fieldOverrides", "indexes"]);
  });
});
