// Born in this repo (docs/CATALOG-QUESTIONS.md), not ported from a
// standalone — but it follows the spec layer's rules: cross-module
// references resolve through the shared global scope and spec-index.js
// load order is semantic (scripts/check-spec-globals.mjs guards the wiring).

// pick-data.js — the `pick` card's demo store + its feed questions.
// A favourite is one pick from a catalogue of ~1,025 (data/pokedex.ts);
// the reveal is a leaderboard, not a split: top entities above the floor,
// everyone else folded into one honest bucket. The real fold — ties at the
// boundary, complementary suppression — lives in functions/src/pure.ts
// where it is tested; this demo shows the same shape without re-implementing
// the disclosure math on synthetic numbers.
(function () {
  const LS = 'insight.picks.v1';
  let mine = {};
  try { mine = JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { mine = {}; }
  const subs = new Set();

  // Mirrors AGG_MIN_N in functions/src/v2.ts and the top-N cap in
  // docs/CATALOG-QUESTIONS.md.
  const AGG_MIN_N = 5;
  const TOP_N = 10;

  // Baked demo crowd PER QUESTION (keyed by qid, not domain: two questions
  // over the same catalogue are different questions and must not share a
  // reveal), entity → count, so the board is full from day one (the
  // place-stats precedent). Sub-floor entries are here ON PURPOSE: the
  // reveal has to demonstrate the floor's honesty, not dodge it. Key '0' is
  // the "Not listed" bucket — published as a count inside "everyone else",
  // never enumerated.
  const CROWD = {
    pk01: {
      25: 41,  // Pikachu
      6: 38,   // Charizard
      448: 29, // Lucario
      133: 26, // Eevee
      94: 24,  // Gengar
      7: 19,   // Squirtle
      1: 17,   // Bulbasaur
      143: 12, // Snorlax
      778: 9,  // Mimikyu
      658: 7,  // Greninja
      197: 6,  // Umbreon — clears the floor but not the top 10; folds
      359: 5,  // Absol — same
      4: 3,    // Charmander — below the floor
      258: 2,  // Mudkip — below the floor
      0: 4,    // Not listed
    },
    // daily catalog-question run, 2026-07-30 (docs/QUESTION-FARM.md § the
    // daily catalog-question run)
    pk02: {
      94: 34,  // Gengar
      778: 26, // Mimikyu
      491: 18, // Darkrai
      487: 15, // Giratina
      354: 9,  // Banette
      93: 8,   // Haunter
      442: 7,  // Spiritomb
      356: 6,  // Dusclops
      425: 5,  // Drifloon
      635: 5,  // Hydreigon
      200: 3,  // Misdreavus — below the floor
      92: 2,   // Gastly — below the floor
      0: 6,    // Not listed
    },
    // daily catalog-question run, 2026-07-31
    pk03: {
      133: 31, // Eevee
      175: 24, // Togepi
      39: 21,  // Jigglypuff
      25: 17,  // Pikachu — cute AND everyone's favourite; overlap is honest
      393: 14, // Piplup
      258: 11, // Mudkip
      300: 8,  // Skitty
      417: 7,  // Pachirisu
      173: 6,  // Cleffa
      172: 6,  // Pichu
      431: 4,  // Glameow — below the floor
      427: 3,  // Buneary — below the floor
      0: 5,    // Not listed
    },
    // first card of the emoji domain, 2026-07-31 (keys are Unicode
    // codepoints — data/catalogs.ts, build-emoji.mjs)
    pk04: {
      128514: 43, // 😂 face with tears of joy
      10084: 31,  // ❤️ red heart
      128557: 27, // 😭 loudly crying face
      128293: 22, // 🔥 fire
      129315: 18, // 🤣 rolling on the floor laughing
      128525: 14, // 😍 smiling face with heart-eyes
      128128: 12, // 💀 skull
      128077: 10, // 👍 thumbs up
      10024: 8,   // ✨ sparkles
      128591: 7,  // 🙏 folded hands
      129401: 6,  // 🥹 face holding back tears — clears the floor, folds
      128522: 5,  // 😊 smiling face with smiling eyes — same
      127881: 4,  // 🎉 party popper — below the floor
      128173: 2,  // 💭 thought balloon — below the floor
      0: 9,       // Not listed — the ZWJ-combo and flag devotees
    },
  };

  // Baked demo segment slices, per question: how each cohort orders the
  // global board (D17 — segments only ever reorder the published top,
  // never surface their own long tail). Small per-entity counts inside a
  // ≥floor cohort are publishable on purpose: "one of these fourteen
  // picked Gengar" names nobody (the D8 k-argument). Real slices come
  // from anchors folded at answer time; the demo can't know your cohort,
  // so your own pick joins the global board only.
  const BY = {
    pk01: {
      ageBand: {
        '18-24': { 448: 14, 25: 8, 778: 6, 6: 6, 133: 5, 658: 5, 94: 4 },
        '25-34': { 25: 15, 6: 13, 94: 10, 448: 9, 133: 8, 7: 6, 143: 6, 1: 5 },
        '45+': { 25: 12, 6: 11, 1: 9, 7: 8, 133: 6, 143: 5 },
      },
      gender: {
        Women: { 25: 14, 133: 12, 94: 9, 6: 9, 448: 7, 778: 6 },
        Men: { 6: 21, 25: 16, 448: 15, 7: 9, 94: 8, 1: 8, 143: 7 },
      },
    },
    pk02: {
      ageBand: {
        '18-24': { 778: 12, 94: 9, 491: 7, 354: 4, 425: 3 },
        '25-34': { 94: 14, 778: 9, 491: 8, 487: 7, 354: 3 },
      },
      gender: {
        Women: { 778: 14, 94: 10, 354: 5, 425: 4 },
        Men: { 94: 18, 778: 10, 491: 9, 487: 8, 635: 4 },
      },
    },
    pk03: {
      ageBand: {
        '18-24': { 175: 9, 133: 8, 39: 6, 393: 6, 258: 5 },
        '25-34': { 133: 12, 39: 8, 175: 7, 25: 7, 300: 4 },
      },
      gender: {
        Women: { 133: 11, 175: 9, 39: 8, 300: 5, 173: 4 },
        Men: { 133: 9, 258: 8, 25: 7, 393: 6, 172: 4 },
      },
    },
    pk04: {
      ageBand: {
        '18-24': { 128557: 11, 128128: 9, 128514: 8, 129401: 5, 10024: 4 },
        '25-34': { 128514: 15, 10084: 9, 129315: 8, 128293: 7, 128077: 4 },
      },
      gender: {
        Women: { 10084: 12, 128557: 10, 129401: 6, 10024: 6, 128525: 5 },
        Men: { 128514: 16, 129315: 9, 128293: 8, 128128: 7, 128077: 6 },
      },
    },
  };

  const api = {
    AGG_MIN_N,
    my(qid) { const v = mine[qid]; return v == null ? null : v; },
    pick(qid, entity) {
      mine[qid] = entity;
      try { localStorage.setItem(LS, JSON.stringify(mine)); } catch { /* best-effort: private mode, quota */ }
      subs.forEach((f) => f());
    },
    // The published view: top entities above the floor plus the fold. Your
    // own pick joins the counts at read time (the wfPcts convention) — it
    // is your own answer, so no floor applies to your seeing it.
    canon(qid) {
      const counts = { ...(CROWD[qid] || {}) };
      const v = qid != null ? api.my(qid) : null;
      if (v != null) counts[v] = (counts[v] || 0) + 1;
      let total = 0;
      for (const k of Object.keys(counts)) total += counts[k];
      const top = Object.keys(counts)
        .filter((k) => k !== '0')
        .map((k) => ({ entity: Number(k), count: counts[k] }))
        .sort((a, b) => b.count - a.count || a.entity - b.entity)
        .filter((r) => r.count >= AGG_MIN_N)
        .slice(0, TOP_N);
      const shown = top.reduce((a, r) => a + r.count, 0);
      return { top, rest: total - shown, total };
    },
    // The segment chips a question can offer — flattened from its BY data,
    // in the data's own order. Empty when a question ships no slices.
    segs(qid) {
      const by = BY[qid];
      if (!by) return [];
      const out = [];
      for (const dim of Object.keys(by)) {
        for (const bucket of Object.keys(by[dim])) out.push({ dim, bucket });
      }
      return out;
    },
    // One segment's ordering of the global board: rows sorted by the
    // cohort's own counts, plus the cohort size for the "as N of them see
    // it" line. Null when the question has no slice for that segment.
    canonSeg(qid, dim, bucket) {
      const cell = BY[qid] && BY[qid][dim] && BY[qid][dim][bucket];
      if (!cell) return null;
      const rows = Object.keys(cell)
        .map((k) => ({ entity: Number(k), count: cell[k] }))
        .sort((a, b) => b.count - a.count || a.entity - b.entity);
      return { rows, cohort: rows.reduce((a, r) => a + r.count, 0) };
    },
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
  };
  window.PICKS = api;

  // the feed questions — one per COMMITTED catalogue. Films/artists cards
  // land here the day scripts/build-catalog.mjs output is committed (an
  // operator step, D15) — a card whose catalogue is absent would open
  // straight into the picker's error state, which is worse than no card.
  window.PICK_QS = [
    { id: 'pk01', cat: 'games', type: 'pick', domain: 'pokemon', prompt: 'Favourite Pokémon?', n: 242 },
    // 2026-07-30 daily run: a different canon, not a rephrase — fear
    // ranks ghosts; favouritism ranks starters and mascots.
    { id: 'pk02', cat: 'games', type: 'pick', domain: 'pokemon', prompt: 'The scariest Pokémon?', n: 144 },
    // 2026-07-31 daily run: cuteness ranks the small and round — a third
    // canon next to favouritism and fear.
    { id: 'pk03', cat: 'games', type: 'pick', domain: 'pokemon', prompt: 'The cutest Pokémon?', n: 157 },
    // 2026-07-31, first card of the emoji domain — "most-used" beats
    // "favourite" here: it is the question people actually answer about
    // emoji, and their keyboard already knows.
    { id: 'pk04', cat: 'culture', type: 'pick', domain: 'emoji', prompt: 'Your most-used emoji?', n: 218 },
  ];
})();
