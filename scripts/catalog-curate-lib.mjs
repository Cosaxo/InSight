// The artists domain's curation rule, as pure functions so it can be
// tested without the network (scripts/catalog-curate-lib.test.mjs).
// scripts/build-catalog.mjs supplies the Wikidata half; this file decides
// what the answers mean.
//
// WHY THIS EXISTS AT ALL. D265 generated the artists catalogue from D15's
// recorded query, measured it, and threw it away: sitelink rank plus a
// P106 music occupation returns a canon of famous people who once touched
// music, not of musicians. Leonardo da Vinci placed 2nd, Goethe 3rd,
// Mother Teresa 20th; ten of the top twenty were wrong. The catalogue was
// mechanically valid and every gate was green, which is the whole lesson.
//
// FOUR RULES WERE MEASURED against the 972 rows that query returns. The
// numbers are D265's and are recorded here because the next person to
// touch this will otherwise re-derive them:
//
//   - require a music GENRE (P136)          → kept 93. A TRAP: 93 is
//     exactly the number of musical groups in the set. Wikidata puts P136
//     on bands and essentially never on people, so this discards Michael
//     Jackson, Beethoven, Bach, Elvis, Madonna and Beyoncé while its top
//     25 reads as 25 real bands. Precision hiding a total recall failure —
//     do not reach for it again.
//   - a recording-artist property           → kept 766/971, and still
//     seats Chaplin 3rd: he scored his own films, so the signal is TRUE
//     of him.
//   - majority of occupations musical       → clean head, but drops
//     Wagner, Tchaikovsky, Dylan, Lennon, Sinatra, Whitney Houston.
//   - the same at a third, music occupations widened → what ships below.
//
// THE ROOT CAUSE, because it decides the shape rather than the constant:
// P106 records what someone DID, not what they are KNOWN FOR, and the
// list grows with fame — Goethe carries 40 occupations, Leonardo 30. So
// every ratio punishes exactly the people a popularity-ranked catalogue
// most wants, and no threshold escapes it. Wikidata does not state
// "famous FOR music" in any property, so the last few are a human's call,
// which is what content/artist-review.json is for. The prefilter's job is
// to make that call a bounded one — roughly eight corrections in the top
// 150 rather than fifty.

/** Occupation roots. An occupation counts as musical when it is one of
 *  these or a P279* subclass of one.
 *
 *  Songwriter and conductor are listed and were not in D15's query, but
 *  MEASURED 2026-08-23 they change nothing: the closure is 14 ids either
 *  way, because Wikidata already makes both subclasses of musician. They
 *  stay because the rule should not silently narrow if that edge ever
 *  moves — not because they rescued anyone. An earlier draft of this
 *  comment claimed they pulled Wagner and Dylan over the line; running
 *  the closure both ways showed Wagner unmoved at 3/11 and Dylan
 *  unmoved at 8/22. The threshold below is what actually moved. */
export const MUSIC_OCC_SEEDS = Object.freeze([
  639669,   // musician
  177220,   // singer
  36834,    // composer
  2252262,  // rapper
  488205,   // singer-songwriter
  753110,   // songwriter   — redundant today, see above
  158852,   // conductor    — redundant today, see above
]);

/** The share of an entry's occupations that are musical. A third, not a
 *  majority, and the difference is six canonical answers: at 0.5 the rule
 *  drops Tchaikovsky (4/11), Bob Dylan (8/22), John Lennon (9/22),
 *  Whitney Houston (4/9), Berlioz (3/9) and Schumann (4/9), every one of
 *  whom a third keeps.
 *
 *  Lowering it further does not finish the job and should not be tried as
 *  if it might: Wagner (3/11) and Sinatra (2/10) sit under a third too,
 *  and the thresholds that would catch them re-admit Chaplin (3/15) and
 *  Marilyn Monroe (2/8). That crossing is the whole reason
 *  content/artist-review.json exists — the last few names are not a
 *  constant, they are a judgement. */
export const MUSIC_RATIO_MIN = 1 / 3;

/** Musical occupations over total, as a pair so callers can log the
 *  fraction that produced a decision — every drop this rule makes is one
 *  a human may later want to argue with, and "[3/11]" is the argument. */
export function musicShare(occ, musicOcc) {
  const all = [...(occ || [])];
  return { music: all.filter((o) => musicOcc.has(o)).length, total: all.length };
}

