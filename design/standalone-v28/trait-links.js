// trait-links.js — the web BETWEEN the tests: known cross-trait correlations
// (openness↔authority, extraversion↔warmth…) checked against YOUR results.
// Where your pair travels the usual way, the thread holds; where it doesn't,
// you break a rule — and the rule you break is the most individual thing the
// data can say about you. Rendered by trait-web.jsx on the profile.
window.TRAIT_WEB = (function () {
  // [testA, dimA, testB, dimB, sign, rule (the usual pattern), breakLine]
  // sign +1: the pair usually rises together · −1: one usually sinks the other
  const LINKS = [
    ['big5', 'O', 'political', 'auth', -1, 'curiosity pulls away from command', 'a curious mind that keeps the chain of command'],
    ['big5', 'O', 'values', 'beauty', 1, 'open minds and an eye for beauty travel together', 'openness without the eye for beauty'],
    ['big5', 'O', 'political', 'foreign', 1, 'curiosity looks outward', 'an open mind that stays home'],
    ['big5', 'C', 'values', 'hedonism', -1, 'order keeps pleasure on a leash', 'disciplined — and devoted to pleasure anyway'],
    ['big5', 'E', 'attachment', 'warm', 1, 'warmth usually rides with extraversion', 'reserved people are rarely this warm'],
    ['big5', 'E', 'attachment', 'play', 1, 'playfulness feeds on company', 'the quiet joker'],
    ['big5', 'A', 'attachment', 'warm', 1, 'agreeable people run warm', 'kind at the core, cool at the surface'],
    ['big5', 'A', 'political', 'econ', -1, 'soft hearts lean left on money', 'warm-hearted, hard-nosed on markets'],
    ['big5', 'N', 'values', 'future', -1, 'sensitivity dims the view ahead', 'feels everything, still bets on tomorrow'],
    ['big5', 'N', 'attachment', 'easy', -1, 'steady nerves give easy space', 'anxious, but easygoing all the same'],
    ['attachment', 'open', 'big5', 'O', 1, 'open to ideas, open to people', 'open to ideas, guarded with people'],
  ];

  function dimOf(test, dim, i) {
    const R = (window.IS_TEST_RESULTS || {})[test];
    const d = R && R.dims ? R.dims.find((x) => x.id === dim) : null;
    if (!d) return null;
    const cfg = (window.RP_TESTS || {})[test];
    const hue = cfg && cfg.hues && cfg.hues[dim] != null ? cfg.hues[dim] : (30 + i * 47) % 360;
    return { v: d.value, label: d.label, hue };
  }

  return {
    // one row per link both tests can answer. pa/pb are laid on a shared rail,
    // b FLIPPED when the usual pull is opposite — so "following the pattern"
    // always lands the two dots together, and the gap is the tension.
    rows() {
      const out = [];
      LINKS.forEach((L, i) => {
        const a = dimOf(L[0], L[1], i), b = dimOf(L[2], L[3], i + 3);
        if (!a || !b) return;
        const pa = a.v, pb = L[4] < 0 ? 100 - b.v : b.v;
        const gap = Math.abs(pa - pb);
        const off = Math.max(Math.abs(a.v - 50), Math.abs(b.v - 50));
        out.push({ id: L[0] + L[1] + L[2] + L[3], a, b, pa, pb, gap, sign: L[4], rule: L[5], breakLine: L[6], state: gap >= 24 && off >= 12 ? 'break' : 'holds' });
      });
      return out.sort((m, n) => n.gap - m.gap);
    },
    headline() { return this.rows().find((r) => r.state === 'break') || null; },
    // the written rule for a pair, either way round — read by trait-plane.js so
    // the Web lens can speak the named pairs in words instead of numbers
    ruleFor(ta, da, tb, db) {
      const L = LINKS.find((x) => (x[0] === ta && x[1] === da && x[2] === tb && x[3] === db)
        || (x[0] === tb && x[1] === db && x[2] === ta && x[3] === da));
      return L ? { sign: L[4], rule: L[5], breakLine: L[6] } : null;
    },
  };
})();
