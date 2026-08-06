// world-feed-math.js — the World feed's pure arithmetic and its deterministic
// texture helpers, lifted verbatim out of world-feed.jsx.
//
// WHY THIS FILE EXISTS. world-feed.jsx is 2,500+ lines of which one class
// component is ~2,350, so "split the feed" is not a matter of moving leaf
// components out — there are barely any. What there was is this: a band of
// small, pure, entirely untested functions at the top of the file, several of
// which compute numbers a user reads as fact.
//
// `wfPcts` is the one that earns the module on its own. It is the split shown
// on every feed card, and it does two things a reader would not guess: it adds
// YOUR vote to the counts (the store deliberately excludes it — see
// data/live.ts, "counts exclude the viewer's own vote"), and it forces the
// rounded percentages to sum to exactly 100 by pushing the residue onto the
// largest bucket. Both are correct and neither had a test.
//
// These are real ESM exports, so the names leave the shared-global namespace
// (D39). The porter had registered all of them on globalThis and nothing
// outside world-feed.jsx ever read one — the same ratio result-rose.jsx found:
// the bridge published everything, a real module exports only what is wanted.
//
// The bodies are moved unchanged. Where a comment explained a choice it came
// with the function, because that reasoning is the reason the line is not
// simpler than it looks.

export function wfFmt(n) { return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : '' + n; }

export function wfPcts(counts, mineIdx) {
  const c = counts.map((n, i) => n + (mineIdx === i ? 1 : 0));
  const total = c.reduce((a, b) => a + b, 0);
  const p = c.map((n) => Math.round((n / total) * 100));
  p[p.indexOf(Math.max(...p))] += 100 - p.reduce((a, b) => a + b, 0);
  return { p, total };
}

// image placeholder tile art — topic-tinted, pattern varies per card so the
// feed doesn't read as one repeating texture (real images drop in later)
export function wfTileArt(color, seed) {
  const a = 'color-mix(in oklch, ' + color + ' 32%, var(--surface-2))';
  const b = 'color-mix(in oklch, ' + color + ' 15%, var(--surface-2))';
  const v = Math.floor(wfHash('tile:' + seed) * 4);
  if (v === 0) return 'radial-gradient(110% 120% at 82% 100%, ' + a + ', transparent 58%), linear-gradient(150deg, ' + b + ', ' + a + ')';
  // a bare colour is not a valid background-image layer — it computes to `none`,
  // leaving the dots floating on the card with no fill behind them
  if (v === 1) return 'radial-gradient(circle, ' + a + ' 1.7px, transparent 2.1px) 0 0 / 14px 14px, linear-gradient(' + b + ', ' + b + ')';
  if (v === 2) return 'repeating-linear-gradient(135deg, ' + a + ' 0, ' + a + ' 2px, transparent 2px, transparent 11px), linear-gradient(160deg, ' + b + ', color-mix(in oklch, ' + color + ' 19%, var(--surface-2)))';
  return 'radial-gradient(120% 130% at 22% 12%, ' + a + ', transparent 62%), linear-gradient(160deg, ' + b + ', ' + a + ')';
}

// a catalogue's ranking is not one ranking — every population has its own, and the
// difference between them is the whole point of the breakdown. Each group reweights
// the same counts deterministically, so an item near a neighbour can overtake it
// while a runaway leader usually holds. Shares are derived from those same weights
// against the head's real share of the vote, so a group's numbers stay honest
// arithmetic rather than a second invented statistic.
export function wfPickGroup(qid, key, ranked, headShare) {
  const w = (it) => it.count * (0.45 + wfHash(qid + '|' + key + '|' + it.id) * 1.95);
  const tot = ranked.reduce((a, it) => a + w(it), 0) || 1;
  return ranked.map((it) => ({ it, share: (w(it) / tot) * headShare })).sort((a, b) => b.share - a.share);
}

// catalogue tiles stand in for real posters and portraits, so they need more
// presence than the duel tiles' whisper — a strip of near-cream rectangles reads
// as broken, not as artwork pending. Still one hue per card: strength and pattern
// carry the difference between neighbours, never a second colour.
export function wfCatArt(color, seed) {
  const t = 38 + Math.floor(wfHash('cat:' + seed) * 4) * 9;            // 38 / 47 / 56 / 65
  const a = 'color-mix(in oklch, ' + color + ' ' + t + '%, var(--surface-2))';
  const b = 'color-mix(in oklch, ' + color + ' ' + (t - 24) + '%, var(--surface-2))';
  const v = Math.floor(wfHash('catp:' + seed) * 5);
  if (v === 0) return 'radial-gradient(120% 130% at 78% 100%, ' + a + ', transparent 62%), linear-gradient(155deg, ' + b + ', ' + a + ')';
  if (v === 1) return 'radial-gradient(circle, ' + a + ' 2px, transparent 2.5px) 0 0 / 15px 15px, linear-gradient(' + b + ', ' + b + ')';
  if (v === 2) return 'repeating-linear-gradient(125deg, ' + a + ' 0, ' + a + ' 3px, transparent 3px, transparent 13px), linear-gradient(165deg, ' + b + ', ' + a + ')';
  if (v === 3) return 'linear-gradient(135deg, ' + a + ' 0 46%, ' + b + ' 46%)';
  return 'radial-gradient(100% 120% at 26% 14%, ' + a + ', transparent 66%), linear-gradient(200deg, ' + b + ', ' + a + ')';
}

// the overall counts + a hash, like the daily's.
export function wfHash(s) { let h = 9; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 387420489); return ((h ^ (h >>> 9)) >>> 0) / 4294967295; }

// v2: one hue per card. Strength encodes rank, so the winner reads first and a
// scroll never shows more than the topic's own colour.
export function wfTint(color, rank, n) { const steps = Math.max((n || 4) - 1, 1); const s = 30 - (24 * Math.min(rank, steps)) / steps; return 'color-mix(in oklch, ' + color + ' ' + s.toFixed(1) + '%, var(--surface))'; }
export function wfShadeText() { return '#fff'; }
// rate cards have no sides — a 1–10 score reads as tint strength of the one hue
export function wfRateBg(color, s) { return 'color-mix(in oklch, ' + color + ' ' + (10 + s * 5.9).toFixed(1) + '%, var(--surface))'; }
export function wfRateInk() { return 'var(--ink)'; }
// a group's rate on a knowledge card, drifted deterministically off the real one
// (same trick as the opinion splits). ±23-point spread, so differences mean something.
export function wfKnowRate(id, key, p, bias) { return Math.max(4, Math.min(97, Math.round(p + (wfHash(id + ':k:' + key) - 0.5) * 40 + (bias || 0)))); }
// education level is the one cut with a real direction on knowledge — leaving it
// to pure noise produces headlines like “Trade school beats Doctorate on the
// asteroid belt”, which reads as broken data rather than as an insight
export function wfKnowBias(dim, axis, n, i) { return dim === 'edu' && !axis && n > 1 ? (i / (n - 1) - 0.5) * 22 : 0; }
// a group's average, drifted deterministically off the real one (same trick as the splits)
export function wfRateAvg(qid, key, avg) { return Math.max(1.2, Math.min(9.9, avg + (wfHash(qid + ':' + key) - 0.5) * 3.6)); }
