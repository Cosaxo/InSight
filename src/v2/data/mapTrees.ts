// mapTrees.ts — the Map's v28 branch folds (§5, D207's second half): the
// pulse and Foresight leaves the lazy map chunk grows. Crossroads' fold
// lives with its own store (spec/paths-card.jsx, pathsMapTree) because it
// needs that card's live/demo source discipline; these two are typed folds
// over data the device already holds, so they live here and are
// unit-tested without a DOM.
//
// Every leaf is REAL: a pulse leaf exists only for a pulse you have
// actually answered, a read leaf only for dimensions the READ game has
// graded, a call leaf only for a call you made — and a call whose outcome
// has not published draws as SEALED rather than scored, because "waiting"
// and "wrong" are different claims. Empty branches return empty trees and
// the Map never renders them (map-groups' standing rule).
import LIVE from "./live";
import PULSE from "./pulse";
import { byDim } from "./foresight";
import { DIM_LABEL } from "./cohort";

// The node shape map-tab.jsx files into its constellation. `daily: true`
// is what makes the generic plumbing (layout, filters) treat a leaf as a
// first-class dot; the family flags (`pulse`/`fore`) are what the card
// dispatch and the answer-count filter key on — a pulse or fore leaf sits
// on the map but never inflates "N answers" or the time scrub.
export interface MapTreeCat {
  id: string; label: string; hue: number;
  pulse?: boolean; fore?: boolean; walk?: boolean;
}
export interface MapTreeNode {
  id: string; parentId: string; daily: true;
  label: string; tag: string; ans: string; prompt: string; note: string;
  /** days since the leaf last moved — the time scrub's axis. */
  age: number;
  /** typicality 0..1 — distance from You, the map's one encoded score. */
  typ: number;
  maj: boolean;
  pulse?: boolean; fore?: boolean;
  qid?: string;
}
export interface MapTree { cats: MapTreeCat[]; nodes: MapTreeNode[] }

const EMPTY: MapTree = { cats: [], nodes: [] };
const clampTyp = (x: number): number => Math.max(0.05, Math.min(0.95, x));

// ── the pulse branch (files under g-self via map-groups' 'pulse' cat) ──
//
// One leaf per pulse you have answered inside the 21-day window the store
// keeps. Distance is CONSISTENCY — answered scheduled days over scheduled
// days — so a pulse you keep sits close to You and one you dabble in
// drifts out, with no number needed. The leaf card is the trend line the
// pulse card already draws (ui/PulseTrends).
export function pulseTree(): MapTree {
  const nodes: MapTreeNode[] = [];
  // The demo asks only the first pulse (D166 §3 — the other four have no
  // honest demo crowd), so only it may leaf there; days() serves the same
  // design history for any pid and five identical demo lines would be an
  // invention. Live, roster() is the bank's own list (D203), so a pulse
  // leafs once the bank has arrived — boot's own fetch.
  const roster = LIVE.enabled ? PULSE.roster() : PULSE.roster().slice(0, 1);
  for (const p of roster) {
    const days = PULSE.days(p.id);
    const answered = days.filter((d) => d.v != null);
    if (!answered.length) continue;
    const scheduled = days.filter((d) => d.scheduled);
    const kept = scheduled.length
      ? scheduled.filter((d) => d.v != null).length / scheduled.length
      : answered.length / days.length;
    const lastIdx = days.reduce((a, d, i) => (d.v != null ? i : a), 0);
    const last = days[lastIdx];
    const st = PULSE.streak(p.id);
    nodes.push({
      // p.id is already the "pulse-…" bank id — unique, and distinct
      // from the cat id "pulse" the branch files under
      id: p.id, parentId: "pulse", pulse: true, daily: true,
      qid: p.id,
      label: p.kicker, tag: "Pulse", prompt: p.text,
      ans: last.v != null ? PULSE.word(p.id, last.v) : "",
      note: st.run >= 2 ? st.run + " in a row" : answered.length + (answered.length === 1 ? " day" : " days"),
      age: days.length - 1 - lastIdx,
      typ: clampTyp(kept),
      maj: false,
    });
  }
  if (!nodes.length) return EMPTY;
  return { cats: [{ id: "pulse", label: "Pulse", hue: 282, pulse: true }], nodes };
}

// ── Foresight (g-fore): what you call, and who you read ──
//
// Two clouds of AIMS rather than answers (the v28 wording): a read leaf's
// distance from You is your accuracy on that cut of the population — the
// map says where you see clearly without printing a score — and a call
// leaf is one future you put your name on, sealed until its outcome
// publishes. Folds entirely from state other surfaces already loaded
// (foresightLog, callQs, callOutcomes, your own votes): this module
// fetches nothing, so an unloaded log simply means no leaves yet.
export function foreTree(): MapTree {
  if (!LIVE.enabled) return EMPTY; // the demo has no honest log to draw
  const cats: MapTreeCat[] = [];
  const nodes: MapTreeNode[] = [];

  const logMap = LIVE.foresightLog();
  const verdicts = logMap ? Object.values(logMap) : [];
  if (verdicts.length) {
    for (const d of byDim(verdicts)) {
      nodes.push({
        id: "fore-read-" + d.dim, parentId: "fore-reads", fore: true, daily: true,
        label: DIM_LABEL[d.dim] || d.dim, tag: "Read", prompt: "Reading by " + (DIM_LABEL[d.dim] || d.dim),
        ans: d.hits + "/" + d.played,
        // ≥50% is against the game's own coin, not against other players —
        // "better than most" would be a population claim nothing measures
        note: d.played < 5 ? "early days" : d.pct >= 50 ? "reading clearly" : "blind spot",
        age: 0,
        typ: clampTyp(d.hits / d.played),
        maj: d.pct >= 50,
      });
    }
    if (nodes.length) cats.push({ id: "fore-reads", label: "Reads", hue: 300, fore: true });
  }

  const votes = LIVE.myVotes();
  const outcomes = LIVE.callOutcomes();
  const calls: MapTreeNode[] = [];
  for (const q of LIVE.callQs()) {
    const optId = votes[q.id];
    if (optId == null) continue; // a call you never made is not an aim
    const myIdx = Number(optId);
    const oc = outcomes ? outcomes[q.id] : undefined;
    const graded = oc != null && oc.outcomeIdx >= 0;
    const right = graded && oc.outcomeIdx === myIdx;
    calls.push({
      id: "fore-call-" + q.id, parentId: "fore-calls", fore: true, daily: true,
      qid: q.id,
      label: q.prompt, tag: "Call", prompt: q.prompt,
      ans: q.options?.[myIdx] ?? "",
      note: graded ? (right ? "called it" : "missed") : "sealed — outcome pending",
      age: 0,
      typ: graded ? (right ? 0.9 : 0.1) : 0.5,
      maj: right,
    });
  }
  if (calls.length) {
    cats.push({ id: "fore-calls", label: "Calls", hue: 265, fore: true });
    nodes.push(...calls);
  }

  return cats.length ? { cats, nodes } : EMPTY;
}
