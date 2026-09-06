// world-feed-topics.js — the feed's topic palette, and nothing else.
//
// WHY IT IS ITS OWN FILE. This list is thirteen {id,label,color} rows —
// authored metadata, not content — and it was the ONE thing daily-split.jsx
// (the landing tab, in the entry chunk) needed from world-feed-data.js. That
// import held the feed's whole demo pool in first paint, and the pool is
// where the feed lane appends its continuum twins on every run: writing a
// feed question was adding start-up bytes, the same way writing a daily
// question was before daily-cats.js. The split is the same one, one surface
// over, and for the same reason: a taxonomy is not a bank.
//
// spec-index.js's eager line for world-feed-data.js named this import as its
// only cause and was right about the mechanism; the topic list moving here is
// what let that line go.
//
// Nothing here imports anything, so it is a leaf on both the eager graph and
// the deferred one — which is what makes it safe for the entry chunk to hold
// while the pool it came from is loaded by loadWorldFeed().

// ── topic palette ── id doubles as the question's cat. Hues share one chroma tier.
// Named export alongside the global (D39's "convert on touch", the WPAL
// precedent): typed panels — ui/PatternsTab first — import the binding, so
// the coupling meter (rule 4) never counts them, while the nine spec
// consumers keep reading the global until their own touch converts them.
export const WORLD_TOPICS = [
  { id: 'sport',   label: 'Sport',          color: 'oklch(0.52 0.14 145)' },
  { id: 'food',    label: 'Food',           color: 'oklch(0.52 0.14 40)'  },
  { id: 'movies',  label: 'Movies & TV',    color: 'oklch(0.52 0.14 310)' },
  { id: 'music',   label: 'Music',          color: 'oklch(0.52 0.14 355)' },
  { id: 'tech',    label: 'Tech',           color: 'oklch(0.52 0.14 235)' },
  { id: 'culture', label: 'Culture',        color: 'oklch(0.52 0.14 200)' },
  { id: 'dilemma', label: 'Dilemmas',       color: 'oklch(0.52 0.14 25)'  },
  { id: 'event',   label: 'World events',   color: 'oklch(0.52 0.14 260)' },
  { id: 'people',  label: 'Famous people',  color: 'oklch(0.52 0.14 85)'  },
  { id: 'bigq',    label: 'Big questions',  color: 'oklch(0.52 0.14 290)' },
  // the current-events lane (D231). A TIME, not a subject — which is what
  // keeps it off 'event' (World events), whose questions are evergreen: a
  // card here carries an ask window and stops being served when it closes.
  // Hue 115 is the widest gap left in the row (85 -> 145), picked for
  // distance from its neighbours rather than for a meaning.
  { id: 'now',     label: 'Happening now',  color: 'oklch(0.52 0.14 115)' },
  { id: 'places',  label: 'Places',         color: 'oklch(0.52 0.14 60)'  },
  // catalogue picks are a FORMAT, not a subject — so they live on a channel, the
  // same way dilemmas and rankings do. It also means they always have a home:
  // 'movies' has no scene pointing at it, so a film question filed under it can
  // never reach the feed.
  { id: 'fav',     label: 'Favourites',     color: 'oklch(0.52 0.14 170)' },
];
