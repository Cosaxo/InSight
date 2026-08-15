// paths-data.js — CROSSROADS: branching micro-stories in the feed. Three
// choices deep, eight endings. No score — the reveal is the TREE: the whole
// crowd flowing through the branches, your road inked, and how rare it is
// (the product of the branch shares you took). Walks persist per story.
window.PATHS = (function () {
  const LS = 'insight.paths.v1';
  const STORIES = [
    {
      id: 'wallet', title: 'The Wallet', hue: 20,
      intro: 'The last bus home. On the seat beside you: a wallet, fat with cash. No cameras. No one else aboard.',
      nodes: {
        '': { q: 'It sits there, heavier than it should be.', a: [{ t: 'Open it', p: 61 }, { t: 'Hand it to the driver, unopened', p: 39 }] },
        'A': { q: 'A student ID. 4,000 in cash. A clinic appointment slip for Thursday.', a: [{ t: 'Track them down yourself', p: 57 }, { t: 'Keep the cash, mail the rest back', p: 43 }] },
        'B': { q: 'The driver shrugs without looking. "Lost box is broken. Your call, friend."', a: [{ t: 'Take it back — handle it yourself', p: 72 }, { t: 'Leave it on the seat', p: 28 }] },
        'AA': { q: 'You find them in an hour online. They answer, voice shaking with relief — and offer a reward.', a: [{ t: 'Refuse the reward', p: 64 }, { t: 'Take it — fair is fair', p: 36 }] },
        'AB': { q: 'A week passes. The clinic slip keeps surfacing in your mind like a splinter.', a: [{ t: 'Mail the cash after all', p: 31 }, { t: 'Spend it', p: 69 }] },
        'BA': { q: 'The ID shows an address two streets from yours. Thursday is tomorrow.', a: [{ t: 'The doorstep, in person', p: 58 }, { t: 'The police station drop-box', p: 42 }] },
        'BB': { q: 'The doors hiss shut. Through the window you watch the wallet ride away.', a: [{ t: 'Chase the bus to the next stop', p: 22 }, { t: 'Walk home', p: 78 }] },
      },
      endings: {
        'AAA': { name: 'The Quiet Good', line: 'No reward, no witness. You did it for the version of you that was watching.' },
        'AAB': { name: 'The Honest Trade', line: 'Everyone leaves whole. Virtue doesn\u2019t have to be free.' },
        'ABA': { name: 'The Long Way Round', line: 'The splinter won. Later than right, but right.' },
        'ABB': { name: 'Finders, Keepers', line: 'The money spent easily. Thursday came and went somewhere else.' },
        'BAA': { name: 'The Doorstep', line: 'A stranger\u2019s face, changing as they understand. Worth the walk.' },
        'BAB': { name: 'By the Book', line: 'Clean hands, proper channels. The story ends without your name in it.' },
        'BBA': { name: 'The Second Chance', line: 'Lungs burning at the next stop. Some choices allow one revision.' },
        'BBB': { name: 'Not My Story', line: 'You never found out. That was the choice, too.' },
      },
    },
    {
      id: 'text', title: 'The Wrong Text', hue: 255,
      intro: 'Your boss texts you at 23:40: "Offer the role to the other one. Don\u2019t tell K yet." You are K.',
      nodes: {
        '': { q: 'The message glows in the dark. Typing dots appear, then vanish.', a: [{ t: '"I think this wasn\u2019t meant for me."', p: 54 }, { t: 'Say nothing. Screenshot it.', p: 46 }] },
        'A': { q: 'Your phone rings ten seconds later. A flustered voice offers "a proper chat tomorrow."', a: [{ t: 'Take the chat, ask it straight', p: 77 }, { t: 'Decline — start job-hunting tonight', p: 23 }] },
        'B': { q: 'Next morning they greet you like nothing happened. The role posting closes Friday.', a: [{ t: 'Confront them before Friday', p: 49 }, { t: 'Quietly interview elsewhere', p: 51 }] },
        'AA': { q: 'Across the desk they don\u2019t deny it. "The decision wasn\u2019t final," they say. It sounds final.', a: [{ t: 'Negotiate to stay — on new terms', p: 63 }, { t: 'Resign in the meeting', p: 37 }] },
        'AB': { q: 'Three interviews in a week. One offer arrives — smaller title, better people.', a: [{ t: 'Tell your team why you\u2019re going', p: 35 }, { t: 'Ghost gracefully', p: 65 }] },
        'BA': { q: 'Thursday, empty meeting room. You have the screenshot. They have a story ready.', a: [{ t: 'Show the screenshot', p: 44 }, { t: 'Bluff — "I\u2019ve heard rumours"', p: 56 }] },
        'BB': { q: 'The rival offer lands Friday morning — same pay, a team that actually wanted you.', a: [{ t: 'Accept it', p: 58 }, { t: 'Stay anyway', p: 42 }] },
      },
      endings: {
        'AAA': { name: 'The Renegotiator', line: 'You stayed — but the terms are yours now, and everyone knows it.' },
        'AAB': { name: 'The Clean Exit', line: 'Shortest resignation letter in company history. No regrets by Tuesday.' },
        'ABA': { name: 'The Whistle', line: 'The team heard the truth. Some doors close loudly and that\u2019s fine.' },
        'ABB': { name: 'The Quiet Departure', line: 'No scene, no speech. Your absence said it.' },
        'BAA': { name: 'Cards on the Table', line: 'The screenshot did the talking. Their face did the confessing.' },
        'BAB': { name: 'The Poker Face', line: 'You never showed your hand. They folded anyway.' },
        'BBA': { name: 'The Better Door', line: 'Monday, new desk. The old boss still doesn\u2019t know you knew.' },
        'BBB': { name: 'The Long Game', line: 'You stayed with the receipts. Leverage keeps better than anger.' },
      },
    },
  ];

  let S; const listeners = new Set();
  const fire = () => listeners.forEach((f) => { try { f(); } catch (e) {} });
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} fire(); };
  try { S = JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { S = {}; }
  if (!S || typeof S !== 'object') S = {};
  S.walks = S.walks || {}; // sid → 'ABA' (letters chosen so far)

  const storyOf = (id) => STORIES.find((s) => s.id === id);
  // share of the crowd standing at `key` — the product of branch shares above it
  function flowOf(sid, key) {
    const st = storyOf(sid); let f = 1;
    for (let d = 0; d < key.length; d++) {
      const node = st.nodes[key.slice(0, d)];
      f *= node.a[key[d] === 'A' ? 0 : 1].p / 100;
    }
    return f;
  }
  return {
    stories: () => STORIES, storyOf, flowOf,
    walkOf: (id) => S.walks[id] || '',
    // the map's Crossroads branch: one leaf per finished story. typ carries the
    // walk's rarity, so uncommon roads drift to the map's edge on their own.
    mapTree() {
      const done = STORIES.filter((s) => (S.walks[s.id] || '').length >= 3);
      if (!done.length) return { cats: [], nodes: [] };
      const cats = [{ id: 'path-walks', label: 'Walks', hue: 200, walk: true }];
      const nodes = done.map((st, i) => {
        const w = S.walks[st.id], end = st.endings[w], f = flowOf(st.id, w);
        return { id: 'path-' + st.id, parentId: 'path-walks', walk: true, daily: true, sid: st.id,
          label: st.title + ' → ' + end.name, tag: st.title, ans: end.name, prompt: st.title,
          note: '1 in ' + Math.max(2, Math.round(1 / f)), age: i, typ: Math.max(0.05, Math.min(0.95, f * 2)), maj: false };
      });
      return { cats, nodes };
    },
    choose(id, idx) {
      const w = S.walks[id] || '';
      if (w.length >= 3) return w;
      S.walks[id] = w + (idx === 0 ? 'A' : 'B'); save();
      return S.walks[id];
    },
    reset(id) { delete S.walks[id]; save(); },
    sub: (f) => { listeners.add(f); return () => listeners.delete(f); },
  };
})();
