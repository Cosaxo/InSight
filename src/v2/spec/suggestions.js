// Ported from design/spec-modules/suggestions.js (the historical prototype), then
// re-synced from design/standalone-v24/suggestions.js (the commissioned §8 board
// design) and CONVERTED off the global bridge in the same change: named export,
// no window.SUGGESTIONS. spec-index.js still lists this module (rule 2), and the
// purge listener below is the side effect that listing preserves.
//
// suggestions.js — "Suggest a question": a community suggestion board.
// People propose questions; the most-upvoted, once they clear review, get
// promoted into the Daily for everyone. NOT an infinite feed — a bounded board
// you visit on purpose.
//
// Two modes, honestly separated (D1):
//   · DEMO — the prototype room: seeded community suggestions, baked statuses,
//     your submissions in localStorage. Untouched from the design.
//   · LIVE — your own submissions are REAL (data/suggestions.ts → the D137
//     backend: suggestQuestionV2, review verdicts, the reviewer's note). The
//     community board has no live pool yet — a public voting board is its own
//     decision — so the seeds render under a Preview tag instead of pretending.
import LIVE from '../data/live';
import { IS_DATA } from './sample-data.js';

// The data layer and the label resolver arrive by DYNAMIC import, kicked
// from ensureLive() when the board opens — this store is in the eager
// first-paint graph (spec-index.js) and check:bundle's budget is why:
// nothing about a closed board should cost a byte at boot (D110/D124).
let sgData = null; // ../data/suggestions, once the board has opened
let sgBucketLabel = null; // ../ui/cohortLabels.bucketLabel, same ride

// seeded community suggestions (newest activity varies; a few already picked)
const SEED = [
  { id: 'sg01', prompt: 'Beach holiday or city break?', type: 'binary', options: ['Beach', 'City break'], by: 'Henrik V.', hue: 200, votes: 1846, status: 'picked', ago: '3d' },
  { id: 'sg02', prompt: 'Is it ever okay to read a partner’s messages?', type: 'dilemma', options: ['Never', 'Only if worried', 'Yes'], by: 'Aud K.', hue: 305, votes: 1622, status: 'picked', ago: '5d' },
  { id: 'sg03', prompt: 'Dogs or cats?', type: 'binary', options: ['Dogs', 'Cats'], by: 'Petra S.', hue: 35, votes: 1490, status: 'picked', ago: '2d' },
  { id: 'sg04', prompt: 'Would you take a pill that removed the need for sleep?', type: 'binary', options: ['Yes', 'No'], by: 'Sondre L.', hue: 255, votes: 1204, status: 'review', ago: '1d' },
  { id: 'sg05', prompt: 'How much does a place’s weather shape who you are?', type: 'rating', by: 'Iben M.', hue: 150, votes: 1098, status: 'review', ago: '4d' },
  { id: 'sg06', prompt: 'The book or the film?', type: 'binary', options: ['The book', 'The film'], by: 'Tobias R.', hue: 78, votes: 980, status: 'review', ago: '6d' },
  { id: 'sg07', prompt: 'Money can buy happiness.', type: 'scale', by: 'Nina D.', hue: 165, votes: 902, status: 'review', ago: '2d' },
  { id: 'sg08', prompt: 'You can keep one memory forever — which kind?', type: 'choice', options: ['A person', 'A place', 'A feeling', 'A day'], by: 'Sofie A.', hue: 320, votes: 814, status: 'review', ago: '1d' },
  { id: 'sg09', prompt: 'Tea or coffee — be honest.', type: 'binary', options: ['Tea', 'Coffee'], by: 'Lars V.', hue: 30, votes: 760, status: 'review', ago: '3d' },
  { id: 'sg10', prompt: 'Is talent or hard work more important?', type: 'binary', options: ['Talent', 'Hard work'], by: 'Kari T.', hue: 240, votes: 642, status: 'review', ago: '7d' },
  { id: 'sg11', prompt: 'Would you want to live to 150 if you stayed healthy?', type: 'binary', options: ['Yes', 'No'], by: 'Jonas E.', hue: 12, votes: 528, status: 'review', ago: '5d' },
];

// ── the three hints a suggestion can carry. Hints, not settings: the review
// decides, and the composer says so.
const CADENCE = [['once', 'once'], ['weekly', 'once a week'], ['daily', 'every day']];
const AUDIENCE = () => {
  if (LIVE.enabled) {
    // The viewer's own anchors name the places. D125's rule holds even
    // before the lazy resolver lands: the fallback is the generic label,
    // never the raw bucket key ("NO" must not reach a chip).
    const a = LIVE.anchors() || {};
    return [
      ['world', 'everyone'],
      ['country', a.country && sgBucketLabel ? sgBucketLabel('country', a.country) : 'your country'],
      ['city', a.city || 'your city'],
      ['like', 'people like me'],
    ];
  }
  const me = IS_DATA.me || {};
  return [['world', 'everyone'], ['country', me.country || 'your country'], ['city', me.location || 'your city'], ['like', 'people like me']];
};

