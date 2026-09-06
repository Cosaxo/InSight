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
//     once and gating a button on the pair. Since D381 a GROUP card
//     morphs too: the second tap is a call on where the room will land,
//     which is the one reading that makes the group instrument spread
//     (ROLES-PLAN §3.5). The write shape did not change — rules admitted
//     `guessIdx` on the group surface all along, and the reveal carries it.
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
// `localName` is this device's copy of the display name, written by the
// store whenever the name is saved — the create screen needs it before
// hydration finishes, which is the one moment `LIVE.displayName` is empty
// on an account that has one.
import LIVE, { localName } from "../data/live";
import { note } from "../data/engagement";
import { consumeJoinCode, inviteLinkFor, subscribeJoinCode } from "../data/links";
// Handles and invitations (D122) — how a circle gains a member now. The
// code survives inside the share link for people who have no account
// yet; it is no longer something anyone types.
import { atHandle } from "../data/handles";
// Finding a person is one query shared by every surface that adds one
// (D239) — the create picker here, add-to-a-circle below, and the
// search overlay's people section.
import { usePeopleFinder } from "./peopleSearch";
import PersonRow from "./PersonRow";
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
// The prototype's two accents, kept apart: a circle is a likeness question,
// a 1v1 is a people question, and the option buttons are tinted with
// whichever it is.
const ACC_GROUP = "var(--c-likeness)";
const ACC_DUO = "var(--c-people)";
const ROMANCE = "oklch(0.55 0.13 12)";

/**
 * Whether a stored `streak` is still a claim about the present.
 *
 * The server zeroes a duo's streak when a day settles unrevealed — but only
 * for a group the scan LOOKS at, and the twice-hourly scan queries
 * `pendingDays array-contains day`, which `onV2AnswerCreated` writes. So a
 * duo where NEITHER partner played is never examined and its streak stands
 * untouched, while the pair that missed by half — one partner still
 * playing — is zeroed on the first miss. The more engaged pair lost its
 * run and the abandoned one advertised a live streak indefinitely.
 *
 * The stored number is not wrong for long: `nextStreak` (functions/pure.ts)
 * resets to 1 on any gap, so it self-heals the moment they play again. What
 * needed fixing is the window in between, and the honest fix is here — do
 * not print a run that nothing has confirmed is still running.
 *
 * TWO days of slack, not one. A day is revealed on the day AFTER it was
 * played and the scan runs every two hours, so a perfectly healthy duo
 * reads one or two days back depending on whether this morning's scan has
 * happened yet. One day of slack would blank a live streak every morning.
 */
const dayKeyUTC = (offsetDays = 0): string =>
  new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
// How long ago a browsed reveal actually was.
//
// NOT the dot's position. `revealHistory` COMPACTS: a day with no reveal
// doc — a duo where only one of them played — or one this account may not
// read, because it joined after that day, is ABSENT from the list rather
// than present as a hole. So the third dot is not "three days ago", it is
// the third reveal that exists, and after a single skipped day every label
// behind it is wrong by the size of the gap.
//
// The reveal carries the day it was played, so it can say for itself. The
// index is kept only as the fallback for a reveal with no day key: the
// live `revealFor` entry is minted for yesterday by construction, which is
// exactly what the fallback reports for position 1.
const agoLabel = (key: string | undefined, index: number): string => {
  const at = key ? Date.parse(key + "T00:00:00Z") : NaN;
  const days = Number.isFinite(at)
    ? Math.round((Date.parse(dayKeyUTC(0) + "T00:00:00Z") - at) / 86400000)
    : index;
  if (days <= 0) return "Today";
  return days === 1 ? "Yesterday" : days + " days ago";
};
const streakIsLive = (g: { lastRevealDay?: string }): boolean =>
  typeof g.lastRevealDay === "string" && g.lastRevealDay >= dayKeyUTC(-2);
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
  /** The day the group last revealed. What makes `streak` a claim about NOW
   *  rather than a number that was true once — see streakIsLive below. */
  lastRevealDay?: string;
  memberUids?: string[];
  memberNames?: Record<string, string>;
  // People who asked to join and are waiting on a member (D240). ON the
  // group document, not in a subcollection: members already read this
  // doc, and a subcollection would need a member-gated read rule whose
  // only expression in Firestore is `get()` on the group — one billed
  // read per request listed, which is the tripwire D122 backed out of.
  pending?: string[];
  pendingNames?: Record<string, string>;
}
interface RevealVote { optionIdx: number; guessIdx?: number; qid?: string }
interface LiveReveal extends RevealDocLike {
  day?: string;
  qid?: string;
  votes?: Record<string, RevealVote>;
  names?: Record<string, string>;
}

