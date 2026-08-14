// suggestions.js — "Suggest a question": a community suggestion board.
// People propose questions; the most-upvoted, once they clear review, get
// promoted into the Daily for everyone. NOT an infinite feed — a bounded board
// you visit on purpose. Moderation is faked here (statuses are baked); the
// user's own submissions + upvotes persist to localStorage.
(function () {
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
    const me = (window.IS_DATA || {}).me || {};
    return [['world', 'everyone'], ['country', me.country || 'your country'], ['city', me.location || 'your city'], ['like', 'people like me']];
  };

  // ── declines, written kindly and with the standard stated. A refusal that
  // doesn't say the number it missed reads as a shrug.
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

  // Your own board is never an empty room: three submissions, one in each live
  // state, until you have made your own. Replaced by real ones as they arrive.
  const MINE_DEMO = [
    { id: 'sgd1', prompt: 'Is it rude to take a call on speaker in public?', type: 'binary', options: ['Rude', 'Fine'], by: 'You', hue: 305, votes: 268, status: 'review', ago: '1d', cadence: 'once', audience: 'world', demo: true },
    { id: 'sgd2', prompt: 'Would you rather never be late or never wait?', type: 'binary', options: ['Never late', 'Never wait'], by: 'You', hue: 35, votes: 1441, status: 'picked', ago: '9d', ran: 'ran as the daily on 9 Aug', cadence: 'once', audience: 'world', demo: true },
    { id: 'sgd3', prompt: 'Should Oslo ban cars inside Ring 1?', type: 'binary', options: ['Ban them', 'Keep access'], by: 'You', hue: 150, votes: 96, status: 'declined', ago: '6d', cadence: 'weekly', audience: 'city', decline: 'place', demo: true },
  ];

  const LS = 'insight.suggestions.v1';
  let saved = { mine: [], up: {} };
  try { const j = JSON.parse(localStorage.getItem(LS) || 'null'); if (j) saved = { mine: j.mine || [], up: j.up || {} }; } catch (e) {}
  const listeners = new Set();
  function persist() { try { localStorage.setItem(LS, JSON.stringify(saved)); } catch (e) {} listeners.forEach((f) => f()); }

  const TYPE_LABEL = { binary: 'this or that', choice: 'multiple choice', scale: 'agree / disagree', rating: 'rate 1–10', dilemma: 'dilemma' };

  function all() {
    // user's own submissions are first-class; live vote = base + (you upvoted ? 1 : 0)
    const own = saved.mine.length ? saved.mine : (window.IS_SUGG_DEMO === false ? [] : MINE_DEMO);
    const list = own.map((s) => ({ ...s, mine: true })).concat(SEED)
      .map((s) => ({ ...s, voted: !!saved.up[s.id], liveVotes: s.votes + (saved.up[s.id] ? 1 : 0), days: s.ago === 'just now' ? -1 : (parseInt(s.ago, 10) || 99) }));
    list.sort((a, b) => b.liveVotes - a.liveVotes);
    return list;
  }

  const api = {
    all,
    CADENCE, AUDIENCE, DECLINE,
    cadenceLabel: (id) => ((CADENCE.find((c) => c[0] === id) || [])[1] || 'once'),
    audienceLabel: (id) => ((AUDIENCE().find((c) => c[0] === id) || [])[1] || 'everyone'),
    declineOf: (s) => (s && s.decline ? DECLINE[s.decline] : null),
    typeLabel: (t) => TYPE_LABEL[t] || t,
    counts() { const a = all(); return { total: a.length, picked: a.filter((s) => s.status === 'picked').length, mine: a.filter((s) => s.mine).length }; },
    hasVoted: (id) => !!saved.up[id],
    toggleVote(id) { if (saved.up[id]) delete saved.up[id]; else saved.up[id] = true; persist(); },
    submit({ prompt, type, options, topic, hue, cadence, audience, featured }) {
      const id = 'sgu' + Date.now().toString(36);
      const s = {
        id, prompt: String(prompt || '').trim(), type: type || 'binary',
        options: (options || []).filter(Boolean), topic: (topic || '').trim() || null,
        by: 'You', hue: hue != null ? hue : 282, votes: 1, status: 'review', ago: 'just now',
        cadence: cadence || 'once', audience: audience || 'world', featured: !!featured,
      };
      // keeping the seeded three would read as your submissions; the first real
      // one takes the board over
      saved.mine.unshift(s);
      saved.up[id] = true; // you back your own
      persist();
      return id;
    },
    subscribe(f) { listeners.add(f); return () => listeners.delete(f); },
  };
  window.SUGGESTIONS = api;
})();
