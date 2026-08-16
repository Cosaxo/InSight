// Ported from design/spec-modules/test-definitions.js (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
//
// CONVERTED off the shared-global bridge (D39): the four names below are
// plain named exports and this file publishes nothing to globalThis.
// `window.LIVE` stays a global read — that one is data/live.ts's published
// surface, which is the convention working as intended, not legacy.
//
// It was listed in src/v2/README.md's "what NOT to start with" as half of a
// `test-definitions.js ↔ daily-split.jsx` cycle. That cycle did not exist:
// this module's only outgoing reference of any kind was to `window.LIVE`.
// See the README's own section for what the meter was actually seeing.

// InSight — test definitions & saved results: demo data, typical-person
// baselines, the question banks, and result persistence. No JSX — plain script.
// ─── Saved test results · pre-computed for the demo ───
// A result is `{title, taken, dims}` and carries no colour of its own
// (D182). It used to carry `accent`, which made the demo seed the only
// result in the app that knew what colour it was — a live or passively
// folded one (data/passiveProfile.ts) never has the field, so every
// reader of it drew nothing on a real account. TEST_HUE below is the
// palette; the shape here is the shape the live path writes.
export const IS_TEST_RESULTS = {
  big5: {
    title: 'Big Five',
    taken: '10 days ago',
    dims: [
      { id: 'O', label: 'Openness',          value: 78, blurb: 'curious, wide-ranging' },
      { id: 'C', label: 'Conscientiousness', value: 62, blurb: 'mostly orderly, sometimes loose' },
      { id: 'E', label: 'Extraversion',      value: 48, blurb: 'middle — selective social' },
      { id: 'A', label: 'Agreeableness',     value: 71, blurb: 'warm, slow to judge' },
      { id: 'N', label: 'Sensitivity',       value: 42, blurb: 'steadier side of middle' },
    ],
  },
  political: {
    title: 'Politics',
    taken: '3 weeks ago',
    dims: [
      { id: 'econ',    label: 'Economic',    value: 38, blurb: 'centre-left' },
      { id: 'auth',    label: 'Authority',   value: 24, blurb: 'liberty-minded, flat' },
      { id: 'foreign', label: 'Foreign',     value: 68, blurb: 'open, internationalist' },
      { id: 'env',     label: 'Environment', value: 82, blurb: 'urgent action' },
      { id: 'tech',    label: 'Technology',  value: 64, blurb: 'cautious optimist' },
      { id: 'estab',   label: 'Populism',    value: 56, blurb: 'healthy scepticism' },
    ],
  },
  values: {
    title: 'Values',
    taken: 'last month',
    dims: [
      { id: 'future',   label: 'Future',   value: 58, blurb: 'cautiously hopeful' },
      { id: 'circle',   label: 'Circle',   value: 46, blurb: 'leans close — family first' },
      { id: 'hedonism', label: 'Pleasure', value: 52, blurb: 'middle, slight pleasure' },
      { id: 'meaning',  label: 'Meaning',  value: 71, blurb: 'struggle has weight' },
      { id: 'moral',    label: 'Ethics',   value: 44, blurb: 'lean relativist' },
      { id: 'beauty',   label: 'Beauty',   value: 78, blurb: 'beauty matters' },
    ],
  },
  attachment: {
    title: 'Social style',
    taken: '2 weeks ago',
    dims: [
      { id: 'warm',  label: 'Warm',      value: 78, blurb: 'openly affectionate' },
      { id: 'loyal', label: 'Loyal',     value: 84, blurb: 'few and deep, kept for years' },
      { id: 'open',  label: 'Open',      value: 64, blurb: 'lets people in' },
      { id: 'play',  label: 'Playful',   value: 56, blurb: 'keeps it light' },
      { id: 'easy',  label: 'Easygoing', value: 62, blurb: 'gives space' },
    ],
  },
};

