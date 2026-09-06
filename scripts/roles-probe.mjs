// roles-probe.mjs — what the role matcher (D204) does to a duel record of a
// given depth, measured rather than reasoned about. The probe behind
// docs/ROLES-PLAN.md §2; re-run it before trusting the numbers quoted there.
//
//   node scripts/roles-probe.mjs
//
// WHAT IT DOES. Draws pairs and groups with plausible TRUE rates, plays
// them for n days, folds the days exactly as data/roles.ts does (rates,
// flips, the same clamp), hands the dims to the shipped IS_matchArchetype
// and counts: which named type each record lands on, how often the match
// is a tie (the matcher's own `gap` under 5 rms points — its comment calls
// that "effectively a tie"), and how often ONE MORE DAY changes the name.
// It also reports the correlation between the group dims, because a type
// table over three dims that move together is a table over one.
//
// WHAT IT ASSUMES. The spread of true rates is authored here, not measured
// — no live duel record has scored yet (content/scorecard.json, duel
// section: 0 plays). Two models per instrument so a finding has to survive
// both: for a 1v1, independent hit rates, then a projection model (a guess
// is your own answer with some probability, else a read); for a group,
// one smooth spread of conformity, then a polarised mixture with a third
// of members at 0.3. Every finding in the plan is one that held under both.
//
// Stdlib only, apart from the matcher itself — archetype-data.js is off the
// bridge (D253) and loads under plain node, which is what lets a probe run
// against the SHIPPED tables rather than a copy of them.
import { IS_ARCHETYPES, IS_matchArchetype } from "../src/v2/spec/archetype-data.js";

let seed = 20260906;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const gauss = () => { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const clip = (x) => Math.max(0.05, Math.min(0.97, x));
const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
const rate = (r, t) => (t ? clamp((r / t) * 100) : 50);
// data/roles.ts's steadiness, verbatim in shape
function steadiness(arr) {
  if (!arr || arr.length < 2) return 50;
  let flips = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i] !== arr[i - 1]) flips++;
  return clamp(100 - (flips / (arr.length - 1)) * 100);
}
const match = (kind, dims) => { const m = IS_matchArchetype(kind, dims); return { name: m.list[m.idx].name, gap: m.gap }; };
const pct = (n, d) => String(Math.round((100 * n) / d)).padStart(3);
const short = (s) => s.replace(/^The /, "");
const line = (names, counts, N) => names.map((x) => `${short(x)} ${pct(counts[x], N)}`).join(" · ");
const corr = (x, y) => {
  const mx = x.reduce((a, b) => a + b) / x.length, my = y.reduce((a, b) => a + b) / y.length;
  let sxy = 0, sx = 0, sy = 0;
  for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; }
  return sxy / Math.sqrt(sx * sy);
};

// ── 1v1 ─────────────────────────────────────────────────────────────────
const duoNames = IS_ARCHETYPES.duo.list.map((t) => t.name);
const duoDims = (read, by, same) => [
  { id: "read", value: rate(read.filter(Boolean).length, read.length) },
  { id: "seen", value: rate(by.filter(Boolean).length, by.length) },
  { id: "like", value: rate(same, read.length) },
  { id: "steady", value: steadiness(read) },
];
// Model A: independent hit rates. Model B: k options a day; a guess is your
// own answer with probability `proj`, else a read that lands with `skill`.
function playDuo(model, n) {
  const read = [], by = []; let same = 0;
  if (model === "A") {
    const pr = clip(0.62 + 0.15 * gauss()), ps = clip(0.62 + 0.15 * gauss()), pl = clip(0.54 + 0.15 * gauss());
    for (let d = 0; d < n; d++) { read.push(rnd() < pr); by.push(rnd() < ps); if (rnd() < pl) same++; }
  } else {
    const like = clip(0.55 + 0.15 * gauss());
    const proj = clip(0.5 + 0.25 * gauss()), skill = clip(0.6 + 0.2 * gauss());
    const tproj = clip(0.5 + 0.25 * gauss()), tskill = clip(0.6 + 0.2 * gauss());
    for (let d = 0; d < n; d++) {
      const k = [2, 3, 4][Math.floor(rnd() * 3)];
      const mine = Math.floor(rnd() * k);
      const theirs = rnd() < like ? mine : (mine + 1 + Math.floor(rnd() * (k - 1))) % k;
      if (mine === theirs) same++;
      const g = rnd() < proj ? mine : rnd() < skill ? theirs : Math.floor(rnd() * k);
      const tg = rnd() < tproj ? theirs : rnd() < tskill ? mine : Math.floor(rnd() * k);
      read.push(g === theirs); by.push(tg === mine);
    }
  }
  return { read, by, same };
}
console.log("=== 1v1 — the shipped `duo` table ===");
console.log("authored shares: " + IS_ARCHETYPES.duo.list.map((t) => `${short(t.name)} ${String(t.share).padStart(3)}`).join(" · "));
for (const model of ["A", "B"]) {
  console.log(`model ${model === "A" ? "A — independent rates" : "B — projection, 2–4 options"}`);
  for (const n of [3, 7, 14, 30]) {
    const N = 20000; const counts = Object.fromEntries(duoNames.map((x) => [x, 0])); let ties = 0, flap = 0;
    for (let i = 0; i < N; i++) {
      const p = playDuo(model, n + 1);
      const a = match("duo", duoDims(p.read.slice(0, n), p.by.slice(0, n), Math.round((p.same * n) / (n + 1))));
      const b = match("duo", duoDims(p.read, p.by, p.same));
      counts[a.name]++; if (a.gap < 5) ties++; if (a.name !== b.name) flap++;
    }
    console.log(`  n=${String(n).padStart(2)}: tie ${pct(ties, N)}%  one-more-day flips the name ${pct(flap, N)}%   ${line(duoNames, counts, N)}`);
  }
}

