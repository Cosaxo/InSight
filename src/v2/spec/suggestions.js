// Ported from design/spec-modules/suggestions.js (the historical prototype),
// re-synced from design/standalone-v24/suggestions.js (the §8 board design),
// CONVERTED off the global bridge in the same change — and CUT DOWN
// 2026-08-24 with design/standalone-2026-08-24/suggestions.jsx (D288 §1):
// the community board retired, so the seeded board, the upvote budget and
// the vote persistence went with it. What remains is the store for the ONE
// door that exists now — your own asks, each of them a paid ask.
//
// suggestions.js — "Ask a question": the paid door's store.
// Every question through it is bought for a place and a window, reviewed,
// and always marked PAID on the card. There is no free community path to
// fall back to, so there is nothing here to upvote and nothing seeded.
//
// Two modes, honestly separated (D1):
//   · DEMO — the prototype room: your submissions in localStorage, three
//     baked examples (one per state) until you have made your own.
//   · LIVE — your submissions are REAL (data/suggestions.ts → the D138
//     backend: suggestQuestionV2, review verdicts, the reviewer's note).
//     The review conversation is where the contract is arranged — the
//     door says so instead of pretending a checkout exists (D288 §3).
import LIVE from '../data/live';
import { IS_DATA } from './sample-data.js';

// The data layer and the label resolver arrive by DYNAMIC import, kicked
// from ensureLive() when the door opens — this store is in the deferred
// overlays group, but the queries and the modules behind them still cost
// nothing until a real open (D124/D129 posture).
let sgData = null; // ../data/suggestions, once the door has opened
let sgBucketLabel = null; // ../ui/cohortLabels.bucketLabel, same ride

// ── the hints an ask can carry. Hints, not settings: the review decides,
// and the composer says so. `like` is unreachable from the scope ruler now
// but stays for LABEL RESOLUTION — rows submitted before D288 carry it.
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

// Your own DEMO room is never empty: three asks, one in each live state,
// until you have made your own. Demo only — a live door renders your real
// rows or an honest empty state, never these.
const MINE_DEMO = [
  { id: 'sgd1', prompt: 'Is it rude to take a call on speaker in public?', type: 'binary', options: ['Rude', 'Fine'], by: 'You', hue: 305, status: 'review', ago: '1d', cadence: 'once', audience: 'world', demo: true },
  { id: 'sgd2', prompt: 'Would you rather never be late or never wait?', type: 'binary', options: ['Never late', 'Never wait'], by: 'You', hue: 35, status: 'picked', ago: '9d', ran: 'ran as the daily on 9 Aug', cadence: 'once', audience: 'world', demo: true },
  { id: 'sgd3', prompt: 'Should Oslo ban cars inside Ring 1?', type: 'binary', options: ['Ban them', 'Keep access'], by: 'You', hue: 150, status: 'declined', ago: '6d', cadence: 'weekly', audience: 'city', decline: 'place', demo: true },
];

// The key predates D288 and the shape shrank with the board (`up` — the
// upvote map — died with it): old payloads still parse, the dead half is
// simply never read again and the next persist writes the new shape.
const LS = 'insight.suggestions.v1';
let saved = { mine: [] };
try { const j = JSON.parse(localStorage.getItem(LS) || 'null'); if (j) saved = { mine: j.mine || [] }; } catch (e) { /* absent or corrupt payload — fall back to the default initialised above. */ }
const listeners = new Set();
function persist() { try { localStorage.setItem(LS, JSON.stringify(saved)); } catch (e) { /* localStorage can throw: private mode, quota, disabled storage. Persistence here is best-effort and the in-memory state stays correct. */ } listeners.forEach((f) => f()); }

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

// The real rows, in the card shape the door renders. `live: true` is what
// SgMine keys its honesty changes on: the reviewer's note as the decline
// text, never the demo DECLINE table.
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

/** Your asks, newest first — the only list the door draws (D288 §1). */
function mine() {
  const own = LIVE.enabled ? liveMine() : (saved.mine.length ? saved.mine : MINE_DEMO).map((s) => ({ ...s, mine: true }));
  return own
    .map((s) => ({ ...s, days: s.ago === 'just now' ? -1 : (parseInt(s.ago, 10) || 99) }))
    .sort((a, b) => a.days - b.days);
}

export const SUGGESTIONS = {
  mine,
  CADENCE, AUDIENCE, DECLINE,
  cadenceLabel: (id) => ((CADENCE.find((c) => c[0] === id) || [])[1] || 'once'),
  audienceLabel: (id) => ((AUDIENCE().find((c) => c[0] === id) || [])[1] || 'everyone'),
  /** The name the ask would wear (the door's "wear your name" chip preview).
   * Live: the real display name, or the neutral pronoun while it is unset —
   * never a demo persona. */
  meName: () => (LIVE.enabled ? (LIVE.displayName || 'You') : ((IS_DATA.me || {}).name || 'You')),
  /** The age band the age dim would print, or null when the account has no
   * age anchor to name one — the chip simply does not render then, because
   * offering a dim the door cannot state would be an invented figure. */
  ageBand: () => (LIVE.enabled ? ((LIVE.anchors() || {}).age || null) : '25–34'),
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
  counts() { return { mine: mine().length }; },
  /** Kick the one-shot load of your real rows. Called when the door opens
   * (never at import time — the queries and the modules behind them stay
   * unpaid until a real open). No-op in demo mode. */
  ensureLive() {
    if (!LIVE.enabled) return;
    Promise.all([import('../data/suggestions'), import('../ui/cohortLabels')])
      .then(([d, l]) => {
        if (!sgData) {
          sgData = d;
          sgBucketLabel = l.bucketLabel;
          // The data layer's own notifications reach the door's listeners.
          d.subscribeMine(() => listeners.forEach((g) => g()));
        }
        return d.loadMine();
      })
      .then(() => listeners.forEach((g) => g()))
      .catch(() => { /* a failed load renders the empty state; reopening retries */ });
  },
  /**
   * Submit. Returns a promise either way:
   *   { ok: true, id }               — queued (live: really queued, D138)
   *   { ok: false, code, message }   — the server's refusal, written to be
   *                                    shown (the budget, a form bound)
   *
   * No paid flag on the wire: since D288 §1 EVERY submission through this
   * door is a paid ask, so the callable needs no second bit to say so —
   * the review conversation that follows is where the contract starts.
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
      by: 'You', hue: hue != null ? hue : 282, status: 'review', ago: 'just now',
      cadence: cadence || 'once', audience: audience || 'world',
    };
    // keeping the baked three would read as your asks; the first real one
    // takes the room over
    saved.mine.unshift(s);
    persist();
    return Promise.resolve({ ok: true, id });
  },
  subscribe(f) { listeners.add(f); return () => listeners.delete(f); },
};

// The purge (data/live.ts, D51): drop the in-memory copy too, or the next
// submit()'s persist writes the previous account's asks back under the new
// uid — authored questions rendered as "You". The live cache goes with it
// (a wiped device must not render the previous account's queue). Notify
// without re-creating the purged key.
window.addEventListener('insight:local-purge', () => {
  saved = { mine: [] };
  // If the lazy data layer never loaded, there is no live cache to clear.
  if (sgData) sgData.clearSuggestionCache();
  listeners.forEach((f) => f());
});
