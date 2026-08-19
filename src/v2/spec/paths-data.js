// paths-data.js — CROSSROADS: branching micro-stories in the feed. Three
// choices deep, eight endings. No score — the reveal is the TREE: the whole
// crowd flowing through the branches, your road inked, and how rare it is
// (the product of the branch shares you took). Walks persist per story.
//
// Ported from the standalone_23 prototype (design provenance: its
// `paths-data.js`), with three deliberate differences, each of which the
// tree's own rules asked for:
//
//   1. A NAMED EXPORT, not `window.PATHS`. Every cross-module reference in
//      the spec layer is counted by check:globals rule 4 and the count may
//      only go down (D39), so a new module cannot arrive on the bridge —
//      it would fail CI for adding two references. Its one consumer
//      (paths-card.jsx) imports it.
//
//   2. NO `mapTree()` — SUPERSEDED at D207. This note recorded why the
//      fold stayed unbuilt: map-tab was eager with no room, and reading
//      this store off the bridge would spend the coupling ratchet. D207
//      moved both budgets (the Map is lazy; imports cost the ratchet
//      nothing), and the fold now lives in paths-card.jsx (pathsMapTree)
//      rather than here, because it needs that card's live/demo source
//      discipline. Kept rather than deleted for the shape it documents:
//      a correct reason for an omission, and the entry that ended it.
//
//   3. The crowd shares here are AUTHORED. This store is the card's DEMO
//      source only — live, a story is a bank question whose eight endings
//      are its options and whose branch shares fold from real answers
//      (LIVE.pathQs, D136). See the note on `flowOf`.
const LS = 'insight.paths.v1';

// The stories. Editorial content in the same sense the question bank is —
// written, not sampled — so this is not the demo-persona data that stays in
// sample-data.js. What IS invented here is every `p`: see `flowOf`.
const STORIES = [
  {
    id: 'wallet', title: 'The Wallet', hue: 20,
    intro: 'The last bus home. On the seat beside you: a wallet, fat with cash. No cameras. No one else aboard.',
    nodes: {
      // '_', not '' — Firestore refuses an empty map key, so the bank's
      // stories carry a sentinel and this store matches their shape (D136).
      '_': { q: 'It sits there, heavier than it should be.', a: [{ t: 'Open it', p: 61 }, { t: 'Hand it to the driver, unopened', p: 39 }] },
      'A': { q: 'A student ID. 4,000 in cash. A clinic appointment slip for Thursday.', a: [{ t: 'Track them down yourself', p: 57 }, { t: 'Keep the cash, mail the rest back', p: 43 }] },
      'B': { q: 'The driver shrugs without looking. "Lost box is broken. Your call, friend."', a: [{ t: 'Take it back — handle it yourself', p: 72 }, { t: 'Leave it on the seat', p: 28 }] },
      'AA': { q: 'You find them in an hour online. They answer, voice shaking with relief — and offer a reward.', a: [{ t: 'Refuse the reward', p: 64 }, { t: 'Take it — fair is fair', p: 36 }] },
      'AB': { q: 'A week passes. The clinic slip keeps surfacing in your mind like a splinter.', a: [{ t: 'Mail the cash after all', p: 31 }, { t: 'Spend it', p: 69 }] },
      'BA': { q: 'The ID shows an address two streets from yours. Thursday is tomorrow.', a: [{ t: 'The doorstep, in person', p: 58 }, { t: 'The police station drop-box', p: 42 }] },
      'BB': { q: 'The doors hiss shut. Through the window you watch the wallet ride away.', a: [{ t: 'Chase the bus to the next stop', p: 22 }, { t: 'Walk home', p: 78 }] },
    },
    endings: {
      'AAA': { name: 'The Quiet Good', line: 'No reward, no witness. You did it for the version of you that was watching.' },
      'AAB': { name: 'The Honest Trade', line: 'Everyone leaves whole. Virtue doesn’t have to be free.' },
      'ABA': { name: 'The Long Way Round', line: 'The splinter won. Later than right, but right.' },
      'ABB': { name: 'Finders, Keepers', line: 'The money spent easily. Thursday came and went somewhere else.' },
      'BAA': { name: 'The Doorstep', line: 'A stranger’s face, changing as they understand. Worth the walk.' },
      'BAB': { name: 'By the Book', line: 'Clean hands, proper channels. The story ends without your name in it.' },
      'BBA': { name: 'The Second Chance', line: 'Lungs burning at the next stop. Some choices allow one revision.' },
      'BBB': { name: 'Not My Story', line: 'You never found out. That was the choice, too.' },
    },
  },
  {
    id: 'text', title: 'The Wrong Text', hue: 255,
    intro: 'Your boss texts you at 23:40: "Offer the role to the other one. Don’t tell K yet." You are K.',
    nodes: {
      '_': { q: 'The message glows in the dark. Typing dots appear, then vanish.', a: [{ t: '"I think this wasn’t meant for me."', p: 54 }, { t: 'Say nothing. Screenshot it.', p: 46 }] },
      'A': { q: 'Your phone rings ten seconds later. A flustered voice offers "a proper chat tomorrow."', a: [{ t: 'Take the chat, ask it straight', p: 77 }, { t: 'Decline — start job-hunting tonight', p: 23 }] },
      'B': { q: 'Next morning they greet you like nothing happened. The role posting closes Friday.', a: [{ t: 'Confront them before Friday', p: 49 }, { t: 'Quietly interview elsewhere', p: 51 }] },
      'AA': { q: 'Across the desk they don’t deny it. "The decision wasn’t final," they say. It sounds final.', a: [{ t: 'Negotiate to stay — on new terms', p: 63 }, { t: 'Resign in the meeting', p: 37 }] },
      'AB': { q: 'Three interviews in a week. One offer arrives — smaller title, better people.', a: [{ t: 'Tell your team why you’re going', p: 35 }, { t: 'Ghost gracefully', p: 65 }] },
      'BA': { q: 'Thursday, empty meeting room. You have the screenshot. They have a story ready.', a: [{ t: 'Show the screenshot', p: 44 }, { t: 'Bluff — "I’ve heard rumours"', p: 56 }] },
      'BB': { q: 'The rival offer lands Friday morning — same pay, a team that actually wanted you.', a: [{ t: 'Accept it', p: 58 }, { t: 'Stay anyway', p: 42 }] },
    },
    endings: {
      'AAA': { name: 'The Renegotiator', line: 'You stayed — but the terms are yours now, and everyone knows it.' },
      'AAB': { name: 'The Clean Exit', line: 'Shortest resignation letter in company history. No regrets by Tuesday.' },
      'ABA': { name: 'The Whistle', line: 'The team heard the truth. Some doors close loudly and that’s fine.' },
      'ABB': { name: 'The Quiet Departure', line: 'No scene, no speech. Your absence said it.' },
      'BAA': { name: 'Cards on the Table', line: 'The screenshot did the talking. Their face did the confessing.' },
      'BAB': { name: 'The Poker Face', line: 'You never showed your hand. They folded anyway.' },
      'BBA': { name: 'The Better Door', line: 'Monday, new desk. The old boss still doesn’t know you knew.' },
      'BBB': { name: 'The Long Game', line: 'You stayed with the receipts. Leverage keeps better than anger.' },
    },
  },
];