// ── one hue per instrument (D121, corrected D182) ──────────────────
//
// There were TWO of these, and they disagreed. `RP_TESTS[k].banner`
// (result-rose.jsx) coloured the result card; `PASSIVE.META[k].accent`
// (passive-progress.js) coloured the progress sheet's rings, pips and
// rows. On values and attachment they were not even close — the sheet drew
// Values in rose and Social in violet while the card drew Values violet
// and Social green — so the same instrument changed colour between the
// screen that says how full it is and the screen that says what it found.
//
// D121 took the sheet's palette because it is built from the app's own
// tokens, the same accents the daily's modes and the Mirror's stops run
// on, so an instrument reads as part of the app rather than as its own
// chart. That rule stands. What it MISSED is that there was a third
// palette and it was never in the comparison: `RP_TESTS[k].hues` — one
// hue per AXIS — is what the same card's rose petals are drawn from, and
// what `typeColor`/`typeSplit` (type-marks.jsx) build every type mark
// from. Two of the four then sat outside their own chart: Values wore
// rose over petals that run 282–344, Social wore violet over petals that
// run 95–205. So the banner and the rose under it disagreed on the ONE
// card that draws both, and the sheet's row disagreed with the mark
// beside it.
//
// The tokens still win; the token now has to belong to the instrument's
// own axis family:
//
//   big5        0–95    → --c-around, sienna 40   (unchanged)
//   political   170–285 → --c-world, indigo 235   (unchanged)
//   values      282–344 → violet 320
//   attachment  95–205  → --c-city, sage 150
//
// Violet has no token — nothing else in the app is violet — which is why
// Values' is written out; it is the one family the palette does not
// already name. Sage is a token, so Social gets one it did not have.
// `test-hue.test.ts` holds each of these inside its own family, reading
// the token's angle out of styles.css so neither file can drift alone.
export const TEST_HUE = {
  big5:       'var(--c-around)',
  political:  'var(--c-world)',
  values:     'oklch(0.52 0.13 320)',
  attachment: 'var(--c-city)',
};

// Typical-person baselines per dimension. Grounded, not precise: enough to
// give every score a reference point.
//
// NO LONGER DRAWN AS A MEASUREMENT (D157). These five constants per
// instrument used to BE the hollow "most people" ring on every axis of
// every result card, and the percentile line above it read "higher than 9
// in 10 members" — this app's population, named, from a number typed here.
// `data/testNorms.ts` is the seam now: it folds the published counts of
// the bank's own test items into the population's real average, and hands
// these back only in the DEMO build, where the population is invented in
// the first place. A live build with too thin a crowd gets an EMPTY map
// and the card draws no ring.
//
// Two live readers remain and both are MODELS rather than claims on a
// screen — the same split D149 drew when it took the authored `card.p` off
// the learn reveal and left it driving the difficulty scheduler:
//   · archetype-data.js centres you and each signature on these before
//     comparing, so which type you match cannot drift with whoever the
//     app happened to fetch this session
//   · IS_typeRuleParts reads the same centring to name a type's defining
//     dims ("very reserved + curious")
export const IS_TEST_AVG = {
  big5:       { O: 60, C: 58, E: 52, A: 65, N: 48 },
  political:  { econ: 50, auth: 52, foreign: 48, env: 55, tech: 60, estab: 55 },
  values:     { future: 52, circle: 45, hedonism: 55, meaning: 58, moral: 55, beauty: 60 },
  attachment: { warm: 64, loyal: 66, open: 56, play: 58, easy: 60 },
};

