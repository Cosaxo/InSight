// nature-data.js — the Born-or-built layer: per-dimension heritability (h²)
// ballparks from twin & family studies, matched to the core tests' dim ids.
// These are POPULATION estimates — the share of person-to-person spread traced
// to genes — never a slice of one person; every surface showing them must keep
// that framing. Rendered by the "Born or built" section in result-card.jsx.
window.NATURE = {
  h2: {
    big5: { O: 56, C: 49, E: 53, A: 42, N: 48 },
    political: { econ: 32, auth: 46, foreign: 28, env: 34, tech: 24, estab: 30 },
    values: { future: 32, circle: 28, hedonism: 46, meaning: 30, moral: 26, beauty: 38 },
    attachment: { warm: 36, loyal: 28, open: 40, play: 45, easy: 32 },
    cognitive: { analyst: 52, systems: 48, empath: 40, maker: 44 },
  },
  of(testKey, dim) { const t = this.h2[testKey]; return t ? (t[dim] != null ? t[dim] : null) : null; },
  avg(testKey) { const t = this.h2[testKey]; if (!t) return null; const v = Object.keys(t).map((k) => t[k]); return Math.round(v.reduce((a, b) => a + b, 0) / v.length); },
};
