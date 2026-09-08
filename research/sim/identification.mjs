// identification.mjs — G7 §3's table, checked exactly.
//
// A directed observation y by sender i about receiver j is modelled as
//   y = mean + sender_i + receiver_j + relationship_ij + error
// with two covariances across the terms (generalized reciprocity between a
// unit's sender and receiver terms; dyadic reciprocity between the pair's
// two directed relationship terms), plus, on the designs that carry them,
// a sitting term shared by observations taken in one sitting and a context
// term shared by every observation inside one context (a group).
//
// Under that model the covariance of the observation vector is LINEAR in
// the variance parameters: Sigma(theta) = sum_k theta_k V_k, where each
// V_k is a 0/1 matrix fixed by the design (which observations share a
// sender, a receiver, a directed pair, a reversed pair, a sitting, a
// context). So the parameters are identified — the map theta -> Sigma is
// injective — exactly when the V_k are linearly independent, and the null
// space of {vec V_k} lists the combinations no estimator can separate.
// That is a theorem about the design, not a Monte Carlo, which is why each
// row of the table is checked this way: there is no sampling noise to
// argue with, only a rank.

import { nullSpace, identifiedParameters } from "./lib/linalg.mjs";

export const COMPONENTS = {
  sender: (m, n) => (m.sender === n.sender ? 1 : 0),
  receiver: (m, n) => (m.receiver === n.receiver ? 1 : 0),
  // cov(sender_i, receiver_i): observation m's sender is n's receiver, or the reverse
  genRecip: (m, n) => (m.sender === n.receiver ? 1 : 0) + (m.receiver === n.sender ? 1 : 0),
  relationship: (m, n) => (m.sender === n.sender && m.receiver === n.receiver ? 1 : 0),
  // cov(relationship_ij, relationship_ji): the reversed directed pair
  dyadRecip: (m, n) => (m.sender === n.receiver && m.receiver === n.sender ? 1 : 0),
  error: (m, n) => (m === n ? 1 : 0),
  sitting: (m, n) => (m.sitting !== undefined && m.sitting === n.sitting ? 1 : 0),
  context: (m, n) => (m.context !== undefined && m.context === n.context ? 1 : 0),
};
export const BASE = ["sender", "receiver", "genRecip", "relationship", "dyadRecip", "error"];

/** vec of the upper triangle (incl. diagonal) of each component's V_k. */
export function componentColumns(obs, names) {
  const N = obs.length;
  const len = (N * (N + 1)) / 2;
  return names.map((name) => {
    const f = COMPONENTS[name];
    const col = new Float64Array(len);
    let t = 0;
    for (let m = 0; m < N; m += 1) {
      for (let n = m; n < N; n += 1) {
        col[t] = f(obs[m], obs[n]);
        t += 1;
      }
    }
    return col;
  });
}

/**
 * The identification reading for a design: which parameters are identified
 * on their own, and the combinations the null space says are not.
 * @returns {{names, rank, identified: string[], unidentified: string[], nulls: number[][]}}
 */
export function identify(obs, names = BASE) {
  const cols = componentColumns(obs, names);
  const { rank, nulls } = nullSpace(cols);
  const flags = identifiedParameters(nulls, names.length);
  return {
    names,
    rank,
    identified: names.filter((_, i) => flags[i]),
    unidentified: names.filter((_, i) => !flags[i]),
    nulls: nulls.map((c) => {
      // normalise so the first non-zero coefficient is +1, for readability
      const big = c.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
      const first = c.find((x) => Math.abs(x) > 1e-9 * Math.abs(big)) || big;
      return c.map((x) => Math.round((x / first) * 1e6) / 1e6);
    }),
  };
}

/** A null vector as prose: "relationship − error" means those two only sum. */
export function describeNull(names, c) {
  return names
    .map((n, i) => [n, c[i]])
    .filter(([, x]) => Math.abs(x) > 1e-6)
    .map(([n, x], i) => `${x < 0 ? "− " : i ? "+ " : ""}${Math.abs(Math.abs(x) - 1) < 1e-6 ? "" : `${Math.abs(x)}·`}${n}`)
    .join(" ");
}

// ── The designs, one per row of G7 §3's table ──

let sittingCounter = 0;
const ownSitting = () => (sittingCounter += 1);
const directed = (sender, receiver, extra = {}) => ({ sender, receiver, sitting: ownSitting(), ...extra });

/** Each unit in exactly one relation, observed once in each direction. */
export function oneRelationPerUnit(nPairs = 6) {
  const obs = [];
  for (let k = 0; k < nPairs; k += 1) {
    obs.push(directed(2 * k, 2 * k + 1));
    obs.push(directed(2 * k + 1, 2 * k));
  }
  return obs;
}

/** Round-robin groups: every ordered pair inside a group once (or `reps` times), each observation in its own sitting. */
export function roundRobin(groups = 3, size = 4, reps = 1, opts = {}) {
  const obs = [];
  for (let g = 0; g < groups; g += 1) {
    const units = Array.from({ length: size }, (_, i) => g * size + i);
    for (const i of units) {
      for (const j of units) {
        if (i === j) continue;
        for (let r = 0; r < reps; r += 1) {
          obs.push(directed(i, j, opts.context ? { context: g } : {}));
        }
      }
    }
  }
  return obs;
}

