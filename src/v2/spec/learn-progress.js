// Ported from design/InSight_standalone_15.html (learn-progress.js, 2026-07-31
// revision). THIS file is the live source now, hand-edits and all.
// OFF THE GLOBAL BRIDGE (D109): `LEARN` is a named export, and the content
// it folds arrives as imports rather than as globals this file hoped had
// already been assigned. `window.LIVE` (see below) is the one cross-module
// global left here, read at call time.
import { LEARN_CARDS, LEARN_FIELDS, LEARN_SPLIT, LEARN_SUBJECTS } from './learn-data.js';
// Which build's cards these are (D284). `LEARN_CARDS` above is the demo
// SAMPLE now — five a field, compiled in so the demo build has something
// to serve — and a live build's bank arrives here after boot.
import { learnCards, learnFieldTotal, subscribeLearnBank } from '../data/learnBank.ts';

// learn-progress.js — the engine behind Learn. Three ideas, no more:
//
//   1. Right first time → you know it. It goes on your map immediately.
//   2. Wrong → the card drops into a queue and needs three rights IN A ROW to
//      be earned. The three must be SPACED (at least GAP cards apart), or it is
//      short-term memory, not knowledge. One miss empties all three dots.
//   3. Your level per field is a target difficulty, expressed in the only unit
//      the app trusts: the % of the crowd who get a card right. Right answers
//      push you toward harder cards, misses back off. Aiming for ~80% success.
//
// Known cards come back once, rarely, weeks later. Miss the check-in and the
// fact leaves your map — a map you cannot lose things from is not a map.
// The IIFE's own return value is the export — no hoisted `export let` needed
// here, unlike DAILYQ / FRIENDS / SCENES / DUELS, because this module already
// wrote `window.LEARN = (function () {…})()` rather than assigning from inside.
export const LEARN = (function () {
  const LS = 'insight.learn.v3';
  const LS_F = 'insight.learnFields.v1';
  // Imports, not `window.X || []`. The `|| []` was a load-order guard reading
  // at MODULE SCOPE: it silently substituted an empty card bank for the real
  // one if spec-index.js ever listed learn-data.js after this file, which is
  // the failure D109's learn-data.js header describes. An imported binding
  // cannot be unset, and learn-data.js depends on nothing that could put it in
  // TDZ, so the fallbacks are gone rather than rewritten.
  // `let`, and the reason is the one thing about D284 that touches this
  // file: the bank is no longer known at module scope. A demo build's
  // sample is (it is compiled in), but a live build's cards arrive when
  // `hydrate()` publishes them, which is after every line here has run. So
  // the cards are re-read and re-indexed on that signal rather than
  // captured once — see `adopt()` below.
  let CARDS = learnCards(LEARN_CARDS);
  const FIELDS = LEARN_FIELDS;
  const SUBJECTS = LEARN_SUBJECTS;
  const GAP = 4;        // cards that must pass before a repeat counts
  const STREAK = 3;     // rights in a row to earn a missed card
  const CHECKIN_D = 12; // days before a known card comes back once
  const L0 = 62;        // everyone starts where ~62% of the crowd is right
  const LMIN = 24, LMAX = 92;

  // FIELDS and SUBJECTS are the taxonomy and still ship whole, so their two
  // indexes are built once. The card indexes are rebuilt whenever the pool
  // changes — `let` for the same reason CARDS is.
  let BYID = {}, BYF = {};
  const FBY = {}, SBY = {};
  const indexCards = () => {
    BYID = {}; BYF = {};
    CARDS.forEach((c) => { BYID[c.id] = c; (BYF[c.f] = BYF[c.f] || []).push(c); });
  };
  indexCards();
  FIELDS.forEach((f) => { FBY[f.id] = f; });
  SUBJECTS.forEach((s) => { SBY[s.id] = s; });

  const listeners = new Set();
  const fire = () => listeners.forEach((f) => { try { f(); } catch (e) { /* a subscriber that throws must not stop the others — one broken listener would silence the store for every screen watching it. NOT storage: the comment here said localStorage for years, pasted from the save() above. */ } });

  // The live bank, when it lands (D284). `hydrate()` publishes it well
  // after this module evaluated, so the pool is re-read and the two card
  // indexes rebuilt — then `fire()`, because every mounted consumer is
  // holding a render made against the sample and none of them polls.
  //
  // A demo build never calls the publisher, so this never fires there and
  // the sample stays. No unsubscribe: the engine is a singleton for the
  // life of the tab, and a store that outlives every subscriber has
  // nothing to tear down.
  subscribeLearnBank(() => {
    CARDS = learnCards(LEARN_CARDS);
    indexCards();
    fire();
  });

  let S;
  try { S = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { S = null; }
  if (!S || typeof S !== 'object') S = null;
  // first run is seeded, like friends and daily answers are: a few facts already
  // held so the map is never an empty room, and one card mid-streak so the
  // three-in-a-row rule is discoverable without having to fail at it first.
  //
  // …in the DEMO build only. A live build starts Learn at its real zero
  // (D32): the map claims mastery of what you actually answered, and six
  // pre-known cards would be fabricated activity (D1). Gated on the build
  // flag rather than window.LIVE.enabled because this seed runs at module
  // scope, before the live boot has attached — the same signal live.ts's
  // demoInProd reads.
  const LIVE_BUILD = import.meta.env && import.meta.env.VITE_V2_LIVE === 'true';
  // One builder for the fresh-boot state, used by the cold load AND the
  // purge listener below — a field added to the shape lands in both, so the
  // two can never diverge.
  function freshS() {
    if (LIVE_BUILD) return { c: {}, lvl: {}, pos: 0, order: [] };
    const s = { c: {}, lvl: {}, pos: 9, order: ['cell2', 'cell4', 'sol1', 'sol5', 'cap1', 'cap4'] };
    const t0 = Date.now();
    s.order.forEach((id, i) => { s.c[id] = { s: 'known', k: STREAK, seen: 1, miss: 0, pos: i, at: t0 - (6 - i) * 864e5 }; });
    s.c.sol2 = { s: 'learning', k: 1, seen: 2, miss: 1, pos: 7, at: 0 };   // “Venus is hottest” — missed once, one right so far
    s.lvl = { cell: 54, solar: 66, capitals: 58 };
    return s;
  }
  // EVERY FIELD, not three (D283 — the owner's decision, 2026-08-24).
  //
  // This used to seed `['cell', 'solar', 'capitals']`, and D115 derived
  // FIELD_TARGET from exactly that: at 8 cards a field, three followed
  // fields is 24 fresh cards and about eight days of runway. The three
  // were "stocked from day one", which was the right reading of a bank
  // that had 8 per field and nothing behind it.
  //
  // What it cost, once the bank had grown: `pool()` serves the followed
  // fields and nothing else, so a fresh install could only ever meet 34
  // of the 146 cards in it. Reported from a device as there being far too
  // few learn questions — and the app was showing under a quarter of what
  // it had. Following everything is not more cards a sitting, it is the
  // same cards drawn from four times the bank: the RATE is LEARN_FEED's
  // frequency dial (one card in seven by default), and it is untouched.
  //
  // That reverses learn-feed.js's "how many fields you follow is already
  // an intensity control", deliberately and only for the DEFAULT. The
  // control is still there — it just starts at everything, the way the
  // feed's topics do (D96: "a live build runs EVERY subject its bank
  // stocks, always on"), and narrowing is a thing you choose rather than
  // a thing you have to discover. The topic sheet gained the row that
  // makes that possible in the same change; before it, the follow list
  // was one-way and this default would have been a trap.
  function freshF() {
    const f = FIELDS.map((x) => x.id).filter((id) => FBY[id]);
    return f.length ? f : ['cell'];
  }
  if (!S) S = freshS();
  S.c = S.c || {}; S.lvl = S.lvl || {}; S.pos = S.pos || 0; S.order = Array.isArray(S.order) ? S.order : [];

  let F;
  try { F = JSON.parse(localStorage.getItem(LS_F) || 'null'); } catch (e) { F = null; }
  if (!Array.isArray(F)) F = freshF();
  F = F.filter((id) => FBY[id]);
  if (!F.length) F = ['cell'];

  const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { /* localStorage can throw: private mode, quota, disabled storage. Best-effort — in-memory state stays correct. */ } fire(); };
  const saveF = () => { try { localStorage.setItem(LS_F, JSON.stringify(F)); } catch (e) { /* localStorage can throw: private mode, quota, disabled storage. Best-effort — in-memory state stays correct. */ } fire(); };
  // The purge (data/live.ts, D51): both keys are already gone; drop the
  // in-memory mastery map and field list to their fresh-boot shapes too, or
  // the next answer()'s save() writes the previous account's map back under
  // the new uid. fire() without save() — do not re-create the purged keys.
  window.addEventListener('insight:local-purge', () => { S = freshS(); F = freshF(); fire(); });

  const st = (id) => S.c[id] || null;
  const lvl = (fid) => (S.lvl[fid] == null ? L0 : S.lvl[fid]);
  const hueOf = (fid) => { const f = FBY[fid]; const s = f && SBY[f.subject]; return s ? s.hue : 250; };
  const colorOf = (fid) => 'oklch(0.52 0.14 ' + hueOf(fid) + ')';
  const pool = () => { const out = []; F.forEach((fid) => (BYF[fid] || []).forEach((c) => out.push(c))); return out; };

  // The two re-serves that COUNT, shared by plan() and the public due()
  // below so they can never disagree: the queued repeat that has waited out
  // GAP, and the rare check-in on a known card. Everything else a plan can
  // fall back to (slow, warm) is filler for a thin pool — answering it again
  // now would be the massed practice rule 2 exists to prevent.
  const dueRepeat = (s) => !!s && s.s === 'learning' && s.k < STREAK && S.pos - s.pos >= GAP;
  const dueCheckin = (s, now) => !!s && s.s === 'known' && now - (s.at || 0) > CHECKIN_D * 864e5 && S.pos - s.pos >= 12;

  // plan the next n cards WITHOUT answering any of them, so the scroll can ship
  // stocked instead of unlocking one card at a time. Same priority order as a
  // single pick: a queued repeat that has waited, the rare check-in, then
  // something new at your level.
  function plan(n, only, exclude) {
    let P = only ? (BYF[only] || []).slice() : pool();
    if (exclude && exclude.length) P = P.filter((c) => exclude.indexOf(c.id) < 0);
    if (!P.length) return [];
    const now = Date.now();
    const due = P.filter((c) => dueRepeat(st(c.id))).sort((a, b) => st(a.id).pos - st(b.id).pos);
    const chk = P.filter((c) => dueCheckin(st(c.id), now)).sort((a, b) => (st(a.id).at || 0) - (st(b.id).at || 0));
    const fresh = P.filter((c) => !st(c.id)).sort((a, b) => Math.abs(a.p - lvl(a.f)) - Math.abs(b.p - lvl(b.f)));
    const slow = P.filter((c) => { const s = st(c.id); return s && s.s === 'learning' && s.k < STREAK; }).sort((a, b) => st(a.id).pos - st(b.id).pos);
    const warm = P.slice().sort((a, b) => ((st(a.id) || {}).pos || 0) - ((st(b.id) || {}).pos || 0));
    const used = {};
    const take = (arr) => { while (arr.length) { const c = arr.shift(); if (!used[c.id]) { used[c.id] = 1; return c; } } return null; };
    const out = [];
    for (let i = 0; out.length < n; i++) {
      let c = null;
      if ((S.pos + i) % 7 === 6) c = take(chk);
      if (!c) c = take(due);
      if (!c) c = take(fresh);
      if (!c) c = take(slow);
      if (!c) c = take(warm);
      if (!c) break;
      out.push(c);
    }
    return out;
  }

  function next(only, exclude) {
    return plan(1, only, exclude)[0] || null;
  }

  function answer(id, pick) {
    const card = BYID[id];
    if (!card) return null;
    const ok = pick === card.c;
    const was = st(id);
    // First exposure only feeds the crowd stat (D32): `was == null` means
    // this tap is the first time this device has seen the card — the one
    // moment that measures difficulty rather than the scheduler's own
    // retries. Later attempts stay in this file's localStorage, and the
    // create-only answer rule refuses them server-side anyway.
    if (!was && window.LIVE && window.LIVE.enabled && window.LIVE.learnAnswer) {
      window.LIVE.learnAnswer(id, pick);
    }
    const cur = was ? { ...was } : { s: 'new', k: 0, seen: 0, miss: 0, pos: -99, at: 0 };
    const wasKnown = cur.s === 'known';
    cur.seen++; cur.pos = S.pos;
    let mastered = false, lost = false;
    if (ok) {
      if (wasKnown) cur.at = Date.now();                       // check-in passed
      else if (cur.s === 'learning') { cur.k++; if (cur.k >= STREAK) { cur.s = 'known'; cur.at = Date.now(); mastered = true; } }
      else { cur.s = 'known'; cur.k = STREAK; cur.at = Date.now(); mastered = true; }
    } else {
      if (wasKnown) lost = true;
      cur.s = 'learning'; cur.k = 0; cur.miss++;
    }
    S.c[id] = cur;
    S.pos++;
    S.lvl[card.f] = Math.max(LMIN, Math.min(LMAX, lvl(card.f) + (ok ? -4 : 6)));
    if (mastered && S.order.indexOf(id) < 0) S.order.push(id);
    if (lost) S.order = S.order.filter((x) => x !== id);
    save();
    // `split` is null in a live build with nothing published for this card
    // (D149) — the reveal re-reads LEARN_SPLIT at render anyway, and no
    // caller reads this field. Kept for the demo, where it is the authored
    // model and the only source there is.
    //
    // `repeat` is the same fact `was` gates the send on, handed to the
    // reveal (D157). The crowd split counts FIRST tries — that is what
    // makes it a difficulty measurement — so on a re-serve the answer you
    // have just given is deliberately not in it, and the reveal has to
    // say so. Without it the reader sees a tick beside "0 people · 0%"
    // and no explanation anywhere on the screen, which is the fault this
    // was reported as.
    return { ok, mastered, lost, wasKnown, repeat: !!was, streak: cur.k, correct: card.c, split: LEARN_SPLIT(card) };
  }

  return {
    STREAK,
    subjects: () => SUBJECTS.slice(),
    fields: () => FIELDS.slice(),
    field: (id) => FBY[id] || null,
    subject: (id) => SBY[id] || null,
    fieldsOf: (sid) => FIELDS.filter((f) => f.subject === sid),
    card: (id) => BYID[id] || null,
    // The BANK's count where the published order carries one (D320): the
    // live pool is a page since learn left the boot fetch, so counting it
    // here would claim the page size — the exact under-count D283 was
    // reported as. Null (demo, or order not yet loaded) falls back to the
    // pool, which is then the whole truth.
    total: (fid) => learnFieldTotal(fid) ?? (BYF[fid] || []).length,
    hueOf, colorOf,
    mine: () => F.map((id) => FBY[id]).filter(Boolean),
    has: (id) => F.indexOf(id) >= 0,
    follow: (id) => { if (FBY[id] && F.indexOf(id) < 0) { F.push(id); saveF(); } },
    unfollow: (id) => { if (F.length > 1) { F = F.filter((x) => x !== id); saveF(); } },
    toggle: (id) => { if (F.indexOf(id) >= 0) { if (F.length > 1) { F = F.filter((x) => x !== id); saveF(); } } else if (FBY[id]) { F.push(id); saveF(); } return F.indexOf(id) >= 0; },
    next, answer, plan,
    // Whether re-answering this card right now would COUNT (D95). The feed
    // asks before re-serving an answered card: a repeat inside GAP or a
    // check-in before its window is one the scheduler would not credit, so
    // serving it could only render a stale reveal or invite massed practice.
    due: (id) => dueRepeat(st(id)) || dueCheckin(st(id), Date.now()),
    stateOf: (id) => st(id),
    level: lvl,
    // known facts, in the order you earned them — the map reads this
    mastered: () => S.order.map((id, i) => ({ id, card: BYID[id], at: (S.c[id] || {}).at || 0, i })).filter((x) => x.card),
    knownCount: () => S.order.length,
    stats: (fid) => {
      const cs = BYF[fid] || [];
      let known = 0, learning = 0;
      cs.forEach((c) => { const s = st(c.id); if (!s) return; if (s.s === 'known') known++; else learning++; });
      // Same bank-over-pool rule as total() above: known/learning are
      // device truth (the pool holds every card with history, by the
      // pager's cache rule), but the denominator is the bank's.
      return { known, learning, total: learnFieldTotal(fid) ?? cs.length };
    },
    reset: () => { S = { c: {}, lvl: {}, pos: 0, order: [] }; save(); },
    subscribe: (f) => { listeners.add(f); return () => listeners.delete(f); },
  };
})();
