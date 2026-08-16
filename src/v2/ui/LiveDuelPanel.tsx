// LiveDuelPanel — the LIVE group/duo panel. Replaces the demo
// GroupDailyBody / DuoBody when LIVE is enabled: real circles with
// server-minted invite codes, today's question from the shared
// deterministic rotation, sealed votes, and yesterday's materialized
// reveal. With no circles yet, the panel IS the create-or-join flow.
//
// REBUILT TO THE v25 PROTOTYPE'S SHAPE (D156). It was a plain vertical list
// of bordered cards: names as text, one flat reveal list, an always-open
// invite code, and answer+guess crammed onto one screen behind a Seal
// button. The prototype's `group-daily.jsx` and `duo-daily.jsx` — which are
// still in this repo as the demo bodies, so the two can be read side by
// side — are a different screen entirely, and the difference is structural
// rather than decorative:
//
//   · a sticky RAIL of every circle, marked when it still wants you, that
//     you tap to jump — so a person with four circles sees four, not a
//     scroll;
//   · cards that FILL the view and snap, so one circle is one screen;
//   · initials + colour for every person and circle, because a reveal is a
//     list of people and a list of names is not;
//   · the reveal as BARS with faces on them, not "name — option" rows;
//   · answering that MORPHS into guessing, instead of asking for both at
//     once and gating a button on the pair.
//
// The port is faithful where live data allows and honestly short where it
// does not — each gap is commented at its site rather than filled with a
// plausible number. The three that matter: nothing can say who else has
// played today (that is the seal doing its job), a member list carries no
// "invited · waiting" state (invitations live on the invitee's side, by
// design — see LdInvites), and day history costs reads, so it arrives on a
// tap rather than on arrival.
//
// Born in this repo (not ported from the prototype), so it lives here as
// typed TSX. Reached by React.lazy from daily-split.jsx since D156 — it is
// two of the daily tab's three modes and none of the first paint.
import React from "react";
import LIVE from "../data/live";
import { consumeJoinCode, inviteLinkFor } from "../data/links";
// Handles and invitations (D122) — how a circle gains a member now. The
// code survives inside the share link for people who have no account
// yet; it is no longer something anyone types.
import { atHandle, handleProblem, normalizeHandle } from "../data/handles";
import { inviteLine, type Invite } from "../data/invites";
import { duoRuns, revealTally, type RevealDocLike } from "../data/duelRuns";
import { DuelAv, GroupMark, YouChip } from "./duelMarks";
import { firstName } from "./marks";
// Untyped spec modules, both already in the graph these screens' demo twins
// use. One @ts-expect-error each, at the specifier — TS7016 is reported
// there, not at the use site.
// @ts-expect-error TS7016 — untyped spec module
import { ReadRun } from "../spec/read-run.jsx";
// @ts-expect-error TS7016 — untyped spec module
import { RevealClock } from "../spec/reveal-clock.js";
// LAZY, and that is a measurement rather than a style (D152). This panel is
// reached from the daily tab; a static import put the whole takes panel into
// the graph for a thread that renders under a revealed duel, and
// `npm run check:bundle` counts a statically-imported chunk whether or not
// anything renders it.
const LiveTakesPanel = React.lazy(() => import("./LiveTakesPanel"));

const LD_LINE = "1px solid color-mix(in oklch, var(--rule), transparent 25%)";
const LD_HAIR = "0.5px solid color-mix(in oklch, var(--rule), transparent 30%)";
const LD_NAME_LS = "insight.displayName.v1";
// The prototype's two accents, kept apart: a circle is a likeness question,
// a 1v1 is a people question, and the option buttons are tinted with
// whichever it is.
const ACC_GROUP = "var(--c-likeness)";
const ACC_DUO = "var(--c-people)";
const ROMANCE = "oklch(0.55 0.13 12)";
const GOOD = "var(--c-likeness)";
const MISS = "var(--ochre)";

const col = (g: number): React.CSSProperties => ({ display: "flex", flexDirection: "column", gap: g });

// The store keeps groups/reveals loosely typed at the seam; these are
// the fields this panel actually renders.
interface LiveGroup {
  id: string;
  name?: string;
  mode?: string;
  duoMode?: string;
  inviteCode?: string;
  streak?: number;
  memberUids?: string[];
  memberNames?: Record<string, string>;
}
interface RevealVote { optionIdx: number; guessIdx?: number; qid?: string }
interface LiveReveal extends RevealDocLike {
  day?: string;
  qid?: string;
  votes?: Record<string, RevealVote>;
  names?: Record<string, string>;
}

function ldName(): string {
  try { return localStorage.getItem(LD_NAME_LS) || ""; } catch { return ""; }
}
function ldSaveName(n: string): void {
  try { localStorage.setItem(LD_NAME_LS, n); } catch { /* best-effort */ }
}
function errText(e: unknown): string {
  return String((e instanceof Error && e.message) || e);
}

function LdInput({ value, onChange, placeholder, style }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      style={{ border: LD_LINE, borderRadius: 10, padding: "11px 13px", fontFamily: "var(--sans)",
        fontSize: "var(--field-size)", fontWeight: 600, color: "var(--ink)", background: "var(--surface-2)",
        outline: "none", minWidth: 0, width: "100%", boxSizing: "border-box", ...style }} />
  );
}

function LdBtn({ onClick, children, primary, disabled, small }: {
  onClick: () => void;
  children: React.ReactNode;
  primary?: boolean;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <button className="press" onClick={onClick} disabled={disabled}
      style={{ border: primary ? "none" : LD_LINE, borderRadius: 999, cursor: disabled ? "default" : "pointer",
        padding: small ? "7px 14px" : "11px 20px", fontFamily: "var(--sans)", fontWeight: 800,
        fontSize: small ? 12 : 14, WebkitAppearance: "none", opacity: disabled ? 0.5 : 1,
        background: primary ? "var(--accent, var(--ink))" : "var(--surface-2)",
        color: primary ? "var(--surface)" : "var(--ink)" }}>{children}</button>
  );
}

// The prompt, at the prototype's weight. 25 is not a large heading for its
// own sake — a duel question is the only thing on the card, and it is read
// standing up.
function LdPrompt({ children, size = 25 }: { children: React.ReactNode; size?: number }) {
  return (
    <div style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: size, lineHeight: 1.12,
      letterSpacing: -0.5, textWrap: "pretty" }}>{children}</div>
  );
}

