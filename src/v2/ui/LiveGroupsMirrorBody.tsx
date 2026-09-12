// LiveGroupsMirrorBody — the Mirror's Groups stop, computed from REAL
// reveal history: the room drawn as a cast (D437, the owner's 2026-09-09
// design, `design/standalone-2026-09-09/group-mirror.jsx`).
//
// What a group is, since D434, is three role votes in four and a rating
// every fourth, nothing predicted and nothing called — so what this stop
// reads is who the room has named, and how it rates itself:
//
//   · the head — the identity ring is roles cast over all the roles in
//     the packs; the seat line *Here, you are the one who gets things
//     going · 5 of 15 votes say so* once two votes have named you;
//   · the field — the role map (`LgRoleMap`, lazy): everyone on a ring,
//     each held role a satellite in its pack's colour, a shared one on a
//     dashed thread between two;
//   · the row — Votes (who the room named, by pack, a row opening who
//     voted for whom) · People (the constellation, whoever casts the room
//     like you, everyone's seat) · Scores (how the group rates itself,
//     one pole row per rating) · Compare (your profile against the
//     members' mean, and *how they see you*: the roles you hold, and the
//     one place the sentence *the room named you N of M votes* appears).
//
// Every number comes off `v2_groups/{gid}/reveals/r{n}` documents this
// user can already read — one ordered query per room per session, the
// same cache the duel panel fills — folded by `data/groupCast.ts`,
// `data/groupPortrait.ts` and `data/roles.ts`, all pure and all pinned.
// Zero reads of its own beyond the open room's history.
//
// What left with the majority (D437): the alignment ring and *aligned with
// you · N of M days*, the Answers rows of what the group "landed on", the
// cross-group *runs most like you* line (D287's groups half) and its
// fan-out over every room's history. A room's votes are about its people,
// not about a side, so there is no side to have been on.
//
// Duos are excluded on purpose: a 1v1 has its own Mirror in the reveal
// itself, and a room of two names nobody the other did not.
//
// Born in this repo (not ported from the design prototype), so it lives
// as typed TSX.
import React from "react";
import LIVE from "../data/live";
// The rings-and-you drawing every other stop shows when it is empty (D172).
// A tiny standalone module, NOT LiveSimilarityField: this file is a static
// import in mirror-tab, and that one is the whole similarity engine.
import EmptyField from "./EmptyField";
// The stop's tab row (D190) — static like every other host's, because it IS
// the stop's navigation and a suspense gap where the tabs belong is a stop
// that looks broken.
import MirrorLensTabs from "./MirrorLensTabs";
import { useLensRowScroll } from "./lensRowScroll";
import type { LensTab } from "./lensTabs";
import { groupPortrait, MIN_SHARED, type PortraitReveal } from "../data/groupPortrait";
import { groupScores, namedCount, roleVotes, type GroupScore, type RoleVotes, type RoleVoteRow } from "../data/groupCast";
import { groupRole, isRatingReveal, seatFor, MIN_GROUP, type BankEntryLike, type BankLookup } from "../data/roles";
import type { FieldMember } from "../data/roleField";
import { DuelAv, YouChip } from "./duelMarks";
import { firstName } from "./marks";

// The stop's constellation (D152) — shared with Circle and the cohort
// stops, so a group's cast is arranged by the same rule as every other
// population in the Mirror. Lazy: it is an SVG canvas, and the portrait's
// numbers must not wait on it.
const LgField = React.lazy(() =>
  import("./LiveSimilarityField").then((m) => ({ default: m.PeopleField })),
);
// The role map (D437) — the field this stop stands on. Lazy for the same
// reason: a canvas with its own animation and two cards, and this file is
// a static import of the Mirror chunk.
const LgRoleMap = React.lazy(() => import("./LgRoleMap"));
// Compare, borrowed rather than rebuilt (D190, re-pointed at D193) — the
// same reuse Near makes (LiveRoomTabs) and for the same reason: the lens
// asks for a population and a noun, so a group reads the way a city does.
//
// LAZY IS NOT OPTIONAL HERE. This file is a STATIC import in mirror-tab, so
// a static import of the lens would put its four SVG canvases in the entry
// graph — where check:bundle leaves about a dozen kilobytes.
const GroupCompare = React.lazy(() => import("./LiveCompareLens"));

const LG_LINE = "0.5px solid var(--rule)";

