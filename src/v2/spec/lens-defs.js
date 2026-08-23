// Ported from design/InSight_standalone_13.html (lens-defs.js). THIS file is
// the live source now, hand-edits and all.
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
//
// An ordinary import, not the window.LIVE lookups this file carried — the
// typed module is importable from spec (map-anchors precedent), and the
// two freed reference sites are what pay for lensAgg's read below under
// check:globals rule 4. `.enabled`/`.lensAgg` are data conditions and
// stay: enabled is false for the whole of mock mode, and lensAgg answers
// null against a bank that has no lens rows.
import LIVE from '../data/live';

// lens-defs.js — the MINOR instruments ("lenses"). Smaller than the four core
// tests: 4–8 questions each, no archetype, no rarity banner. They live on the
// profile's Lenses tab and trickle into the World feed at a lower rate than
// the core tests' own questions. Plain script.
//
// Tier 1 = the explanatory ones (why people hold positions, and where their
// answers actually come from). Tier 2 = useful but narrower.
//
// TWO DELIBERATE DIVERGENCES FROM THE PROTOTYPE, both for the same reason —
// the prototype may show you a filled-in profile you did not earn, a shipped
// app may not (README: "Passive tests start at zero"; D1: no fake anything):
//
//   1. `seed` pre-fills part of a lens so the demo can show every progress
//      state at once. It is read through a LIVE-aware Proxy here, exactly as
//      passive-progress.js does for the core tests, so live mode starts every
//      lens at a real zero.
//   2. `demo` is each dimension's TYPICAL-PERSON baseline. The prototype
//      blends it into your own score as a weight-2 prior, which in live mode
//      would mean part of "your" result was invented. Here the prior is
//      zero-weighted in live mode: your score is your answers, and `demo`
//      is only ever drawn as the reference shape — the same "you vs the
//      typical person" language test-viz.jsx already uses.
window.IS_LENSES = [
  {
    id: 'moral', tier: 1, hue: 355, title: 'Moral foundations',
    lead: 'the weights under your positions',
    viz: 'ranked',
    dims: [
      { id: 'care',      label: 'Care',      demo: 82 },
      { id: 'fair',      label: 'Fairness',  demo: 76 },
      { id: 'liberty',   label: 'Liberty',   demo: 68 },
      { id: 'loyal',     label: 'Loyalty',   demo: 44 },
      { id: 'authority', label: 'Authority', demo: 31 },
      { id: 'sanctity',  label: 'Sanctity',  demo: 22 },
    ],
    seed: 0.5,
    questions: [
      { q: 'Someone suffering matters more than someone being wronged.', d: 'care' },
      { q: 'Cruelty is the worst thing a person can be.', d: 'care' },
      { q: 'People should get out what they put in — no more, no less.', d: 'fair' },
      { q: 'Standing by your own people counts, even when they are wrong.', d: 'loyal' },
      { q: 'Respect for those in charge holds a society together.', d: 'authority' },
      { q: 'Some things are degrading even when nobody is harmed.', d: 'sanctity' },
      { q: 'Being told what to do is a harm in itself.', d: 'liberty' },
      { q: 'Rules I never agreed to have no hold on me.', d: 'liberty' },
      // APPENDED, never inserted: lens answers and feed ids (lq-<lens>-<qi>)
      // are index-keyed, so only the tail is safe to grow. This is the
      // lens's one reverse-keyed item — without any, an agree-with-
      // everything response style scores as a full moral profile (the same
      // acquiescence hole the W2 expansion closed for big5/attachment).
      { q: 'Toughness does more good than tenderness.', d: 'care', invert: true },
    ],
  },
  {
    id: 'risk', tier: 1, hue: 35, title: 'Risk, by domain',
    lead: 'nobody is brave everywhere',
    viz: 'columns',
    dims: [
      { id: 'financial',    label: 'Money',   demo: 34 },
      { id: 'health',       label: 'Health',  demo: 47 },
      { id: 'social',       label: 'Social',  demo: 71 },
      { id: 'recreational', label: 'Thrill',  demo: 62 },
      { id: 'ethical',      label: 'Ethical', demo: 19 },
    ],
    seed: 0.34,
    questions: [
      { q: 'I would put a month of savings into something volatile.', d: 'financial' },
      { q: 'I read the fine print before signing anything with money in it.', d: 'financial', invert: true },
      { q: 'I skip the check-up and assume it is nothing.', d: 'health' },
      { q: 'I will say the unpopular thing in a room that disagrees.', d: 'social' },
      { q: 'Steep, fast and slightly out of control is my idea of fun.', d: 'recreational' },
      { q: 'I would bend a rule if the outcome were clearly better.', d: 'ethical' },
    ],
  },
  {
    id: 'trust', tier: 1, hue: 200, title: 'Trust & worldview',
    lead: 'what you assume the world is like',
    viz: 'spine',
    dims: [
      { id: 'trust',     label: 'Strangers', poles: ['wary', 'trusting'],      demo: 64 },
      { id: 'zerosum',   label: 'Gains',     poles: ['grows', 'is fixed'],     demo: 29 },
      { id: 'justworld', label: 'Outcomes',  poles: ['luck', 'deserved'],      demo: 37 },
    ],
    seed: 0.5,
    questions: [
      { q: 'Most people would give back a wallet they found.', d: 'trust' },
      { q: 'You have to be careful — people take advantage.', d: 'trust', invert: true },
      { q: 'For one group to gain, another has to lose.', d: 'zerosum' },
      { q: 'Trade between countries leaves both better off.', d: 'zerosum', invert: true },
      { q: 'In the long run, people get roughly what they deserve.', d: 'justworld' },
      { q: 'Where you end up is mostly where you started.', d: 'justworld', invert: true },
    ],
  },
  {
    id: 'time', tier: 1, hue: 255, title: 'Time orientation',
    lead: 'how fast the future fades',
    viz: 'curve',
    dims: [
      { id: 'horizon',  label: 'Focus',    poles: ['now', 'later'],        demo: 61 },
      { id: 'patience', label: 'Patience', poles: ['impulsive', 'steady'], demo: 55 },
    ],
    seed: 0.5,
    questions: [
      { q: '€100 today beats €160 in a year.', d: 'horizon', invert: true },
      { q: 'I plan further ahead than most people I know.', d: 'horizon' },
      { q: 'I finish the boring part first and enjoy the rest after.', d: 'patience' },
      { q: 'If I want it, I buy it — I sort the rest out later.', d: 'patience', invert: true },
      { q: 'A decade from now feels real enough to save for.', d: 'horizon' },
      { q: 'Waiting is easy when I know what is coming.', d: 'patience' },
    ],
  },
  {
    id: 'taste', tier: 1, hue: 305, title: 'Taste',
    lead: 'what you reach for in film, music, food',
    viz: 'spine',
    dims: [
      { id: 'novelty',    label: 'Novelty',    poles: ['familiar', 'new'],        demo: 74 },
      { id: 'complexity', label: 'Complexity', poles: ['clean', 'dense'],         demo: 66 },
      { id: 'sincerity',  label: 'Register',   poles: ['ironic', 'sincere'],      demo: 58 },
      { id: 'scene',      label: 'Scene',      poles: ['mainstream', 'obscure'],  demo: 63 },
    ],
    seed: 0.34,
    questions: [
      { q: 'I would rather try an unknown dish than order the one I love.', d: 'novelty' },
      { q: 'I rewatch and relisten to the same things for years.', d: 'novelty', invert: true },
      { q: 'A film that needs a second viewing is a better film.', d: 'complexity' },
      { q: 'Earnest beats clever.', d: 'sincerity' },
      { q: 'If everyone likes it, it has usually been sanded down.', d: 'scene' },
      { q: 'I keep up with what most people are watching.', d: 'scene', invert: true },
    ],
  },
  {
    id: 'conflict', tier: 2, hue: 20, title: 'Conflict style',
    lead: 'what you do when it gets tense',
    viz: 'mini',
    dims: [
      { id: 'assert', label: 'Stance',  poles: ['accommodate', 'assert'], demo: 47 },
      { id: 'engage', label: 'Instinct', poles: ['withdraw', 'engage'],   demo: 68 },
    ],
    seed: 0.5,
    questions: [
      { q: 'I say it in the room rather than after.', d: 'engage' },
      { q: 'I let small things go to keep the peace.', d: 'assert', invert: true },
      { q: 'I would rather win the argument than end it.', d: 'assert' },
      { q: 'When it heats up I go quiet and leave.', d: 'engage', invert: true },
    ],
  },
  {
    id: 'humor', tier: 2, hue: 85, title: 'Humour',
    lead: 'who the joke is for',
    viz: 'mini',
    dims: [
      { id: 'affiliative', label: 'Warm',      demo: 78 },
      { id: 'selfenh',     label: 'Wry',       demo: 61 },
      { id: 'aggressive',  label: 'Cutting',   demo: 34 },
      { id: 'selfdef',     label: 'At myself', demo: 42 },
    ],
    seed: 0.25,
    questions: [
      { q: 'I joke to make a room easier to be in.', d: 'affiliative' },
      { q: 'When things go badly I can usually find it funny.', d: 'selfenh' },
      { q: 'A good joke is worth someone being stung by it.', d: 'aggressive' },
      { q: 'I get laughs by putting myself down.', d: 'selfdef' },
      // Appended (index-keyed — see the moral lens note): the reverse-keyed
      // item this lens shipped without.
      { q: 'A joke that needs a target isn’t worth telling.', d: 'aggressive', invert: true },
    ],
  },
  {
    id: 'thinking', tier: 2, hue: 225, title: 'Thinking style',
    lead: 'gut or working-out',
    viz: 'mini',
    dims: [
      { id: 'mode',   label: 'Method', poles: ['intuitive', 'analytic'], demo: 58 },
      { id: 'update', label: 'Holding', poles: ['certain', 'revising'],  demo: 71 },
    ],
    seed: 0.5,
    questions: [
      { q: 'My first instinct is usually right.', d: 'mode', invert: true },
      { q: 'I want the numbers before I decide.', d: 'mode' },
      { q: 'I change my mind when the evidence changes.', d: 'update' },
      { q: 'Sitting with not knowing is uncomfortable.', d: 'update', invert: true },
    ],
  },
  {
    id: 'culture', tier: 2, hue: 150, title: 'Cultural orientation',
    lead: 'the self, and the rules',
    viz: 'mini',
    dims: [
      { id: 'self',  label: 'Self',  poles: ['we', 'I'],           demo: 64 },
      { id: 'norms', label: 'Norms', poles: ['loose', 'tight'],    demo: 33 },
    ],
    seed: 0.34,
    questions: [
      { q: 'My choices are mine before they are my family’s.', d: 'self' },
      { q: 'What my community expects shapes what I do.', d: 'self', invert: true },
      { q: 'Breaking a social rule should have consequences.', d: 'norms' },
      { q: 'Places work better when people are left to improvise.', d: 'norms', invert: true },
    ],
  },
];