/** Round-robin, but the two directions of each pair are collected in ONE sitting. */
export function roundRobinSharedSitting(groups = 3, size = 4) {
  const obs = roundRobin(groups, size, 1);
  for (const o of obs) {
    const lo = Math.min(o.sender, o.receiver);
    const hi = Math.max(o.sender, o.receiver);
    o.sitting = `pair:${lo}-${hi}`;
  }
  return obs;
}

/** One direction only: i → i+1 and i → i+2 on a ring, so every unit sends to two and receives from two, and no pair is reversed. */
export function oneDirectionRing(n = 9) {
  const obs = [];
  for (let i = 0; i < n; i += 1) {
    obs.push(directed(i, (i + 1) % n));
    obs.push(directed(i, (i + 2) % n));
  }
  return obs;
}

/**
 * Units crossing contexts without any pair repeating: the seven triples of
 * the Fano plane, every pair of seven units in exactly one triple, every
 * unit in three. Round-robin inside each triple, context = the triple.
 */
export function fanoContexts() {
  const triples = [
    [0, 1, 2], [0, 3, 4], [0, 5, 6], [1, 3, 5], [1, 4, 6], [2, 3, 6], [2, 4, 5],
  ];
  const obs = [];
  triples.forEach((t, g) => {
    for (const i of t) for (const j of t) if (i !== j) obs.push(directed(i, j, { context: g }));
  });
  return obs;
}

export const DESIGNS = [
  {
    key: "oneRelationPerUnit",
    claim: "each unit in one relation: sender, receiver, pair and error are one number",
    build: () => oneRelationPerUnit(6),
    names: BASE,
  },
  {
    key: "roundRobinOnce",
    claim: "degree ≥ 2 in each role, one observation per directed pair, both directions: sender, receiver and both reciprocities identified; relationship and error only as a sum",
    build: () => roundRobin(3, 4, 1),
    names: BASE,
  },
  {
    key: "roundRobinReplicated",
    claim: "the same, with every directed pair observed twice in separate sittings: everything identified",
    build: () => roundRobin(3, 4, 2),
    names: BASE,
  },
  {
    key: "sharedSitting",
    claim: "both directions of a pair in one sitting: the dyadic covariance is confounded with the sitting term",
    build: () => roundRobinSharedSitting(3, 4),
    names: [...BASE, "sitting"],
  },
  {
    key: "oneDirectionRing",
    claim: "no pair reversed: the dyadic covariance is not an estimand at all; the member terms are",
    build: () => oneDirectionRing(9),
    names: BASE,
  },
  {
    key: "contextTriples",
    claim: "a context term on groups of THREE whose units are in no other context: confounded with the members' and the pair's terms",
    build: () => roundRobin(4, 3, 1, { context: true }),
    names: [...BASE, "context"],
  },
  {
    key: "contextQuads",
    claim: "a context term on groups of FOUR, units in no other context: identified — two pairs with no member in common share the context and nothing else",
    build: () => roundRobin(3, 4, 1, { context: true }),
    names: [...BASE, "context"],
  },
  {
    key: "contextFano",
    claim: "a context term on groups of three where every unit crosses three contexts: identified by the crossing",
    build: () => fanoContexts(),
    names: [...BASE, "context"],
  },
];

export function runIdentificationTable() {
  return DESIGNS.map((d) => {
    const obs = d.build();
    const r = identify(obs, d.names);
    return { ...d, observations: obs.length, ...r, described: r.nulls.map((c) => describeNull(d.names, c)) };
  });
}

// ── §4: what a pairing graph lets a symmetric observation attribute ──
//
// The fixed part of a difference-type response is theta_i − theta_j, of a
// sum-type response theta_i + theta_j. Stack one row per observed pair;
// the null space of that matrix is what no amount of data determines. The
// claim: differences leave one constant per connected component; sums
// leave one alternating constant per bipartite component and nothing on a
// component with an odd cycle.
export function pairingGraphNullSpace(nUnits, edges, kind) {
  const cols = Array.from({ length: nUnits }, (_, u) => {
    const col = new Float64Array(edges.length);
    edges.forEach(([i, j], e) => {
      if (u === i) col[e] = 1;
      if (u === j) col[e] = kind === "difference" ? -1 : 1;
    });
    return col;
  });
  const { rank, nulls } = nullSpace(cols);
  return { rank, nullDimension: nUnits - rank, nulls };
}

export const GRAPHS = [
  { key: "path4", units: 4, edges: [[0, 1], [1, 2], [2, 3]], bipartite: true, oddCycle: false },
  { key: "cycle4", units: 4, edges: [[0, 1], [1, 2], [2, 3], [3, 0]], bipartite: true, oddCycle: false },
  { key: "triangle", units: 3, edges: [[0, 1], [1, 2], [2, 0]], bipartite: false, oddCycle: true },
  { key: "twoTriangles", units: 6, edges: [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 3]], bipartite: false, oddCycle: true, components: 2 },
  { key: "bipartiteK23", units: 5, edges: [[0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4]], bipartite: true, oddCycle: false },
];