/**
 * The stop's four, in the design's order: the first three describe the
 * room — who it named, who is in it, how it rates itself — and Compare
 * is the one that puts you against it, which is where a row that runs
 * from "them" to "you and them" wants to end (D184's argument, ported).
 * Overview is not a tab: the seat line and the role map draw above the
 * row always, as the field does on every other stop (D136).
 */
const GROUP_TABS: LensTab[] = [
  { id: "votes", label: "Votes" },
  { id: "people", label: "People" },
  { id: "scores", label: "Scores" },
  { id: "compare", label: "Compare" },
];

interface LiveGroup {
  id: string;
  name?: string;
  mode?: string;
  memberUids?: string[];
  memberNames?: Record<string, string>;
  /** The server's role ledger (D445) — `ledger.{uid}` on the group
   * document, which the store hands over whole: the seats read it once
   * a member's row clears the floor, and the reveals until then. */
  ledger?: unknown;
}

const packInk = (hue: number | null | undefined) => `oklch(0.605 0.118 ${hue ?? 250})`;

// The head's ring — roles cast over all the roles in the packs — around
// the member cluster.
function LgIdentity({ g, pct }: { g: LiveGroup; pct: number }) {
  const [v, setV] = React.useState(0);
  React.useEffect(() => { setV(0); const t = setTimeout(() => setV(pct), 80); return () => clearTimeout(t); }, [pct, g.id]);
  const S = 64, R = 28.5, C = 2 * Math.PI * R;
  const names = g.memberNames || {};
  const shown = (g.memberUids || []).slice(0, 3);
  return (
    <span style={{ position: "relative", width: S, height: S, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ position: "absolute", inset: 0 }} aria-hidden="true">
        <circle cx={S / 2} cy={S / 2} r={R} fill="none" stroke="var(--surface-3)" strokeWidth="3.5"></circle>
        <circle cx={S / 2} cy={S / 2} r={R} fill="none" stroke="var(--accent)" strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray={`${Math.max(0.01, (v / 100) * C)} ${C}`} transform={`rotate(-90 ${S / 2} ${S / 2})`}
          style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.2,0.8,0.2,1)" }}></circle>
      </svg>
      <span style={{ display: "inline-flex", alignItems: "center" }}>
        {shown.map((u, i) => (
          <span key={u} style={{ marginLeft: i ? -7 : 0, display: "inline-flex", zIndex: shown.length - i, position: "relative" }}>
            <DuelAv uid={u} name={names[u]} size={20} />
          </span>
        ))}
      </span>
    </span>
  );
}

function LgKicker({ children }: { children: React.ReactNode }) {
  return <div className="kicker" style={{ marginBottom: 0 }}>{children}</div>;
}

/** A tab with nothing in it yet — one sentence, where the card would be. */
function LgEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.55, padding: "10px 2px" }}>
      {children}
    </div>
  );
}

const small: React.CSSProperties = { fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)", letterSpacing: "0.09em", textTransform: "uppercase" };
// The row reset every expandable row here wears: a real <button>, because a
// row that opens and closes is a control, and a control that only answers
// to a mouse is one a keyboard user cannot reach at all.
const rowBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 48, padding: "7px 0",
  border: "none", background: "none", color: "inherit", font: "inherit", cursor: "pointer", textAlign: "left", WebkitAppearance: "none",
};
function Chevron({ open }: { open: boolean }) {
  return (
    <span aria-hidden="true" style={{ width: 7, height: 7, flexShrink: 0, marginLeft: 2, borderRight: "1.5px solid var(--ink-3)", borderBottom: "1.5px solid var(--ink-3)",
      transform: open ? "translateY(2px) rotate(-135deg)" : "translateY(-2px) rotate(45deg)", transition: "transform 0.22s var(--ease-out)" }} />
  );
}

/** A member's face — the You pill for the viewer, the initial disc for anyone else. */
function Face({ uid, names, size }: { uid: string; names: Record<string, string>; size: number }) {
  return uid === LIVE.uid ? <YouChip size={size} /> : <DuelAv uid={uid} name={names[uid]} size={size} />;
}
const nameOf = (uid: string, names: Record<string, string>): string =>
  uid === LIVE.uid ? "You" : firstName(names[uid] || "") || names[uid] || "Someone";

// ── Votes: who the room named, by pack ──────────────────────────
// ONE copy of the refused-read sentence, for the three cards that draw
// it. All three empty on the same fetch, so a room whose history could
// not be read must not tell one tab it is empty and another that the
// read failed.
const UNREAD_LINE = "Couldn’t read this room’s rounds. Close and reopen to try again.";