// A tinted option. Bigger and softer than a form control, because tapping
// one IS the answer — there is no submit step to correct it in.
function LdOption({ label, onClick, tint, lead, disabled }: {
  label: string; onClick: () => void; tint: string; lead?: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button className="press" onClick={onClick} disabled={disabled} style={{
      background: `color-mix(in oklch, ${tint} 7%, var(--surface))`,
      border: `1px solid color-mix(in oklch, ${tint} 30%, var(--rule))`,
      borderRadius: 16, boxShadow: "none", padding: "15px 17px", minHeight: 56,
      display: "flex", alignItems: "center", gap: 11, cursor: disabled ? "default" : "pointer",
      textAlign: "left", WebkitAppearance: "none", opacity: disabled ? 0.55 : 1,
    }}>
      {lead}
      <span style={{ fontWeight: 700, fontSize: 17, color: "var(--ink)" }}>{label}</span>
    </button>
  );
}

// ── first-run: create or join ────────────────────────────────────
function LdOnboard({ mode }: { mode?: string }) {
  const [name, setName] = React.useState("");
  // A tapped invite link lands here: the stashed code prefills the join
  // field (consume = one prefill, not a haunting).
  const [code, setCode] = React.useState(() => consumeJoinCode() || "");
  const [me, setMe] = React.useState(ldName());
  const [codeOpen, setCodeOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const duo = mode === "duo";
  const S = LIVE.social;
  const go = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null); ldSaveName(me.trim());
    try { await fn(); } catch (e) { setErr(errText(e)); }
    setBusy(false);
  };
  return (
    <div className="card" data-ld-new="1" style={{ display: "flex", flexDirection: "column", gap: 14, padding: "18px 16px", scrollSnapAlign: "start" }}>
      <div style={{ fontWeight: 800, fontSize: 21, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
        {duo ? "Start a 1v1" : "Start your group"}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink-2)", lineHeight: 1.45 }}>
        {duo
          ? "One question a day, sealed until tomorrow — if you both play."
          : "One question a day, sealed until tomorrow, then revealed with names."}
      </div>
      <LdInput value={me} onChange={setMe} placeholder="Your name (what friends see)" />
      <div style={{ display: "flex", gap: 8 }}>
        <LdInput value={name} onChange={setName} placeholder={duo ? "Name it (e.g. Mira & Leo)" : "Group name"} />
        <LdBtn primary disabled={busy || !name.trim() || !me.trim()}
          onClick={() => void go(() => S.createGroup(name.trim(), mode === "duo" ? "duo" : "group", me.trim()))}>Create</LdBtn>
      </div>
      {/* THE CODE STOPS BEING THE SECOND HALF OF THIS SCREEN (D122).
          It used to sit here under an "OR JOIN WITH A CODE" rule, as a
          peer of Create — which made an eight-character string the thing
          a new user was asked for before they had anyone to swap it
          with. Once a circle exists its members are added by handle, and
          a person with no account gets a link (the code rides inside it,
          where nobody reads it).

          It is not deleted: a tapped invite link prefills this field, and
          somebody who was handed a code out of band still has to be able
          to type it. So it becomes what it actually is — the fallback —
          and prefilled state opens it, because a code that arrived by
          link should not be hidden behind a disclosure. */}
      {codeOpen || code ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink-3)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em" }}>
            <span style={{ flex: 1, height: 1, background: "var(--rule)" }} />OR JOIN WITH A CODE<span style={{ flex: 1, height: 1, background: "var(--rule)" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <LdInput value={code} onChange={(v) => setCode(v.toUpperCase())} placeholder="Invite code" style={{ fontFamily: "var(--mono, monospace)", letterSpacing: "0.12em" }} />
            <LdBtn primary disabled={busy || code.trim().length < 6 || !me.trim()}
              onClick={() => void go(() => S.joinGroup(code.trim(), me.trim()))}>Join</LdBtn>
          </div>
        </>
      ) : (
        <button className="press" onClick={() => setCodeOpen(true)} style={{
          alignSelf: "center", border: "none", background: "none", padding: "2px 8px",
          cursor: "pointer", fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600,
          color: "var(--ink-3)", WebkitAppearance: "none",
        }}>Have an invite code?</button>
      )}
      {err && <div style={{ fontSize: 12.5, fontWeight: 600, color: "oklch(0.5 0.19 25)" }}>{err.replace(/^.*?: */, "")}</div>}
    </div>
  );
}

// ── add someone, by handle (D122) ────────────────────────────────
//
// This is what replaced "share this code with them". The flow is: type a
// handle, we resolve it to a uid against the registry, the callable
// writes an invitation, they accept. Nothing is added to a circle without
// the other side saying yes — which is the difference between this and a
// follow, and the reason follows need no acceptance and this does:
// joining a circle puts your name on a sealed answer that gets revealed
// to those people, and that IS access they did not otherwise have.
function LdAddByHandle({ g }: { g: LiveGroup }) {
  const [h, setH] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);
  const canonical = normalizeHandle(h);

  const send = async () => {
    if (!canonical) return;
    setBusy(true); setMsg(null); setOk(false);
    try {
      const uid = await LIVE.social.whoIs(canonical);
      // "Nobody has that handle" is the failure this flow has that a code
      // did not, so it gets a sentence rather than a raw error — and it
      // deliberately does NOT say whether the handle is malformed or
      // merely unclaimed, because to someone looking a person up those
      // are the same answer.
      if (!uid) { setMsg(`No account is ${atHandle(canonical)}.`); setBusy(false); return; }
      await LIVE.social.inviteToGroup(g.id, uid);
      setH("");
      setOk(true);
      setMsg(`Invited ${atHandle(canonical)} — they will see it next time they open InSight.`);
    } catch (e) {
      const raw = errText(e);
      setMsg(/already-exists/i.test(raw)
        ? `${atHandle(canonical)} is already here.`
        : raw.replace(/^.*?: */, ""));
    }
    setBusy(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <span className="kicker" style={{ marginBottom: 0 }}>Add someone</span>
      <div style={{ display: "flex", gap: 8 }}>
        <LdInput value={h} onChange={setH} placeholder="@their-handle"
          style={{ fontFamily: "var(--mono, monospace)" }} />
        <LdBtn primary disabled={busy || !canonical} onClick={() => void send()}>
          {busy ? "…" : "Invite"}
        </LdBtn>
      </div>
      {(handleProblem(h) || msg) && (
        <div role="status" style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.4,
          color: ok ? "var(--ink-2)" : handleProblem(h) ? "var(--ink-3)" : "oklch(0.5 0.19 25)" }}>
          {handleProblem(h) || msg}
        </div>
      )}
    </div>
  );
}

