// ported from design/spec-modules/daily-questions.js — do not hand-edit load order assumptions
import React from 'react';

// daily-questions.js — "Daily Question" feature data + persistent answer store.
// A new question each day (type varies). Each question carries a plausible,
// per-audience answer distribution so every tab (around / city / groups /
// world / people) shows a DIFFERENT crowd. The user's own answers persist to
// localStorage; "you vs them" is computed live from the current answer.
(function () {
  // ── seeded RNG (mulberry32) ───────────────────────────────────────────────
  function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const rng = (s) => mulberry32(hashStr(s));

  // softmax of logits → integer percentages summing to exactly 100
  function softmaxPct(logits) {
    const m = Math.max(...logits);
    const ex = logits.map(l => Math.exp(l - m));
    const sum = ex.reduce((a, b) => a + b, 0);
    const raw = ex.map(e => (e / sum) * 100);
    const floor = raw.map(Math.floor);
    let rem = 100 - floor.reduce((a, b) => a + b, 0);
    const order = raw.map((v, i) => [v - floor[i], i]).sort((a, b) => b[0] - a[0]);
    for (let k = 0; k < rem; k++) floor[order[k % order.length][1]]++;
    return floor;
  }

  // The five audiences, in tab order.
  const AUDIENCES = [
    { id: 'around', label: 'people near you', short: 'near you', hue: 40 },
    { id: 'city', label: 'Oslo', short: 'Oslo', hue: 150 },
    { id: 'groups', label: 'your circles', short: 'circles', hue: 310 },
    { id: 'world', label: 'the world', short: 'the world', hue: 235 },
    { id: 'people', label: 'your close ties', short: 'close ties', hue: 28 },
    { id: 'country', label: 'Norway', short: 'Norway', hue: 200 },
  ];
  // how strongly each audience leans toward the user's own answer (like-mindedness)
  const PULL = { people: 1.7, around: 0.9, groups: 1.25, city: 0.45, country: 0.25, world: 0.0 };
  // how spread-out each audience is (world most diverse)
  const SPREAD = { people: 1.7, around: 1.5, groups: 1.45, city: 1.2, country: 1.08, world: 0.95 };

  const SCALE5 = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];

  // ── category taxonomy: the topic path each question carries ────────────────
  // A question's path (e.g. ['Sport','Football']) is its tag AND where its
  // answer lands on your map. topWord → placement: a seedId reuses an existing
  // self-branch; the rest are topical branches that emerge as you answer.
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function pathKey(p) { return (p || []).join(' / '); }
  const CAT_META = {
    Body: { seedId: 'health', hue: 150 }, Skills: { seedId: 'craft', hue: 40 }, Interests: { seedId: 'interests', hue: 78 },
    Home: { seedId: 'home', hue: 110 }, Story: { seedId: 'story', hue: 320 }, Goals: { seedId: 'goals', hue: 240 }, Values: { seedId: 'values', hue: 356 },
    Sport: { hue: 18 }, Film: { hue: 265 }, Food: { hue: 35 }, Travel: { hue: 200 }, Mind: { hue: 255 }, Morals: { hue: 305 },
  };
  function catMeta(top) { const m = CAT_META[top] || { hue: 250 }; return { top, hue: m.hue, seedId: m.seedId || null, catId: m.seedId || ('top-' + slug(top)) }; }
  const EMERGENT_CATS = Object.keys(CAT_META).filter((k) => !CAT_META[k].seedId).map((k) => ({ id: 'top-' + slug(k), label: k, hue: CAT_META[k].hue }));
  // candidate branch paths per question: authored default (clearly top-voted) + a couple of alternates
  function buildCandidates(id, def, alts) {
    const r = rng(id + '|cat');
    const out = [{ path: def, votes: 240 + Math.floor(r() * 220) }];
    (alts || []).forEach((p) => out.push({ path: p, votes: 22 + Math.floor(r() * 130) }));
    return out;
  }

  // ── question content (newest first; index 0 = today) ───────────────────────
  // type: scale (5pt) | binary (2) | choice (3-4) | rating (1-10) | dilemma (a scenario)
  // cat: the default topic path · alts: alternative candidate paths the crowd can vote between
  const Q = [
    { type: 'binary', prompt: 'Messi or Ronaldo?', tag: 'The GOAT', options: ['Messi', 'Ronaldo'], tone: 'light',
      cat: ['Sport', 'Football'], alts: [['Sport', 'Greatness'], ['Values', 'What you admire']] },
    { type: 'binary', prompt: 'Tarantino or Wes Anderson?', tag: 'Director duel', options: ['Tarantino', 'Wes Anderson'], tone: 'light',
      cat: ['Film', 'Directors'], alts: [['Film', 'Taste'], ['Interests', 'Cinema']] },
    { type: 'binary', prompt: 'Pineapple on pizza?', tag: 'Pineapple', options: ['Yes', 'Never'], tone: 'light',
      cat: ['Food', 'Debates'], alts: [['Food', 'Taste'], ['Values', 'Openness']] },
    { type: 'choice', prompt: 'What do you want more of this year?', tag: 'Want more', options: ['Time', 'Quiet', 'Adventure', 'Closeness'], tone: 'deep',
      cat: ['Values', 'Longing'], alts: [['Mind', 'Wants'], ['Goals', 'This year']] },
    { type: 'scale', prompt: "It's okay to do nothing sometimes.", tag: 'Doing nothing', axis: 'at ease', tone: 'light',
      cat: ['Mind', 'Rest'], alts: [['Values', 'Rest'], ['Body', 'Recovery']] },
    { type: 'binary', prompt: 'Are people getting kinder, or meaner?', tag: 'People today', options: ['Kinder', 'Meaner'], tone: 'deep',
      cat: ['Morals', 'Direction'], alts: [['Mind', 'Outlook'], ['Values', 'Hope']] },
    { type: 'dilemma', prompt: 'You find €500 in cash on an empty street. What do you do?', tag: 'Found €500', options: ['Keep it', 'Hand it in', 'Leave it'], tone: 'deep',
      cat: ['Morals', 'Honesty'], alts: [['Values', 'Honesty'], ['Mind', 'Conscience']] },
    { type: 'rating', prompt: 'How optimistic are you about the next ten years?', tag: 'Next 10 years', axis: 'optimistic', tone: 'deep',
      cat: ['Mind', 'Outlook'], alts: [['Values', 'Hope'], ['Story', 'The future']] },
    { type: 'scale', prompt: 'People are basically trustworthy.', tag: 'Trust in people', axis: 'trusting', tone: 'deep',
      cat: ['Values', 'Trust'], alts: [['Mind', 'Outlook'], ['Morals', 'Faith in others']] },
    { type: 'binary', prompt: 'A pill that ends your need for sleep. Take it?', tag: 'Sleep pill', options: ['Take it', 'Never'], tone: 'deep',
      cat: ['Mind', 'Human limits'], alts: [['Body', 'Sleep'], ['Values', 'Being human']] },
    { type: 'choice', prompt: 'What should schools teach more of?', tag: 'Schools', options: ['Money', 'Emotions', 'Making things', 'History'], tone: 'deep',
      cat: ['Values', 'Education'], alts: [['Mind', 'Learning'], ['Goals', 'Next generation']] },
    { type: 'dilemma', prompt: 'A job you would love means moving somewhere your partner would hate. Do you take it?', tag: 'Job or partner', options: ['Take it', 'Stay', 'Find a third way'], tone: 'deep',
      cat: ['Morals', 'Loyalty'], alts: [['Values', 'Loyalty'], ['Goals', 'Career']] },
    { type: 'binary', prompt: 'Would you rather watch sport, or play it?', tag: 'Watch or play', options: ['Watch', 'Play'], tone: 'light',
      cat: ['Sport', 'How you engage'], alts: [['Body', 'Activity'], ['Interests', 'Sport']] },
    { type: 'scale', prompt: 'Suffering can give life meaning.', tag: 'Suffering', axis: 'searching', tone: 'deep',
      cat: ['Values', 'Meaning'], alts: [['Mind', 'Outlook'], ['Morals', 'Meaning']] },
    { type: 'rating', prompt: 'How much do you trust the news you read?', tag: 'The news', axis: 'trusting', tone: 'deep',
      cat: ['Mind', 'Media'], alts: [['Values', 'Truth'], ['Morals', 'Institutions']] },
    { type: 'binary', prompt: 'Will AI make everyday life better, or worse?', tag: 'AI', options: ['Better', 'Worse'], tone: 'deep',
      cat: ['Mind', 'Technology'], alts: [['Values', 'Tech'], ['Story', 'The future']] },
    { type: 'choice', prompt: "Humanity's best invention?", tag: 'Best invention', options: ['Writing', 'Medicine', 'The internet', 'Music'], tone: 'blend',
      cat: ['Mind', 'Civilisation'], alts: [['Interests', 'Ideas'], ['Values', 'Progress']] },
    { type: 'scale', prompt: 'Technology is making us lonelier.', tag: 'Loneliness', axis: 'wary', tone: 'deep',
      cat: ['Mind', 'Technology'], alts: [['Values', 'Tech'], ['Morals', 'Connection']] },
    { type: 'choice', prompt: 'What matters most in a life well lived?', tag: 'A good life', options: ['Connection', 'Freedom', 'Creation', 'Peace'], tone: 'deep',
      cat: ['Values', 'What matters'], alts: [['Mind', 'Priorities'], ['Morals', 'The good life']] },
    { type: 'dilemma', prompt: 'Would you rather know the exact date of your death?', tag: 'Date of death', options: ['Know', 'Never know'], tone: 'deep',
      cat: ['Mind', 'Mortality'], alts: [['Values', 'Fate'], ['Morals', 'Big questions']] },
    { type: 'rating', prompt: 'How much of your life so far is luck?', tag: 'Luck', axis: 'shaped by luck', tone: 'deep',
      cat: ['Mind', 'Fate'], alts: [['Story', 'Chance'], ['Values', 'Merit']] },
    { type: 'scale', prompt: "I'd rather have a few deep friendships than many.", tag: 'Deep or many', axis: 'inward', tone: 'blend',
      cat: ['Values', 'Friendship'], alts: [['Mind', 'Temperament'], ['Interests', 'Social']] },
    { type: 'dilemma', prompt: 'A lie that spares someone real pain. Tell it?', tag: 'The kind lie', options: ['Tell it', 'Truth anyway'], tone: 'deep',
      cat: ['Morals', 'Kindness'], alts: [['Values', 'Honesty'], ['Mind', 'Conscience']] },
    { type: 'scale', prompt: "It's better to be honest than kind.", tag: 'Honest or kind', axis: 'frank', tone: 'deep',
      cat: ['Morals', 'Honesty'], alts: [['Values', 'Honesty'], ['Mind', 'Temperament']] },
    { type: 'scale', prompt: 'Money buys happiness.', tag: 'Money', axis: 'materialist', tone: 'blend',
      cat: ['Values', 'Money'], alts: [['Mind', 'Happiness'], ['Morals', 'Wealth']] },
    { type: 'rating', prompt: 'How much control do you feel over your life?', tag: 'Control', axis: 'in control', tone: 'deep',
      cat: ['Mind', 'Agency'], alts: [['Values', 'Control'], ['Story', 'Now']] },
    { type: 'choice', prompt: 'Where does your sense of self come from?', tag: 'Sense of self', options: ['What I do', 'Who I love', 'What I believe', 'What I make'], tone: 'deep',
      cat: ['Values', 'Identity'], alts: [['Story', 'Self'], ['Mind', 'Identity']] },
    { type: 'binary', prompt: 'Relive your best day, or live a new one?', tag: 'Best day', options: ['Relive it', 'A new one'], tone: 'blend',
      cat: ['Mind', 'Time'], alts: [['Story', 'Memory'], ['Values', 'Outlook']] },
    { type: 'choice', prompt: 'Pick a season for the soul.', tag: 'Season', options: ['Spring', 'Summer', 'Autumn', 'Winter'], tone: 'light',
      cat: ['Travel', 'Seasons'], alts: [['Interests', 'Seasons'], ['Mind', 'Mood']] },
    { type: 'scale', prompt: 'Most people would help a stranger in need.', tag: 'Helping hands', axis: 'hopeful', tone: 'deep',
      cat: ['Morals', 'Faith in others'], alts: [['Values', 'Trust'], ['Mind', 'Outlook']] },
  ];

  const UNANSWERED_RECENT = 3; // today + 2 missed days carry no baked answer
  const TODAY = new Date('2026-05-28T08:00:00');
  const DAYNAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function nOf(q) { return q.type === 'rating' ? 10 : q.type === 'binary' ? 2 : q.type === 'scale' ? 5 : q.options.length; }
  function labelsOf(q) {
    if (q.type === 'rating') return Array.from({ length: 10 }, (_, i) => String(i + 1));
    if (q.type === 'scale') return SCALE5;
    return q.options;
  }

  // base "shape" of opinion for a question (before audience perturbation)
  function baseLogits(q, n) {
    const r = rng(q.id + '|base');
    const arr = [];
    // give scale/rating a gentle hump so they look like real opinion curves
    const center = 1 + r() * (n - 2);
    for (let i = 0; i < n; i++) {
      let l = (r() - 0.5) * 1.8;
      if (q.type === 'scale' || q.type === 'rating') l += -Math.pow((i - center) / (n * 0.42), 2) * 1.6;
      arr.push(l);
    }
    return arr;
  }

  function genDist(q, aud, mineIdx, base) {
    const n = base.length;
    const r = rng(q.id + '|' + aud);
    const spread = SPREAD[aud] ?? 1.2;
    const logits = base.map(b => (b / spread) + (r() - 0.5) * 2.0 * spread);
    if (mineIdx != null) logits[mineIdx] += (PULL[aud] ?? 0);
    return softmaxPct(logits);
  }

  // build the question objects
  const QUESTIONS = Q.map((q, i) => {
    const id = 'dq' + String(Q.length - i).padStart(2, '0');
    const d = new Date(TODAY.getTime() - i * 86400000);
    const n = nOf(q);
    const base = baseLogits({ ...q, id }, n);
    // baked "what the user answered that day" (null for today + recent misses)
    let mineIdx = null;
    if (i >= UNANSWERED_RECENT) {
      const mr = rng(id + '|mine');
      // bias the user's own past answers slightly agreeable / positive
      const ml = base.map((b, k) => b + (mr() - 0.5) * 1.6 + ((q.type === 'scale' || q.type === 'rating') ? k * 0.12 : 0));
      mineIdx = ml.indexOf(Math.max(...ml));
    }
    const dist = {};
    AUDIENCES.forEach(a => { dist[a.id] = genDist({ ...q, id }, a.id, mineIdx, base); });
    return {
      id, idx: i, type: q.type, prompt: q.prompt, tag: q.tag || null, tone: q.tone, axis: q.axis || null,
      cat: q.cat, catCandidates: buildCandidates(id, q.cat, q.alts),
      options: labelsOf({ ...q, options: q.options }),
      n, dist, bakedMine: mineIdx,
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      day: DAYNAMES[d.getDay()],
      dateLabel: `${d.getDate()} ${MONTHS[d.getMonth()]}`,
      isToday: i === 0,
    };
  });

  // ── persistent answer store ────────────────────────────────────────────────
  const LS = 'insight.dailyq.v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { saved = {}; }
  const listeners = new Set();

  // ── personal branch placement (overrides the crowd's voted default) ───────
  const LSC = 'insight.dailyq.cat.v1';
  let savedCat = {};
  try { savedCat = JSON.parse(localStorage.getItem(LSC) || '{}'); } catch (e) { savedCat = {}; }
  function categoryPath(q) {
    if (savedCat[q.id]) return savedCat[q.id];
    let best = q.catCandidates[0];
    q.catCandidates.forEach((c) => { if (c.votes > best.votes) best = c; });
    return best.path;
  }
  function categoryCandidates(q) {
    const ov = savedCat[q.id];
    const list = q.catCandidates.map((c) => ({ path: c.path, votes: c.votes + (ov && pathKey(ov) === pathKey(c.path) ? 1 : 0) }));
    if (ov && !list.some((c) => pathKey(c.path) === pathKey(ov))) list.push({ path: ov, votes: 1, custom: true });
    list.forEach((c) => { c.mine = ov ? pathKey(ov) === pathKey(c.path) : false; });
    list.sort((a, b) => b.votes - a.votes);
    const total = list.reduce((s, c) => s + c.votes, 0) || 1;
    list.forEach((c) => { c.share = Math.round((c.votes / total) * 100); });
    return list;
  }
  function voteCategory(qid, path) {
    savedCat[qid] = path;
    try { localStorage.setItem(LSC, JSON.stringify(savedCat)); } catch { /* best-effort */ }
    listeners.forEach((f) => f());
  }
  function answeredCategorized() {
    return QUESTIONS.filter((q) => myAnswer(q) != null).map((q) => {
      const idx = myAnswer(q);
      const ansText = (q.options && q.options[idx] != null) ? q.options[idx] : (q.type === 'rating' ? (idx + 1) + '/10' : '—');
      const prompt = q.prompt.replace(/[.\s]+$/, '');
      const path = categoryPath(q);
      const meta = catMeta(path[0]);
      return { qid: q.id, top: path[0], sub: path[1] || null, catId: meta.catId, hue: meta.hue, label: prompt + ' → ' + ansText, dateLabel: q.dateLabel };
    });
  }

  function myAnswer(q) {
    if (q.id in saved) return saved[q.id];
    // live mode: the demo's baked history is Mira's, not the user's —
    // only genuinely-answered questions may reach the map
    if (window.LIVE && window.LIVE.enabled) return null;
    return q.bakedMine;            // baked past answer, or null
  }

  const api = {
    AUDIENCES, audience: (id) => AUDIENCES.find(a => a.id === id),
    questions: QUESTIONS,
    today: QUESTIONS[0],
    myAnswer,
    isAnswered: (q) => myAnswer(q) != null,
    answer(id, choice) {
      saved[id] = choice;
      try { localStorage.setItem(LS, JSON.stringify(saved)); } catch { /* best-effort */ }
      listeners.forEach(f => f());
    },
    unansweredCount() { return QUESTIONS.filter(q => myAnswer(q) == null).length; },
    // questions the user still hasn't answered, newest first
    unanswered() { return QUESTIONS.filter(q => myAnswer(q) == null); },
    // answered questions (incl. baked), newest first
    answered() { return QUESTIONS.filter(q => myAnswer(q) != null); },
    subscribe(f) { listeners.add(f); return () => listeners.delete(f); },

    // ── category / branch placement ──
    categoryPath, categoryCandidates, voteCategory, catMeta, answeredCategorized,
    EMERGENT_CATS, CAT_META,

    // ── derived helpers for views ──
    // headline stat for a question + audience
    headline(q, audId) {
      const d = q.dist[audId];
      if (q.type === 'rating') {
        const avg = d.reduce((a, p, i) => a + p * (i + 1), 0) / 100;
        return { big: avg.toFixed(1), unit: '/10', sub: 'average' };
      }
      if (q.type === 'scale') {
        const agree = d[3] + d[4];
        return { big: agree + '%', unit: '', sub: 'agree' };
      }
      // binary / choice → leading option
      let top = 0; for (let i = 1; i < d.length; i++) if (d[i] > d[top]) top = i;
      return { big: d[top] + '%', unit: '', sub: q.options[top] };
    },
    // "you vs them" line; returns null if user hasn't answered
    youVsThem(q, audId) {
      const mine = myAnswer(q);
      if (mine == null) return null;
      const d = q.dist[audId];
      const audLabel = (api.audience(audId) || {}).label || 'them';
      if (q.type === 'scale' || q.type === 'rating') {
        const below = d.slice(0, mine).reduce((a, b) => a + b, 0);
        const above = d.slice(mine + 1).reduce((a, b) => a + b, 0);
        const axis = q.axis || 'further along';
        if (below >= above) return { pct: below, text: `more ${axis} than ${below}% of ${audLabel}` };
        return { pct: above, text: `less ${axis} than ${above}% of ${audLabel}` };
      }
      const same = d[mine];
      return { pct: same, text: `${same}% of ${audLabel} are with you` };
    },
  };
  window.DAILYQ = api;

  // ── live hydration (Phase 4b) ─────────────────────────────────────
  // The Map's constellation and the Mirror's daily record read this
  // store. In live mode: (1) the user's real Firestore answers hydrate
  // `saved` (prompt-matched — the seeded daily bank came from this very
  // pool, and option orders are identical), and (2) each question's
  // WORLD distribution is replaced with the real k-floored aggregate.
  // Other audiences keep their synthetic dists until they have real
  // data sources; `liveWorld` marks the swapped ones.
  function liveSync() {
    const L = window.LIVE;
    if (!L || !L.enabled || !L.ready || !L.dailyBank) return;
    const votes = (L.confirmedVotes ? L.confirmedVotes() : (L.myVotes && L.myVotes())) || {};
    const byPrompt = {};
    const demoPrompts = new Set(QUESTIONS.map((q) => q.prompt));
    L.dailyBank().forEach((b) => {
      byPrompt[b.prompt] = b;
      // The join key is prompt-string equality. A bank entry no demo
      // question matches means a content edit silently orphaned it —
      // its votes would stop feeding the Map. Loud beats silent.
      if (!demoPrompts.has(b.prompt)) {
        console.warn('[dailyq] bank entry has no demo twin (prompt drifted?):', b.id);
      }
    });
    let changed = false;
    QUESTIONS.forEach((q) => {
      const b = byPrompt[q.prompt];
      if (!b) return;
      const v = votes[b.id];
      if (v != null && !(q.id in saved)) { saved[q.id] = Number(v); changed = true; }
      const agg = L.aggFor && L.aggFor(b.id);
      const size = (q.dist && q.dist.world && q.dist.world.length) || (q.options && q.options.length) || 0;
      if (agg && agg.tooSmall === false && agg.counts && size) {
        const counts = []; let total = 0;
        for (let i = 0; i < size; i++) { const n = agg.counts[String(i)] || 0; counts.push(n); total += n; }
        if (total > 0) {
          const pcts = counts.map((n) => Math.floor((n / total) * 100));
          let rem = 100 - pcts.reduce((a, c) => a + c, 0);
          for (let i = 0; rem > 0; i = (i + 1) % pcts.length, rem--) pcts[i]++;
          q.dist.world = pcts; q.liveWorld = true; changed = true;
        }
      }
    });
    if (changed) {
      try { localStorage.setItem(LS, JSON.stringify(saved)); } catch { /* best-effort */ }
      listeners.forEach((f) => f());
    }
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('insight-live-update', liveSync);
  }
  liveSync();
})();

