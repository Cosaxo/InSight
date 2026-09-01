// Ported from design/InSight_standalone_13.html (feed-read.js). THIS file is
// the live source now, hand-edits and all.
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import { sharePcts } from '../data/pct';
// The store (D345): `feedInsight` below reads the aggregate through it at
// call time. Imported rather than `window.LIVE` — the load-order guard
// that read carried is unreachable on an import.
import LIVE from '../data/live';
import PLACES from '../data/places';

// feed-read.js — the feed's memory.
//
// Every answered question logs one bit: did you land with the crowd — the
// sparse Mirror uses the count to know how well the feed has read you.
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
// Hoisted `export let`, assigned inside the IIFE — the shape DAILYQ,
// FRIENDS, PICKS and PLACESTATS were converted with (D249). The FEEDREAD
// mirror stays for app-shell.jsx and mirror-field-pops.jsx; `feedInsight`
// has no mirror because world-feed.jsx was its only reader.
export let FEEDREAD;
export let feedInsight;

(function () {
  const LS = 'insight.readRoom.v1';
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
  }

  FEEDREAD = {
    // maj = you were with the majority. First write per question wins —
    // answers are immutable server-side (D5), so the memory of one must be
    // too, or the strip and the aggregate could tell different stories
    // about the same vote.
    log(id, rec) {
      if (S.log.some((r) => r.id === id)) return;
      S.log.push({ id, maj: !!rec.maj });
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
      return { n, withMaj, rate: n ? withMaj / n : 0, streak, majStreak, recent: L.slice(-9) };
    },
    reset() { S = { log: [] }; save(); },
  };
  // The purge (data/live.ts, D51): the key is already gone; drop the
  // in-memory copy too, or the next log()'s save() writes the previous
  // account's read-room history back under the new uid. No save() — that
  // would re-create the key the purge just removed.
  window.addEventListener('insight:local-purge', () => { S = { log: [] }; });

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
  //
  // `mine` is the viewer's own option index, third in the demo signature
  // the call site still uses (`feedInsight(q, counts, mine, …)`) and the
  // one demo argument this live implementation cannot ignore. Reason
  // below, where the room baseline is built.
  feedInsight = function feedInsightImpl(q, _counts, mine) {
    if (!q || !q.live || !q.options || q.options.length < 2) return null;
    const agg = LIVE.enabled ? LIVE.aggFor(q.id) : null;
    const by = agg && agg.by;
    if (!by) return null;

    // THE VIEWER'S OWN VOTE GOES BACK IN, because the room this line talks
    // about has to be the room the card above it drew. `o.count` comes from
    // `countsFor` (data/deck.ts), which SUBTRACTS the viewer's vote once the
    // trigger has folded it — the UI layer adds its own +1. So the card
    // renders `wfPcts(counts, mine)`, which puts it back, and the cohort
    // cells in `agg.by` contain it too. Without this line the baseline was
    // the only population on the screen that nobody was counted in, and it
    // decided both `roomWin` and `gap`.
    //
    // What that produced: whenever your own vote made or changed the
    // leader — routine at the counts a question has in its first hours —
    // the line under the card announced that a cohort "flips it" to the
    // option the card was already showing as the winner. The third site of
    // this same +1 mismatch; the other two are recorded at
    // world-feed.jsx's answers-sheet total and daily-split's.
    const counts = q.options.map((o, i) => (o.count || 0) + (mine === i ? 1 : 0));
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
        const cellCounts = q.options.map((_, i) => cell[String(i)] || 0);
        const pct = cellCounts.map((c) => (c / n) * 100);
        const win = pct.indexOf(Math.max(...pct));
        // a flip — this cohort's winner is not the room's — outranks a lean,
        // however wide the lean is: "X flips to Y" is the more surprising fact
        const flip = win !== roomWin;
        const gap = Math.abs(pct[win] - roomPct[win]);
        if (!flip && gap < MIN_GAP) continue;
        const score = (flip ? 1000 : 0) + gap;
        if (!best || score > best.score) {
          // The COUNTS ride along, not a rounded share. The share this
          // line prints has to be the one the breakdown sheet prints for
          // the same cell, and the sheet rounds with `sharePcts`
          // (data/pct.ts) — the largest-remainder rule this app has one
          // of. `Math.round` per option is the rule that was replaced,
          // and the two disagree on about one in eleven cells at three to
          // five options, always by a point: the card said "25–34 flips
          // it to Agree · 57%" and the sheet it opens said 56%.
          //
          // The float `pct` above still does the RANKING. That is D277's
          // distinction and it is the right way round here too: a sort
          // key wants precision, a printed number wants the app's one
          // rounding rule.
          best = { score, dim, group: bucket, kind: flip ? 'flip' : 'lean', sideIdx: win, counts: cellCounts };
        }
      }
    }
    if (!best) return null;
    // City and country are stored canonically ("Oslo, NO", "NO") so one
    // cohort is one key worldwide; they read as names only after PLACES
    // turns them back (D9).
    let label = best.group;
    if (best.dim === 'country') label = PLACES.countryName(best.group);
    else if (best.dim === 'city') { const pl = PLACES.parse(best.group); if (pl) label = pl.name; }
    return {
      kind: best.kind, group: label, sideIdx: best.sideIdx, dim: best.dim,
      // Rounded once, at the end, and only for the cell that won.
      pct: sharePcts(best.counts)[best.sideIdx],
    };
  };
})();