// ── group ───────────────────────────────────────────────────────────────
const grpNames = IS_ARCHETYPES.group.list.map((t) => t.name);
function playGroup(prior, m, n) {
  const conf = Array.from({ length: m }, () => (prior === "smooth"
    ? clip(0.6 + 0.2 * gauss())
    : clip((rnd() < 0.7 ? 0.75 : 0.3) + 0.1 * gauss())));
  const days = [];
  for (let d = 0; d < n; d++) {
    const k = rnd() < 0.5 ? 2 : 4; const lean = Math.floor(rnd() * k);
    days.push({ k, votes: conf.map((c) => (rnd() < c ? lean : Math.floor(rnd() * k))) });
  }
  return { conf, days };
}
// data/roles.ts's groupRole, for member 0
function groupDims(days, m) {
  let withMaj = 0, agree = 0, shared = 0; const majRun = [];
  for (const d of days) {
    const cnt = new Array(d.k).fill(0); d.votes.forEach((v) => cnt[v]++); const mx = Math.max(...cnt);
    const w = cnt[d.votes[0]] === mx; if (w) withMaj++; majRun.push(w);
    for (let j = 1; j < m; j++) { shared++; if (d.votes[j] === d.votes[0]) agree++; }
  }
  return [
    { id: "own", value: rate(days.length - withMaj, days.length) },
    { id: "pull", value: rate(agree, shared) },
    { id: "settle", value: steadiness(majRun) },
  ];
}
console.log("\n=== group — the shipped `group` table ===");
console.log("authored shares: " + IS_ARCHETYPES.group.list.map((t) => `${short(t.name)} ${String(t.share).padStart(3)}`).join(" · "));
for (const prior of ["smooth", "polarised"]) {
  console.log(prior === "smooth" ? "prior — conformity 0.6 ± 0.2" : "prior — 70% at 0.75, 30% independents at 0.3");
  for (const m of [4, 6]) for (const n of [2, 5, 14, 30]) {
    const N = 8000; const counts = Object.fromEntries(grpNames.map((x) => [x, 0]));
    let ties = 0, flap = 0; const own = [], pull = [], settle = [];
    const ind = Object.fromEntries(grpNames.map((x) => [x, 0])); let nInd = 0;
    for (let i = 0; i < N; i++) {
      const g = playGroup(prior, m, n + 1);
      const d0 = groupDims(g.days.slice(0, n), m);
      const a = match("group", d0), b = match("group", groupDims(g.days, m));
      counts[a.name]++; if (a.gap < 5) ties++; if (a.name !== b.name) flap++;
      own.push(d0[0].value); pull.push(d0[1].value); settle.push(d0[2].value);
      if (g.conf[0] < 0.45) { nInd++; ind[a.name]++; }
    }
    console.log(`  m=${m} n=${String(n).padStart(2)}: tie ${pct(ties, N)}%  flip ${pct(flap, N)}%  r(own,pull) ${corr(own, pull).toFixed(2)}  r(own,settle) ${corr(own, settle).toFixed(2)}   ${line(grpNames, counts, N)}`);
    if (nInd > 200) console.log(`             the independents (true conformity < .45) land on: ${line(grpNames, ind, nInd)}`);
  }
}
