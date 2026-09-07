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

  it("circle.ts fetchAnswersOf: the (surface, answeredAt DESC) COLLECTION-scope composite exists (D398)", () => {
    // The query gained `orderBy("answeredAt", "desc")` at D398 so the
    // 300-cap keeps a member's newest answers instead of their
    // alphabetically-first question ids. An `in` filter ordered by another
    // field needs a composite at the query's own scope — COLLECTION, not
    // COLLECTION_GROUP: the voter sheet's group-scope composites do not
    // serve a single-collection query, and the failure is the header's
    // (FAILED_PRECONDITION in production only, swallowed per member into
    // an emptier stop).
    const hit = cfg.indexes.find(
      (ix) =>
        ix.collectionGroup === "answers"
        && ix.queryScope === "COLLECTION"
        && JSON.stringify(ix.fields) === JSON.stringify([
          { fieldPath: "surface", order: "ASCENDING" },
          { fieldPath: "answeredAt", order: "DESCENDING" },
        ]),
    );
    expect(hit, "the answers (surface, answeredAt DESC) COLLECTION-scope composite is missing or reshaped — fetchAnswersOf's orderBy has no index").toBeDefined();
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

  it("live.ts's bought-question boot query has its (paid, until) composite", () => {
    // D313's questions are written into the bank at runtime, so no
    // published order can carry them (rankBankV2 builds from the compiled
    // bank) and the two other boot queries do not reach them — they are
    // not a boot surface and they are not core. The third boot query is
    // their whole route to a device, and it pairs an equality with an
    // inequality, which needs a composite.
    //
    // Missing, this fails FAILED_PRECONDITION in production and NOWHERE
    // else: the emulator creates composites on demand, so the unit suite,
    // the rules tests and the e2e all pass without it — and the symptom
    // is the one this index exists to end, a paid question reaching
    // nobody.
    const hit = cfg.indexes.find((ix) =>
      ix.collectionGroup === "v2_questions"
      && ix.queryScope === "COLLECTION"
      && JSON.stringify(ix.fields) === JSON.stringify([
        { fieldPath: "paid", order: "ASCENDING" },
        { fieldPath: "until", order: "ASCENDING" },
      ]),
    );
    expect(hit, "the v2_questions (paid, until) composite is missing or reshaped — bought questions reach nobody").toBeDefined();
  });

  it("engagement.ts rollupPage: the (folded, day) collection-group composite exists", () => {
    // rollupPage orders by `day` so the nightly queue is FIFO. Without an
    // orderBy Firestore falls back to `__name__`, which for this group is
    // `v2_users/{uid}/engagement/{day}` — uid-major, so above the cap the
    // same low-sorting accounts are taken every night and the rest starve.
    //
    // The single-field `folded` override does not cover a query that also
    // orders on another field, and the emulator does not enforce index
    // configuration — so a missing composite fails in PRODUCTION ONLY,
    // with FAILED_PRECONDITION, on a scheduled function nobody is watching.
    // This assertion is the only thing standing between that and a silent
    // nightly outage.
    const hit = cfg.indexes.find(
      (ix) =>
        ix.collectionGroup === "engagement"
        && ix.queryScope === "COLLECTION_GROUP"
        && JSON.stringify(ix.fields) === JSON.stringify([
          { fieldPath: "folded", order: "ASCENDING" },
          { fieldPath: "day", order: "ASCENDING" },
        ]),
    );
    expect(hit, "the engagement (folded, day) collection-group composite is missing or reshaped — rollupPage fails FAILED_PRECONDITION in production").toBeDefined();
  });

  it("engagement.ts rollupPage: …and the query still ASKS for that order", () => {
    // The other end of the same claim. The case above says the index
    // exists; its own comment calls itself "the only thing standing
    // between that and a silent nightly outage", and it is not — it reads
    // the JSON only. Delete the `.orderBy("day")` from the query and the
    // starvation the comment describes comes straight back while the now
    // unused index sits in the file and every test stays green.
    //
    // Read off the source, the way check-anchors reads BREAKDOWN_DIMS out
    // of pure.ts: the query is inside `firestoreEngagementStore`, behind
    // an interface every unit test replaces, so nothing that runs can
    // reach it. A parse that finds nothing is an error rather than an
    // empty pass, which is what the first two assertions are for.
    const src = readFileSync(resolve(__dirname, "../../../functions/src/engagement.ts"), "utf8");
    const call = src.slice(src.indexOf('db.collectionGroup("engagement")'));
    expect(call, "rollupPage's collection-group query is gone or renamed — this case is now vacuous").not.toBe("");
    const query = call.slice(0, call.indexOf(".get()"));
    expect(query, "the query no longer filters on `folded`").toContain('.where("folded", "==", false)');
    expect(
      query,
      "rollupPage stopped ordering by `day`. Firestore then falls back to "
      + "`__name__`, which for this group is uid-major, so above the fold "
      + "cap the same low-sorting accounts are taken every night and the "
      + "rest die unfolded at the 90-day TTL — with the composite index "
      + "still declared and nothing red.",
    ).toContain('.orderBy("day")');
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

  // deleteAccount's cross-user sweeps, as ONE case, because they share one
  // failure and it is the worst one in this file.
  //
  // Phases 3–4 of deleteAccount reach documents that live under OTHER
  // people's subtrees — an invitation this account sent sits in a
  // stranger's inbox and carries this account's display name — so each is
  // a collection-group query filtered on a uid field, with no ordering.
  // A collection-group query needs its single-field index declared
  // EXPLICITLY: automatic indexing is collection-scope only, so the
  // absence of a line here is FAILED_PRECONDITION on that sweep.
  //
  // And a sweep that throws is not a partial erasure. Every failure is
  // pushed onto `failed[]`, and a non-empty `failed[]` throws BEFORE
  // getAuth().deleteUser — deliberately, so nothing is orphaned behind a
  // deleted auth user. The consequence is that ONE missing line here means
  // NOBODY CAN DELETE THEIR ACCOUNT, ever, and the message they get is
  // "nothing was lost, please retry" on every attempt.
  //
  // `invites` was the line that was missing. The file declared the two
  // composites `(to, at DESC)` and `(from, at DESC)` — added for the
  // client's inbox, which orders by `at` — and a commit message reasoned
  // that a composite covers the filter-only query "as a prefix". A
  // composite ending `at DESC` carries an implicit trailing `__name__
  // DESC`, and a filter-only query's implicit ordering is `__name__ ASC`,
  // so the prefix argument is at best unproven. It cannot be settled from
  // here — this file's header says why: the emulator does not enforce
  // index configuration, so every local suite is green either way, and
  // only production can answer it.
  //
  // The fix does not need the answer. Declaring the two single-field
  // overrides makes the query served whichever way the composite question
  // resolves, matches what every OTHER sweep in this list already has, and
  // costs one index entry per invite on a collection that holds unanswered
  // invitations. Cheap to add, and the thing it insures against is total.
  // ── the five server-side composites nothing pinned ──────────────────
  //
  // Every composite above backs a query in `src/v2/data`, which is what
  // this file grew up watching. Five more back queries in `functions/src`
  // and one in the takes path, and each of them could be DELETED from the
  // config with every runner in the repository green — measured. The
  // emulator never enforces index configuration, so no suite can see it;
  // the first symptom is production-only, and in four of the five cases it
  // is a whole surface that quietly returns nothing.
  //
  // A helper rather than six copies: the assertion is the same each time —
  // a composite exists at the right scope whose fields are the query's
  // filters and order, in order.
  const composite = (group: string, scope: string, want: Array<[string, string]>) =>
    cfg.indexes.find((i) => i.collectionGroup === group
      && i.queryScope === scope
      && i.fields.length === want.length
      && i.fields.every((f, n) => f.fieldPath === want[n][0] && f.order === want[n][1]));

  it("live.ts loadTakes: both takes threads have their composite", () => {
    // The world thread filters gid, qid and hidden and orders by createdAt
    // desc; a circle's filters gid and hidden and orders the same way.
    // Without either index the thread is empty in production and the
    // catch below it leaves the key absent, so the reader sees no takes and
    // no error.
    expect(
      composite("v2_takes", "COLLECTION",
        [["gid", "ASCENDING"], ["qid", "ASCENDING"], ["hidden", "ASCENDING"], ["createdAt", "DESCENDING"]]),
      "the world takes thread has no (gid, qid, hidden, createdAt DESC) composite",
    ).toBeDefined();
    expect(
      composite("v2_takes", "COLLECTION",
        [["gid", "ASCENDING"], ["hidden", "ASCENDING"], ["createdAt", "DESCENDING"]]),
      "a circle's takes thread has no (gid, hidden, createdAt DESC) composite",
    ).toBeDefined();
  });

  it("v2social.ts nearbyCount/nearbyRoom: presence has its (cell, until) composite", () => {
    // `where cell in [...] where until > now`, as a count() and twice more
    // for the mix and the roster. All three die together without it, so
    // Near reports nobody rather than reporting a failure.
    expect(
      composite("v2_presence", "COLLECTION", [["cell", "ASCENDING"], ["until", "ASCENDING"]]),
      "presence has no (cell, until) composite — Near's count, mix and roster all fail",
    ).toBeDefined();
  });

  it("paid.ts's review sweep has its (status, createdAt) composite", () => {
    // The 30-minute sweep pages bookings still in review past a cutoff. It
    // is the only thing that moves a booking a human never got to, so its
    // silent death is a buyer waiting forever on a decision.
    expect(
      composite("v2_paid_bookings", "COLLECTION", [["status", "ASCENDING"], ["createdAt", "ASCENDING"]]),
      "the paid review sweep has no (status, createdAt) composite",
    ).toBeDefined();
  });

  it("suggestions.ts's review board has its (status, at) composite", () => {
    expect(
      composite("v2_suggestions", "COLLECTION", [["status", "ASCENDING"], ["at", "ASCENDING"]]),
      "the suggestion review board has no (status, at) composite",
    ).toBeDefined();
  });

  it("replay.ts's aggregate rebuild has its (qid, answeredAt ASC) composite", () => {
    // The rebuild walks every answer to one question in write order. It is
    // the repair tool for a fold that went wrong, which is exactly when
    // nobody wants to discover the index is missing.
    expect(
      composite("answers", "COLLECTION_GROUP", [["qid", "ASCENDING"], ["answeredAt", "ASCENDING"]]),
      "the aggregate rebuild has no (qid, answeredAt ASC) collection-group composite",
    ).toBeDefined();
  });

  it("carries no composite for a query nobody makes: invites (from, at)", () => {
    // The file declared BOTH `(to, at DESC)` and `(from, at DESC)`, added
    // together for the client's inbox. Only the first is a query: the
    // inbox is `where("to","==",me), orderBy("at","desc")`
    // (data/socialFetch.ts). The only `from` query in the tree is
    // deleteAccount's erasure sweep (functions/src/index.ts), which has no
    // `orderBy` at all and is served by the single-field override pinned
    // in the case below.
    //
    // So `(from, at DESC)` served nothing and cost an index entry on every
    // invitation written. Removed — and asserted absent, so bringing it
    // back is a decision rather than a copy of its neighbour. The day a
    // real `from` + `orderBy("at")` query appears, this case is the one
    // that has to be edited, which is the point.
    const dead = cfg.indexes.filter((ix) =>
      ix.collectionGroup === "invites"
      && ix.fields.map((f) => f.fieldPath).join(",") === "from,at");
    expect(dead, "invites (from, at) is back — which query orders invites by sender?")
      .toHaveLength(0);
    // The one that IS a query, so this case cannot pass by the whole
    // collection group having been dropped.
    const live = cfg.indexes.filter((ix) =>
      ix.collectionGroup === "invites"
      && ix.fields.map((f) => f.fieldPath).join(",") === "to,at");
    expect(live, "the inbox's own (to, at DESC) composite went with it").toHaveLength(1);
  });

  it("deleteAccount's cross-user sweeps each have their collection-group index", () => {
    const sweeps: Array<[string, string, "order" | "arrayConfig", string]> = [
      // functions/src/index.ts phase 3c — both directions of a circle
      // invitation (D122).
      ["invites", "to", "order", "ASCENDING"],
      ["invites", "from", "order", "ASCENDING"],
      // phase 3b — inbound follows sitting in other people's circles.
      // Also pinned above for circle.ts's own read; kept here because the
      // reason differs and either one going missing is this failure.
      ["following", "to", "order", "ASCENDING"],
      // phase 4 — v1 relations pointing back at this uid.
      ["relations", "linkedUid", "order", "ASCENDING"],
      // phase 3a — v1 impressions this account sent.
      ["insight_inbound_impressions", "senderUid", "order", "ASCENDING"],
      // phase 2 — reveal documents this account is a member of.
      ["reveals", "members", "arrayConfig", "CONTAINS"],
      // phase 2b — reveal documents this account is NAMED IN BY SOMEONE
      // ELSE'S PICK. Its own sibling, added by the same fix and walked by
      // the same phase, and it was missing from this list: dropping the
      // override left every runner green (measured — 12/12 here, and the
      // unit, functions and scripts suites too), while deleteAccount's
      // second pass would throw FAILED_PRECONDITION in production. The
      // failure this case's message describes is not hypothetical for
      // this one: it is the pass that removes an erased person's uid from
      // reveals where only a groupmate's pick names them, and
      // `web/privacy.html` promises that removal in writing.
      ["reveals", "pickedUids", "arrayConfig", "CONTAINS"],
    ];
    for (const [group, field, kind, want] of sweeps) {
      const o = override(group, field);
      expect(
        o,
        `${group}.${field} has no fieldOverride at all — deleteAccount's `
        + `sweep over it throws FAILED_PRECONDITION in production, and a `
        + `failed sweep aborts before the auth delete, so NO account can `
        + `be deleted until it is restored.`,
      ).toBeDefined();
      expect(
        o!.indexes.some((i) => i.queryScope === "COLLECTION_GROUP" && i[kind] === want),
        `${group}.${field} has no COLLECTION_GROUP ${want} index`,
      ).toBe(true);
    }
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