// ── progress, scoring, persistence ──────────────────────────────────────────
//
// PERSISTENCE IS DEVICE-LOCAL, deliberately, and unlike the four core tests —
// which mirror their result onto the owner-only profile doc via
// LIVE.saveTestResult so they survive a reinstall.
//
// Lenses could do the same, and the plan was to: raise firestore.rules'
// `testResults.keys().size() <= 8` cap and mirror each completed lens. What
// stopped it is that score() derives from your raw answers, so a mirrored
// score cannot feed it back — restoring on a new device needs a second source
// of truth inside this module, and until that exists the write would be data
// leaving the device that nothing ever reads. In an app whose pitch is that
// nothing leaves without a reason, a write-only mirror is the wrong default.
//
// The cost is real and it is D6's cost again: an anonymous user who swaps
// phones loses their lenses, as they already lose their local state. Wiring
// the round trip (restore path first, then the mirror, then the rules cap and
// its test) is its own increment.
export const LENSES = (function () {
  const LS = 'insight.lenses.v1';
  const BY = {};
  window.IS_LENSES.forEach((l) => { BY[l.id] = l; });
  const KEYS = window.IS_LENSES.map((l) => l.id);
  const subs = [];

  // live mode starts every lens at its real zero — the demo stagger exists
  // only so the prototype shows all progress states at once. Same Proxy
  // shape as passive-progress.js's SEED, deliberately: one idiom for
  // "demo-only number" across the spec layer.
  const liveOn = () => !!LIVE.enabled;
  const seedOf = (l) => (liveOn() ? 0 : (l.seed || 0));
  // weight of the typical-person prior in your own score. Nonzero only in
  // demo mode, where a half-answered lens still needs to draw something.
  const PRIOR_W = () => (liveOn() ? 0 : 2);

  let st = load();
  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(LS) || '{}');
      return { ans: (v && v.ans) || {}, seen: (v && v.seen) || {} };
    } catch { return { ans: {}, seen: {} }; }
  }
  function save() { try { localStorage.setItem(LS, JSON.stringify(st)); } catch { /* best-effort: private mode, quota */ } }
  function notify() { subs.forEach((f) => { try { f(); } catch { /* one bad listener must not stop the others */ } }); }
  function subscribe(fn) { subs.push(fn); return () => { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); }; }

  function get(id) { return BY[id]; }
  function needed(id) { const l = BY[id]; return l ? l.questions.length : 0; }
  function seedCount(id) { const l = BY[id]; return l ? Math.round(seedOf(l) * l.questions.length) : 0; }
  function answers(id) { return st.ans[id] || {}; }
  function done(id) {
    const a = answers(id);
    const extra = Object.keys(a).filter((i) => Number(i) >= seedCount(id)).length;
    return Math.min(needed(id), seedCount(id) + extra);
  }
  function pct(id) { const n = needed(id); return n ? Math.round((done(id) / n) * 100) : 0; }
  function complete(id) { return needed(id) > 0 && done(id) >= needed(id); }
  function nextIdx(id) {
    const l = BY[id], a = answers(id);
    for (let i = seedCount(id); i < l.questions.length; i++) if (a[i] == null) return i;
    return -1;
  }

  // value 0..4 (0 = strongly disagree) → 0..100 on the question's dimension.
  // A dimension you have not answered for returns null rather than a number:
  // in live mode there is no prior to fall back on, and drawing the
  // typical person's value as yours is the whole thing this avoids.
  // In demo mode the prior is YOUR provisional lean — the population value
  // with a stable personal offset — so d.demo stays a true reference point
  // to read against instead of doubling as your own score.
  function hsh(s) { let x = 17; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 2654435761); return ((x ^ (x >>> 11)) >>> 0) / 4294967295; }
  function score(id) {
    const l = BY[id], a = answers(id), out = {};
    const pw = PRIOR_W();
    l.dims.forEach((d) => {
      const lean = Math.max(4, Math.min(96, d.demo + Math.round((hsh(id + ':' + d.id) * 2 - 1) * 21)));
      let sum = lean * pw, w = pw;                        // your provisional lean as the soft prior — weightless in live mode
      l.questions.forEach((q, i) => {
        if (q.d !== d.id || a[i] == null) return;
        let v = (a[i] / 4) * 100; if (q.invert) v = 100 - v;
        sum += v; w += 1;
      });
      out[d.id] = w > 0 ? Math.round(sum / w) : null;
    });
    return out;
  }
  // the reference shape — what a typical person scores. Never mixed into
  // score(); the cards draw it alongside, labelled.
  function typical(id) {
    const l = BY[id], out = {};
    if (l) l.dims.forEach((d) => { out[d.id] = d.demo; });
    return out;
  }

  function answer(id, i, val) {
    st.ans[id] = { ...(st.ans[id] || {}), [i]: val };
    save(); notify();
  }
  // a lens question answered in the World feed
  function record(q) {
    if (!q || !q.lens || !BY[q.lens] || q.qi == null) return null;
    if (st.seen[q.id] != null) return null;
    st.seen[q.id] = q.lens;
    const val = typeof q.value === 'number' ? q.value : 2;
    st.ans[q.lens] = { ...(st.ans[q.lens] || {}), [q.qi]: val };
    save(); notify();
    return q.lens;
  }
  function mapped() { return KEYS.filter(complete).length; }
  // the public wipe. The account-deletion / uid-change contract is served
  // by the insight:local-purge listener below, not by callers of this.
  function reset() { st = { ans: {}, seen: {} }; save(); notify(); }
  // live.ts's purgeLocalTrace() removes every insight.* key on account
  // deletion and uid change, then announces it. Drop the in-memory copy
  // too: the uid-change path has no reload behind it, so without this the
  // next answer()'s save() would write the previous account's lens answers
  // straight back under the new uid. Deliberately NOT reset() — no save():
  // re-creating the key the purge just removed, even empty, works against
  // "remove every local trace".
  window.addEventListener('insight:local-purge', () => { st = { ans: {}, seen: {} }; notify(); });
  // liveOn is published for LENS_FEED_QS below: its pool differs between
  // demo and live, and re-deriving the flag there would mean a second
  // window.LIVE read for a fact this store already owns. It is the LENS
  // store's mode, not a general "is the app live" check — that stays
  // window.LIVE.enabled.
  return { KEYS, all: window.IS_LENSES, get, needed, done, pct, complete, seedCount, nextIdx, score, typical, answer, record, subscribe, mapped, reset, liveOn, poke: notify };
})();
// ── the lenses' own questions, for the World feed ───────────────────────────
// Deliberately thinner than TEST_FEED_QS: the core tests still own the feed.
//
// A FUNCTION, not a module-scope array. LIVE.enabled flips only after the
// async boot (data/live.ts initLive), long after this module evaluates — so
// a pool snapshotted here is always the DEMO one: seedCount() excludes each
// lens's seeded prefix as "already answered". Live mode starts every lens at
// a real zero, so freezing that snapshot in cost live users every one of
// those prefix questions (~20 of the 50 items) — for a feed-only user,
// `moral` could never pass 4 of 8. Rebuilt lazily instead; world-feed calls
// this on every feed build.
// No window mirror (D244): world-feed.jsx was the only reader.
export const LENS_FEED_QS = (function () {
  function h(s) { let x = 17; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 2654435761); return ((x ^ (x >>> 11)) >>> 0) / 4294967295; }
  // Agree-FIRST, and the seeded bank's lens rows carry the same five in the
  // same order (content/lenses.json → LENS_SCALE, drift-gated by
  // check:content): stored optionIdx indexes this list, and world-feed's
  // `4 - val` store inversion depends on the order.
  const SCALE = ['Strongly agree', 'Agree', 'Neutral', 'Disagree', 'Strongly disagree'];
  function build() {
    const L = window.LENSES; if (!L) return [];
    const live = L.liveOn();
    const perLens = L.all.map((l) => {
      const from = L.seedCount(l.id); // 0 in live mode — every question enters
      return l.questions.slice(from).map((q, i) => {
        const qi = from + i, id = 'lq-' + l.id + '-' + qi;
        const peak = Math.floor(h(id) * SCALE.length);
        // AUTHORED counts — demo furniture. A live card never renders them:
        // it either replaces them with the measured counts below or carries
        // selfOnly, which keeps every crowd surface off the card.
        const options = SCALE.map((label, oi) => {
          const w = 1 / (1 + Math.abs(oi - peak)) + h(id + ':' + oi) * 0.45;
          return { label, count: Math.round(180 + w * 1900) };
        });
        // tier 2 lenses surface at half the rate of tier 1
        const card = { id, lens: l.id, qi, tier: l.tier, cat: 'lens', type: 'vote', prompt: q.q, options };
        if (live) {
          // D91 (reversing D50's device-only half): lens items are seeded
          // world questions now, so a live card draws the same k-floored
          // counts every feed card does — and the answer still records to
          // the on-device instrument (world-feed setVote calls both).
          const agg = LIVE.lensAgg(id);
          if (agg) {
            card.options = SCALE.map((label, oi) => ({ label, count: agg.counts[oi] || 0 }));
            card.live = true;
            card.noCountsYet = agg.noCountsYet;
          } else {
            // The bank has no lens rows — a pre-D91 backend. The counts
            // above are authored, not measured, so the D50 treatment
            // stays: every crowd surface off, acknowledge the local write.
            card.selfOnly = true;
          }
        }
        return card;
      });
    });
    const t1 = [], t2 = [];
    for (let i = 0; perLens.some((p) => i < p.length); i++) {
      perLens.forEach((p) => { if (i < p.length) (p[i].tier === 1 ? t1 : t2).push(p[i]); });
    }
    // weave: two tier-1 questions for every tier-2 one
    const out = []; let a = 0, b = 0;
    while (a < t1.length || b < t2.length) {
      for (let k = 0; k < 2 && a < t1.length; k++) out.push(t1[a++]);
      if (b < t2.length) out.push(t2[b++]);
    }
    return out;
  }
  // Memoised in DEMO mode only, where the pool is static. A live pool
  // carries measured counts that move with every vote and agg refresh, so
  // it is rebuilt per call — world-feed calls this once per feed build,
  // which is exactly the cadence TEST_FEED_QS gets rebuilt at
  // (buildFeedGlobals), just pull instead of push.
  let demoBuilt = null;
  return function () {
    const L = window.LENSES;
    if (L && L.liveOn()) { demoBuilt = null; return build(); }
    if (!demoBuilt) demoBuilt = build();
    return demoBuilt;
  };
})();
// The mirror stays for lens-cards.jsx and profile-general.jsx.
window.LENSES = LENSES;