// The other way in — the one that reaches somebody with no account yet.
// The LINK, not the bare code: pasteable anywhere, and it lands on the
// hosted /join page (or straight in the app once app-links verify). The
// code is still the button's face, because that is what a person who was
// handed one out of band will be looking for.
function LdCopyLink({ g }: { g: LiveGroup }) {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    try {
      void navigator.clipboard.writeText(g.inviteCode ? inviteLinkFor(g.inviteCode) : "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <button onClick={copy} aria-label="Copy invite link — no account needed" title="Copy invite link"
      style={{ flexShrink: 0, border: LD_LINE, background: "var(--surface-2)", borderRadius: 8, padding: "5px 10px",
        cursor: "pointer", fontFamily: "var(--mono, monospace)", fontSize: 11.5, fontWeight: 700,
        letterSpacing: "0.1em", color: "var(--ink-2)", WebkitAppearance: "none" }}>
      {copied ? "copied ✓" : g.inviteCode}
    </button>
  );
}

// ── invitations waiting for you (D122) ───────────────────────────
//
// Anyone may invite anyone (owner's call), so this list is one a stranger
// can lengthen. What keeps that survivable is that an invitation grants
// nothing until accepted, declining is one tap, and the inviter is told
// nothing either way — a "declined" state would make refusing someone a
// message you have to send them, which is what makes people accept
// invitations they do not want.
function LdInvites({ mode }: { mode?: string }) {
  const [, tick] = React.useState(0);
  React.useEffect(() => LIVE.subscribe(() => tick((t) => t + 1)), []);
  // On mount, not on render: the fetch is a collection-group query and
  // this panel re-renders on every store notify.
  React.useEffect(() => { void LIVE.social.loadInvites(); }, []);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const want = mode === "duo" ? "duo" : "group";
  const list = (LIVE.social.invites() as Invite[]).filter((i) => (i.mode || "group") === want);
  if (!list.length) return null;

  const act = async (gid: string, accept: boolean) => {
    setBusy(gid); setErr(null);
    try {
      if (accept) await LIVE.social.acceptInvite(gid);
      else await LIVE.social.declineInvite(gid);
    } catch (e) { setErr(errText(e).replace(/^.*?: */, "")); }
    setBusy(null);
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 15px" }}>
      <span className="kicker" style={{ marginBottom: 0 }}>
        {list.length === 1 ? "An invitation" : `${list.length} invitations`}
      </span>
      {list.map((inv) => (
        <div key={inv.gid} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ flex: 1, minWidth: 140, fontSize: 14, fontWeight: 650, lineHeight: 1.3 }}>
            {inviteLine(inv)}
          </span>
          <LdBtn small onClick={() => void act(inv.gid, false)} disabled={busy === inv.gid}>Decline</LdBtn>
          <LdBtn small primary onClick={() => void act(inv.gid, true)} disabled={busy === inv.gid}>Accept</LdBtn>
        </div>
      ))}
      {err && <div role="status" style={{ fontSize: 12.5, fontWeight: 600, color: "oklch(0.5 0.19 25)" }}>{err}</div>}
    </div>
  );
}

