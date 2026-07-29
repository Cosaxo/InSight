// Ported from design/InSight_standalone_13.html (feed-read.js). THIS file is
// the live source now, hand-edits and all.
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.

// feed-read.js — the feed's memory.
//
// Every answered question logs one bit: did you land with the crowd (and, on
// predict cards, did you call the split). That lets the feed show a running
// strip of your last answers, spot a streak, and name a pattern back to you —
// so votes accumulate into something instead of evaporating.
//
// Everything here is YOUR OWN answers, held in localStorage on your device.
// It reports no one else's behaviour, so it needs no k-anonymity floor and no
// server surface: the honest half of the prototype's "read the room".
//
// `feedInsight()` — "the most surprising split" — now exists, and reads REAL
// data. The prototype's version derived its rows from `hash(qid:dim:bucket)`:
// invented, to make a demo room feel populated, and refused on those grounds.
// What that refusal was waiting for is now built (D9): per-anchor aggregation
// with a k-floor per cell and complementary suppression, published in the
// public mirror as `agg.by`. So the rows are real, and this reads them.
//
// Two things it will not do. It never fabricates — a question with no
// published breakdown returns null and the line simply does not appear,
// rather than falling back to a plausible number. And it has no `friends`
// kind: the prototype's best line is "3 of 5 friends went the other way",
// which is a named who-voted at world scale and exactly what D1 rules out.
(function () {
  const LS = 'insight.readRoom.v1';
  const subs = [];
  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(LS) || '{}');
      return v && typeof v === 'object' ? v : {};
    } catch { return {}; }
  }
  let S = load();
  if (!Array.isArray(S.log)) S.log = [];
  function save() {
    try { localStorage.setItem(LS, JSON.stringify(S)); } catch { /* best-effort: private mode, quota */ }
    subs.forEach((f) => { try { f(); } catch { /* one bad listener must not stop the others */ } });
  }

  window.FEEDREAD = {
    // maj = you were with the majority · pred = you called the winner
    // (null when the card had no predict stage). First write per question
    // wins — answers are immutable server-side (D5), so the memory of one
    // must be too, or the strip and the aggregate could tell different
    // stories about the same vote.
    log(id, rec) {
      if (S.log.some((r) => r.id === id)) return;
      S.log.push({ id, maj: !!rec.maj, pred: rec.pred == null ? null : !!rec.pred });
      // 80 is ~9 strips of history: enough for every streak this reads, and
      // small enough that the JSON stays trivial to parse on every boot.
      if (S.log.length > 80) S.log = S.log.slice(-80);
      save();
    },
    stats() {
      const L = S.log, n = L.length;
      const withMaj = L.filter((r) => r.maj).length;
      let streak = 0, majStreak = 0;
      for (let i = L.length - 1; i >= 0; i--) { if (!L[i].maj) streak++; else break; }
      for (let i = L.length - 1; i >= 0; i--) { if (L[i].maj) majStreak++; else break; }
      const preds = L.filter((r) => r.pred != null);
      return {
        n, withMaj, rate: n ? withMaj / n : 0, streak, majStreak,
        recent: L.slice(-9),
        predN: preds.length, predHit: preds.filter((r) => r.pred).length,
      };
    },
    // a named pattern retires once acknowledged, so the feed cannot nag
    dismissed(k) { return !!(S.seen && S.seen[k]); },
    dismiss(k) { S.seen = S.seen || {}; S.seen[k] = 1; save(); },
    reset() { S = { log: [] }; save(); },
    subscribe(f) {
      subs.push(f);
      return () => { const i = subs.indexOf(f); if (i >= 0) subs.splice(i, 1); };
    },
  };

  // How readable a cut has to be before it is worth a line of its own. A
  // cohort that merely rounds differently from the room is noise; the point
  // of the line is that it cuts AGAINST the overall result.
  const MIN_GAP = 12;

  // The one published cut that disagrees most with the room.
  //
  // Reads only `agg.by`, which the server has already floored per cell with
  // complementary suppression (functions/src/pure.ts) — so anything visible
  // here is publishable by construction, and this adds no disclosure of its
  // own. Returns null for anything it cannot say honestly: a demo card, a
  // question below the floor, a breakdown with nothing surprising in it.
  window.feedInsight = function feedInsight(q) {
    if (!q || !q.live || !q.options || q.options.length < 2) return null;
    const L = window.LIVE;
    const agg = L && L.enabled && L.aggFor ? L.aggFor(q.id) : null;
    const by = agg && agg.by;
    if (!by || agg.tooSmall !== false) return null;

    const counts = q.options.map((o) => o.count || 0);
    const roomTotal = counts.reduce((a, b) => a + b, 0);
    if (!roomTotal) return null;
    const roomPct = counts.map((c) => (c / roomTotal) * 100);
    const roomWin = roomPct.indexOf(Math.max(...roomPct));

    let best = null;
    for (const dim of Object.keys(by)) {
      const buckets = by[dim] || {};
      for (const bucket of Object.keys(buckets)) {
        const cell = buckets[bucket];
        const n = Object.keys(cell).reduce((a, k) => a + cell[k], 0);
        if (!n) continue;
        const pct = q.options.map((_, i) => ((cell[String(i)] || 0) / n) * 100);
        const win = pct.indexOf(Math.max(...pct));
        // a flip — this cohort's winner is not the room's — outranks a lean,
        // however wide the lean is: "X flips to Y" is the more surprising fact
        const flip = win !== roomWin;
        const gap = Math.abs(pct[win] - roomPct[win]);
        if (!flip && gap < MIN_GAP) continue;
        const score = (flip ? 1000 : 0) + gap;
        if (!best || score > best.score) {
          best = { score, dim, group: bucket, kind: flip ? 'flip' : 'lean', sideIdx: win, pct: Math.round(pct[win]) };
        }
      }
    }
    if (!best) return null;
    // City and country are stored canonically ("Oslo, NO", "NO") so one
    // cohort is one key worldwide; they read as names only after PLACES
    // turns them back (D9).
    const P = window.PLACES;
    let label = best.group;
    if (P) {
      if (best.dim === 'country') label = P.countryName(best.group);
      else if (best.dim === 'city') { const pl = P.parse(best.group); if (pl) label = pl.name; }
    }
    return { kind: best.kind, group: label, sideIdx: best.sideIdx, pct: best.pct, dim: best.dim };
  };
})();
