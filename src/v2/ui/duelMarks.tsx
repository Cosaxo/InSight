// duelMarks — the two shapes the daily's social surfaces draw people and
// circles as (D156), over the derivations in ./marks.
//
// A round initial avatar for a PERSON, a rounded-square initial mark for a
// CIRCLE, and a black "you" pill. Every row in the prototype's group and
// 1v1 bodies leans on them — the rail, the reveal bars, the member list,
// the guess step — and the live panel had none of it, which is the largest
// single reason those screens did not look like the sample.
//
// Components only: the hash, the initials and the first-name helper live in
// ./marks, because react-refresh will not hot-reload a file that mixes the
// two — and a stale copy of the hash is a circle that changes colour.
//
// No React import: the automatic JSX runtime supplies it, and these are
// three spans with no hooks between them.
import { groupInitials, markHue, personInitials } from "./marks";

// ── a person ─────────────────────────────────────────────────────

//
// Round, because the circle mark below is square: at rail size the SHAPE is
// what tells you whether you are looking at a person or a group, before the
// colour or the letters resolve.
// No dim/faded state on either mark since v28 §7.1: a half-washed disc read
// as broken, so the done/waiting cue is the rail's pending dot — shape, not
// saturation — the same rule the demo rails follow in group-daily.jsx and
// duo-daily.jsx.
export function DuelAv({ uid, name, size = 22, title }: {
  uid: string; name?: string; size?: number; title?: string;
}) {
  const init = personInitials(name || "");
  return (
    <span title={title || name || "Someone"} aria-hidden="true" style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--sans)", fontWeight: 800, fontSize: Math.round(size * 0.4),
      color: "#fff", background: `oklch(0.52 0.13 ${markHue(uid)})`,
      boxShadow: "0 0 0 1.5px var(--surface-2)",
      // An account with no display name gets a dot rather than a letter —
      // inventing an initial from the uid would be a name we made up.
      letterSpacing: init ? "normal" : "0",
    }}>{init || "·"}</span>
  );
}

// ── a circle ─────────────────────────────────────────────────────
export function GroupMark({ gid, name, size = 34 }: {
  gid: string; name?: string; size?: number;
}) {
  return (
    <span aria-hidden="true" style={{
      width: size, height: size, borderRadius: Math.round(size * 0.32), flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--sans)", fontWeight: 800, fontSize: Math.round(size * 0.38),
      letterSpacing: "-0.02em",
      color: "#fff", background: `oklch(0.52 0.12 ${markHue(gid)})`,
    }}>{groupInitials(name || "")}</span>
  );
}

// ── you ──────────────────────────────────────────────────────────
//
// A pill, not a circle. You are the one person on these screens who never
// needs identifying by colour, and the word costs less to read than a
// letter you have to decode.
export function YouChip({ size = 22 }: { size?: number }) {
  return (
    <span style={{
      height: size, padding: "0 8px", borderRadius: 999, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--sans)", fontWeight: 800, fontSize: Math.max(9.5, Math.round(size * 0.36)),
      color: "var(--surface)", background: "var(--ink)", boxShadow: "0 0 0 1.5px var(--surface-2)",
    }}>you</span>
  );
}
