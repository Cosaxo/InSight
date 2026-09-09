// Ported from design/spec-modules/map-anchors.js (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import LIVE from '../data/live';
import { IS_DATA } from './sample-data.js';
import { IS_TEST_RESULTS } from './test-definitions.js';

// InSight — Map anchors: the profile facts every daily answer reads against.
// Seven anchors — age, work, study, plus the four test results — sit in a ring
// at the map's centre. Each answered question relates to 1–3 of them with a
// strength (1–3) and one short, hedged line. Curated, deterministic, no fake
// percentages.
//
// Both counts are check:figures' now, off the two array literals below. They
// said eight and five, and had since D103 retired the Thinking test twenty
// lines down — where this file already records that a retired test leaves no
// anchor behind. CLAUDE.md's own line ("real for three anchors and refuses
// for four") sums to seven.
let listExport, relateExport;
(function () {
  // ── anchor definitions ─────────────────────────────────────────────────────
  function topDims(key, n) {
    const R = IS_TEST_RESULTS[key];
    if (!R || !R.dims) return '';
    return R.dims.slice().sort((a, b) => b.value - a.value).slice(0, n || 2)
      .map((d) => d.label + ' ' + d.value).join(' · ');
  }
  // The four test anchors. Same shape in both modes because the source is
  // the same object: test-definitions.js seeds it with the demo persona's
  // results and data/live.ts replaces the whole thing on hydrate, so in
  // live mode a test the user has not taken is simply absent and topDims
  // returns ''. list() drops those rows.
  //
  // Five for two days: `cognitive` was added here when it finally got a
  // question bank (2026-08-10) and removed with the rest of the Thinking
  // test on D103. A retired test leaves no anchor behind — a row whose
  // value can only ever be '' is a row list() drops on every render.
  function testRows() {
    return [
      { id: 'big5',       label: 'Big Five', hue: 40,  value: topDims('big5'),       sub: tTaken('big5') },
      { id: 'political',  label: 'Politics', hue: 235, value: topDims('political'),  sub: tTaken('political') },
      { id: 'values',     label: 'Values',   hue: 28,  value: topDims('values'),     sub: tTaken('values') },
      { id: 'attachment', label: 'Social',   hue: 320, value: topDims('attachment'), sub: tTaken('attachment') },
    ];
  }
  // Live mode: the viewer's OWN anchors (D8), read back from the store —
  // three of the ten fields an answer snapshots (count held by
  // check:figures, off ANCHOR_FIELDS in data/live.ts). It said the same
  // SEVEN fields, which is the drift live.ts:5206 already records having
  // fixed in its own copy: "This said 'the seven keys' while ANCHOR_FIELDS
  // held ten.".
  //
  // The `||` defaults the prototype carried here were the sample persona's
  // — `s.age || 34`, `me.job || 'Editor'`, `me.education || 'MA Literature'`
  // — so a live build put "age 34 · Editor · independent press · MA
  // Literature · Univ. of Oslo" at the centre of every stranger's map, with
  // no Preview badge: MirrorPreviewTag returns null for the You stop
  // precisely because nothing there was supposed to be sample data.
  //
  // This is the second time this persona has leaked through a profile
  // surface. profile-general.jsx's baseFor() carries the first, and the
  // note there is the one that matters: the anchors effect writes whatever
  // the profile holds to `v2_users/{uid}`, and answerAnchors() then stamps
  // it onto every answer — which are create-only (D5), so a fabricated
  // cohort cannot be corrected after the fact.
  //
  // Age is the BAND, not a year: that is all the anchor holds. The exact
  // birthday never leaves the device (profile-general.jsx, anchorsFrom).
  function liveList() {
    const a = LIVE.anchors() || {};
    return [
      { id: 'age', label: 'Age',   hue: 265, value: a.ageBand ? 'age ' + a.ageBand : '', sub: 'from your profile' },
      // `self` is the COHORT's value where it differs from the profile's,
      // which for Work it does: the pick is a profession and the dim is
      // the derived `jobField` (D328), so "6 people in your line of work
      // chose the same · you: Carpenter" named a cohort of carpenters when
      // the six are the whole trades-and-construction field. Age solved
      // the same problem by publishing the BAND as its value; Work keeps
      // the profession as its headline — that is who you are, and it
      // claims no cohort — and carries the field for the sentence that
      // does. Absent falls back to the profession, which is the shape a
      // profile written before D328 has.
      { id: 'job', label: 'Work',  hue: 85,  value: a.profession || '',
        self: a.jobField || a.profession || '',                          sub: 'from your profile' },
      { id: 'edu', label: 'Study', hue: 190, value: a.education || '',                   sub: 'from your profile' },
      ...testRows(),
    ];
  }
  function demoList() {
    const me = IS_DATA.me || {};
    const s = me.stats || {};
    return [
      { id: 'age',        label: 'Age',      hue: 265, value: 'age ' + (s.age || 34),          sub: 'born ' + (s.birthYear || 1991) },
      { id: 'job',        label: 'Work',     hue: 85,  value: me.job || 'Editor',              sub: 'from your profile' },
      { id: 'edu',        label: 'Study',    hue: 190, value: me.education || 'MA Literature', sub: 'from your profile' },
      ...testRows(),
    ];
  }
  // An empty ring is a legitimate result in live mode — a fresh account has
  // filled in no Basics card and taken no test. Both callers already handle
  // it: MapTab divides by `anchors.length || 1`, and profile-general's
  // MapThumbCard returns null on a zero-length list.
  function list() {
    // The module import, not `window.LIVE`: data/live.ts is already in the
    // entry chunk (main.jsx imports initLive from it), so this costs no
    // bytes and keeps check:globals rule 4 pointing the right way. The
    // `window.LIVE && …` existence half of the old idiom is dead with it —
    // an imported binding cannot be unset — but `.enabled` is data and
    // stays: it is false for the whole of mock mode.
    return (LIVE.enabled ? liveList() : demoList()).filter((r) => r.value);
  }
  function tTaken(key) {
    const R = IS_TEST_RESULTS[key];
    return R && R.taken ? (R.title + ' · taken ' + R.taken) : '';
  }

  // ── per-question relations: [anchorId, strength 1–3, one short line] ───────
  // Lines reference Mira's actual profile (O78 C62 E48 A71 N42 · green-left ·
  // meaning 71, beauty 78 · loyal 84, warm 78 · systems 78 · editor · MA lit).
  const REL = {
    dq30: [ // Messi or Ronaldo
      ['age', 2, 'this rivalry ran through your twenties — most 34-year-olds hold a side'],
      ['values', 2, 'beauty at 78 tends to side with the playmaker'],
    ],
    dq29: [ // Tarantino or Wes Anderson
      ['big5', 2, 'openness 78 predicts strong director loyalties'],
      ['edu', 2, 'literature grads pick by authorship, not genre'],
    ],
    dq28: [ // Pineapple on pizza
      ['big5', 1, 'openness 78 usually says yes to odd toppings'],
      ['age', 1, 'the debate splits every age group about evenly'],
    ],
    dq27: [ // More of this year
      ['values', 3, 'meaning 71 — the wanting usually points at time and quiet'],
      ['big5', 2, 'mid extraversion wants closeness and quiet in equal parts'],
      ['job', 2, 'editors run on other people’s deadlines — time is the common ask'],
    ],
    dq26: [ // Okay to do nothing
      ['big5', 2, 'conscientiousness 62 agrees, with a small guilty pause'],
      ['values', 2, 'pleasure at 52 — rest is allowed, not worshipped'],
    ],
    dq25: [ // Mountains or sea
      ['political', 1, 'climate-first people split evenly — both are the outdoors'],
      ['big5', 1, 'openness mostly decides how far, not which'],
    ],
    dq24: [ // €500 on the street
      ['big5', 3, 'agreeableness 71 hands it in far more often than not'],
      ['values', 2, 'circle 46 — care leans close, but strangers still register'],
      ['political', 1, 'flat-authority types still mostly choose the honest desk'],
    ],
    dq23: [ // Optimism next ten years
      ['values', 3, 'future 58 — cautious hope is exactly this question'],
      ['political', 2, 'tech-optimists at 64 rate the decade higher'],
      ['big5', 2, 'low sensitivity keeps the number from sinking'],
    ],
    dq22: [ // People basically trustworthy
      ['big5', 3, 'agreeableness 71 is the single best predictor of yes'],
      ['attachment', 2, 'open 64 — people who let others in expect good faith'],
      ['political', 1, 'internationalists lean trusting'],
    ],
    dq21: [ // Plan or wing it
      ['big5', 3, 'conscientiousness 62 books the first nights, then loosens'],
      ['job', 1, 'editors plan by default — an itinerary is a draft'],
    ],
    dq20: [ // Perfect morning
      ['big5', 2, 'mid extraversion starts quiet more often than social'],
      ['job', 1, 'print people guard slow mornings'],
      ['age', 1, 'mid-thirties mornings drift earlier'],
    ],
    dq19: [ // Job vs partner
      ['attachment', 3, 'loyal 84 — this one stays, or finds the third way'],
      ['values', 2, 'duty 64 outweighs the title'],
      ['job', 2, 'editing is a networked trade — moving costs the web'],
    ],
    dq18: [ // Watch or play sport
      ['age', 2, 'mid-thirties is when watching quietly overtakes playing'],
      ['big5', 2, 'extraversion 48 — plays with few, watches with many'],
    ],
    dq17: [ // Suffering gives meaning
      ['values', 3, 'meaning 71 says yes — struggle carries weight for you'],
      ['edu', 2, 'literature degrees agree; it’s half the syllabus'],
      ['big5', 2, 'openness 78 sits with the hard idea rather than around it'],
    ],
    dq16: [ // Energy today
      ['big5', 1, 'sensitivity 42 keeps the daily swings small'],
      ['age', 1, 'energy at 34 is mostly sleep, not age'],
    ],
    dq15: [ // Text or call
      ['big5', 3, 'extraversion 48 texts first, calls the inner few'],
      ['attachment', 2, 'warm 78 is why the calls still happen at all'],
      ['age', 2, 'your cohort texts by default'],
    ],
    dq14: [ // Coffee, tea, or neither
      ['job', 2, 'editing runs on coffee — the trade’s oldest tool'],
      ['age', 1, 'coffee peaks right around your decade'],
    ],
    dq13: [ // Tech making us lonelier
      ['political', 3, 'surveillance-wary but tech-hopeful — agrees, with reservations'],
      ['values', 2, 'tech 62 resists the bleakest reading'],
      ['age', 1, 'the generation that remembers both sides of the divide'],
    ],
    dq12: [ // Life well lived
      ['values', 3, 'meaning 71 and beauty 78 point at creation'],
      ['attachment', 2, 'warm 78 keeps connection a close second'],
    ],
    dq11: [ // Know your death date
      ['big5', 2, 'sensitivity 42 — low dread makes “know” thinkable'],
      ['values', 2, 'meaning-seekers ask what the number would change'],
    ],
    dq10: [ // How rested
      ['age', 1, 'rest at 34 tracks habits more than years'],
      ['big5', 1, 'conscientiousness 62 protects the bedtime, mostly'],
    ],
    dq09: [ // Few deep friendships
      ['big5', 3, 'extraversion 48 — the textbook few-and-deep profile'],
      ['attachment', 3, 'loyal 84 was never going to say many'],
    ],
    dq08: [ // Free evening
      ['big5', 2, 'mid extraversion — a book wins most weeks, friends some'],
      ['edu', 2, 'the MA never really left the reading chair'],
      ['job', 1, 'reading for a living rarely spoils reading for joy'],
    ],
    dq07: [ // Honest vs kind
      ['big5', 3, 'agreeableness 71 bends the truth toward kindness'],
      ['attachment', 2, 'warm 78 breaks ties in kindness’s favour'],
    ],
    dq06: [ // Early bird or night owl
      ['age', 2, 'chronotypes drift earlier through the thirties'],
      ['big5', 2, 'conscientiousness 62 leans lark, weekends excepted'],
    ],
    dq05: [ // Control over life
      ['big5', 2, 'sensitivity 42 reads life as steerable'],
      ['job', 2, 'independent-press work keeps the number honest'],
      ['values', 1, 'future 58 — hopeful, hands on the wheel'],
    ],
    dq04: [ // Sense of self
      ['job', 3, 'people in making trades answer “what I make”'],
      ['edu', 2, 'literature people split between make and believe'],
      ['values', 2, 'meaning 71 rules out “what I do” alone'],
    ],
    dq03: [ // Relive best day or new one
      ['big5', 2, 'openness 78 almost always takes the new day'],
      ['age', 1, 'the relive vote grows with age — not yet'],
    ],
    dq02: [ // Season for the soul
      ['values', 2, 'beauty 78 picks the melancholy seasons at twice the rate'],
      ['big5', 1, 'open types feel the seasons harder'],
    ],
    dq01: [ // Most would help a stranger
      ['values', 3, 'circle 46 — believes it mildly, helps locally'],
      ['big5', 2, 'agreeableness 71 says yes on people’s behalf'],
      ['political', 1, 'trust in strangers leans left of centre'],
    ],
  };

  // fallbacks by topic, for questions without a curated entry
  const FALLBACK = {
    Sport:     [['age', 2, 'sport taste is generational'], ['big5', 1, 'extraversion shapes how you engage']],
    Film:      [['big5', 2, 'openness 78 drives taste breadth'], ['edu', 1, 'trained readers watch like readers']],
    Food:      [['age', 1, 'food splits run young–old'], ['big5', 1, 'openness says try it']],
    Travel:    [['big5', 2, 'openness 78 sets the range'], ['political', 1, 'green politics travels lighter']],
    Mind:      [['big5', 2, 'temperament questions map onto the Big Five'], ['values', 1, 'meaning 71 colours the answer']],
    Morals:    [['big5', 2, 'agreeableness 71 leans generous'], ['values', 2, 'ethics 44 — your morals lean situational']],
    Values:    [['values', 2, 'closest to your values test'], ['big5', 2, 'openness and agreeableness pull the answer']],
    Body:      [['age', 2, 'the body keeps the calendar'], ['big5', 1, 'conscientiousness runs the routine']],
    Skills:    [['job', 2, 'craft answers track the trade'], ['big5', 1, 'openness picks the next craft']],
    Interests: [['big5', 2, 'openness 78 is the collector'], ['edu', 1, 'the degree shows in the shelf']],
    Home:      [['age', 1, 'home answers settle with the decade'], ['values', 1, 'beauty 78 arranges the rooms']],
    Story:     [['age', 2, 'the timeline is the anchor'], ['edu', 1, 'the study years bent the path']],
    Goals:     [['values', 2, 'meaning 71 sets the horizon'], ['job', 1, 'the trade shapes the ambition']],
    Music:     [['big5', 2, 'openness 78 sets the playlist'], ['age', 1, 'the ear is set young']],
  };

  // DEMO ONLY — no caller today, and it must not gain one in live mode
  // without a rewrite. Every line above is prose about Mira ("openness 78
  // sets the playlist"), and the keys are the prototype's `dq*` ids, so a
  // live question misses REL entirely and lands on a FALLBACK line whose
  // numbers belong to somebody else. Kept because the curation is real
  // work and the mock path is where it reads correctly.
  function relate(qid, top) {
    const rows = REL[qid] || FALLBACK[top] || [['big5', 1, 'temperament shapes this one']];
    return rows.map((r) => ({ a: r[0], s: r[1], line: r[2] }));
  }

  listExport = list;
  relateExport = relate;
})();

// CONVERTED off the shared-global bridge (D39): `window.MapAnchors` is gone
// and the two consumers (map-tab.jsx, profile-general.jsx) import these.
// The conversion is what pays for the `window.LIVE` read above under
// check:globals rule 4 — and it removes the load-order condition with it,
// so the `window.MapAnchors && …` guards both callers carried are deleted
// rather than translated. The data condition is NOT removed: list() can
// still return [], and both callers still handle that.
export const list = listExport;
export const relate = relateExport;