// ── Persist completed results so a retake (or reload) keeps what you scored ──
// (v2: axes changed — politics merged liberty/order + gained populism; values
// merged duty+altruism into one moral-circle tension. Old v1 results would
// carry retired dims, so they are simply not read.)
const TEST_RESULTS_KEY = 'insight.testResults.v2';
// A pristine copy of the demo results ABOVE, taken before the saved-result
// overlay below lands — the purge listener restores it, because the
// fresh-boot state of this object is the demo seed plus an empty overlay,
// not an empty object. The module's own binding, not a window read: this
// file left the global bridge (D39-style conversion, #85), so the export
// is the only copy there is.
const IS_TEST_RESULTS_DEMO = JSON.parse(JSON.stringify(IS_TEST_RESULTS));
try {
  const saved = JSON.parse(localStorage.getItem(TEST_RESULTS_KEY) || '{}');
  Object.keys(saved).forEach(k => { IS_TEST_RESULTS[k] = saved[k]; });
} catch (e) { /* ignore corrupt storage */ }
// The purge (data/live.ts, D51). Disk cannot resurrect here —
// persistTestResult below reads storage fresh on every write — but this
// mirror object is what the profile surfaces render, and without the drop
// it keeps showing the previous account's results until an app restart.
// In place, not reassigned: consumers hold references to this object.
window.addEventListener('insight:local-purge', () => {
  Object.keys(IS_TEST_RESULTS).forEach((k) => { delete IS_TEST_RESULTS[k]; });
  Object.keys(IS_TEST_RESULTS_DEMO).forEach((k) => { IS_TEST_RESULTS[k] = JSON.parse(JSON.stringify(IS_TEST_RESULTS_DEMO[k])); });
});
// Live hydration (data/live.ts publishTestResults). Fires only in live
// mode — hydrate() and resetForNewUid() are the sole callers and neither
// runs without a session — so the demo seed above survives untouched in
// mock mode, where the persona IS the content.
//
// REPLACE, not merge, and that is the point rather than an optimisation:
// the seed at the top of this file is Mira Halvorsen's, and a live account
// that has taken no test must render nothing rather than hers. The payload
// is already {server, …device}, so a key missing from it means the user has
// not taken that test on any device.
//
// In place, for the same reason the purge above is: the fifteen consumers
// import this binding and hold the object.
window.addEventListener('insight:test-results', (e) => {
  const next = (e && e.detail) || {};
  Object.keys(IS_TEST_RESULTS).forEach((k) => { delete IS_TEST_RESULTS[k]; });
  Object.keys(next).forEach((k) => { IS_TEST_RESULTS[k] = next[k]; });
});

// Exported as `persistTestResult`; consumers used to reach it as
// `window.IS_persistTestResult`, which is why the import in daily-split and
// test-overlay does not match the old global's name.
export function persistTestResult(kind, result) {
  IS_TEST_RESULTS[kind] = result;
  if (window.LIVE && window.LIVE.enabled && window.LIVE.saveTestResult) window.LIVE.saveTestResult(kind, result);
  try {
    const saved = JSON.parse(localStorage.getItem(TEST_RESULTS_KEY) || '{}');
    saved[kind] = result;
    localStorage.setItem(TEST_RESULTS_KEY, JSON.stringify(saved));
  } catch (e) { /* ignore */ }
}