function LgVotesCard({ rv, names, reading, unread }: { rv: RoleVotes; names: Record<string, string>; reading: boolean; unread: boolean }) {
  const [open, setOpen] = React.useState<string | null>(null);
  // By pack, latest first inside each; a role vote with no pack (an
  // untagged role, if one ever ships) gathers under its own heading.
  const packs = rv.packs.map((pack) => ({ pack, roles: rv.roles.filter((r) => r.pack && r.pack.id === pack.id) }));
  const loose = rv.roles.filter((r) => !r.pack);
  if (loose.length) packs.push({ pack: { id: "", label: "Roles", hue: 250 }, roles: loose });
  if (!rv.roles.length) {
    // "The first role is on the table" invites the reader to start a room
    // that may have played for weeks; the refused read has to say so
    // rather than borrow the empty room's sentence.
    return reading
      ? <LgEmpty>Reading the rounds…</LgEmpty>
      : unread
        ? <LgEmpty>{UNREAD_LINE}</LgEmpty>
        : <LgEmpty>No votes revealed yet — the first role is on the table.</LgEmpty>;
  }
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <LgKicker>Who the room named</LgKicker>
        <span style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 700, color: "var(--ink-3)" }}>{rv.roles.length} {rv.roles.length === 1 ? "vote" : "votes"}</span>
      </div>
      {packs.map(({ pack, roles }) => {
        const ink = packInk(pack.hue);
        return (
          <div key={pack.id || "loose"} style={{ marginTop: 14 }}>
            <div style={{ ...small, color: ink }}>{pack.label}</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {roles.map((role) => <LgVoteRow key={role.key} role={role} ink={ink} names={names} open={open === role.key} onToggle={() => setOpen(open === role.key ? null : role.key)} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
function LgVoteRow({ role, ink, names, open, onToggle }: { role: RoleVoteRow; ink: string; names: Record<string, string>; open: boolean; onToggle: () => void }) {
  const lead = role.holders[0] || null;
  const with_ = role.contested ? role.second : role.holders[1] || null;
  const title = lead ? nameOf(lead, names) + (with_ ? ` & ${nameOf(with_, names)}` : "") : "Nobody yet";
  const named = Object.entries(role.votes).sort((a, b) => b[1] - a[1]);
  return (
    <div style={{ borderBottom: LG_LINE }}>
      <button type="button" className="press" onClick={onToggle} aria-expanded={open} style={rowBtn}>
        <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          {lead && <Face uid={lead} names={names} size={26} />}
          {with_ && <span style={{ marginLeft: -7, display: "inline-flex", boxShadow: "0 0 0 2px var(--surface-2)", borderRadius: 999 }}><Face uid={with_} names={names} size={26} /></span>}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: "var(--sans)", fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
          <span style={{ display: "block", marginTop: 1, fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 500, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {role.label}{role.contested ? " · contested" : role.holders.length > 1 ? " · shared" : ""}
          </span>
        </span>
        <span aria-hidden="true" style={{ display: "flex", gap: 3, flexShrink: 0 }}>
          {Array.from({ length: lead ? role.votes[lead] || 0 : 0 }, (_, i) => <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: ink }} />)}
        </span>
        <Chevron open={open} />
      </button>
      {open && (
        <div className="fade-in" style={{ padding: "2px 0 12px", display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, color: "var(--ink-3)" }}>{role.prompt}{role.round ? ` · round ${role.round}` : ""}</div>
          {named.map(([uid, n]) => (
            <div key={uid} style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <Face uid={uid} names={names} size={22} />
              <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--sans)", fontSize: 13, fontWeight: role.holders.includes(uid) ? 800 : 600, color: "var(--ink)" }}>{nameOf(uid, names)}</span>
              <span style={small}>by</span>
              <span style={{ display: "flex", alignItems: "center", gap: 3 }} aria-label={`${n} ${n === 1 ? "vote" : "votes"}`}>
                {(role.by[uid] || []).map((voter) => <Face key={voter} uid={voter} names={names} size={20} />)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── People: the constellation, the twin, everyone's seat ─────────
function LgPeopleCard({ g, reveals, lookup, reading, unread }: { g: LiveGroup; reveals: PortraitReveal[]; lookup: BankLookup; reading: boolean; unread: boolean }) {
  const names = g.memberNames || {};
  // Named the same person on the same role vote: the portrait's pairwise
  // fold, over role votes only — a rating is the group about itself and
  // agreeing on a step is not casting the room alike.
  const P = groupPortrait(reveals.filter((r) => !isRatingReveal(r, lookup)), LIVE.uid);
  const others = (g.memberUids || []).filter((u) => u !== LIVE.uid);
  const twinName = P.twin ? nameOf(P.twin.uid, names) : null;
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <LgKicker>Who's who</LgKicker>
        <span style={small}>closer = names the same people</span>
      </div>
      {/* The cast, arranged (D152) — the Mirror's one grammar. Only
          members with a shared round are placed: a radius for someone you
          have never voted beside would be a position invented out of
          nothing, and the seats below carry everyone regardless. */}
      {/* READING IS NOT NOTHING. `revealHistory()` is empty for a history
          still arriving as much as for a room that has never played, and
          this stop opens on that fetch — so the still-reading arm is said
          HERE, synchronously, not as the lazy field's empty line, which
          would arrive a chunk later than the sentence it corrects. */}
      {(reading || unread) && !P.people.length ? (
        <LgEmpty>{reading ? "Reading the rounds…" : UNREAD_LINE}</LgEmpty>
      ) : (
        <React.Suspense fallback={null}>
          <LgField
            people={P.people.filter((p) => p.shared > 0).map((p) => ({ id: p.uid, label: names[p.uid] || "", match: p.pct }))}
            caption="closer to you = casts the room like you"
            emptyLine={others.length ? <>Places are taken from the first reveal.</> : <>Add someone from the daily tab and they appear here.</>}
          />
        </React.Suspense>
      )}
      {/* Named to their face, so only over MIN_SHARED shared rounds — one
          agreement is a coin landing once (groupPortrait's own floor). */}
      {P.twin && twinName && (
        <div style={{ marginTop: 4, textAlign: "center", fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", textWrap: "balance" }}>
          <b style={{ fontWeight: 800, color: "var(--ink)" }}>{twinName}</b> casts the room like you · same pick on {P.twin.agree} of {P.twin.shared} rounds
        </div>
      )}
      {others.length > 0 && (
        <div style={{ marginTop: 13, paddingTop: 13, borderTop: LG_LINE, display: "flex", flexDirection: "column", gap: 9 }}>
          {others.map((uid) => {
            const s = seatFor(reveals, uid, lookup, g.ledger);
            const named = s ? s.shares[s.seat.id] : 0;
            return (
              <div key={uid} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <DuelAv uid={uid} name={names[uid]} size={22} />
                <span style={{ fontFamily: "var(--sans)", fontSize: 13, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>{nameOf(uid, names)}</span>
                <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: s ? 700 : 500, color: s ? "var(--accent)" : "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s ? s.seat.line : "not named yet"}
                </span>
                {s && (
                  <span style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 600, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {named} of {s.n} votes
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {P.people.some((p) => p.shared > 0 && p.shared < MIN_SHARED) && (
        <div style={{ marginTop: 11, paddingTop: 10, borderTop: LG_LINE, ...small, letterSpacing: "0.02em", textTransform: "none" }}>
          A place from under {MIN_SHARED} shared rounds is a first reading.
        </div>
      )}
    </div>
  );
}

// ── Scores: how the group rates itself ──────────────────────────
function LgScoresCard({ scores, total, names, reading, unread }: { scores: GroupScore[]; total: number; names: Record<string, string>; reading: boolean; unread: boolean }) {
  const [open, setOpen] = React.useState<string | null>(null);
  // Strongest lean first: a room that is 90 on Chaos says more than one
  // that is 52 on anything.
  const rows = [...scores].sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50));
  const pos = (step: number) => 6 + (step / 4) * 88;
  const word = (lean: boolean): React.CSSProperties => ({
    fontFamily: "var(--sans)", fontSize: 11.5, letterSpacing: "0.01em", width: 72, flexShrink: 0,
    fontWeight: lean ? 700 : 500, color: lean ? "var(--accent)" : "var(--ink-3)", textWrap: "balance",
  });
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <LgKicker>How the group rates itself</LgKicker>
        {/* THE HEADER IS A CLAIM TOO. It sat outside both guards, so a room
            whose rounds could not be read printed "0 of 4 rated" — a
            numerator that means "we could not ask" over a denominator off
            the device's own bank — directly above the sentence saying the
            read failed. The comment further down this file records fixing
            this exact class for the card BODIES and not for the counts
            above them. */}
        <span style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 700, color: "var(--ink-3)" }}>
          {reading || unread ? `${total} to rate` : `${scores.length} of ${total} rated`}
        </span>
      </div>
      {!rows.length && (
        <div style={{ marginTop: 10, fontFamily: "var(--sans)", fontSize: 13, color: "var(--ink-3)", textWrap: "pretty" }}>
          {reading ? "Reading the rounds…"
            : unread ? UNREAD_LINE
              : "No ratings yet — every fourth round asks the group about itself."}
        </div>
      )}
      {rows.length > 0 && (
        <div style={{ position: "relative", marginTop: 14, display: "flex", flexDirection: "column", gap: 4 }}>
          {rows.map((s) => {
            const on = open === s.qid;
            const hi = s.score >= 58, lo = s.score <= 42;
            const seen: Record<number, number> = {};
            const nHi = s.counts[3] + s.counts[4], nLo = s.counts[0] + s.counts[1], nMid = s.counts[2];
            const who = (n: number) => `${n} of ${s.total}`;
            return (
              <div key={s.qid}>
                <button type="button" className="press" aria-expanded={on} onClick={() => setOpen(on ? null : s.qid)}
                  aria-label={`${s.poles[0]} to ${s.poles[1]} · the group · ${s.score}`}
                  style={{ ...rowBtn, minHeight: 44, padding: "2px 0" }}>
                  <span style={{ ...word(lo), textAlign: "right" }}>{s.poles[0]}</span>
                  <span style={{ position: "relative", flex: 1, height: 26 }} aria-hidden="true">
                    <span style={{ position: "absolute", left: "6%", right: "6%", top: "50%", height: 1, background: "var(--rule)" }} />
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span key={i} style={{ position: "absolute", left: pos(i) + "%", top: "50%", transform: "translate(-50%, -50%)", width: 5, height: 5, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--ink-3)", boxSizing: "border-box" }} />
                    ))}
                    {s.marks.map((m) => {
                      const k = (seen[m.step] = (seen[m.step] || 0) + 1);
                      return <span key={m.uid} title={names[m.uid] || ""} style={{ position: "absolute", left: pos(m.step) + "%", top: "50%", transform: `translate(${-50 + (k - 1) * 45}%, -50%)`, width: 9, height: 9, borderRadius: "50%", background: "color-mix(in oklch, var(--accent) 45%, var(--surface))" }} />;
                    })}
                    <span title={`the group · ${s.score}`} style={{ position: "absolute", left: pos(s.mean) + "%", top: "50%", transform: "translate(-50%, -50%)", width: 15, height: 15, borderRadius: "50%", background: "var(--accent)", border: "2px solid var(--surface)", boxSizing: "border-box", boxShadow: "0 0 0 1px var(--accent)" }} />
                    {s.mine != null && (
                      <span title="you" style={{ position: "absolute", left: pos(s.mine) + "%", top: "50%", transform: "translate(-50%, -50%)", width: 9, height: 9, borderRadius: "50%", background: "var(--ink)", boxSizing: "border-box", boxShadow: "0 0 0 1.5px var(--surface)" }} />
                    )}
                  </span>
                  <span style={word(hi)}>{s.poles[1]}</span>
                </button>
                {on && (
                  <div className="fade-in" style={{ margin: "0 0 8px", padding: "9px 12px", borderRadius: 12, background: "var(--surface-2)", border: LG_LINE }}>
                    <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 500, color: "var(--ink-2)", textWrap: "pretty" }}>{s.prompt}</div>
                    <div style={{ marginTop: 5, fontFamily: "var(--sans)", fontSize: 14, fontWeight: 800, letterSpacing: "-0.01em", color: "var(--ink)" }}>
                      {s.label} <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)" }}>· {s.score}{s.round ? ` · round ${s.round}` : ""}</span>
                    </div>
                    <div style={{ marginTop: 4, fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", textWrap: "pretty" }}>
                      {[nHi ? `${who(nHi)} lean ${s.poles[1]}` : null, nLo ? `${who(nLo)} lean ${s.poles[0]}` : null, nMid ? `${who(nMid)} in between` : null].filter(Boolean).join(" · ")}
                      {s.mine != null ? ` · you said ${s.steps[s.mine] || `step ${s.mine + 1}`}` : ""}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {rows.length > 0 && (
        <div className="legend" style={{ justifyContent: "center", gap: 14, marginTop: 10, paddingTop: 11, borderTop: LG_LINE }}>
          <span style={{ "--lgc": "var(--accent)" } as React.CSSProperties}><span className="lg-dot" />the group</span>
          <span style={{ "--lgc": "var(--ink)" } as React.CSSProperties}><span className="lg-dot" />you</span>
          <span style={{ "--lgc": "color-mix(in oklch, var(--accent) 45%, var(--surface))" } as React.CSSProperties}><span className="lg-dot" />members</span>
        </div>
      )}
    </div>
  );
}

// ── Compare's second card: how they see you ─────────────────────
function LgSeenCard({ rv, reveals, lookup, reading, unread }: { rv: RoleVotes; reveals: PortraitReveal[]; lookup: BankLookup; reading: boolean; unread: boolean }) {
  const uid = LIVE.uid;
  const held = rv.roles.filter((r) => uid != null && (r.holders.includes(uid) || r.second === uid));
  const n = namedCount(reveals, uid, lookup);
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <LgKicker>How they see you</LgKicker>
      {held.length ? (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
            {held.map((r) => {
              const hollow = r.contested || r.holders.length > 1;
              const ink = packInk(r.pack ? r.pack.hue : null);
              return (
                <span key={r.key} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--sans)", fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--ink-2)", padding: "5px 13px", borderRadius: 999, background: "var(--surface-2)", border: LG_LINE }}>
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: hollow ? "var(--surface)" : ink, border: hollow ? `1.6px solid ${ink}` : "none", boxSizing: "border-box" }} />
                  {r.label}
                </span>
              );
            })}
          </div>
          {held.some((r) => r.contested || r.holders.length > 1) && (
            <div className="legend" style={{ marginTop: 9 }}>
              <span style={{ "--lgc": "var(--ink-3)" } as React.CSSProperties}><span className="lg-dot" data-hollow="" />hollow = shared or contested</span>
            </div>
          )}
        </>
      ) : (
        <div style={{ marginTop: 10, fontFamily: "var(--sans)", fontSize: 13, color: "var(--ink-3)" }}>
          {/* THE THIRD STATE, which this card was the one lens card not
              given. `rv.roles` is empty both when nobody has been cast and
              when the room's rounds could not be read, and it said the
              first about the second — under a header naming the room, on
              the stop whose own kicker two hundred lines up already says
              "couldn't read the rounds". The bar below hides itself
              correctly in the same state, which is what made this look
              like an oversight rather than a choice. */}
          {reading ? "Reading the rounds…"
            : unread ? UNREAD_LINE
              : "No roles yet — the next vote could change that."}
        </div>
      )}
      {n.all > 0 && (
        <div style={{ marginTop: 15, paddingTop: 13, borderTop: LG_LINE }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
            <span style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--ink-3)" }}>the room named you</span>
            <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 800, color: "var(--ink-2)" }}>{n.mine} of {n.all} votes</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "var(--surface-3)", overflow: "hidden" }} aria-hidden="true">
            <div style={{ width: `${Math.round((n.mine / n.all) * 100)}%`, height: "100%", borderRadius: 999, background: "var(--accent)", opacity: 0.75 }} />
          </div>
        </div>
      )}
    </div>
  );
}

// Stable empties for the memo above the early return: a fresh `[]` or `{}`
// per render would be a new dependency every time.
const NO_REVEALS: PortraitReveal[] = [];
const NO_NAMES: Record<string, string> = {};
const NO_UIDS: readonly string[] = [];

/** The stop's folds over one room's history, once per history: the room's
 *  votes, scores, your seat and the members the role map places. A hook of
 *  its own so the memo's inputs are the primitives and store references
 *  passed in, and nothing after it in the component can be read as
 *  modifying them. */
function useGroupFolds(
  gid: string | null,
  memberUids: readonly string[],
  names: Record<string, string>,
  reveals: PortraitReveal[],
  lookup: BankLookup,
  me: string | null,
  ledger: unknown,
) {
  return React.useMemo(() => {
    const rv = roleVotes(reveals, lookup, me);
    const scores = groupScores(reveals, lookup, me);
    // The seats read the server's ledger once a row clears the floor
    // (D445) and the reveals until then; the Votes lens above stays over
    // the reveals — who holds a role is the card's rule, per round.
    const mine = gid ? groupRole(reveals, me, lookup, ledger) : null;
    const members: FieldMember[] = gid ? memberUids.map((uid) => ({
      id: uid, name: uid === me ? "You" : names[uid] || "", me: uid === me,
      seatLine: (uid === me ? mine && { seat: mine.seat } : seatFor(reveals, uid, lookup, ledger))?.seat.line ?? null,
    })) : [];
    return { rv, scores, mine, members };
  }, [gid, memberUids, names, reveals, lookup, me, ledger]);
}

function LiveGroupsMirrorBody() {
  const [, tick] = React.useState(0);
  React.useEffect(() => LIVE.subscribe(() => tick((t) => t + 1)), []);
  const S = LIVE.social;
  const groups = (LIVE.enabled ? S.groups("group") : []) as LiveGroup[];
  const [gid, setGid] = React.useState<string | null>(null);
  const g = groups.find((x) => x.id === gid) || groups[0] || null;
  // the history fetch is on-demand and idempotent — one ordered query of
  // ≤REVEAL_HIST_CAP documents per group per session, only once this
  // stop is actually open, and only for the room you are looking at
  React.useEffect(() => {
    if (g) void S.loadRevealHistory(g.id);
  }, [g && g.id]); // eslint-disable-line react-hooks/exhaustive-deps -- S is a module-level singleton
  // Closed, like every other stop (D155/D190).
  const [tab, setTab] = React.useState("");
  const rowRef = React.useRef<HTMLDivElement | null>(null);
  useLensRowScroll(tab, rowRef);

  // The folds, ONCE per history: `revealHistory` hands back the same array
  // while nothing changed, so the room's votes, scores, seats and the
  // role map's layout (memoized on `rv`/`members` in LgRoleMap) are not
  // re-folded on every store notify — the second review of #456 found the
  // map's memo never hit because these were rebuilt each render.
  const lookup = React.useCallback<BankLookup>((qid) => S.bankQ(qid) as BankEntryLike | null, [S]);
  const me = LIVE.uid;
  const reveals = g ? (S.revealHistory(g.id) as unknown as PortraitReveal[]) : NO_REVEALS;
  const names: Record<string, string> = (g && g.memberNames) || NO_NAMES;
  const memberUids: readonly string[] = (g && g.memberUids) || NO_UIDS;
  const { rv, scores, mine, members } = useGroupFolds(g ? g.id : null, memberUids, names, reveals, lookup, me, g ? g.ledger : null);

  if (!LIVE.enabled) return null;

  // The read's three states, not two. This stop `void`s its own
  // `loadRevealHistory` — the answer it throws away is the one the roles
  // panel keeps — so a refused read used to arrive here as an empty
  // history with no flag set, and both sentences below stated it as a
  // fact about the room: "no rounds revealed yet" under the room's own
  // name, and "the first role is on the table" in the votes card.
  const hist$ = g ? S.revealHistState(g.id) : "ready";
  const reading = hist$ === "loading";
  const unread = hist$ === "failed";
  const bank = S.groupBankCounts();
  // Roles cast over all the roles in the packs. A role since retired from
  // the bank still counts as cast — it was — so the share is capped.
  const castPct = bank.roles ? Math.min(100, Math.round((rv.roles.length / bank.roles) * 100)) : 0;
  const nCast = rv.roles.length, nScores = scores.length;

  return (
    <div className="mf-stage" data-screen-label="Mirror — groups (live)" style={{
      // The frame every other live Mirror stop wears since D188: 16px of
      // inset, and NO bottom padding, so `marginTop: auto` on the row puts
      // it against the bottom of the content box and `.app-body`'s own
      // padding is the whole gap to the app's tab bar. `.mf-stage` supplies
      // the filling column.
      padding: "4px 16px 0",
    }}>
      {g ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "6px 2px 0" }}>
            <LgIdentity key={g.id} g={g} pct={castPct} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "var(--sans)", fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.name}</div>
              <div style={{ marginTop: 2, fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, color: "var(--ink-3)" }}>
                {nCast || nScores
                  ? `${nCast} role${nCast === 1 ? "" : "s"} cast · ${nScores} score${nScores === 1 ? "" : "s"}`
                  : reading ? "reading the rounds…"
                    : unread ? "couldn’t read the rounds"
                      : "no rounds revealed yet"}
              </div>
            </div>
          </div>
          {groups.length > 1 && (
            <div className="h-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "10px 2px 2px" }}>
              {groups.map((x) => {
                const on = x.id === g.id;
                return (
                  <button key={x.id} className="press" onClick={() => setGid(x.id)} aria-pressed={on} style={{
                    display: "flex", alignItems: "center", gap: 8, flexShrink: 0, cursor: "pointer",
                    padding: "6px 13px", borderRadius: 999, WebkitAppearance: "none",
                    background: on ? "color-mix(in oklch, var(--accent) 10%, var(--surface-2))" : "var(--surface-2)",
                    border: on ? "1.5px solid color-mix(in oklch, var(--accent) 55%, transparent)" : LG_LINE,
                    boxShadow: "var(--shadow-card)",
                    fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: on ? 800 : 600,
                    color: on ? "var(--ink)" : "var(--ink-2)", whiteSpace: "nowrap" }}>{x.name}</button>
                );
              })}
            </div>
          )}
          {/* The seat line — said only once two votes have named you
              (MIN_GROUP), because a seat off one vote is a coin with a
              title on it. In play a seat is its LINE, never its label. */}
          {mine && mine.n >= MIN_GROUP && (
            <div style={{ margin: "12px 2px 0", display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--sans)", fontSize: 15, fontWeight: 800, letterSpacing: "-0.015em", color: "var(--ink)" }}>
                Here, you are <span style={{ color: "var(--accent)" }}>{mine.seat.line}</span>
              </span>
              <span style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, color: "var(--ink-3)" }}>
                {mine.shares[mine.seat.id]} of {mine.n} votes say so
              </span>
            </div>
          )}
          {/* The field: the room as a cast. Drawn with no reveals too —
              everyone on the ring and no satellites is the true picture of
              a room that has not revealed, and a picture beats a card
              saying so (D172). */}
          <React.Suspense fallback={<div className="mf-canvaswrap" aria-hidden="true" />}>
            <LgRoleMap key={g.id} gid={g.id} gname={g.name || "This group"} rv={rv} members={members} />
          </React.Suspense>
        </>
      ) : (
        // The FIELD, not a card of prose (D172). This and Circle were the
        // last two stops answering an empty account with a paragraph while
        // every other one drew its rings — and they are the two a new
        // account meets first.
        //
        // The BUTTON stays. Creating a group is not something the stop can
        // fill by itself the way City fills as strangers answer, so this is
        // the only route to it and removing it would trade wordiness for a
        // dead end. The nav key pins the GROUP scope: goTab("track") would
        // restore whatever daily scope was last open, and a user arriving
        // from the 1v1 tab landed back on 1v1 — a button that promises a
        // group and delivers a duel.
        <EmptyField action={{ label: "Start a group →", nav: "track:group" }}>
          Everyone answers, then it opens with names.
        </EmptyField>
      )}

      {/* The row, where every other stop's row is (D190) — including with
          no group at all, which is the state a new account meets. A stop
          whose tab bar appears only once it has data reads as a stop that
          was never finished. */}
      <div ref={rowRef} style={{ marginTop: "auto", paddingTop: 16 }}>
        <MirrorLensTabs tabs={GROUP_TABS} open={tab}
          onOpen={(id) => setTab(id === tab ? "" : id)} />
      </div>

      {!!tab && (
        <div className="fade-in" role="tabpanel" style={{ paddingTop: 14 }}
          aria-label={(GROUP_TABS.find((t) => t.id === tab) || { label: "" }).label}>
          {!g ? (
            <LgEmpty>Start a group and this fills in from the first reveal.</LgEmpty>
          ) : tab === "votes" ? (
            <LgVotesCard rv={rv} names={names} reading={reading} unread={unread} />
          ) : tab === "people" ? (
            <LgPeopleCard g={g} reveals={reveals} lookup={lookup} reading={reading} unread={unread} />
          ) : tab === "scores" ? (
            <LgScoresCard scores={scores} total={bank.ratings} names={names} reading={reading} unread={unread} />
          ) : (
            <React.Suspense fallback={null}>
              {/* The group's own name is the noun — the lens prints it in
                  "You ↔ Book Club".

                  PEOPLE, not counts, and it is the one population that
                  has no choice (D193). A group's history is its reveals,
                  which are the group's own questions — it holds no
                  answers to the test bank for a cell fold to read. What
                  it does have is members whose completed instruments are
                  public (D98) and cached beside their names, so its side
                  is their mean, over the count the card prints.

                  WITHOUT YOU. The lens prints "You ↔ {group}", so the
                  right-hand side is the group MINUS the viewer — passing
                  the whole membership compared you with a population you
                  are inside, which drags the gap toward zero and, in a
                  group where nobody else has finished a test, makes it
                  exactly zero. Every sibling population already excludes
                  the viewer. */}
              <GroupCompare
                pop={{ basis: "people", uids: (g.memberUids || []).filter((u) => u !== LIVE.uid) }}
                whom={g.name || "this group"}
                emptyThem={<>Nobody here has finished a test yet.</>} />
              <LgSeenCard rv={rv} reveals={reveals} lookup={lookup} reading={reading} unread={unread} />
            </React.Suspense>
          )}
        </div>
      )}
    </div>
  );
}

export default LiveGroupsMirrorBody;