/**
 * The name this account already has — the profile's, or this device's copy
 * of it while the profile is still hydrating.
 *
 * The screen used to ASK for this, in a field above the circle's name
 * (D156's port of the prototype's create card). D190 took it out: a
 * display name is a fact about the account, it is collected once at the
 * top (LiveProfileSetup) and every screen that needs it reads it from
 * here. The field survives only as the fallback below — see LdOnboard.
 */
function ldName(): string {
  return LIVE.displayName || localName();
}
function errText(e: unknown): string {
  return String((e instanceof Error && e.message) || e);
}

function LdInput({ value, onChange, placeholder, style, onEnter }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  /** Enter submits. A picker you have to reach for a button to use is not one. */
  onEnter?: () => void;
}) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      onKeyDown={onEnter ? (e) => { if (e.key === "Enter") { e.preventDefault(); onEnter(); } } : undefined}
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

// ── who is coming (D236) ─────────────────────────────────────────
//
// A circle used to be created EMPTY and populated afterwards, and that is
// the whole reason a first-run screen could offer nothing but a code: at
// the one moment you knew who you wanted, the app had nowhere to put
// them. So you made a room, then went looking for a way to tell people.
//
// Picking is also what sends the notification. Creating a circle notifies
// nobody — a circle's name reaching people who were not invited is
// precisely the read v2_groups' member gate exists to refuse.
//
// SEARCH IS THE SOURCE, not the follow graph. In live mode that graph
// fills from likeness surfaces (Kindred, voter lists), so it is mostly
// people you have never met — the wrong list to pick friends out of. A
// handle is an address you already know, the way a phone number is.
// Nothing here triggers `LIVE.loadCircle()`: that is one read per follow,
// and paying it for a convenience on the create screen is the kind of
// fan-out this panel is careful about everywhere else.
// The name rides along with the uid because not everybody has a handle
// — a chip for somebody found by name has nothing else to say.
interface LdPick { uid: string; handle: string; name: string }