/** Does this candidate belong in a "favourite music artist" catalogue?
 *
 *  Musical GROUPS bypass the ratio entirely: a band's P106 is usually
 *  empty (it is not a person), so a ratio over nothing would reject The
 *  Beatles. `isGroup` is the P31 Q215380 half of D15's own query — the
 *  half that never needed filtering. */
export function keepsAsArtist(row, musicOcc, min = MUSIC_RATIO_MIN) {
  if (row.isGroup) return true;
  const { music, total } = musicShare(row.occ, musicOcc);
  return total > 0 && music / total >= min;
}

/** Read content/artist-review.json into two maps, collecting every
 *  complaint rather than throwing on the first: a reviewer fixing this
 *  file wants the whole list, and the file is edited by hand by design. */
export function parseReview(raw) {
  const errors = [];
  const reject = new Map();
  const admit = new Map();
  const seen = new Map();
  for (const side of ["reject", "admit"]) {
    const list = raw?.[side];
    if (list === undefined) continue;
    if (!Array.isArray(list)) {
      errors.push(`${side}: must be an array`);
      continue;
    }
    for (let i = 0; i < list.length; i++) {
      const at = `${side}[${i}]`;
      const e = list[i];
      if (!e || typeof e !== "object") {
        errors.push(`${at}: must be an object`);
        continue;
      }
      if (!Number.isInteger(e.qid) || e.qid < 1) {
        errors.push(`${at}: qid must be a positive integer (the numeric part of Q…, so 1511 for Q1511)`);
        continue;
      }
      if (typeof e.name !== "string" || !e.name.trim()) {
        errors.push(`${at} (Q${e.qid}): name is required — it is what makes the entry auditable`);
        continue;
      }
      // A rejection is a claim about a person, so it carries its reason.
      // An admission does not: "this is a musician" is the whole reason,
      // and the name says it.
      if (side === "reject" && (typeof e.why !== "string" || !e.why.trim())) {
        errors.push(`${at} (${e.name}): why is required — a rejection nobody can audit is a rejection nobody can reverse`);
        continue;
      }
      const prior = seen.get(e.qid);
      if (prior) {
        errors.push(`${at} (${e.name}): Q${e.qid} is already in ${prior}`);
        continue;
      }
      seen.set(e.qid, at);
      (side === "reject" ? reject : admit).set(e.qid, e);
    }
  }
  return { reject, admit, errors };
}

/** Apply the reviewed exceptions to the prefilter's output.
 *
 *  `pool` is every candidate the query returned, BEFORE the prefilter —
 *  an admission has to come from somewhere, and it comes from there. That
 *  is the property that keeps this file inside the repo's
 *  never-from-model-memory rule (QUESTION-FARM.md): no key here is typed
 *  from anyone's memory, each one is a key the generator itself produced,
 *  so a review entry can omit a person or restore one but can never mint
 *  a key that resolves to the wrong entity.
 *
 *  Staleness is reported, never silently tolerated: a refresh that drops
 *  someone out of the candidate pool leaves an exception pointing at
 *  nothing, and an unreadable exception list is how this rule rots. */
export function applyReview(kept, pool, review) {
  const byKey = new Map(pool.map((r) => [r.key, r]));
  const keptKeys = new Set(kept.map((r) => r.key));

  const stale = [];        // in the review, not a candidate at all
  const redundant = [];    // rejected, but the prefilter had already dropped it
  const rejected = [];
  const admitted = [];

  for (const [qid, entry] of review.reject) {
    if (!byKey.has(qid)) { stale.push({ side: "reject", ...entry }); continue; }
    if (!keptKeys.has(qid)) { redundant.push(entry); continue; }
    rejected.push(entry);
  }
  for (const [qid, entry] of review.admit) {
    if (!byKey.has(qid)) { stale.push({ side: "admit", ...entry }); continue; }
    if (keptKeys.has(qid)) { redundant.push({ ...entry, side: "admit" }); continue; }
    admitted.push(entry);
  }

  const out = kept.filter((r) => !review.reject.has(r.key));
  for (const e of admitted) out.push(byKey.get(e.qid));
  // Popularity order, ties by key — the same total order the builder
  // writes, so an admitted row lands where its sitelinks put it rather
  // than at the end.
  out.sort((a, b) => b.links - a.links || a.key - b.key);

  return { rows: out, rejected, admitted, stale, redundant };
}
