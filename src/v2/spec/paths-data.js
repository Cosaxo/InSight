// paths-data.js — CROSSROADS: branching micro-stories in the feed. Three
// choices deep, eight endings. No score — the reveal is the TREE: the whole
// crowd flowing through the branches, your road inked, and how rare it is
// (the product of the branch shares you took). Walks persist per story.
//
// Ported from the standalone_23 prototype (design provenance: its
// `paths-data.js` — the STORE; the stories it carried were retired at
// D413, see STORIES below), with three deliberate differences, each of
// which the tree's own rules asked for:
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
//
// Two of the bank's stories, not the prototype's two. The prototype's pair
// ("The Wallet", "The Wrong Text") lived here from the port until D413,
// when the owner retired their bank twins (pt1, pt2 — "completely
// uninteresting"); a demo pool that kept telling the two stories the live
// app had just dropped would be the one place they survived, and the
// store-screenshot lanes draw this build. So the demo carries the bank's
// pt4 and pt7 by other ids — 'event' and 'bigq' are always-on channels in
// the demo feed, which is what keeps a stub reachable with no scene
// followed (world-feed-data.js). The prose is the bank's verbatim; only
// the `p` shares are authored here, for the reason `flowOf` gives.
const STORIES = [
  {
    id: 'blackout', title: 'The Blackout', hue: 45,
    intro: '9:40 on a Friday night and the whole city goes dark at once — every window, every streetlight, the fridge’s hum. Your phone says 31%.',
    nodes: {
      // '_', not '' — Firestore refuses an empty map key, so the bank's
      // stories carry a sentinel and this store matches their shape (D136).
      '_': { q: 'Out in the stairwell, neighbours’ voices you have never heard before.', a: [{ t: 'Go out and join them', p: 63 }, { t: 'Stay in, light a candle', p: 37 }] },
      'A': { q: 'Somebody’s radio says "grid failure", then static. Two neighbours are heading for the hill to see how far it goes.', a: [{ t: 'Go and see how far it goes', p: 44 }, { t: 'Wait for the news to come to you', p: 56 }] },
      'B': { q: 'Candlelight, and a quiet you have never heard in this flat. It could be an hour. It could be the night.', a: [{ t: 'Wait up for the lights', p: 58 }, { t: 'Sleep through it', p: 42 }] },
      'AA': { q: 'From the hill: the dark runs to the horizon in every direction. The ridge above would show the next town.', a: [{ t: 'Push on up to the ridge', p: 35 }, { t: 'Head back while you know the way', p: 65 }] },
      'AB': { q: 'The step fills up — a guitar, a bottle, no plan. A stranger asks what you actually do all day, and there is no screen to hide behind.', a: [{ t: 'Tell them, properly', p: 52 }, { t: 'Deflect — ask about them', p: 48 }] },
      'BA': { q: '2 a.m. Still dark, and the sky over the roofs has stars this window has never shown.', a: [{ t: 'Climb up to the roof', p: 41 }, { t: 'Watch from the window', p: 59 }] },
      'BB': { q: 'Morning. The power is back, and the group chat has 212 messages about a night you slept through.', a: [{ t: 'Read all 212', p: 67 }, { t: 'Mark as read', p: 33 }] },
    },
    endings: {
      'AAA': { name: 'The Ridge Walker', line: 'You saw the whole dark city from above. Nobody else on your street did.' },
      'AAB': { name: 'The Scout', line: 'Far enough to know, close enough to get home. You came back with the news.' },
      'ABA': { name: 'The Open Book', line: 'No screen, no small talk. You told a stranger the real answer.' },
      'ABB': { name: 'The Listener', line: 'You learned every story on the step and gave away none of yours.' },
      'BAA': { name: 'The Stargazer', line: 'The city went dark and you climbed towards the sky.' },
      'BAB': { name: 'The Night Watch', line: 'You kept the candle going and saw the lights come back, one street at a time.' },
      'BBA': { name: 'The Morning Reader', line: 'You missed the night, then lived it twice — in the chat, with coffee.' },
      'BBB': { name: 'The Sleeper', line: 'The city had a night. You had a night’s sleep. Both are true.' },
    },
  },
  {
    id: 'capsule', title: 'The Time Capsule', hue: 100,
    intro: 'A padded envelope from your old school: a letter you wrote to yourself at fifteen, sealed for a project everyone forgot. The teacher’s note says: "Open alone."',
    nodes: {
      '_': { q: 'It is 8 a.m. on a working day, and the envelope is thick.', a: [{ t: 'Open it now, coffee going cold', p: 71 }, { t: 'Save it for the weekend', p: 29 }] },
      'A': { q: 'Page one is everything fifteen-year-old you was sure of. Someone is in the kitchen, asking what came in the post.', a: [{ t: 'Read it aloud to them', p: 46 }, { t: 'Read it alone, as instructed', p: 54 }] },
      'B': { q: 'Saturday. Page one is a list of predictions. Page two names your best friend then — someone you could look up before you read on.', a: [{ t: 'Search their name first', p: 57 }, { t: 'Read on without looking', p: 43 }] },
      'AA': { q: 'They laugh at the predictions, then go quiet at the one that came true. The letter ends with a request: "Go back to the lake."', a: [{ t: 'Drive to the lake this month', p: 38 }, { t: 'Leave the lake where it is', p: 62 }] },
      'AB': { q: 'Fifteen-year-old you names the person you were in love with. They are still in your contacts.', a: [{ t: 'Send them the page', p: 27 }, { t: 'Keep the page to yourself', p: 73 }] },
      'BA': { q: 'Your old best friend: a nurse in another city now, two kids, a public page full of the lake you both swam in.', a: [{ t: 'Message them: "I found a letter"', p: 49 }, { t: 'Close the tab and read on', p: 51 }] },
      'BB': { q: 'The last line: "If you are reading this with someone, tell them the lake thing." You are alone.', a: [{ t: 'Write the next one, to you at fifty', p: 44 }, { t: 'Fold it away', p: 56 }] },
    },
    endings: {
      'AAA': { name: 'The Lake Returner', line: 'You went back. It was smaller, and you were not.' },
      'AAB': { name: 'The Kitchen Reader', line: 'Read aloud over cold coffee. The lake stays a line on a page.' },
      'ABA': { name: 'The Sender', line: 'One photo, one old name. Whatever comes back, you started it.' },
      'ABB': { name: 'The Keeper of Page Two', line: 'Some names stay in the envelope. You know which one.' },
      'BAA': { name: 'The Finder', line: 'A letter, a search, a message: one afternoon. Twenty years, undone in an hour.' },
      'BAB': { name: 'The Quiet Looker', line: 'You know exactly where they are now. They will never know you looked.' },
      'BBA': { name: 'The Next Letter Writer', line: 'Sealed again, addressed to fifty. The project outlived the school.' },
      'BBB': { name: 'The One-Time Reader', line: 'Read once, alone, as instructed. Filed with the things you don’t reread.' },
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