// ── yesterday's reveal ───────────────────────────────────────────
//
// Two shapes over one document, because a circle and a pair are asking
// different questions of the same data. A circle wants the SPLIT — which
// way did we go, and who is standing where — so it draws bars with faces
// on them. A pair has no split worth a bar with two votes in it; what it
// wants is the two READS, which is the prototype's "you read Ada / Ada
// read you" pair of rows.
function LdReveal({ g, reveal, day }: { g: LiveGroup; reveal: LiveReveal; day?: string }) {
  // "" rather than null: this component INDEXES the vote map by it, and an
  // anonymous session has no uid. An empty key matches nobody, which is the
  // right answer — nothing on the reveal is yours.
  const uid = LIVE.uid || "";
  const names = { ...(g.memberNames || {}), ...(reveal.names || {}) };
  const votes = (reveal.votes || {}) as Record<string, RevealVote>;
  const rowQid = reveal.qid || null;
  // resolve the revealed question's prompt + options from the seeded bank
  const bankQ = reveal.qid ? LIVE.social.bankQ(reveal.qid) : null;
  const duo = g.mode === "duo";
  const tint = duo ? ACC_DUO : ACC_GROUP;
  // Options for a given question — a "pick" question carries none, because
  // its options ARE the group.
  const optsFor = (q: { options?: string[] } | null): string[] =>
    (q && q.options && q.options.length)
      ? q.options
      : (g.memberUids || []).map((u, i) => names[u] || "Member " + (i + 1));
  const opts = optsFor(bankQ);
  const labelIn = (list: string[], idx: number) =>
    (list[idx] != null ? list[idx] : "Option " + (idx + 1));
  const who = (u: string) => (u === uid ? "you" : (names[u] || "Someone"));
  // A member's answer belongs to the question THEY were asked. Rendering it
  // under the day's prompt is the part D70 could not fix from the server:
  // the reveal carried one qid, so an answer given to a different question
  // appeared under this one, with that member's name on it. Their vote now
  // carries its own qid when it differs (D71), so it can be shown honestly.
  const qidOf = (v: RevealVote) => (typeof v.qid === "string" && v.qid ? v.qid : rowQid);
  const offQuestion = Object.keys(votes).filter((u) => qidOf(votes[u]) !== rowQid);
  const mine = votes[uid];

  return (
    <div style={{ borderRadius: 12, border: LD_LINE, background: "var(--surface-2)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 9 }}>
      <div className="kicker" style={{ marginBottom: 0 }}>{day || "Yesterday"} · revealed</div>
      {bankQ && <div style={{ fontWeight: 800, fontSize: 15.5, lineHeight: 1.2 }}>{bankQ.prompt}</div>}
      {duo ? duoRows() : <LdRevealBars reveal={reveal} opts={opts} names={names} uid={uid} tint={tint} />}
      {offQuestion.map((u) => {
        // One block per member who was asked something else: their prompt,
        // then their answer read against THEIR options. Their vote is not in
        // the counts this card implies, and saying so is the honest version
        // of what used to be a silent mislabel.
        const theirQ = LIVE.social.bankQ(qidOf(votes[u]) as string) as
          { prompt?: string; options?: string[] } | null;
        const list = optsFor(theirQ);
        return (
          <div key={u} style={{ borderTop: LD_LINE, paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: "var(--ink-3)" }}>
              {who(u) === "you" ? "You were" : who(u) + " was"} asked a different question
            </div>
            {theirQ && theirQ.prompt && (
              <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.25 }}>{theirQ.prompt}</div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
              {u === uid ? <YouChip size={20} /> : <DuelAv uid={u} name={names[u]} size={20} />}
              <span style={{ fontWeight: 700 }}>{labelIn(list, votes[u].optionIdx)}</span>
            </div>
          </div>
        );
      })}
      {/* Takes hang off the REVEALED question, never today's. Today's vote
          is sealed until tomorrow, and free text beside a sealed answer is
          the leak the seal exists to prevent — "obviously B" under a
          question nobody has answered yet is the vote, in prose. Once names
          are on the answers there is nothing left to give away, which is
          also the only moment a circle has anything to discuss.

          rowQid rather than a member's own qid: a split day (D71) asks
          different people different things, and one shared comment thread
          has to belong to one question. The panel renders nothing when the
          reveal carries no qid. */}
      {rowQid && (
        <div style={{ borderTop: LD_LINE, paddingTop: 10 }}>
          {/* null fallback, not a spinner: the chunk is on the phone's own
              disk by the time a reveal is open, and a spinner that shows
              for one frame reads as a stutter. */}
          <React.Suspense fallback={null}>
            <LiveTakesPanel gid={g.id} qid={rowQid} />
          </React.Suspense>
        </div>
      )}
    </div>
  );

  // The pair's two rows: what you called, and what they called. Each is a
  // statement about the OTHER's answer, so the other's mark leads it.
  function duoRows() {
    const themUid = (g.memberUids || []).find((m) => m !== uid) || "";
    const theirs = themUid ? votes[themUid] : undefined;
    // …only when you were both answering the same question. Across a split,
    // "called it" would compare a guess about one prompt to an answer about
    // another and land on true by coincidence.
    const comparable = !!mine && !!theirs && qidOf(mine) === qidOf(theirs);
    const rows: React.ReactNode[] = [];
    if (mine && theirs && comparable && typeof mine.guessIdx === "number") {
      rows.push(revealRow("you read " + (firstName(names[themUid]) || "them"),
        mine.guessIdx === theirs.optionIdx,
        labelIn(opts, theirs.optionIdx), labelIn(opts, mine.guessIdx),
        <DuelAv key="a" uid={themUid} name={names[themUid]} size={20} />));
    }
    if (mine && theirs && comparable && typeof theirs.guessIdx === "number") {
      rows.push(revealRow((firstName(names[themUid]) || "They") + " read you",
        theirs.guessIdx === mine.optionIdx,
        labelIn(opts, mine.optionIdx), labelIn(opts, theirs.guessIdx),
        <YouChip key="b" size={20} />));
    }
    // No guesses to score (a pre-D40 reveal, or a split day) — fall back to
    // the plain answers rather than an empty box.
    if (!rows.length) {
      return (
        <div style={col(6)}>
          {Object.keys(votes).filter((u) => qidOf(votes[u]) === rowQid).map((u) => (
            <div key={u} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
              {u === uid ? <YouChip size={20} /> : <DuelAv uid={u} name={names[u]} size={20} />}
              <span style={{ fontWeight: 700 }}>{labelIn(opts, votes[u].optionIdx)}</span>
            </div>
          ))}
        </div>
      );
    }
    return <div style={col(0)}>{rows}</div>;
  }

  function revealRow(label: string, right: boolean, ansLabel: string, guessLabel: string, av: React.ReactNode) {
    return (
      <div key={label} style={{ padding: "9px 0", borderTop: LD_HAIR, ...col(4) }}>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink-3)" }}>{label}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {av}
          <span style={{ fontWeight: 700, fontSize: 14 }}>{ansLabel}</span>
          <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: 12.5, color: right ? GOOD : MISS, whiteSpace: "nowrap" }}>
            {right ? "called it" : "guessed " + guessLabel}
          </span>
        </span>
      </div>
    );
  }
}

