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