export const PATHS = (function () {
  let S; const listeners = new Set();
  const fire = () => listeners.forEach((f) => { try { f(); } catch (e) { /* a bad subscriber is not this store's problem */ } });
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { /* private mode */ } fire(); };
  try { S = JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { S = {}; }
  if (!S || typeof S !== 'object') S = {};
  S.walks = S.walks || {}; // sid → 'ABA' (letters chosen so far)

  const storyOf = (id) => STORIES.find((s) => s.id === id);

  /**
   * Share of the crowd standing at `key` — the product of the branch shares
   * above it.
   *
   * EVERY NUMBER THIS RETURNS IS AUTHORED, not measured: the `p` on each
   * choice was written to make the tree read well, and no walk anyone takes
   * moves it — which is why these numbers reach a screen ONLY in a demo
   * build. Live, `PathsCard` reads `LIVE.pathQs()` and folds the shares from
   * real answers instead; D1 forbids showing invented figures as findings,
   * and "you and 12% ended here" is a finding in the only sense that
   * matters: the reader cannot tell it from one.
   *
   * The live fold needs no backend work and is the shipped path now: a
   * finished walk is one of eight
   * endings, so it stores as an ordinary `optionIdx` 0..7 (the fold drops
   * idx > 19), and a branch's share is then the summed counts of the
   * endings under it. Marginals the aggregate already publishes.
   */
  function flowOf(sid, key) {
    const st = storyOf(sid); let f = 1;
    for (let d = 0; d < key.length; d++) {
      const node = st.nodes[key.slice(0, d) || '_'];
      f *= node.a[key[d] === 'A' ? 0 : 1].p / 100;
    }
    return f;
  }

  const api = {
    stories: () => STORIES,
    storyOf,
    flowOf,
    walkOf: (id) => (S.walks[id] || ''),
    choose(id, idx) {
      const w = S.walks[id] || '';
      if (w.length >= 3) return w;
      S.walks[id] = w + (idx === 0 ? 'A' : 'B'); save();
      return S.walks[id];
    },
    reset(id) { delete S.walks[id]; save(); },
    sub: (f) => { listeners.add(f); return () => listeners.delete(f); },
  };

  // The purge (data/live.ts, D51): the key is already gone by the time this
  // fires; drop the in-memory copy too, or the next choose()'s save() writes
  // the previous account's walks back under the new uid. No save() here —
  // that would re-create the key the purge just removed. Matches feed-read.js.
  window.addEventListener('insight:local-purge', () => { S = { walks: {} }; fire(); });

  return api;
})();