// One bar per option anybody chose: the share carries the fill, the faces
// sit on the right, and your own row wears the accent border. The
// prototype's GDReveal, over the live reveal doc.
function LdRevealBars({ reveal, opts, names, uid, tint }: {
  reveal: LiveReveal; opts: string[]; names: Record<string, string>; uid: string; tint: string;
}) {
  const rows = revealTally(reveal, opts.length);
  const total = rows.reduce((a, r) => a + r.uids.length, 0) || 1;
  const mine = (reveal.votes || {})[uid];
  return (
    <div style={col(8)}>
      {rows.map((r) => {
        const isMine = !!mine && mine.optionIdx === r.optionIdx;
        return (
          <div key={r.optionIdx} style={{
            position: "relative", overflow: "hidden", borderRadius: 14,
            border: isMine ? `1.5px solid color-mix(in oklch, ${tint} 55%, transparent)` : LD_LINE,
            background: "var(--surface)", boxShadow: "none",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0,
              width: (r.uids.length / total) * 100 + "%",
              background: `color-mix(in oklch, ${tint} 13%, transparent)` }} />
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px" }}>
              <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 13.5 }}>
                {opts[r.optionIdx] != null ? opts[r.optionIdx] : "Option " + (r.optionIdx + 1)}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {r.uids.filter((u) => u !== uid).map((u) => (
                  <DuelAv key={u} uid={u} name={names[u]} size={20} />
                ))}
                {isMine && <YouChip size={20} />}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── a duo's question pool (D40 part 4) ───────────────────────────
// Renders only when a flip can land somewhere: the romantic pool seeds
// dark (active: false) until the mode-aware client is the fleet, and a
// picker offering an empty pool would trade today's question for nothing.
// The `already romantic` arm keeps the road back open if the pool is ever
// darkened again. Locked once today's answer is sealed — the pools rotate
// independently, so a post-seal flip would hand the pair two different
// questions for one day; the partner-side remainder of that race is
// recorded in D40's adoption note.
function LdModeRow({ g, sealed }: { g: LiveGroup; sealed: boolean }) {
  const S = LIVE.social;
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const current = g.duoMode === "romantic" ? "romantic" : "friends";
  const flip = async (next: "friends" | "romantic") => {
    if (busy || sealed || next === current) return;
    setBusy(true); setErr(null);
    try { await S.setDuoMode(g.id, next); }
    catch { setErr("Couldn’t switch pools — check your connection."); }
    setBusy(false);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span className="kicker" style={{ marginBottom: 0, flex: 1 }}>Question pool</span>
        {(["friends", "romantic"] as const).map((m) => (
          <button key={m} className="press" onClick={() => void flip(m)}
            disabled={busy || sealed} aria-pressed={current === m}
            style={{ border: "none", borderRadius: 999, padding: "6px 13px",
              cursor: busy || sealed ? "default" : "pointer",
              fontFamily: "var(--sans)", fontWeight: current === m ? 800 : 600, fontSize: 12.5,
              background: current === m ? (m === "romantic" ? ROMANCE : "var(--ink)") : "var(--surface-3)",
              color: current === m ? "var(--surface)" : "var(--ink-3)",
              opacity: busy || sealed ? 0.55 : 1, WebkitAppearance: "none" }}>
            {m === "friends" ? "Friends" : "Romantic"}
          </button>
        ))}
      </div>
      {sealed && (
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)" }}>
          Pool is locked until tomorrow — today’s answer is sealed.
        </div>
      )}
      {err && <div role="status" style={{ fontSize: 12.5, fontWeight: 600, color: "oklch(0.5 0.19 25)" }}>{err}</div>}
    </div>
  );
}

// ── the ⋯ panel: everything that is not today's question ─────────
//
// The prototype puts a circle's management behind a bottom sheet and a
// pair's behind an inline row. One inline panel serves both here: the
// content is the same either way, and a portal that needs `.app` in the
// document is a second way for the same tap to do nothing.
function LdManage({ g, onClose }: { g: LiveGroup; onClose: () => void }) {
  const S = LIVE.social;
  const uid = LIVE.uid || "";
  const duo = g.mode === "duo";
  const members = g.memberUids || [];
  const names = g.memberNames || {};
  const [confirmLeave, setConfirmLeave] = React.useState(false);
  const [leaveErr, setLeaveErr] = React.useState<string | null>(null);
  const leave = async () => {
    setLeaveErr(null);
    try { await S.leaveGroup(g.id); }
    catch { setLeaveErr("Couldn’t leave — check your connection."); }
  };
  return (
    <div style={{ ...col(11), border: LD_LINE, borderRadius: 13, background: "var(--surface)", padding: "12px 13px" }}>
      {/* Who is here. No "invited · waiting" row, and that is a real gap
          rather than an oversight: invitations are written to the INVITEE's
          own path (firestore.rules — members deliberately cannot read the
          list, because "who was asked and has not answered" is a fact about
          them). So this names the members and nothing else. */}
      <div style={col(7)}>
        <span className="kicker" style={{ marginBottom: 0 }}>
          {members.length === 1 ? "Just you so far" : members.length + " here"}
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {members.map((u) => (
            <span key={u} style={{ display: "flex", alignItems: "center", gap: 7, border: LD_LINE,
              borderRadius: 999, background: "var(--surface-2)", padding: "4px 12px 4px 5px" }}>
              {u === uid ? <YouChip size={22} /> : <DuelAv uid={u} name={names[u]} size={22} />}
              <span style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 12.5, color: "var(--ink)" }}>
                {u === uid ? "you" : (firstName(names[u]) || "Someone")}
              </span>
            </span>
          ))}
        </div>
      </div>

      {members.length < (duo ? 2 : 32) && <LdAddByHandle g={g} />}

      <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: LD_HAIR, paddingTop: 10 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: "var(--ink-2)", textWrap: "pretty" }}>
          Or send a link — no account needed.
        </span>
        <LdCopyLink g={g} />
      </div>

      {/* The only way out of a circle short of deleting the account.
          Two-step, because the last member out takes the circle and every
          reveal in it (leaveGroupV2's recursiveDelete) — the same reason
          the privacy panel's delete confirms. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: LD_HAIR, paddingTop: 10 }}>
        {confirmLeave ? (
          <>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--ink-2)", textWrap: "pretty" }}>
              {members.length <= 1
                ? "You’re the last one — leaving deletes this circle and its history."
                : duo
                  ? "End this 1v1? You keep the days you played."
                  : "Leave this circle? You keep the days you played."}
            </span>
            <button className="press" onClick={() => setConfirmLeave(false)}
              style={{ border: LD_LINE, background: "transparent", borderRadius: 999, padding: "6px 12px", cursor: "pointer", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 700, color: "var(--ink-2)", WebkitAppearance: "none" }}>
              {duo ? "Keep" : "Cancel"}
            </button>
            <button className="press" onClick={() => { void leave(); }}
              style={{ border: "none", background: "var(--ochre-ink, var(--ink))", borderRadius: 999, padding: "6px 13px", cursor: "pointer", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 800, color: "#fff", WebkitAppearance: "none" }}>
              {duo ? "End" : "Leave"}
            </button>
          </>
        ) : (
          <>
            <button className="press" onClick={() => setConfirmLeave(true)}
              style={{ border: "none", background: "transparent", padding: "2px 0", cursor: "pointer", fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 700, color: "var(--ochre-ink, var(--ink-3))", WebkitAppearance: "none" }}>
              {duo ? "End this 1v1" : "Leave circle"}
            </button>
            <button className="press" onClick={onClose}
              style={{ marginLeft: "auto", border: LD_LINE, background: "var(--surface-2)", borderRadius: 999, padding: "6px 13px", cursor: "pointer", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 700, color: "var(--ink)", WebkitAppearance: "none" }}>
              Done
            </button>
          </>
        )}
      </div>
      {leaveErr && (
        <div role="status" style={{ fontSize: 12.5, fontWeight: 600, color: "oklch(0.5 0.19 25)" }}>{leaveErr}</div>
      )}
    </div>
  );
}

// ── one circle's card — fills the view, snaps into place ─────────
function LdCard({ g, vh, nextName, newest }: {
  g: LiveGroup; vh: number; nextName: string | null; newest: boolean;
}) {
  const S = LIVE.social;
  const uid = LIVE.uid || "";
  const duo = g.mode === "duo";
  const q = S.todayQ(g.id);
  const mine = S.myDuelVote(g.id);
  const reveal = S.revealFor(g.id) as LiveReveal | null;
  const members = g.memberUids || [];
  const names = g.memberNames || {};
  const themUid = duo ? (members.find((m) => m !== uid) || "") : "";
  const themName = firstName(names[themUid]) || "them";
  const romantic = g.duoMode === "romantic";
  const tint = duo ? (romantic ? ROMANCE : ACC_DUO) : ACC_GROUP;

  const [menu, setMenu] = React.useState(false);
  // The answer, held locally between the two taps. A duo answers, then
  // guesses — the prototype's morph — but the WRITE is still one create
  // (D5: answers are create-only), so the pick waits here until the guess
  // lands and both go up together.
  const [pick, setPick] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [voteErr, setVoteErr] = React.useState<string | null>(null);
  // Day browsing. `revealFor` is yesterday, live-subscribed and free;
  // anything older is a doc read per day per circle, so it arrives on the
  // tap that asks for it rather than on the daily tab's first paint.
  const [day, setDay] = React.useState(0);
  const [histAsked, setHistAsked] = React.useState(false);
  const hist = (S.revealHistory(g.id) as LiveReveal[]) || [];
  const past = hist.length ? hist : (reveal ? [reveal] : []);
  const shown: LiveReveal | null = day === 0 ? null : (past[day - 1] || null);

  const seal = async (optionIdx: number, guessIdx?: number) => {
    if (busy) return;
    setBusy(true); setVoteErr(null);
    try { await S.voteDuel(g.id, optionIdx, guessIdx); }
    catch {
      setVoteErr("That didn’t save — check your connection.");
      setPick(null);
    }
    setBusy(false);
  };
  const loadOlder = () => {
    setHistAsked(true);
    void S.loadRevealHistory(g.id);
  };

  // one dot per day this circle has on record; tap to browse back
  const dots = past.length > 0 && (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6 }}>
      {!histAsked && (
        <button onClick={loadOlder} aria-label="Load older days"
          style={{ border: "none", background: "none", padding: "0 4px", cursor: "pointer", color: "var(--ink-3)", fontSize: 12, fontWeight: 800, lineHeight: 1, WebkitAppearance: "none" }}>⋯</button>
      )}
      {/* oldest left, today right — the row is time, so it has to run that
          way even though `past` arrives newest first */}
      {past.map((_, i) => i + 1).reverse().map((n) => {
        const cur = n === day;
        return (
          <button key={n} onClick={() => setDay(n)} aria-current={cur ? "true" : undefined}
            aria-label={(n === 1 ? "Yesterday" : n + " days ago") + " — revealed"}
            style={{ width: 22, height: 22, padding: 0, border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", WebkitAppearance: "none" }}>
            <span style={{ width: cur ? 18 : 6, height: 6, borderRadius: 999,
              background: cur ? tint : `color-mix(in oklch, ${tint} 45%, var(--surface-3))`,
              transition: "width .25s ease, background .2s ease" }} />
          </button>
        );
      })}
      <button onClick={() => setDay(0)} aria-current={day === 0 ? "true" : undefined} aria-label="Today"
        style={{ width: 22, height: 22, padding: 0, border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", WebkitAppearance: "none" }}>
        <span style={{ width: day === 0 ? 18 : 6, height: 6, borderRadius: 999,
          background: day === 0 ? tint : (mine ? `color-mix(in oklch, ${tint} 45%, var(--surface-3))` : "color-mix(in oklch, var(--ink-3) 30%, transparent)"),
          transition: "width .25s ease, background .2s ease" }} />
      </button>
    </div>
  );

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      {duo && themUid
        ? <DuelAv uid={themUid} name={names[themUid]} size={26} />
        : <GroupMark gid={g.id} name={g.name} size={26} />}
      <span style={{ fontWeight: 800, fontSize: 15, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {duo && themUid ? themName : g.name}
      </span>
      {duo && romantic && <span aria-label="romantic mode" style={{ width: 7, height: 7, borderRadius: "50%", background: ROMANCE, flexShrink: 0 }} />}
      <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        {(g.streak || 0) > 0 && <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)" }}>{g.streak}-day run</span>}
        {!duo && <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)" }}>{members.length}</span>}
        <button className="tap44" aria-label={"Manage " + (g.name || "this circle")} aria-expanded={menu}
          onClick={() => setMenu((v) => !v)}
          style={{ border: "none", background: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 17, fontWeight: 800, padding: "0 3px", lineHeight: 1, WebkitAppearance: "none" }}>{"⋯"}</button>
      </span>
    </div>
  );

  let body: React.ReactNode;
  if (shown) {
    // an earlier day, browsed via the dots
    body = (
      <div style={col(12)} key={"past" + day}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setDay(0)}
            style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontWeight: 700, fontSize: 12, color: "var(--ink-2)", WebkitAppearance: "none" }}>{"‹"} today</button>
        </div>
        <LdReveal g={g} reveal={shown} day={day === 1 ? "Yesterday" : day + " days ago"} />
      </div>
    );
  } else if (duo && members.length < 2) {
    // the prototype's "Waiting for Ada" — live has no invitee to name (the
    // invitation lives on their side), so it names the two ways to reach one
    body = (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 13 }} key="solo">
        <GroupMark gid={g.id} name={g.name} size={52} />
        <div style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 21, letterSpacing: -0.4 }}>Waiting for someone</div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", maxWidth: 260, textWrap: "pretty" }}>
          Add them by handle or send the link.
        </div>
        <LdAddByHandle g={g} />
        <LdCopyLink g={g} />
      </div>
    );
  } else if (mine) {
    body = (
      <div style={{ ...col(16), animation: "popIn .35s cubic-bezier(0.2,0.8,0.2,1)" }} key="done">
        {q && <LdPrompt size={24}>{q.prompt}</LdPrompt>}
        <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-3)" }}>you said</span>
          <span style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 19, letterSpacing: -0.3, color: "var(--ink)" }}>
            {q && q.options[mine.optionIdx] != null ? q.options[mine.optionIdx] : "—"}
          </span>
        </div>
        <div style={{ ...col(11), borderTop: LD_HAIR, padding: "14px 0 2px" }}>
          {/* Everyone who could answer today. Deliberately NOT dimmed by
              who has played: a duel answer is sealed until the reveal, so
              nothing on this device knows, and dimming half of them would
              be a claim invented to fill a shape. */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {members.filter((u) => u !== uid).map((u) => (
              <DuelAv key={u} uid={u} name={names[u]} size={34} />
            ))}
            <YouChip size={34} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)", textWrap: "pretty" }}>
            {/* live countdown when this is the card in view; "tomorrow" is
                the honest fallback, and stays the wording everywhere else —
                the clock counts to LOCAL midnight while the reveal is keyed
                on a UTC day (reveal-clock.js says why).

                The CONDITION is the part that cannot be dropped: a duo
                reveals both-or-nothing (shouldReveal), so a partner who
                never plays means no reveal, and a bare "reveals tomorrow"
                would look broken on the morning that happens. */}
            {newest
              ? <RevealClock prefix="Reveals in" suffix={duo ? " — if you both play." : ", with names."} />
              : (duo ? "Reveals tomorrow — if you both play." : "Reveals tomorrow, with names.")}
            {" Takes open with the reveal."}
          </div>
          {nextName && (
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)" }}>
              {"Swipe down — " + nextName + " is waiting"}
            </div>
          )}
        </div>
        {/* Yesterday, kept on the card after you have played — a deliberate
            departure from the prototype, whose done-state is quiet and
            offers the past only through the day dots. Live's reveal carries
            the takes thread, which is the app's only place to say anything
            to anyone; by the time most people open this they have already
            answered, and burying the conversation behind a dot tap is not a
            trade the sample was making (it had no thread). Below the day's
            own block rather than above it, so the top of the card still
            reads the way the sample's does. */}
        {reveal && <LdReveal g={g} reveal={reveal} />}
      </div>
    );
  } else if (q && duo && members.length === 2 && pick != null) {
    // the morph: you have answered, now read them
    body = (
      <div style={{ ...col(12), animation: "popIn .3s cubic-bezier(0.2,0.8,0.2,1)" }} key="guess">
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>
          You picked <b>{q.options[pick]}</b>.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <DuelAv uid={themUid} name={names[themUid]} size={38} />
          <LdPrompt>{"And " + themName + " picked…?"}</LdPrompt>
        </div>
        <div style={col(9)}>
          {q.options.map((o: string, i: number) => (
            <LdOption key={i} label={o} tint={tint} disabled={busy} onClick={() => void seal(pick, i)} />
          ))}
        </div>
        <button className="press" onClick={() => setPick(null)} disabled={busy}
          style={{ alignSelf: "flex-start", border: "none", background: "none", padding: "2px 0", cursor: "pointer", fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 700, color: "var(--ink-3)", WebkitAppearance: "none" }}>
          {"‹"} change my answer
        </button>
        {voteErr && <div role="status" style={{ fontSize: 12.5, fontWeight: 600, color: "oklch(0.5 0.19 25)" }}>{voteErr}</div>}
      </div>
    );
  } else if (q) {
    body = (
      <div style={col(12)} key="ask">
        {reveal && <LdReveal g={g} reveal={reveal} />}
        <LdPrompt>{q.prompt}</LdPrompt>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-3)" }}>your answer</span>
        <div style={col(9)}>
          {q.options.map((o: string, i: number) => (
            <LdOption key={i} label={o} tint={tint} disabled={busy}
              onClick={() => (duo && members.length === 2 ? setPick(i) : void seal(i))} />
          ))}
        </div>
        {voteErr && <div role="status" style={{ fontSize: 12.5, fontWeight: 600, color: "oklch(0.5 0.19 25)" }}>{voteErr}</div>}
      </div>
    );
  } else {
    body = (
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }} key="noq">
        No question today — the deck is still loading.
      </div>
    );
  }

  // The pair's two runs, folded out of the reveal history they can both
  // already read. The dots ARE the score; there is no number, because the
  // shape of the run says more than an average.
  const runs = duo && themUid ? duoRuns(hist, uid, themUid) : { read: [], by: [] };
  const runRows = runs.read.length > 0 && (
    <div style={{ ...col(8), borderTop: LD_HAIR, paddingTop: 13 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }} aria-label="How well you read them">
        <span style={{ flexShrink: 0, width: 62, fontWeight: 800, fontSize: 12.5, color: "var(--ink)" }}>you</span>
        <ReadRun days={runs.read} size={14} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }} aria-label="How well they read you">
        <span style={{ flexShrink: 0, width: 62, fontWeight: 800, fontSize: 12.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{themName}</span>
        <ReadRun days={runs.by} color={ACC_DUO} size={14} />
      </div>
    </div>
  );

  return (
    <div data-duel-card={g.id} style={{
      // A card fills the view while it still wants something from you, and
      // collapses to its content once it does not — a finished circle
      // should not cost a screen of scrolling to get past.
      minHeight: mine || shown ? 0 : Math.min(Math.max((vh || 540) - 190, 250), 380),
      boxSizing: "border-box",
      scrollSnapAlign: "start", scrollSnapStop: "always",
      display: "flex", flexDirection: "column", gap: 16,
      borderTop: LD_LINE, padding: "20px 1px 26px",
    }}>
      {header}
      {menu && <LdManage g={g} onClose={() => setMenu(false)} />}
      {menu && duo && members.length === 2 && (S.romanticPoolReady() || romantic) && (
        <LdModeRow g={g} sealed={mine != null} />
      )}
      {body}
      {runRows}
      {dots}
    </div>
  );
}

