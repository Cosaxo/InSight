// Ported from design/spec-modules/follows.js (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.

// follows.js — friendships (mutual). Your friends ARE your circle: they feed the
// 1v1s, the groups, and the circle populations. Adding someone sends a request;
// in this prototype the other side accepts after a short, believable delay.
// Persisted locally.
//
// THE DEMO'S HALF of the friends handshake (VISION-2026-09-12 §2,
// D-2026-09-12d): beside `friends` and `invited` the store keeps
// `requests` — people who asked YOU, seeded so the demo's *Your friends*
// overlay has something to accept — and `dismissed`, the suggestions waved
// away. `status(id)` answers `none · invited · requested · friends`; an
// invite to somebody already asking is an accept. The live build's
// equivalent is data/friends.ts, which reads the same four states off
// D101's follow rows; this store is what the demo and the mount suites
// play, and the shapes are kept equal so one overlay draws both.
//
// The IIFE is vestigial under ESM (D39) and stays only because unwrapping it
// re-indents the file for no behavioural gain; the binding is hoisted out.
// Same shape as daily-questions.js — see the note there.
export let FRIENDS;

(function () {
  const LS = 'insight.friends.v1';
  // Twelve of the twenty-four in IS_DATA.people, and the split is the point:
  // the circle has to be big enough that the surfaces reading it (duels'
  // members, learn-social's standings, search's people section) have a
  // population, and small enough that invite → accept still has candidates —
  // `duoAvailable()` offers friends you have no 1v1 with, so a fully-seeded
  // roster would leave that path untestable. Ids must exist in
  // IS_DATA.people or every consumer's find() drops them silently;
  // src/v2/test/sample-people.test.js holds that.
  //
  // Growing this list does NOT reach an existing demo install: the key below
  // is written on first run and read back forever after. Clearing site data
  // (or the D51 purge) is what picks up a new seed.
  const SEED = ['f1', 'f2', 'f3', 'f4', 'f6', 'f8', 'f10', 'f12', 'f14', 'f17', 'f18', 'f20'];
  // Two people asking to compare answers, neither in the seed above and
  // both in IS_DATA.people (sample-people.test.js holds the ids).
  const SEED_REQ = ['f5', 'f7'];
  // NOT ON A LIVE BUILD — the gate scenes.js and world-subtopics.js have
  // carried since D66 and this store never got, though it is the one
  // seeding PEOPLE. Consumers read `list()` and resolve the ids against
  // IS_DATA.people, so a seeded roster put twelve invented friends —
  // name, avatar, "sister · since birth · 86% match" — into the Search
  // overlay's Friends section and invented standings into learn's
  // reveals, on a release build whose boot had not attached. Those two
  // surfaces gate on `LIVE.enabled`, which is FALSE in exactly that
  // window: `demoInProd` is defined as a live build that has not
  // attached, and its own declaration says D1 requires suppressing the
  // seeded fake people there. On the build flag rather than on
  // `LIVE.enabled` for scenes.js's reason — the default is derived
  // before the boot attaches, and this store's is derived at import.
  const LIVE_BUILD = import.meta.env && import.meta.env.VITE_V2_LIVE === 'true';
  let S;
  try { S = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { S = null; }
  const fresh = () => ({ friends: LIVE_BUILD ? [] : SEED.slice(), invited: {}, requests: LIVE_BUILD ? [] : SEED_REQ.slice(), dismissed: [] });
  if (!S || !Array.isArray(S.friends)) S = fresh();
  S.invited = S.invited && typeof S.invited === 'object' ? S.invited : {};
  // An install from before the handshake carries neither list; the seeded
  // requests appear for it too — the key is the same, the shape grew.
  S.requests = Array.isArray(S.requests) ? S.requests : (LIVE_BUILD ? [] : SEED_REQ.slice());
  S.dismissed = Array.isArray(S.dismissed) ? S.dismissed : [];
  const listeners = new Set();
  const fire = () => listeners.forEach((f) => { try { f(); } catch (e) { /* one listener throwing must not stop the others being notified. */ } });
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { /* localStorage can throw: private mode, quota, disabled storage. Persistence here is best-effort and the in-memory state stays correct. */ } fire(); };
  // deterministic per-person acceptance delay (10–30 s) — "they saw it on their phone"
  function delayMs(id) { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return 10000 + (h % 20000); }
  function sweep() {
    const now = Date.now(); let hit = false;
    Object.keys(S.invited).forEach((id) => {
      if (now - S.invited[id] >= delayMs(id)) { delete S.invited[id]; if (!S.friends.includes(id)) S.friends.push(id); hit = true; }
    });
    if (hit) save();
  }
  let timer = null;
  function ensureTimer() {
    if (timer) return;
    timer = setInterval(() => { if (!Object.keys(S.invited).length) { clearInterval(timer); timer = null; return; } sweep(); }, 2500);
  }
  if (Object.keys(S.invited).length) ensureTimer();
  const dropReq = (id) => { S.requests = S.requests.filter((x) => x !== id); };
  function accept(id) {
    if (!S.requests.includes(id)) return;
    dropReq(id);
    if (!S.friends.includes(id)) S.friends.push(id);
    save();
  }
  FRIENDS = {
    status: (id) => (S.friends.includes(id) ? 'friends' : S.invited[id] != null ? 'invited' : S.requests.includes(id) ? 'requested' : 'none'),
    isFriend: (id) => S.friends.includes(id),
    invite: (id) => {
      if (!id || S.friends.includes(id)) return;
      // asking somebody who already asked you is saying yes
      if (S.requests.includes(id)) return accept(id);
      if (S.invited[id] == null) { S.invited[id] = Date.now(); ensureTimer(); save(); }
    },
    cancel: (id) => { delete S.invited[id]; save(); },
    unfriend: (id) => { S.friends = S.friends.filter((x) => x !== id); delete S.invited[id]; dropReq(id); save(); },
    list: () => S.friends.slice(),
    invitedList: () => Object.keys(S.invited),
    count: () => S.friends.length,
    requests: () => S.requests.slice(),
    accept,
    ignore: (id) => { dropReq(id); save(); },
    dismiss: (id) => { if (id && !S.dismissed.includes(id)) { S.dismissed.push(id); save(); } },
    dismissed: () => S.dismissed.slice(),
    isDismissed: (id) => S.dismissed.includes(id),
    subscribe: (f) => { listeners.add(f); return () => listeners.delete(f); },
  };
  // The purge (data/live.ts, D51): drop to the fresh-boot state — the SEED
  // circle, exactly what load() yields with the key gone — or the next
  // invite/unfriend save() writes the previous account's edits back. fire()
  // without save(): notify, but do not re-create the purged key.
  window.addEventListener('insight:local-purge', () => { S = fresh(); fire(); });
})();