// ── declines, written kindly and with the standard stated. A refusal that
// doesn't say the number it missed reads as a shrug. DEMO copy: the numbers in
// it are the prototype's. A live decline carries the server's reason (the
// callable's message at the door, the reviewer's note after review) instead —
// rendering this table for a real row would be an invented statistic.
const DECLINE = {
  place: {
    line: 'asked for one city only',
    why: 'A city-only question needs about 500 answers in its week to be worth reading. Oslo returned 180 last week, so the split would have been noise dressed as a finding.',
    offer: 'Send it again for Norway — Oslo still comes back as its own cut, so you get the city answer either way.',
    offerAudience: 'country',
  },
  narrow: {
    line: 'too few people could answer it',
    why: 'Fewer than one in twenty voters had the experience this question assumes, and the rest would have guessed.',
    offer: 'Ask the version everyone can answer, then the cut for people who have done it.',
  },
  dupe: {
    line: 'already ran',
    why: 'Nearly the same question ran on 3 Aug with 24k answers.',
    offer: 'Read that result instead — and if your wording changes the meaning, say how and send it again.',
  },
};

// Your own DEMO board is never an empty room: three submissions, one in each
// live state, until you have made your own. Demo only — a live board renders
// your real rows or an honest empty state, never these.
const MINE_DEMO = [
  { id: 'sgd1', prompt: 'Is it rude to take a call on speaker in public?', type: 'binary', options: ['Rude', 'Fine'], by: 'You', hue: 305, votes: 268, status: 'review', ago: '1d', cadence: 'once', audience: 'world', demo: true },
  { id: 'sgd2', prompt: 'Would you rather never be late or never wait?', type: 'binary', options: ['Never late', 'Never wait'], by: 'You', hue: 35, votes: 1441, status: 'picked', ago: '9d', ran: 'ran as the daily on 9 Aug', cadence: 'once', audience: 'world', demo: true },
  { id: 'sgd3', prompt: 'Should Oslo ban cars inside Ring 1?', type: 'binary', options: ['Ban them', 'Keep access'], by: 'You', hue: 150, votes: 96, status: 'declined', ago: '6d', cadence: 'weekly', audience: 'city', decline: 'place', demo: true },
];

const LS = 'insight.suggestions.v1';
let saved = { mine: [], up: {} };
try { const j = JSON.parse(localStorage.getItem(LS) || 'null'); if (j) saved = { mine: j.mine || [], up: j.up || {} }; } catch (e) { /* absent or corrupt payload — fall back to the default initialised above. */ }
const listeners = new Set();
function persist() { try { localStorage.setItem(LS, JSON.stringify(saved)); } catch (e) { /* localStorage can throw: private mode, quota, disabled storage. Persistence here is best-effort and the in-memory state stays correct. */ } listeners.forEach((f) => f()); }

const TYPE_LABEL = { binary: 'this or that', choice: 'multiple choice', scale: 'agree / disagree', rating: 'rate 1–10', dilemma: 'dilemma' };

// A stable, meaningless hue for a live row — a coat of paint keyed to the id,
// carrying no data (the demo rows' hues are authored the same way).
const hueOf = (id) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360; return h; };
const agoOf = (atMs) => {
  if (!atMs) return 'just now';
  const mins = Math.max(0, (Date.now() - atMs) / 60000);
  if (mins < 60) return 'just now';
  if (mins < 1440) return Math.round(mins / 60) + 'h';
  return Math.round(mins / 1440) + 'd';
};

// The real rows, in the card shape the board renders. `live: true` is what
// SgMine keys its honesty changes on: no backing count (nothing counts
// backing yet), the reviewer's note as the decline text.
function liveMine() {
  const rows = (sgData && sgData.myRows()) || [];
  return rows.map((r) => ({
    id: r.id, prompt: r.prompt, type: r.type, options: r.options,
    topic: r.topicHint, by: 'You', hue: hueOf(r.id), status: r.status,
    ago: agoOf(r.atMs), cadence: r.cadenceHint || 'once',
    audience: (r.audienceHint || 'world').split(' ')[0], note: r.note,
    live: true, mine: true,
  }));
}