function LdPicker({ picked, onChange, cap, busy: outerBusy }: {
  picked: LdPick[];
  onChange: (next: LdPick[]) => void;
  cap: number;
  busy?: boolean;
}) {
  const [q, setQ] = React.useState("");
  const full = picked.length >= cap;
  // Already picked are excluded from the results rather than shown and
  // refused — a row you may not tap is a worse answer than no row.
  const { rows, busy, empty, failed } = usePeopleFinder(full ? "" : q, [
    ...picked.map((p) => p.uid),
    LIVE.uid || "",
  ]);

  const add = (uid: string, handle: string, name: string) => {
    onChange([...picked, { uid, handle, name }]);
    setQ("");
  };

  return (
    <div style={col(8)}>
      {picked.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {picked.map((p) => (
            <button key={p.uid} className="press"
              aria-label={`Remove ${p.handle ? atHandle(p.handle) : p.name || "them"}`}
              onClick={() => onChange(picked.filter((x) => x.uid !== p.uid))}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, border: LD_LINE,
                borderRadius: 999, background: "var(--surface-2)", padding: "6px 10px 6px 12px",
                cursor: "pointer", fontFamily: p.handle ? "var(--mono, monospace)" : "var(--sans)",
                fontSize: 12.5, fontWeight: 700, color: "var(--ink)", WebkitAppearance: "none" }}>
              {p.handle ? atHandle(p.handle) : (p.name || "Someone")}
              <span aria-hidden="true" style={{ fontSize: 14, color: "var(--ink-3)" }}>&times;</span>
            </button>
          ))}
        </div>
      )}
      {/* The field goes away at the cap rather than failing on submit —
          for a 1v1 the cap is one, and an open field there would invite
          a second person into a room with one seat. */}
      {!full && (
        <>
          {/* NOT "Name or @handle", which is LdAddByHandle's. Both can be
              on screen at once — the rail ends with this card while every
              circle above it carries that one — and two identically
              labelled fields that add to different circles is the kind of
              ambiguity a person only discovers by inviting the wrong
              person to the wrong room.

              Both take a name or a handle since D239. This one says whose
              circle it is instead of what it accepts, because a row
              appears the moment you type either. */}
          <LdInput value={q} onChange={setQ} placeholder="Who's coming?" />
          {rows.map((r) => (
            <PersonRow key={r.uid} uid={r.uid} name={r.name} handle={r.handle || undefined}
              disabled={outerBusy}
              onClick={() => add(r.uid, r.handle, r.name)} />
          ))}
          {busy && !rows.length && (
            <div role="status" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)" }}>Looking…</div>
          )}
          {/* Deliberately does not distinguish "no such name" from "no
              such handle": to somebody looking a person up those are one
              answer, and saying which would report on what the directory
              holds rather than on who was found. */}
          {empty && !busy && (
            <div role="status" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)" }}>
              Nobody found for “{empty}”.
            </div>
          )}
          {/* A refused or offline read said "Nobody found" — a claim about
              who exists, made when the only thing that happened was that
              we could not ask. */}
          {failed && !busy && (
            <div role="status" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)" }}>
              Couldn’t search just now.
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── first-run: create or join ────────────────────────────────────
function LdOnboard({ mode }: { mode?: string }) {
  const [name, setName] = React.useState("");
  // A tapped invite link lands here: the stashed code prefills the join
  // field (consume = one prefill, not a haunting).
  const [picked, setPicked] = React.useState<LdPick[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const duo = mode === "duo";
  const S = LIVE.social;
  // YOUR NAME IS NOT A QUESTION THIS SCREEN ASKS (D190).
  //
  // It asked for one in a field of its own, above the circle's name, and
  // that was reported from a device as the wrong screen for it: the name
  // is set at sign-in (LiveProfileSetup) and every account that has been
  // through that screen already has one. So the account's name is read,
  // and the field appears ONLY when there is none to read.
  //
  // The backup is not decoration. `profileSetupSeen` is per DEVICE and the
  // setup screen is skippable in one tap, so an account with no name is a
  // state that survives — and a reveal with a blank where a name goes is
  // worse than one more field on a screen somebody chose to open.
  const known = ldName().trim();
  const [typedMe, setTypedMe] = React.useState("");
  const me = known || typedMe.trim();
  // Create, then invite the people already picked — one act on this
  // screen, two calls under it.
  //
  // BEST-EFFORT on the second, and the order is the reason: by the time it
  // runs the circle EXISTS, so a failed invitation must not surface as a
  // failed creation and send somebody back to a screen whose circle was in
  // fact made. It reports for itself instead of throwing into `go`'s catch.
  const create = async () => {
    const out = await S.createGroup(name.trim(), duo ? "duo" : "group", me || undefined);
    const gid = (out as { gid?: string } | undefined)?.gid;
    if (!gid || !picked.length) return out;
    try {
      await S.inviteToGroup(gid, picked.map((p) => p.uid));
    } catch (e) {
      setErr(`Circle made — the invitations did not send. ${errText(e).replace(/^.*?: */, "")}`);
    }
    return out;
  };

  const go = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null);
    // Only the fallback writes: with a known name there is nothing new to
    // save, and re-saving it on every create would be a Firestore write
    // per circle for a string the profile already holds.
    if (!known && me) { try { await LIVE.saveDisplayName(me); } catch { /* the callable takes it too */ } }
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
      {!known && <LdInput value={typedMe} onChange={setTypedMe} placeholder="Your name (what friends see)" />}
      <div style={{ display: "flex", gap: 8 }}>
        <LdInput value={name} onChange={setName} placeholder={duo ? "Name it (e.g. Mira & Leo)" : "Group name"} />
        {/* `me || undefined`, never "": createGroupV2's callerName reads
            the profile when the client sends nothing, and sending an empty
            string would overwrite a name the profile already has. */}
        <LdBtn primary disabled={busy || !name.trim() || !me}
          onClick={() => void go(create)}>Create</LdBtn>
      </div>
      {/* WHO IS COMING (D236) — the half of this screen that used to be a
          code field. Optional: a circle with nobody in it yet is still a
          legitimate thing to make, and the link is how you reach somebody
          who has no account to hold a handle. */}
      <LdPicker picked={picked} onChange={setPicked} cap={duo ? 1 : 31} busy={busy} />
      {/* NO CODE FIELD (D238). D122 demoted it to a fallback behind "Have
          an invite code?" and this is the rest of that move: a tapped
          invite link now lands as LdJoinPending, one button at the top of
          the panel, so nothing is ever read off a screen and typed into
          another one.

          What that gives up, stated: somebody handed a code out of band —
          read aloud, written down — has no way to enter it. That is the
          point rather than the cost. A code was a bearer token with no
          expiry and no rotation that admitted its holder with nobody's
          consent, sitting next to an invitation flow that exists because
          joining a circle puts your name on an answer these people will
          read. Two doors, two rules; this closes the one nobody agreed
          to. */}
      {err && <div style={{ fontSize: 12.5, fontWeight: 600, color: "oklch(0.5 0.19 25)" }}>{err.replace(/^.*?: */, "")}</div>}
    </div>
  );
}