// Each question maps answer values (0..4) to dimension deltas via `dims`
// Result is computed by summing values per dimension, normalised to 0..100
export const IS_TESTS = {
    big5: {
      title: 'Big Five',
      tag: 'personality · 25 questions · 5 traits',
      dims: [
        { id: 'O', label: 'Openness',          blurb: 'curiosity & range' },
        { id: 'C', label: 'Conscientiousness', blurb: 'order & follow-through' },
        { id: 'E', label: 'Extraversion',      blurb: 'energy from people' },
        { id: 'A', label: 'Agreeableness',     blurb: 'warmth & trust' },
        { id: 'N', label: 'Sensitivity',       blurb: 'steady ←→ sensitive' },
      ],
      questions: [
        { q: "I find new ideas more interesting than familiar ones.", d: 'O' },
        { q: "I enjoy thinking about abstract concepts.",              d: 'O' },
        { q: "I keep appointments and rarely run late.",               d: 'C' },
        { q: "I finish what I start, even when it gets dull.",         d: 'C' },
        { q: "I feel energised by spending time with strangers.",       d: 'E' },
        { q: "I prefer a loud party to a quiet evening.",              d: 'E' },
        { q: "I try to keep the peace, even at some cost.",            d: 'A' },
        { q: "I trust people until they give me reason not to.",       d: 'A' },
        { q: "I worry about things I can't control.",                  d: 'N' },
        { q: "Small setbacks throw off my whole day.",                 d: 'N' },
        // Round 2 (one per trait, all reverse-keyed): the first ten items
        // all keyed agreement to the high pole, so an agree-with-everything
        // response style scored as a personality. These anchor the low end.
        { q: "I stick with what I know works rather than experiment.", d: 'O', invert: true },
        { q: "I leave things to the last minute more often than not.", d: 'C', invert: true },
        { q: "A full day alone recharges me more than a night out.",   d: 'E', invert: true },
        { q: "I'd rather win the argument than smooth things over.",   d: 'A', invert: true },
        { q: "It takes a lot to rattle me.",                           d: 'N', invert: true },
        // Round 3 (K 3→5): two per trait, one of them reverse-keyed, so
        // every trait ends at five items with two inverts. Three items per
        // trait left each score with 13 reachable values — one careless tap
        // moved a trait ~8 points, which is more resolution than the Mirror
        // reads off it.
        { q: "I go looking for music, films or books I know nothing about.", d: 'O' },
        { q: "I have little patience for questions with no practical use.",  d: 'O', invert: true },
        { q: "I keep my things in order without having to think about it.",  d: 'C' },
        { q: "My plans tend to fall apart in the details.",                  d: 'C', invert: true },
        { q: "I start conversations with people I have just met.",           d: 'E' },
        { q: "In a group I say less than most people there.",                d: 'E', invert: true },
        { q: "I give people the benefit of the doubt when a story doesn't add up.", d: 'A' },
        { q: "I decide quickly whether someone is worth my time.",           d: 'A', invert: true },
        { q: "I replay conversations afterwards, looking for what I got wrong.", d: 'N' },
        { q: "I sleep fine the night before something big.",                 d: 'N', invert: true },
      ],
    },
    political: {
      title: 'Politics',
      tag: 'compass · 30 questions · 6 axes',
      dims: [
        { id: 'econ',    label: 'Economic',   blurb: 'left ←→ right' },
        { id: 'auth',    label: 'Authority',  blurb: 'liberty ←→ order' },
        { id: 'foreign', label: 'Foreign',    blurb: 'closed ←→ open' },
        { id: 'env',     label: 'Environment',blurb: 'low ←→ high urgency' },
        { id: 'tech',    label: 'Technology', blurb: 'precaution ←→ accelerate' },
        { id: 'estab',   label: 'Populism',   blurb: 'establishment ←→ outsider' },
      ],
      questions: [
        { q: "Markets, left to themselves, distribute fairly.",        d: 'econ' },
        { q: "Essential services belong in public hands, not markets.",      d: 'econ', invert: true },
        { q: "Some speech is harmful enough to restrict.",             d: 'auth' },
        { q: "The state should keep out of private life.",             d: 'auth', invert: true },
        { q: "My country should help others before its own poor.",     d: 'foreign' },
        { q: "Borders should be more open than they are now.",         d: 'foreign' },
        { q: "Climate action is worth real economic cost.",            d: 'env' },
        { q: "Green rules should hold even when jobs are on the line.", d: 'env' },
        { q: "New technology, on balance, makes life better.",         d: 'tech' },
        { q: "Some technologies should be slowed down on purpose.",    d: 'tech', invert: true },
        { q: "Strong leaders matter more than strong institutions.",   d: 'estab' },
        { q: "The system is rigged against ordinary people.",          d: 'estab' },
        // Round 2: the axes that had both items keyed the same way
        // (foreign/env/estab) get their reverse-keyed item here.
        { q: "Lower taxes matter more than more public services.",     d: 'econ' },
        { q: "More surveillance is a fair price for more safety.",     d: 'auth' },
        { q: "My country should put its own people first.",            d: 'foreign', invert: true },
        { q: "The dangers of climate change are exaggerated.",         d: 'env', invert: true },
        { q: "Progress means building first and fixing problems as they come.", d: 'tech' },
        { q: "Experts and institutions usually get it right.",         d: 'estab', invert: true },
        // Round 3 (K 3→5): two per axis, one reverse-keyed. The compass is
        // the test whose result the Mirror slices hardest (D44 treats these
        // answers as Art. 9-adjacent), so it is the one that could least
        // afford three items an axis.
        { q: "People mostly end up where their own effort puts them.",  d: 'econ' },
        { q: "The gap between rich and poor is the biggest problem we have.", d: 'econ', invert: true },
        { q: "Order in the streets matters more than the right to protest.", d: 'auth' },
        { q: "Adults should be free to harm themselves if they choose.", d: 'auth', invert: true },
        { q: "Immigration has made my country better.",                 d: 'foreign' },
        { q: "We should fix problems at home before problems abroad.",   d: 'foreign', invert: true },
        { q: "I would pay noticeably more for energy to cut emissions faster.", d: 'env' },
        { q: "Environmental rules are already strict enough.",           d: 'env', invert: true },
        { q: "I would rather live with the risks of new technology than miss what it brings.", d: 'tech' },
        { q: "New tools should prove they are safe before anyone can use them.", d: 'tech', invert: true },
        { q: "Most politicians are in it for themselves.",               d: 'estab' },
        { q: "The people running things mostly know what they are doing.", d: 'estab', invert: true },
      ],
    },
    values: {
      title: 'Values',
      tag: '30 questions · six tensions',
      dims: [
        { id: 'future',   label: 'Future',   blurb: 'pessimist ←→ optimist' },
        { id: 'circle',   label: 'Circle',   blurb: 'close ←→ wide' },
        { id: 'hedonism', label: 'Pleasure', blurb: 'duty ←→ pleasure' },
        { id: 'meaning',  label: 'Meaning',  blurb: 'happiness ←→ struggle' },
        { id: 'moral',    label: 'Ethics',   blurb: 'relative ←→ objective' },
        { id: 'beauty',   label: 'Beauty',   blurb: 'truth only ←→ beauty too' },
      ],
      questions: [
        { q: "Future generations will live better than ours.",                  d: 'future' },
        { q: "Most of what's changing right now is change for the better.",     d: 'future' },
        { q: "What I owe my family weighs more than what I owe strangers.",     d: 'circle', invert: true },
        { q: "I'd give up real comfort to help a stranger.",              d: 'circle' },
        { q: "Pleasure needs no justification.",                                d: 'hedonism' },
        { q: "Obligations come before enjoyment.",                              d: 'hedonism', invert: true },
        { q: "Suffering can give life meaning, not just pain.",                 d: 'meaning' },
        { q: "A hard life spent on something big beats an easy one.",           d: 'meaning' },
        { q: "There are objective right answers in ethics.",                    d: 'moral' },
        { q: "Some things are wrong in every era and every culture.",           d: 'moral' },
        { q: "Beauty matters as much as truth.",                                d: 'beauty' },
        { q: "A beautiful thing needs no other use.",                           d: 'beauty' },
        // Round 2: reverse-keyed items for the tensions that lacked one
        // (future/meaning/moral/beauty).
        { q: "The world is mostly getting worse.",                              d: 'future', invert: true },
        { q: "A stranger's suffering moves me as much as a neighbour's.",       d: 'circle' },
        { q: "Enjoying myself is a good enough reason to do something.",        d: 'hedonism' },
        { q: "A calm, happy life beats a hard, important one.",                 d: 'meaning', invert: true },
        { q: "Right and wrong depend on the culture you're standing in.",       d: 'moral', invert: true },
        { q: "Whether something works matters more than how it looks.",         d: 'beauty', invert: true },
        // Round 3 (K 3→5): two per tension, one reverse-keyed.
        { q: "I expect my own life ten years from now to be better than it is today.", d: 'future' },
        { q: "The problems ahead of us are bigger than anything we have solved.", d: 'future', invert: true },
        { q: "A life saved far away counts the same as one saved here.",        d: 'circle' },
        { q: "Charity should start with the people around you.",                d: 'circle', invert: true },
        { q: "I plan my week around things I will enjoy.",                      d: 'hedonism' },
        { q: "I feel uneasy resting while work is unfinished.",                 d: 'hedonism', invert: true },
        { q: "The best parts of my life came out of something difficult.",      d: 'meaning' },
        { q: "I would trade a smaller life for a more peaceful one.",           d: 'meaning', invert: true },
        { q: "Some acts would be wrong even if everyone approved of them.",     d: 'moral' },
        { q: "Morality is something people invented, like money.",              d: 'moral', invert: true },
        { q: "I will pay more for something well made when a plain one would do.", d: 'beauty' },
        { q: "Decoration is the first thing I would cut.",                      d: 'beauty', invert: true },
      ],
    },
    attachment: {
      title: 'Social',
      tag: '25 questions · what kind of friend you are',
      dims: [
        { id: 'warm',  label: 'Warm',      blurb: 'reserved ←→ warm' },
        { id: 'loyal', label: 'Loyal',     blurb: 'many & light ←→ few & deep' },
        { id: 'open',  label: 'Open',      blurb: 'guarded ←→ open book' },
        { id: 'play',  label: 'Playful',   blurb: 'grounded ←→ playful' },
        { id: 'easy',  label: 'Easygoing', blurb: 'invested ←→ easygoing' },
      ],
      questions: [
        { q: "I show people I care without being asked.",             d: 'warm' },
        { q: "I'm quick with a hug or a kind word.",                  d: 'warm' },
        { q: "Friends know I'll show up when it matters.",            d: 'loyal' },
        { q: "Once you're my friend, you're my friend for years.",    d: 'loyal' },
        { q: "I say what I'm feeling rather than keeping it in.",      d: 'open' },
        { q: "I let people see the messy parts of me.",               d: 'open' },
        { q: "I'm usually the one keeping things light and fun.",     d: 'play' },
        { q: "I'd rather joke around than be too serious.",           d: 'play' },
        { q: "Little gets under my skin in a friendship.",            d: 'easy' },
        { q: "I give people room and don't keep score.",              d: 'easy' },
        // Round 2 (one per dimension, all reverse-keyed — same
        // acquiescence fix as big5).
        { q: "Showing affection doesn't come naturally to me.",       d: 'warm', invert: true },
        { q: "My friendships tend to fade when life gets busy.", d: 'loyal', invert: true },
        { q: "I keep my problems to myself.",                         d: 'open', invert: true },
        { q: "I take most things seriously, even the small stuff.",   d: 'play', invert: true },
        { q: "I keep track of who reached out last.",      d: 'easy', invert: true },
        // Round 3 (K 3→5): two per dimension, one reverse-keyed.
        { q: "I tell my friends what they mean to me.",               d: 'warm' },
        { q: "Compliments feel awkward coming out of my mouth.",      d: 'warm', invert: true },
        { q: "I still keep up with people I met years ago.",          d: 'loyal' },
        { q: "When someone moves away, we usually lose touch.",       d: 'loyal', invert: true },
        { q: "I will admit it when I am struggling.",                 d: 'open' },
        { q: "There are things about me nobody in my life knows.",    d: 'open', invert: true },
        { q: "I am the one who suggests something daft.",             d: 'play' },
        { q: "I find it hard to switch off and mess about.",          d: 'play', invert: true },
        { q: "A friend cancelling on me barely registers.",           d: 'easy' },
        { q: "It bothers me when a friend doesn't reply for days.",   d: 'easy', invert: true },
      ],
    },
};
