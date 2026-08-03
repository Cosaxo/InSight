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
    // daily catalog-question run, 2026-08-01 — annoyance is its own canon:
    // pk04 ranks what people SEND, this ranks what they roll their eyes
    // at RECEIVING, and the boards disagree from the top down (😂 sits
    // high on both, which is honest — beloved and resented at once).
    pk05: {
      128580: 37, // 🙄 face with rolling eyes
      128514: 29, // 😂 tears of joy — the backlash vote
      128077: 25, // 👍 thumbs up — the passive-aggressive reply
      128169: 21, // 💩 pile of poo
      129313: 17, // 🤡 clown face
      128579: 13, // 🙃 upside-down face
      128175: 11, // 💯 hundred points
      128536: 8,  // 😘 face blowing a kiss
      128521: 7,  // 😉 winking face
      129392: 6,  // 🥰 smiling face with hearts
      10024: 5,   // ✨ sparkles — clears the floor but not the top 10; folds
      129315: 5,  // 🤣 rolling on the floor laughing — same
      128556: 3,  // 😬 grimacing face — below the floor
      129760: 2,  // 🫠 melting face — below the floor
      0: 8,       // Not listed
    },
    // daily catalog-question run, 2026-08-02 — power is the fourth pokemon
    // canon: favouritism ranks mascots, fear ranks ghosts, cuteness ranks
    // the small and round; strength ranks the box legendaries, with
    // Charizard as the honest fan-vote overlap (a favourite people also
    // insist is strong).
    pk06: {
      150: 39, // Mewtwo
      493: 33, // Arceus
      384: 28, // Rayquaza
      890: 14, // Eternatus
      6: 12,   // Charizard — the fan vote
      383: 10, // Groudon
      382: 9,  // Kyogre
      487: 8,  // Giratina
      888: 7,  // Zacian
      149: 6,  // Dragonite — takes the last slot on the entity tie-break
      483: 6,  // Dialga — same count, higher dex; folds
      448: 5,  // Lucario — clears the floor but not the top 10; folds
      445: 3,  // Garchomp — below the floor
      248: 2,  // Tyranitar — below the floor
      0: 7,    // Not listed
    },
    // daily catalog-question run, 2026-08-03 — identity, the fifth pokemon
    // canon: not what you love (pk01) or fear (pk02) but who you ARE.
    // Snorlax and Psyduck lead a board favouritism never produces —
    // self-image runs on naps and mild panic, not on mascots.
    pk07: {
      143: 34, // Snorlax — the nap vote
      54: 27,  // Psyduck — the quietly overwhelmed vote
      133: 24, // Eevee — undecided, all potential
      129: 19, // Magikarp — late bloomer, cope pending
      132: 15, // Ditto — fits in anywhere
      79: 12,  // Slowpoke — gets there eventually
      94: 10,  // Gengar — the menace self-image
      25: 8,   // Pikachu — main-character energy
      6: 7,    // Charizard
      39: 6,   // Jigglypuff — sings anyway
      448: 5,  // Lucario — clears the floor but not the top 10; folds
      202: 5,  // Wobbuffet — same
      7: 3,    // Squirtle — below the floor
      4: 2,    // Charmander — below the floor
      0: 8,    // Not listed
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
    pk05: {
      ageBand: {
        // the 😂 backlash is a young-cohort phenomenon; older cohorts
        // resent the passive-aggressive 👍 more
        '18-24': { 128514: 12, 128077: 9, 128580: 7, 129313: 6, 128175: 4 },
        '25-34': { 128580: 11, 128514: 8, 128169: 7, 128077: 6, 128579: 5 },
      },
      gender: {
        Women: { 128580: 13, 128077: 8, 128514: 7, 128536: 6, 128521: 5 },
        Men: { 128514: 10, 128580: 9, 129313: 9, 128169: 8, 128175: 5 },
      },
    },
    pk06: {
      ageBand: {
        // younger cohorts reach for the newest box legendaries; the
        // older ones hold the Kanto line
        '18-24': { 384: 9, 150: 8, 493: 7, 890: 6, 888: 5 },
        '25-34': { 150: 13, 493: 10, 384: 8, 6: 6, 382: 4 },
      },
      gender: {
        Women: { 150: 9, 493: 8, 384: 6, 6: 5, 487: 4 },
        Men: { 150: 14, 384: 10, 493: 9, 383: 6, 149: 4 },
      },
    },
    pk07: {
      ageBand: {
        // the overwhelmed-Psyduck and Magikarp-cope votes skew young;
        // the settled Snorlax vote grows with age
        '18-24': { 54: 10, 129: 8, 143: 7, 94: 6, 133: 5 },
        '25-34': { 143: 12, 54: 8, 133: 7, 132: 5, 79: 5 },
      },
      gender: {
        Women: { 133: 9, 143: 8, 54: 7, 39: 5, 129: 5 },
        Men: { 143: 11, 94: 7, 129: 7, 6: 6, 25: 5 },
      },
    },
  };

  const api = {
    AGG_MIN_N,
    TOP_N,
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
      // The fold's two honest scalars: how many distinct entries it covers
      // (excluding "Not listed", which is votes rather than an entry) and
      // whether every one of them still sits below the floor. Aggregate
      // properties of the tail, never an enumeration — the UI additionally
      // renders the entity count only when the fold covers at least two
      // entries and stepped down, the same subtraction-leak and
      // delta-disclosure rules the published counts already keep
      // (docs/CATALOG-QUESTIONS.md § the reveal).
      const folded = Object.keys(counts)
        .filter((k) => k !== '0' && !top.some((r) => String(r.entity) === k));
      return {
        top, rest: total - shown, total,
        restEntities: folded.length,
        restBelowFloor: folded.every((k) => counts[k] < AGG_MIN_N),
      };
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
  //
  // cat 'fav', all of them: the v15 revision makes catalogue picks a FORMAT
  // with a channel of their own (world-feed-data.js), replacing this repo's
  // earlier 'games' channel — same guarantee (a pick card is never
  // invisible-by-default), one home instead of a per-subject scatter.
  window.PICK_QS = [
    { id: 'pk01', cat: 'fav', type: 'pick', domain: 'pokemon', prompt: 'Favourite Pokémon?', n: 242 },
    // 2026-07-30 daily run: a different canon, not a rephrase — fear
    // ranks ghosts; favouritism ranks starters and mascots.
    { id: 'pk02', cat: 'fav', type: 'pick', domain: 'pokemon', prompt: 'The scariest Pokémon?', n: 144 },
    // 2026-07-31 daily run: cuteness ranks the small and round — a third
    // canon next to favouritism and fear.
    { id: 'pk03', cat: 'fav', type: 'pick', domain: 'pokemon', prompt: 'The cutest Pokémon?', n: 157 },
    // 2026-07-31, first card of the emoji domain — "most-used" beats
    // "favourite" here: it is the question people actually answer about
    // emoji, and their keyboard already knows.
    { id: 'pk04', cat: 'fav', type: 'pick', domain: 'emoji', prompt: 'Your most-used emoji?', n: 218 },
    // 2026-08-01 daily run: annoyance, not usage — what you send (pk04)
    // and what makes you wince are different questions with different
    // winners.
    { id: 'pk05', cat: 'fav', type: 'pick', domain: 'emoji', prompt: 'The most annoying emoji?', n: 197 },
    // 2026-08-02 daily run: strength, the fourth pokemon canon — a
    // legendary board, not the mascot board favouritism produces.
    { id: 'pk06', cat: 'fav', type: 'pick', domain: 'pokemon', prompt: 'The strongest Pokémon?', n: 189 },
    // 2026-08-03 daily run: identity — who you are, not what you love.
    // Warmer and stranger than a fifth ranking of the same mascots.
    { id: 'pk07', cat: 'fav', type: 'pick', domain: 'pokemon', prompt: 'The Pokémon you’d be?', n: 185 },
  ];
})();