function all() {
  // user's own submissions are first-class; live vote = base + (you upvoted ? 1 : 0)
  const own = LIVE.enabled ? liveMine() : (saved.mine.length ? saved.mine : MINE_DEMO).map((s) => ({ ...s, mine: true }));
  const list = own.concat(SEED.map((s) => ({ ...s, demo: true })))
    .map((s) => ({ ...s, voted: !!saved.up[s.id], liveVotes: (s.votes || 0) + (saved.up[s.id] ? 1 : 0), days: s.ago === 'just now' ? -1 : (parseInt(s.ago, 10) || 99) }));
  list.sort((a, b) => b.liveVotes - a.liveVotes);
  return list;
}

export const SUGGESTIONS = {
  all,
  CADENCE, AUDIENCE, DECLINE,
  cadenceLabel: (id) => ((CADENCE.find((c) => c[0] === id) || [])[1] || 'once'),
  audienceLabel: (id) => ((AUDIENCE().find((c) => c[0] === id) || [])[1] || 'everyone'),
  // A live decline shows the review's own words; the DECLINE table is the
  // demo room's. No note yet means exactly that, and the copy says so.
  declineOf: (s) => {
    if (s && s.live) {
      return s.status === 'declined'
        ? { line: 'declined in review', why: s.note || 'The review passed on this one without a note.', offer: null }
        : null;
    }
    return s && s.decline ? DECLINE[s.decline] : null;
  },
  typeLabel: (t) => TYPE_LABEL[t] || t,
  counts() { const a = all(); return { total: a.length, picked: a.filter((s) => s.status === 'picked').length, mine: a.filter((s) => s.mine).length }; },
  hasVoted: (id) => !!saved.up[id],
  toggleVote(id) { if (saved.up[id]) delete saved.up[id]; else saved.up[id] = true; persist(); },
  /** Kick the one-shot load of your real rows. Called when the board opens
   * (never at import time — the store is in the eager graph, the query and
   * the modules behind it are not). No-op in demo mode. */
  ensureLive() {
    if (!LIVE.enabled) return;
    Promise.all([import('../data/suggestions'), import('../ui/cohortLabels')])
      .then(([d, l]) => {
        if (!sgData) {
          sgData = d;
          sgBucketLabel = l.bucketLabel;
          // The data layer's own notifications reach the board's listeners.
          d.subscribeMine(() => listeners.forEach((g) => g()));
        }
        return d.loadMine();
      })
      .then(() => listeners.forEach((g) => g()))
      .catch(() => { /* a failed load renders the empty state; reopening retries */ });
  },
  /**
   * Submit. Returns a promise either way:
   *   { ok: true, id }               — queued (live: really queued, D137)
   *   { ok: false, code, message }   — the server's refusal, written to be
   *                                    shown (the budget, the paid-path
   *                                    decline, a form bound)
   */
  submit({ prompt, type, options, topic, hue, cadence, audience }) {
    const opts = (options || []).filter(Boolean);
    if (LIVE.enabled) {
      const audLabel = (AUDIENCE().find((c) => c[0] === audience) || [])[1] || 'everyone';
      return import('../data/suggestions').then((d) => d.submitSuggestion({
        prompt: String(prompt || '').trim(),
        type: type || 'binary',
        options: opts,
        topicHint: (topic || '').trim() || null,
        // The id plus the resolved place, so the reviewer reads "city ·
        // Oslo, NO" rather than a bare token.
        audienceHint: audience && audience !== 'world' ? audience + ' · ' + audLabel : 'world',
        cadenceHint: cadence || 'once',
        credit: false,
      }));
    }
    const id = 'sgu' + Date.now().toString(36);
    const s = {
      id, prompt: String(prompt || '').trim(), type: type || 'binary',
      options: opts, topic: (topic || '').trim() || null,
      by: 'You', hue: hue != null ? hue : 282, votes: 1, status: 'review', ago: 'just now',
      cadence: cadence || 'once', audience: audience || 'world',
    };
    // keeping the seeded three would read as your submissions; the first real
    // one takes the board over
    saved.mine.unshift(s);
    saved.up[id] = true; // you back your own
    persist();
    return Promise.resolve({ ok: true, id });
  },
  subscribe(f) { listeners.add(f); return () => listeners.delete(f); },
};

// The purge (data/live.ts, D51): drop the in-memory copy too, or the next
// toggleVote()'s persist writes the previous account's submissions back
// under the new uid — authored questions rendered as "You". The live cache
// goes with it (a wiped device must not render the previous account's
// queue). Notify without re-creating the purged key.
window.addEventListener('insight:local-purge', () => {
  saved = { mine: [], up: {} };
  // If the lazy data layer never loaded, there is no live cache to clear.
  if (sgData) sgData.clearSuggestionCache();
  listeners.forEach((f) => f());
});