// ── the rail: every circle at a glance, dot = it still wants you ──
function LdRail({ items, cur, onPick, onNew, duo }: {
  items: Array<{ g: LiveGroup; pending: boolean; themUid: string; label: string }>;
  cur: string; onPick: (id: string) => void; onNew: () => void; duo: boolean;
}) {
  return (
    <div className="h-scroll" style={{ display: "flex", gap: 4, overflowX: "auto", padding: "3px 6px 2px" }}>
      {items.map(({ g, pending, themUid, label }) => {
        const sel = g.id === cur;
        return (
          <button key={g.id} onClick={() => onPick(g.id)} aria-current={sel ? "true" : undefined}
            aria-label={label + " — " + (pending ? "still to play" : "done for today")}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, border: "none", background: "none", cursor: "pointer", padding: "4px 6px", WebkitAppearance: "none", flexShrink: 0, width: 62 }}>
            <span style={{ position: "relative", display: "inline-flex", borderRadius: 14, padding: 2,
              boxShadow: sel ? `0 0 0 2px ${duo ? ACC_DUO : ACC_GROUP}` : "none", transition: "box-shadow .18s" }}>
              {duo && themUid
                ? <DuelAv uid={themUid} name={label} size={38} dim={!pending && !sel} />
                : <GroupMark gid={g.id} name={g.name} size={38} faded={!pending && !sel} />}
              {/* only the waiting state wears a mark — a check on every
                  circle carried no information and made the rail read as
                  noise */}
              {pending && <span style={{ position: "absolute", top: -1, right: -1, width: 11, height: 11, borderRadius: "50%", background: duo ? ACC_DUO : ACC_GROUP, border: "2px solid var(--surface)" }} />}
            </span>
            <span style={{ fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: sel ? 800 : 600, color: sel ? "var(--ink)" : "var(--ink-3)", whiteSpace: "nowrap", maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
          </button>
        );
      })}
      <button onClick={onNew} aria-label={duo ? "Start a 1v1" : "Create a group"}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, border: "none", background: "none", cursor: "pointer", padding: "4px 6px", WebkitAppearance: "none", flexShrink: 0, width: 62 }}>
        <span style={{ width: 38, height: 38, margin: 2, borderRadius: 11, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px dashed color-mix(in oklch, var(--ink-3) 55%, transparent)", color: "var(--ink-2)", fontSize: 18, fontWeight: 600, lineHeight: 1 }}>+</span>
        <span style={{ fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 600, color: "var(--ink-3)" }}>New</span>
      </button>
    </div>
  );
}