// ── people waiting on this circle (D240) ─────────────────────────
//
// The circle's half of the consent. A tapped link used to admit its
// holder outright; now it puts them here, and a member decides.
//
// Drawn from the GROUP DOCUMENT, which is already live-subscribed
// (hydrateSocial's onSnapshot), so an approval lands on every member's
// screen with no refresh and no extra read.
//
// Declining tells them nothing, on D122's reasoning about declining an
// invitation: a "declined" state makes refusing somebody a message you
// have to send them, which is what makes people approve requests they do
// not want. The row simply stops being there.
function LdPendingRequests({ g }: { g: LiveGroup }) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const pending = g.pending || [];
  const names = g.pendingNames || {};
  if (!pending.length) return null;

  const act = async (uid: string, ok: boolean) => {
    setBusy(uid); setErr(null);
    try {
      if (ok) await LIVE.social.approveJoin(g.id, uid);
      else await LIVE.social.declineJoin(g.id, uid);
    } catch (e) { setErr(errText(e).replace(/^.*?: */, "")); }
    setBusy(null);
  };

  return (
    <div style={col(9)}>
      <span className="kicker" style={{ marginBottom: 0 }}>
        {pending.length === 1 ? "Wants to join" : `${pending.length} want to join`}
      </span>
      {pending.map((uid) => (
        <PersonRow key={uid} uid={uid} name={names[uid] || ""}>
          <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <LdBtn small disabled={busy === uid} onClick={() => void act(uid, false)}>No</LdBtn>
            <LdBtn small primary disabled={busy === uid} onClick={() => void act(uid, true)}>Let in</LdBtn>
          </span>
        </PersonRow>
      ))}
      {err && <div role="status" style={{ fontSize: 12.5, fontWeight: 600, color: "oklch(0.5 0.19 25)" }}>{err}</div>}
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
  const [q, setQ] = React.useState("");
  const [busySend, setBusySend] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);
  // The circle's own members are excluded, so the list never offers
  // somebody the callable would refuse with "already a member".
  const { rows, busy, empty, failed } = usePeopleFinder(q, [
    ...(g.memberUids || []),
    LIVE.uid || "",
  ]);

  const send = async (uid: string, name: string, handle: string) => {
    setBusySend(true); setMsg(null); setOk(false);
    try {
      await LIVE.social.inviteToGroup(g.id, uid);
      setQ("");
      setOk(true);
      const who = handle ? atHandle(handle) : (name || "them");
      // NOT "they will see it next time they open InSight", which is
      // what this said and what D236 falsified — an invitation notifies
      // now. It does not promise the notification either: an account
      // that has never created, joined or accepted has no push token yet
      // (D236 limit 1), so the message keeps the half that is always
      // true — it is sent, and it is theirs to accept.
      setMsg(`Invited ${who} — waiting on them.`);
    } catch (e) {
      const raw = errText(e);
      setMsg(/already-exists/i.test(raw)
        ? "They are already here."
        : raw.replace(/^.*?: */, ""));
    }
    setBusySend(false);
  };

  return (
    <div style={col(8)}>
      {/* NAME OR HANDLE (D239), the same field the create picker uses and
          for the same reason: the two screens add people, and needing to
          remember which one takes a name is the kind of difference a
          person discovers by failing. */}
      <LdInput value={q} onChange={setQ} placeholder="Name or @handle" />
      {rows.map((r) => (
        <PersonRow key={r.uid} uid={r.uid} name={r.name} handle={r.handle || undefined}
          disabled={busySend}
          onClick={() => void send(r.uid, r.name, r.handle)} />
      ))}
      {busy && !rows.length && (
        <div role="status" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)" }}>Looking…</div>
      )}
      {empty && !busy && !msg && (
        <div role="status" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)" }}>
          Nobody found for “{empty}”.
        </div>
      )}
      {failed && !busy && !msg && (
        <div role="status" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)" }}>
          Couldn’t search just now.
        </div>
      )}
      {msg && (
        <div role="status" style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.4,
          color: ok ? "var(--ink-2)" : "oklch(0.5 0.19 25)" }}>
          {msg}
        </div>
      )}
    </div>
  );
}

