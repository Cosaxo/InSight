// pulse-data.js — THE PULSES: short questions asked on a rhythm you set, so a
// line can be drawn through them. A line may only be drawn through a question
// that repeats, so a pulse is never a one-off — but there is now more than one,
// and each carries its own cadence: daily · often (Mon·Wed·Fri) · weekly
// (Sunday) · off. Raising a pulse's cadence is what "show up more often" means.
//
// Everything here stays honest by construction:
//   · a day nobody answered is ABSENT — never zero-filled, never bridged
//   · a day too thin to place keeps its count and is listed, not positioned
//   · a day the pulse was not scheduled is simply absent too
//   · no smoothing, no rolling mean, no invented baseline anywhere
// The reading lives in pulse-trends.jsx; the instrument in pulse-card.jsx.
// Every public reader (days, scope, bins, streak, Q, STEPS…) answers for the
// ACTIVE pulse, so both of those files follow whichever pulse is on screen.
(function () {
  const KEY = 'insight.pulse.v1';         // {pulseId: {iso: value}}  (v1 flat = mood)
  const CKEY = 'insight.pulse.cadence.v1';
  const DAYS = 21;
  const THIN = 20;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const CADENCES = ['daily', 'often', 'weekly', 'off'];

  // ── the library. hue: null = the app's own --pulse token (mood is the
  // original); every other hue goes through WPAL like all World colour.
  const PULSES = [
    { id: 'mood',   kicker: 'daily pulse',  text: 'How is today going?',       hue: null, base: 3.5, pop: 1,
      steps: ['Rough', 'Off', 'Fine', 'Good', 'Great'], ends: ['rough', 'great'], cad: 'daily' },
    { id: 'energy', kicker: 'energy pulse', text: 'How is your energy today?', hue: 42,  base: 3.1, pop: 0.55,
      steps: ['Drained', 'Low', 'OK', 'Charged', 'Wired'], ends: ['drained', 'wired'], cad: 'weekly' },
    { id: 'sleep',  kicker: 'sleep pulse',  text: 'How did you sleep?',        hue: 258, base: 3.3, pop: 0.7,
      steps: ['Badly', 'Patchy', 'OK', 'Well', 'Deeply'], ends: ['badly', 'deeply'], cad: 'weekly' },
    { id: 'focus',  kicker: 'focus pulse',  text: 'How clear is your head?',   hue: 152, base: 3.2, pop: 0.4,
      steps: ['Scattered', 'Foggy', 'OK', 'Clear', 'Sharp'], ends: ['scattered', 'sharp'], cad: 'off' },
    { id: 'social', kicker: 'social pulse', text: 'How connected do you feel?', hue: 330, base: 3.4, pop: 0.35,
      steps: ['Alone', 'Distant', 'OK', 'Close', 'Held'], ends: ['alone', 'held'], cad: 'off' },
  ];
  const byId = (id) => PULSES.find((p) => p.id === id) || PULSES[0];

  // ── mood keeps its authored demo histories: each one exists to make an honest
  // case visible — a real user with three skips, a week away, day one, a perfect run
  const HISTORY = {
    typical: [3, 4, 4, null, 3, 2, 3, 4, 4, 4, null, 3, 3, 4, 5, 4, null, 3, 4, 4, null],
    gap:     [4, 3, 3, 4, 4, 3, 4, null, null, null, null, null, null, null, 3, 4, 4, 3, 4, 4, null],
    day1:    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    perfect: [4, 4, 3, 4, 5, 4, 4, 3, 4, 4, 5, 5, 4, 4, 3, 4, 4, 5, 5, 4, null],
  };
  const MOOD_SCOPES = [
    { id: 'city', short: 'city',
      mean: [3.4, 3.5, null, 3.2, 3.3, 3.6, 3.1, 2.9, null, 3.4, 3.5, 3.3, 3.2, 3.6, 3.7, 3.0, 3.3, 3.4, 3.5, 3.6, 3.5],
      n:    [64, 71, 0, 58, 83, 96, 41, 12, 0, 77, 88, 64, 59, 103, 96, 8, 74, 92, 118, 131, 43] },
    { id: 'country', short: 'country',
      mean: [3.3, 3.4, 3.3, 3.2, 3.3, 3.5, 3.2, 3.1, 3.2, 3.3, 3.4, 3.3, 3.2, 3.5, 3.6, 3.2, 3.3, 3.4, 3.4, 3.5, 3.4],
      n:    [1240, 1310, 980, 1120, 1420, 1510, 1180, 1260, 1090, 1330, 1470, 1280, 1210, 1560, 1620, 1180, 1390, 1480, 1620, 1710, 610] },
    { id: 'world', short: 'world', label: 'World',
      mean: [3.5, 3.5, 3.4, 3.4, 3.5, 3.6, 3.4, 3.4, 3.4, 3.5, 3.5, 3.5, 3.4, 3.6, 3.6, 3.4, 3.5, 3.5, 3.5, 3.6, 3.5],
      n:    [58200, 61400, 49800, 57300, 64100, 71200, 55600, 59800, 52100, 63400, 69700, 60200, 57900, 72300, 74800, 58600, 66200, 70400, 73900, 78100, 24800] },
  ];
  const MOOD_BINS = { city: [7, 12, 27, 35, 19], country: [8, 14, 28, 33, 17], world: [6, 13, 28, 34, 19] };

  const subs = new Set();
  const notify = () => subs.forEach((f) => { try { f(); } catch (e) {} });
  const h01 = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 8) % 100000) / 100000; };
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const midnight = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const dayAt = (i) => { const d = midnight(); d.setDate(d.getDate() - (DAYS - 1 - i)); return d; };
  const dayLabel = (d) => d.getDate() + ' ' + MON[d.getMonth()];

  // ── cadence: the rhythm you set per pulse. Explainable, not fuzzy.
  const dueOn = (cad, date) => {
    if (cad === 'off') return false;
    if (cad === 'daily') return true;
    const w = date.getDay();
    if (cad === 'often') return w === 1 || w === 3 || w === 5;
    return w === 0;
  };
  const loadCad = () => { try { const v = JSON.parse(localStorage.getItem(CKEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } };
  const cadence = (id) => { const c = loadCad()[id]; return CADENCES.includes(c) ? c : byId(id).cad; };
  const setCadence = (id, c) => {
    if (!CADENCES.includes(c)) return;
    const m = loadCad(); m[id] = c;
    try { localStorage.setItem(CKEY, JSON.stringify(m)); } catch (e) {}
    if (window.HAPTIC) window.HAPTIC.tick();
    notify();
  };

  // ── your answers, per pulse (migrating the flat v1 map into mood)
  function load() {
    let v = {};
    try { v = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { v = {}; }
    const keys = Object.keys(v);
    if (keys.length && !PULSES.some((p) => v[p.id])) { if (/^\d{4}-/.test(keys[0])) v = { mood: v }; }
    PULSES.forEach((p) => { if (!v[p.id] || typeof v[p.id] !== 'object') v[p.id] = {}; });
    return v;
  }
  const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };

  // ── the seeded history + crowd for every pulse but mood: same shape, same
  // rules, generated from the pulse id so the demo is stable between reloads
  const _syn = {};
  function synth(id) {
    if (_syn[id]) return _syn[id];
    const p = byId(id);
    const hist = [], scopes = [];
    for (let i = 0; i < DAYS; i++) {
      const d = dayAt(i), r = h01(id + ':h' + i);
      hist.push(dueOn(p.cad === 'off' ? 'often' : p.cad, d) && r > 0.14
        ? Math.max(1, Math.min(5, Math.round(p.base + (h01(id + ':v' + i) - 0.5) * 2.2)))
        : null);
    }
    [['city', 1 / 900], ['country', 1 / 42], ['world', 1]].forEach(([sid, f]) => {
      const mean = [], n = [];
      for (let i = 0; i < DAYS; i++) {
        const mv = p.base + (h01(id + sid + 'm' + i) - 0.5) * 0.6;
        const nv = Math.round(64000 * p.pop * f * (0.8 + h01(id + sid + 'n' + i) * 0.5) * (i === DAYS - 1 ? 0.34 : 1));
        mean.push(nv > 0 ? Math.round(mv * 10) / 10 : null); n.push(nv);
      }
      scopes.push({ id: sid, short: sid, label: sid === 'world' ? 'World' : undefined, mean, n });
    });
    // today's five bins: a shape peaked at the crowd's own mean, to the point
    const m = scopes[2].mean[DAYS - 1] || p.base;
    const bins = {};
    scopes.forEach((s) => {
      const w = [1, 2, 3, 4, 5].map((v) => Math.exp(-((v - m) ** 2) / 1.5));
      const t = w.reduce((a, x) => a + x, 0);
      bins[s.id] = w.map((x) => Math.round((x / t) * 100));
    });
    return (_syn[id] = { hist, scopes, bins });
  }
  const histOf = (id) => (id === 'mood' ? (HISTORY[window.IS_PULSE_HISTORY] || HISTORY.typical) : synth(id).hist);
  const scopesOf = (id) => (id === 'mood' ? MOOD_SCOPES : synth(id).scopes);
  const binsOf = (id) => (id === 'mood' ? MOOD_BINS : synth(id).bins);

  // ── which pulses are asked today, and which one the card is showing
  function dueToday() { const d = midnight(); return PULSES.filter((p) => dueOn(cadence(p.id), d)).map((p) => p.id); }
  // the next day this pulse is asked — so a card that isn't due says when it is
  const DOWN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function nextDue(pid) {
    const c = cadence(pid || active().id);
    if (c === 'off') return null;
    const d = midnight();
    for (let k = 0; k < 8; k++) { const t = new Date(d); t.setDate(d.getDate() + k); if (dueOn(c, t)) return { date: t, days: k, label: k === 0 ? 'today' : k === 1 ? 'tomorrow' : DOWN[t.getDay()] }; }
    return null;
  }
  let _active = null;
  function active() {
    const due = dueToday();
    if (_active && (due.includes(_active) || cadence(_active) !== 'off')) return byId(_active);
    const mineAll = load();
    const today = iso(midnight());
    const open = due.find((id) => mineAll[id][today] == null);
    return byId(open || due[due.length - 1] || (PULSES.find((p) => cadence(p.id) !== 'off') || {}).id || 'mood');
  }
  const setActive = (id) => { _active = byId(id).id; notify(); };

  function days(pid) {
    const id = pid || active().id, hs = histOf(id), mine = load()[id] || {};
    return hs.map((v, i) => {
      const d = dayAt(i), k = iso(d);
      return { i, key: k, date: d, label: dayLabel(d), today: i === DAYS - 1, weekStart: i % 7 === 0, v: mine[k] != null ? mine[k] : v };
    });
  }

  function scope(sid, pid) {
    const id = pid || active().id;
    const list = scopesOf(id);
    const s = list.find((x) => x.id === sid) || list[0];
    const me = (window.IS_DATA || {}).me || {};
    const label = s.label || (s.id === 'city' ? (me.location || 'Your city') : s.id === 'country' ? (me.country || 'Your country') : 'World');
    const series = s.mean.map((m, i) => {
      const n = s.n[i] || 0;
      return { i, mean: n > 0 ? m : null, n, placed: n >= THIN && m != null, thin: n > 0 && n < THIN };
    });
    return { id: s.id, label, short: s.short, series };
  }

  function streak(pid) {
    const d = days(pid);
    const live = d[DAYS - 1].v != null;
    let run = 0;
    for (let i = DAYS - 1 - (live ? 0 : 1); i >= 0; i--) { if (d[i].v == null) break; run++; }
    return { run, live, ticks: d.slice(DAYS - 14) };
  }

  const fmtN = (n) => n >= 1000000 ? (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 10000 ? Math.round(n / 1000) + 'k' : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
  const stepsOf = (id) => byId(id).steps.map((label, k) => ({ v: k + 1, label }));

  window.PULSE = {
    DAYS, THIN, CADENCES, PULSES,
    SCOPES: ['city', 'country', 'world'],
    get STEPS() { return stepsOf(active().id); },
    stepsFor: (id) => stepsOf(id || active().id),
    get Q() { const p = active(); return { id: p.id, kicker: p.kicker, text: p.text, ends: p.ends, hue: p.hue }; },
    days, scope, streak, fmtN,
    word: (v, pid) => (stepsOf(pid || active().id).find((s) => s.v === v) || {}).label || '',
    bins: (sid, pid) => binsOf(pid || active().id)[sid] || binsOf(pid || active().id).world,
    active, setActive, dueToday, nextDue, cadence, setCadence,
    pulse: (id) => { const p = byId(id); return { id: p.id, kicker: p.kicker, text: p.text, ends: p.ends, hue: p.hue }; },
    // the pulse's colour: mood owns the app's --pulse token, the rest go
    // through WPAL like every other World hue
    colour: (pid) => { const p = byId(pid || active().id); return p.hue == null ? 'var(--pulse)' : window.WPAL.c('oklch(0.6 0.15 ' + p.hue + ')'); },
    // the contrast-safe twin, for the one place a pulse fill carries #fff
    inkColour: (pid) => { const p = byId(pid || active().id); return p.hue == null ? 'var(--pulse)' : window.WPAL.ink('oklch(0.52 0.14 ' + p.hue + ')'); },
    mineToday: (pid) => { const d = days(pid); return d[DAYS - 1].v; },
    answer(v, pid) { const id = pid || active().id; const m = load(); m[id][iso(midnight())] = v; save(m); notify(); if (window.HAPTIC) window.HAPTIC.tick(); },
    clearToday(pid) { const id = pid || active().id; const m = load(); delete m[id][iso(midnight())]; save(m); notify(); },
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
    // ── onto the Map: the pulse is a branch of You with one leaf per day
    // answered. Radius stays the map's own encoding — typicality — so a day you
    // felt what everyone felt sits close in and an outlier sits at the edge.
    mapBranch() {
      const sc = scope('world', 'mood');
      const nodes = days('mood').filter((d) => d.v != null).map((x) => {
        const m = sc.series[x.i];
        return {
          id: 'pulse-' + x.key, parentId: 'pulse', pulse: true, daily: true, pidx: x.i,
          label: x.label + ' → ' + this.word(x.v, 'mood'), tag: 'Daily pulse', ans: this.word(x.v, 'mood'), prompt: PULSES[0].text,
          note: m.placed ? 'world ' + m.mean.toFixed(1) : 'no crowd figure',
          age: DAYS - 1 - x.i,
          typ: m.placed ? Math.max(0, 1 - Math.abs(x.v - m.mean) / 2) : 0.5,
        };
      });
      return { cats: [{ id: 'pulse', label: 'Pulse', hue: 282, pulse: true }], nodes };
    },
  };
})();
