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

  // Baked demo crowd, dex → count, so the reveal is full from day one (the
  // place-stats precedent). Sub-floor entries are here ON PURPOSE: the
  // reveal has to demonstrate the floor's honesty, not dodge it. Key '0' is
  // the "Not listed" bucket — published as a count inside "everyone else",
  // never enumerated.
  const CROWD = {
    pokemon: {
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
    canon(domain, qid) {
      const counts = { ...(CROWD[domain] || {}) };
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
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
  };
  window.PICKS = api;

  // the feed question — one pilot domain (docs/CATALOG-QUESTIONS.md step 2)
  window.PICK_QS = [
    { id: 'pk01', cat: 'games', type: 'pick', domain: 'pokemon', prompt: 'Favourite Pokémon?', n: 242 },
  ];
})();