function LiveDuelPanel({ mode }: { mode?: string }) {
  const [, tick] = React.useState(0);
  React.useEffect(() => LIVE.subscribe(() => tick((t) => t + 1)), []);
  const duo = mode === "duo";
  const S = LIVE.social;
  const uid = LIVE.uid || "";
  const groups = (LIVE.enabled ? S.groups(duo ? "duo" : "group") : []) as LiveGroup[];

  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const railRef = React.useRef<HTMLDivElement | null>(null);
  const scRef = React.useRef<HTMLElement | null>(null);
  const [vh, setVh] = React.useState(0);
  const [cur, setCur] = React.useState("");
  const has = groups.length > 0;

  // Snap on the tab's own scroller while this panel is mounted, plus a
  // scroll-spy that keeps the rail pointing at whatever is under the
  // thumb. Ported from the prototype's DuoBody — the scroller is the tab's,
  // not ours, so it is found by walking up and its properties are restored
  // on unmount.
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el || !has) return;
    let sc: HTMLElement | null = el.parentElement;
    while (sc && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement;
    scRef.current = sc;
    if (!sc) return;
    const scroller = sc;
    scroller.style.scrollSnapType = "y proximity";
    // snapped cards must land BELOW the sticky rail, not under it — pad the
    // snap origin by the rail's real height
    const railH = railRef.current ? railRef.current.offsetHeight : 80;
    scroller.style.scrollPaddingTop = railH + 14 + "px";
    setVh(scroller.clientHeight - railH);
    const onScroll = () => {
      const st = scroller.getBoundingClientRect().top + railH;
      let best: Element | null = null;
      let bd = Infinity;
      el.querySelectorAll("[data-duel-card]").forEach((c) => {
        const d = Math.abs(c.getBoundingClientRect().top - st - 80);
        if (d < bd) { bd = d; best = c; }
      });
      if (best) setCur((best as Element).getAttribute("data-duel-card") || "");
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      scroller.style.scrollSnapType = "";
      scroller.style.scrollPaddingTop = "";
    };
  }, [has]);

  const jumpTo = (sel: string) => {
    const sc = scRef.current;
    const el = rootRef.current;
    if (!sc || !el) return;
    const card = el.querySelector(sel);
    if (!card) return;
    const railH = railRef.current ? railRef.current.offsetHeight : 80;
    sc.scrollTo({
      top: card.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - railH - 14,
      behavior: "smooth",
    });
  };

  if (!LIVE.enabled) return null;

  // First run: no rail, no stack — the panel IS the create-or-join flow,
  // and an empty rail above it would be a frame around nothing.
  if (!has) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "4px 1px 20px" }}>
        <LdInvites mode={mode} />
        <LdOnboard mode={mode} />
      </div>
    );
  }

  const items = groups.map((g) => {
    const members = g.memberUids || [];
    const themUid = duo ? (members.find((m) => m !== uid) || "") : "";
    return {
      g,
      pending: S.myDuelVote(g.id) == null && !!S.todayQ(g.id),
      themUid,
      label: (duo ? (firstName((g.memberNames || {})[themUid]) || g.name || "1v1") : (g.name || "Circle")) as string,
    };
  });
  const nLeft = items.filter((i) => i.pending).length;

  return (
    <div ref={rootRef} style={{ ...col(10), padding: "0 0 20px" }}>
      <div style={{ display: "flex", alignItems: "baseline", padding: "0 2px" }}>
        <span className="kicker" style={{ marginBottom: 0 }}>{duo ? "One on one" : "Your circles"}</span>
        {nLeft > 0 && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "var(--ink-3)" }}>{nLeft} to play</span>}
      </div>
      <div ref={railRef} style={{ position: "sticky", top: 0, zIndex: 6, margin: "-1px -16px 0", padding: "1px 10px 0", background: "var(--surface-a, var(--surface))", borderBottom: "0.5px solid color-mix(in oklch, var(--rule), transparent 25%)" }}>
        <LdRail items={items} cur={cur} duo={duo}
          onPick={(id) => jumpTo('[data-duel-card="' + id + '"]')}
          onNew={() => jumpTo("[data-ld-new]")} />
      </div>
      {/* Invitations lead the stack. Someone asking to play with you
          outranks a card you have already finished. */}
      <LdInvites mode={mode} />
      <div style={col(0)}>
        {items.map(({ g }, i) => {
          const next = items.slice(i + 1).find((x) => x.pending);
          return (
            <LdCard key={g.id} g={g} vh={vh}
              nextName={next ? next.label : null} newest={i === 0} />
          );
        })}
      </div>
      <LdOnboard mode={mode} />
    </div>
  );
}

export default LiveDuelPanel;