// The other way in — the one that reaches somebody with no account yet,
// who therefore has no handle to be picked by.
//
// IT SAYS WHAT IT DOES (D238). The button's face used to be the eight
// characters themselves, on the reasoning that a person handed a code
// would be looking for one. That reasoning died with the field that
// received them: it copies a LINK, it has always copied a link, and
// showing a code was the last place in the app that taught people this
// was a code product.
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
      style={{ flexShrink: 0, border: LD_LINE, background: "var(--surface-2)", borderRadius: 999, padding: "6px 13px",
        cursor: "pointer", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 700,
        color: "var(--ink-2)", WebkitAppearance: "none" }}>
      {copied ? "link copied ✓" : "Invite"}
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

// ── a tapped invite link (D238) ──────────────────────────────────
//
// What a link used to do was PREFILL A TEXT FIELD, which meant the app
// had received the invitation and then asked you to confirm it by
// looking at eight characters it already had. This is the same act with
// the typing removed: one button.
//
// It sits at the top of the panel beside LdInvites, not inside LdOnboard
// where the field lived, and that placement is the fix for a second
// thing: LdOnboard renders at the END of the rail for an account that
// already has circles, so a tapped link used to land in a card you had
// to scroll past four circles to reach.
//
// Mode-agnostic on purpose. The code names a circle, not a tab, and
// `joinGroupV2` resolves it either way — so whichever of Circle or 1v1
// you are looking at when the link opens the app, the invitation is
// there. It used to require being on the right tab AND opening a
// disclosure.
function LdJoinPending({ code, onDone }: { code: string; onDone: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ status: string; name: string } | null>(null);

  const ask = async () => {
    setBusy(true); setErr(null);
    try {
      const out = await LIVE.social.requestJoin(code, ldName().trim() || undefined);
      // Already a member: nothing happened and nothing needs saying.
      if (out.status === "member") { onDone(); return; }
      setDone({ status: out.status, name: out.name || "" });
    } catch (e) {
      setErr(errText(e).replace(/^.*?: */, ""));
    }
    setBusy(false);
  };

  if (done) {
    const where = done.name ? ` ${done.name}` : " the circle";
    return (
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 11, padding: "16px 15px" }}>
        <span className="kicker" style={{ marginBottom: 0 }}>
          {done.status === "joined" ? "You're in" : "Asked"}
        </span>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink-2)", lineHeight: 1.45 }}>
          {done.status === "joined"
            // They had already been invited by handle — the circle's
            // consent was on record, so the link completed it rather
            // than opening a second queue behind it.
            ? `You had an invitation to${where}, so you're in.`
            : `Someone in${where} has to let you in.`}
        </div>
        <div><LdBtn small onClick={onDone}>OK</LdBtn></div>
      </div>
    );
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 11, padding: "16px 15px" }}>
      <span className="kicker" style={{ marginBottom: 0 }}>An invitation</span>
      {/* A CLAIM, not a caption (COPY.md §3). What joining does is put
          your name on a sealed answer that these people read the next
          day, and D122 made consent the difference between an invitation
          and a follow. Somebody arriving from a link has been told
          nothing by the app yet, so this is where it gets said. */}
      <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink-2)", lineHeight: 1.45 }}>
        One question a day, sealed until tomorrow, then revealed with names to the people in it.
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {/* ASK, not Join (D240). The link no longer admits its holder —
            a forwarded one puts you forward instead of in, and the
            button says which. */}
        <LdBtn primary disabled={busy} onClick={() => void ask()}>{busy ? "\u2026" : "Ask to join"}</LdBtn>
        <LdBtn small disabled={busy} onClick={onDone}>Not now</LdBtn>
      </div>
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
      {!duo && roomRow()}
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

  // Your call on where the room would land (D381), read against the bars
  // above it: a hit when it named an option that tied for the top. A room
  // of one is you, so a day only you answered draws no row — calling your
  // own vote is not a read. Split days are excluded the way duoRows
  // excludes them: a guess about one prompt read against another's bars.
  function roomRow() {
    if (!mine || typeof mine.guessIdx !== "number" || qidOf(mine) !== rowQid) return null;
    const tally = revealTally(reveal, opts.length);
    const counted = tally.reduce((a, r) => a + r.uids.length, 0);
    if (counted < 2) return null;
    const top = Math.max(...tally.map((r) => r.uids.length));
    const winners = tally.filter((r) => r.uids.length === top).map((r) => r.optionIdx);
    return revealRow("you read the room", winners.includes(mine.guessIdx),
      winners.map((i) => labelIn(opts, i)).join(" · "), labelIn(opts, mine.guessIdx),
      <GroupMark key="room" gid={g.id} name={g.name} size={20} />);
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
  // R2/D270: a reveal on screen is the duel loop's payoff being
  // collected — the one signal rung 0 could never see (the reveal doc is
  // server-written; VIEWING it wrote nothing until now). Mount-scoped:
  // once per bars instance, a no-op unless the live session armed the
  // tally.
  React.useEffect(() => { note("revealSeen"); }, []);
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
              {/* The pill is HIDDEN here and nowhere else (D244). `YouChip`
                  speaks by design — in a reveal bar it is the only marker
                  of your own row, so `aria-hidden` on the component would
                  cost that. This chip is the one place that already prints
                  the word beside it, so unhidden the member list announced
                  "you you". The caller owns the duplication, so the caller
                  hides it. */}
              {u === uid
                ? <span aria-hidden="true" style={{ display: "flex" }}><YouChip size={22} /></span>
                : <DuelAv uid={u} name={names[u]} size={22} />}
              <span style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 12.5, color: "var(--ink)" }}>
                {u === uid ? "you" : (firstName(names[u]) || "Someone")}
              </span>
            </span>
          ))}
        </div>
      </div>

      <LdPendingRequests g={g} />
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
      {past.map((r, i) => ({ n: i + 1, r })).reverse().map(({ n, r }) => {
        const cur = n === day;
        return (
          // Labelled from the reveal's own day, like the card it opens —
          // see `agoLabel`. Kept in step deliberately: a dot that says one
          // thing and a card that says another is worse than both being
          // wrong together, and that is what fixing only one of them gives.
          <button key={n} className="tap44 is-tight" onClick={() => setDay(n)} aria-current={cur ? "true" : undefined}
            aria-label={agoLabel(r.day, n) + " — revealed"}
            style={{ width: 22, height: 22, padding: 0, border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", WebkitAppearance: "none" }}>
            <span style={{ width: cur ? 18 : 6, height: 6, borderRadius: 999,
              background: cur ? tint : `color-mix(in oklch, ${tint} 45%, var(--surface-3))`,
              transition: "width .25s ease, background .2s ease" }} />
          </button>
        );
      })}
      <button className="tap44 is-tight" onClick={() => setDay(0)} aria-current={day === 0 ? "true" : undefined} aria-label="Today"
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
        {(g.streak || 0) > 0 && streakIsLive(g) && <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)" }}>{g.streak}-day run</span>}
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
        <LdReveal g={g} reveal={shown} day={agoLabel(shown.day, day)} />
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
          Add them, or send the link.
        </div>
        <LdPendingRequests g={g} />
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
  } else if (q && pick != null) {
    // the morph: you have answered, now read them — or, in a circle, read
    // the room (D381): the same second tap, asking where most will land
    body = (
      <div style={{ ...col(12), animation: "popIn .3s cubic-bezier(0.2,0.8,0.2,1)" }} key="guess">
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>
          You picked <b>{q.options[pick]}</b>.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {duo
            ? <DuelAv uid={themUid} name={names[themUid]} size={38} />
            : <GroupMark gid={g.id} name={g.name} size={38} />}
          <LdPrompt>{duo ? "And " + themName + " picked…?" : "And the room picked…?"}</LdPrompt>
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
              onClick={() => setPick(i)} />
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
                ? <DuelAv uid={themUid} name={label} size={38} />
                : <GroupMark gid={g.id} name={g.name} size={38} />}
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
  // A tapped invite link, consumed ONCE (D238). Read-and-clear, so it
  // prompts on this visit and does not resurface days later on a circle
  // the person already declined to join — the same contract the field it
  // replaced had, minus the typing.
  const [pendingCode, setPendingCode] = React.useState(() => consumeJoinCode() || "");
  // …and again whenever one ARRIVES, which the initializer alone cannot
  // see. An invite tapped while this screen is already open stashes a code
  // and navigates to the tab the user is already on: nothing remounts, so
  // the read above never runs a second time and the invite is swallowed
  // until something else happens to remount the panel. Read-and-clear is
  // unchanged; only the moment of reading moves.
  React.useEffect(() => subscribeJoinCode(() => {
    const c = consumeJoinCode();
    if (c) setPendingCode(c);
  }), []);

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
        {pendingCode && <LdJoinPending code={pendingCode} onDone={() => setPendingCode("")} />}
        <LdInvites mode={mode} />
        <LdOnboard mode={mode} />
      </div>
    );
  }

  const items = groups.map((g) => {
    const members = g.memberUids || [];
    const themUid = duo ? (members.find((m) => m !== uid) || "") : "";
    // A ROOM THAT CANNOT BE PLAYED OWES YOU NOTHING. `todayQ` hands back a
    // question for any room whatever its membership, so a 1v1 you created
    // and whose partner has not joined counted toward "N to play" and got
    // a "still to play" dot on the rail — for ever — while the card
    // directly beneath it renders "Waiting for someone" with no options at
    // all. Same condition the card uses (`duo && members.length < 2`), so
    // the two cannot disagree.
    //
    // The prototype this was ported from had it: `duo-daily.jsx` computes
    // `pending = !invited && isPending(p)` and filters the count the same
    // way. The port kept the second half and dropped the first.
    const unplayable = duo && members.length < 2;
    return {
      g,
      pending: !unplayable && S.myDuelVote(g.id) == null && !!S.todayQ(g.id),
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
      {pendingCode && <LdJoinPending code={pendingCode} onDone={() => setPendingCode("")} />}
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
