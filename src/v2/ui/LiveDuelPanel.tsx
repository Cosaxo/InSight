// LiveDuelPanel — the LIVE group/duo panel. Replaces the demo
// GroupDailyBody / DuoBody when LIVE is enabled: real circles with
// server-minted invite codes, the open ROUND's question from the shared
// deterministic rotation (ROUNDS-PLAN, D420), sealed votes, and the latest
// round's materialized reveal. With no circles yet, the panel IS the
// create-or-join flow.
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
//     once and gating a button on the pair. Since D386 a GROUP card
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
import { revealTally, type RevealDocLike } from "../data/duelRuns";
import { DuelAv, GroupMark, YouChip } from "./duelMarks";
import { firstName, markHue } from "./marks";
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
 * `roundDeadlineAt <= now`, whose clock `onV2AnswerCreated` starts. So a
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
// The open round's deadline, off the group document (a Firestore
// Timestamp on the client, a number in fixtures), as millis — or null while
// nobody has played the open round and there is no clock yet.
const deadlineMs = (raw: unknown): number | null => {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (raw && typeof (raw as { toMillis?: unknown }).toMillis === "function") {
    const ms = (raw as { toMillis: () => number }).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
};
const GOOD = "var(--c-likeness)";
const MISS = "var(--ochre)";

const col = (g: number): React.CSSProperties => ({ display: "flex", flexDirection: "column", gap: g });

// The store keeps groups/reveals loosely typed at the seam; these are
// the fields this panel actually renders.
interface LiveGroup {
  /** Rounds (ROUNDS-PLAN, D420): the open round, and its clock when the
   *  open round has an answer in it. A Firestore Timestamp on the client;
   *  a number in fixtures. */
  round?: number;
  roundDeadlineAt?: unknown;
  /** Who has sealed which round, `{ r7: [uid] }` — who has answered and
   *  never what (ROUNDS-PLAN §2.4). The card's "who has played" halos and
   *  its "N rounds waiting for you" band read it. */
  played?: Record<string, string[]>;
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
interface RevealVote { optionIdx: number; guessIdx?: number; qid?: string; late?: boolean }
interface LiveReveal extends RevealDocLike {
  day?: string;
  qid?: string;
  votes?: Record<string, RevealVote>;
  names?: Record<string, string>;
  /** Who the reveal records as there — the seats, against the votes. */
  members?: string[];
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
          ? "Answer blind, guess theirs. It reveals the moment you both have — then the next one."
          : "Everyone answers blind. It reveals with names when everyone has played, or at the deadline."}
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
    <button onClick={copy} aria-label="Copy invite link" title="Copy invite link"
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

  // The design's hero (request 11, state 9): the invitation leads, with
  // the inviter's mark beside the seat that is yours, and one line on what
  // playing is. Accept is the pill; Decline is a word — refusing somebody
  // should not look like a button you pressed by accident.
  const acc = want === "duo" ? ACC_DUO : ACC_GROUP;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "4px 0 18px", borderBottom: "0.5px solid var(--rule)", marginBottom: 14 }}>
      {list.map((inv) => (
        <div key={inv.gid} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: acc }}>Invitation</span>
          <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-0.015em", lineHeight: 1.25, textWrap: "pretty" }}>{inviteLine(inv)}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ display: "flex", gap: 4 }}>
              <DuelAv uid={inv.from} name={inv.fromName} size={26} />
              <span aria-label="open seat" style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, boxSizing: "border-box", border: `1.5px dashed color-mix(in oklch, ${acc} 72%, transparent)` }} />
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.45 }}>
              {want === "duo" ? `answer, then guess ${firstName(inv.fromName) || "their"}${firstName(inv.fromName) ? "’s" : ""}` : "everyone answers blind, then calls the room"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="press" onClick={() => void act(inv.gid, true)} disabled={busy === inv.gid}
              style={{ minHeight: 44, padding: "10px 20px", border: "none", borderRadius: 999, background: acc, color: "#fff", font: "inherit", fontWeight: 800, fontSize: 14.5, letterSpacing: "-0.01em", cursor: "pointer", WebkitAppearance: "none", opacity: busy === inv.gid ? 0.5 : 1 }}>Accept</button>
            <button className="press" onClick={() => void act(inv.gid, false)} disabled={busy === inv.gid}
              style={{ minHeight: 44, padding: "8px 10px", border: "none", background: "none", color: "var(--ink-2)", font: "inherit", fontWeight: 700, fontSize: 13.5, cursor: "pointer", WebkitAppearance: "none", opacity: busy === inv.gid ? 0.5 : 1 }}>Decline</button>
          </div>
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
        Everyone answers blind, and each round is revealed with names to the people in it.
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

// ── the design's grammar (design/rounds-card-2026-09-08, request 11) ──
//
// Nine states over one card, and the vocabulary they share: a KICKER
// (12/700 uppercase, ink-3) that names the round — `Round 9`, `· World`,
// `· revealed`, `· closed at the deadline` — the prompt in the serif, the
// answer as tinted 56px options, people as marks and you as a pill, and
// the RUN at the foot: one dot per round, filled when your call landed,
// hollow when it missed, with a tail carrying the rounds still in play
// (sealed · open · late). No clock on a 1v1 anywhere; a group's one clock
// is its round deadline, drawn coarse (`1d 16h`), because the reveal
// waits on people and not on the minute.
const KICK: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase",
  color: "var(--ink-3)", whiteSpace: "nowrap",
};
const WORLD = "var(--c-world)";
const GROUND = "var(--surface-a, var(--surface))";
const serif = (size: number): React.CSSProperties => ({
  fontFamily: "var(--serif)", fontWeight: 500, fontSize: size, lineHeight: 1.14,
  letterSpacing: "-0.01em", color: "var(--ink)", textWrap: "balance",
});
const NUMWORD = ["", "One", "Two", "Three", "Four", "Five"];
const roundsWord = (n: number): string => `${NUMWORD[n] || String(n)} ${n === 1 ? "round" : "rounds"}`;
// An open seat: somebody the room expected who has not answered. A dashed
// ring and never a name — an empty seat is a seat (D1).
function OpenSeat({ size = 26 }: { size?: number }) {
  return (
    <span aria-label="open seat" style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, boxSizing: "border-box",
      border: "1.5px dashed color-mix(in oklch, var(--accent) 72%, transparent)" }} />
  );
}
// A person's mark with the design's halo when they have played — the fill
// of their own mark, at 42%, ringed on the ground.
function HaloAv({ uid, name, size, on }: { uid: string; name?: string; size: number; on: boolean }) {
  const fill = `oklch(0.52 0.13 ${markHue(uid)})`;
  return (
    <span style={{ display: "inline-flex", borderRadius: "50%",
      boxShadow: on ? `0 0 0 1.5px ${GROUND}, 0 0 0 3.5px color-mix(in oklch, ${fill} 42%, ${GROUND})` : `0 0 0 1.5px ${GROUND}` }}>
      <DuelAv uid={uid} name={name} size={size} title={(name || "Someone") + (on ? " — played" : " — not yet")} />
    </span>
  );
}
// The design's coarse clock: `1d 16h`, `3h 04m`, `12m`. Date.now() lives in
// a helper rather than the render body (react-hooks/purity, the same move
// reveal-clock.js made), and the tick is a minute — a second hand would
// claim a precision the deadline does not have.
const msLeft = (until: number): number => until - Date.now();
function leftText(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(mm).padStart(2, "0")}m`;
  return `${mm}m`;
}
function useLeft(until: number | null): string | null {
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    if (until == null) return;
    const id = setInterval(() => tick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [until]);
  return until == null ? null : leftText(msLeft(until));
}

// ── the run of rounds ────────────────────────────────────────────
//
// The dots ARE the score, and since request 11 they are also the browser:
// a revealed round's dot opens that reveal above. Five kinds from the
// design plus one — `n`, a round you played that carried no call to score
// (a world round whose guess was a lookup, a reveal from before rounds).
type DotKind = 1 | 0 | "s" | "o" | "l" | "n";
const DOT_TITLE: Record<string, string> = {
  "1": "called it", "0": "missed", s: "sealed · waiting on the others",
  o: "open · waiting for you", l: "late · no score", n: "played · no call",
};
function dotStyle(k: DotKind, color: string, acc: string): React.CSSProperties {
  const s: React.CSSProperties = { width: 13, height: 13, flexShrink: 0, borderRadius: "50%", boxSizing: "border-box", display: "block" };
  if (k === 1) s.background = color;
  else if (k === 0) s.border = `1.5px solid color-mix(in oklch, ${color} 55%, transparent)`;
  else if (k === "s") { s.background = acc; s.boxShadow = `inset 0 0 0 2px ${GROUND}, inset 0 0 0 3.5px ${acc}`; }
  else if (k === "o") s.border = "1.5px dashed color-mix(in oklch, var(--ink-3) 75%, transparent)";
  else if (k === "l") s.border = "1.5px dotted var(--ink-3)";
  else s.border = "1.5px solid color-mix(in oklch, var(--ink-3) 55%, transparent)";
  return s;
}
interface RunDot { k: DotKind; aria: string; at?: number }
interface RunRow { label: string; aria: string; color: string; dots: RunDot[] }
function LdRun({ rows, acc, onPick }: { rows: RunRow[]; acc: string; onPick: (at: number) => void }) {
  if (!rows.length || !rows[0].dots.length) return null;
  return (
    <div style={{ ...col(8), borderTop: LD_HAIR, paddingTop: 13 }}>
      {rows.map((r, ri) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 11 }} aria-label={r.aria}>
          <span style={{ flexShrink: 0, width: 62, padding: "3px 0", fontWeight: 800, fontSize: 12.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
          <span className="h-scroll" style={{ display: "flex", gap: 3, alignItems: "center", overflowX: "auto", minWidth: 0 }}>
            {r.dots.map((d, i) => ((ri === 0 && d.at != null)
              ? (
                <button key={i} className="tap44 is-tight" aria-label={d.aria} title={d.aria} onClick={() => onPick(d.at as number)}
                  style={{ border: "none", background: "none", padding: 0, cursor: "pointer", display: "flex", WebkitAppearance: "none" }}>
                  <span style={dotStyle(d.k, r.color, acc)} />
                </button>
              )
              : <span key={i} title={d.aria} style={dotStyle(d.k, r.color, acc)} />))}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── a round's reveal ─────────────────────────────────────────────
//
// One document, four shapes (request 11): a 1v1's SAID · CALLED table, a
// group's split with faces on the bars, and for a world round the three
// columns — you, them, the World's share — on either. Under them, who
// played and who did not (a seat, never a name), the verdict and the
// calls, a late answer said plainly, the door to one, and the takes.
function LdReveal({ g, reveal, browsed }: { g: LiveGroup; reveal: LiveReveal; browsed?: string | null }) {
  // "" rather than null: this component INDEXES the vote map by it, and an
  // anonymous session has no uid. An empty key matches nobody, which is the
  // right answer — nothing on the reveal is yours.
  const uid = LIVE.uid || "";
  const names = { ...(g.memberNames || {}), ...(reveal.names || {}) };
  const votes = (reveal.votes || {}) as Record<string, RevealVote>;
  const rowQid = reveal.qid || null;
  const bankQ = reveal.qid ? LIVE.social.bankQ(reveal.qid) : null;
  const world = !!bankQ && (bankQ as { kind?: string }).kind === "world";
  const duo = g.mode === "duo";
  const tint = duo ? ACC_DUO : ACC_GROUP;
  // A world round's crowd is fetched on the reveal that draws it — one
  // read per question per session, and none on a room's own question
  // (ROUNDS-PLAN §0a). `LIVE` is a module binding, so the dependency list
  // is complete as written.
  React.useEffect(() => {
    if (world && rowQid) LIVE.social.ensureWorldSplit(rowQid);
  }, [world, rowQid]);
  const optsFor = (q: { options?: string[] } | null): string[] =>
    (q && q.options && q.options.length)
      ? q.options
      : (g.memberUids || []).map((u, i) => names[u] || "Member " + (i + 1));
  const opts = optsFor(bankQ);
  const labelIn = (list: string[], idx: number) =>
    (list[idx] != null ? list[idx] : "Option " + (idx + 1));
  const who = (u: string) => (u === uid ? "you" : (names[u] || "Someone"));
  const qidOf = (v: RevealVote) => (typeof v.qid === "string" && v.qid ? v.qid : rowQid);
  const onQ = (u: string) => !!votes[u] && qidOf(votes[u]) === rowQid;
  const offQuestion = Object.keys(votes).filter((u) => !onQ(u) && !votes[u].late);
  const mine = votes[uid];
  const themUid = duo ? ((g.memberUids || []).find((m) => m !== uid) || "") : "";
  const theirs = themUid ? votes[themUid] : undefined;
  const themName = firstName(names[themUid]) || "them";
  // Who the reveal says was there (its `members`, the room's roster before
  // it), against who answered: the difference is the open seats.
  const roster: string[] = (Array.isArray(reveal.members) && reveal.members.length
    ? (reveal.members as string[]) : (g.memberUids || []));
  const openSeats = roster.filter((u) => !votes[u]);
  const round = typeof reveal.round === "number" ? reveal.round : null;
  const myLate = !!mine && !!mine.late;
  const lateOthers = Object.keys(votes).filter((u) => votes[u].late && u !== uid);
  const closed = openSeats.length > 0 && !myLate;

  // The 1v1's two calls, comparable only on one shared question and only
  // when both were blind — across a split, or beside a late answer, a
  // "called it" would be a coincidence, not a read (D71, ROUNDS-PLAN §4).
  const comparable = !!mine && !!theirs && qidOf(mine) === qidOf(theirs) && !mine.late && !theirs.late
    && typeof mine.guessIdx === "number" && typeof theirs.guessIdx === "number";
  const iCalled = comparable && (mine as RevealVote).guessIdx === (theirs as RevealVote).optionIdx;
  const theyCalled = comparable && (theirs as RevealVote).guessIdx === (mine as RevealVote).optionIdx;

  // The room's verdict (D386): the option(s) most of the room landed on,
  // read against your call — a room of one is you, so it needs two.
  const tally = revealTally(reveal, opts.length);
  const counted = tally.reduce((a, r) => a + r.uids.length, 0);
  const top = tally.length ? Math.max(...tally.map((r) => r.uids.length)) : 0;
  const winners = tally.filter((r) => r.uids.length === top).map((r) => r.optionIdx);
  const myCall = mine && !mine.late && onQ(uid) && typeof mine.guessIdx === "number" ? mine.guessIdx : null;
  const roomHit = myCall != null && counted >= 2 && winners.includes(myCall);

  // …and the door to a late answer: a member with no vote in this reveal
  // may still answer it, marked, as long as the round is inside the lead
  // behind the open one — the rules' own window (`voteLate`, data/live.ts).
  const R = LIVE.social.roundInfo(g.id);
  const mayAnswerLate = !mine && !!uid && (g.memberUids || []).includes(uid)
    && R != null && round != null && round < R.open && round >= R.open - R.lead;
  const [lateBusy, setLateBusy] = React.useState(false);
  const [lateErr, setLateErr] = React.useState<string | null>(null);
  const answerLate = async (i: number) => {
    if (lateBusy || round == null) return;
    setLateBusy(true); setLateErr(null);
    try { await LIVE.social.voteLate(g.id, round, i); }
    catch { setLateErr("That didn’t save — check your connection."); }
    setLateBusy(false);
  };

  const head = round != null ? `Round ${round}` : (reveal.day ? agoLabel(reveal.day, 1) : null);
  const post = (closed ? "closed at the deadline" : "revealed") + (round != null && browsed ? ` · ${browsed}` : "");
  const good = GOOD;

  return (
    <div data-testid="ld-reveal" style={col(10)}>
      <div style={{ display: "flex", gap: 5, alignItems: "baseline", flexWrap: "wrap" }}>
        {head && <span style={KICK}>{head}</span>}
        {world && <span style={{ ...KICK, color: WORLD }}>· World</span>}
        <span style={KICK}>{head ? "· " : ""}{post}</span>
      </div>
      {bankQ && <div style={{ fontWeight: 700, fontSize: 17, lineHeight: 1.25, letterSpacing: "-0.01em", textWrap: "pretty" }}>{bankQ.prompt}</div>}
      {world ? worldCols() : (duo ? duoTable() : (
        <LdRevealBars reveal={reveal} opts={opts} names={names} uid={uid} tint={tint} />
      ))}
      {openSeats.length > 0 && seats()}
      {line()}
      {myLate && (
        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.45, color: "var(--ink-2)", textWrap: "pretty" }}>
          Answered after the reveal. It shows, and scores nothing.
        </div>
      )}
      {lateOthers.length > 0 && (
        <div style={{ borderTop: LD_HAIR, paddingTop: 8, ...col(4) }} aria-label="Answered after the reveal">
          <div style={{ fontSize: 11.5, fontWeight: 800, color: "var(--ink-3)" }}>Answered after the reveal</div>
          {lateOthers.map((u) => (
            <div key={u} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
              <DuelAv uid={u} name={names[u]} size={20} />
              <span style={{ fontWeight: 700 }}>{labelIn(optsFor(qidOf(votes[u]) === rowQid ? bankQ : (LIVE.social.bankQ(qidOf(votes[u]) as string) as { options?: string[] } | null)), votes[u].optionIdx)}</span>
              <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)" }}>late</span>
            </div>
          ))}
        </div>
      )}
      {mayAnswerLate && (
        <div style={{ borderTop: LD_HAIR, paddingTop: 10, ...col(8) }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", textWrap: "pretty" }}>
            You didn’t play this one. You can still answer — it shows here, marked late, and doesn’t count toward a read.
          </div>
          <div style={col(6)}>
            {opts.map((o, i) => (
              <LdOption key={i} label={o} tint={tint} disabled={lateBusy} onClick={() => void answerLate(i)} />
            ))}
          </div>
          {lateErr && <div role="status" style={{ fontSize: 12.5, fontWeight: 600, color: "oklch(0.5 0.19 25)" }}>{lateErr}</div>}
        </div>
      )}
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
          is sealed until the reveal, and free text beside a sealed answer is
          the leak the seal exists to prevent — "obviously B" under a
          question nobody has answered yet is the vote, in prose. Once names
          are on the answers there is nothing left to give away, which is
          also the only moment a room has anything to discuss.

          rowQid rather than a member's own qid: a split round (D71) asks
          different people different things, and one shared comment thread
          has to belong to one question. The panel renders nothing when the
          reveal carries no qid. */}
      {rowQid && (
        <div style={{ borderTop: LD_LINE, paddingTop: 10 }}>
          <React.Suspense fallback={null}>
            <LiveTakesPanel gid={g.id} qid={rowQid} />
          </React.Suspense>
        </div>
      )}
    </div>
  );

  // The 1v1's table: what each of you SAID, and what each CALLED about the
  // other — a ✓ before the call that landed. Only votes on this question
  // and only blind ones; a split or a late answer is explained below.
  function duoTable() {
    const rows = [uid, themUid].filter((u) => u && onQ(u) && !votes[u].late);
    if (!rows.length) return null;
    const cell = (u: string) => {
      const v = votes[u];
      const hit = u === uid ? iCalled : theyCalled;
      const call = typeof v.guessIdx === "number" ? labelIn(opts, v.guessIdx) : null;
      return (
        <div key={u} style={{ display: "grid", gridTemplateColumns: "72px 1fr 1fr", gap: 10, alignItems: "center", padding: "10px 0", borderTop: LD_HAIR }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            {u === uid ? <YouChip size={22} /> : (
              <>
                <DuelAv uid={u} name={names[u]} size={26} />
                <span style={{ fontWeight: 800, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{firstName(names[u]) || "Someone"}</span>
              </>
            )}
          </span>
          <span style={{ fontWeight: 700, fontSize: 14, textWrap: "pretty" }}>{labelIn(opts, v.optionIdx)}</span>
          <span style={{ fontWeight: 800, fontSize: 14, textWrap: "pretty", color: comparable ? (hit ? good : MISS) : "var(--ink-3)" }}>
            {call == null ? "—" : (comparable && hit ? <><span aria-label="called it">✓</span> {call}</> : call)}
          </span>
        </div>
      );
    };
    return (
      <div style={col(0)}>
        <div style={{ display: "grid", gridTemplateColumns: "72px 1fr 1fr", gap: 10, padding: "0 0 6px" }}>
          <span />
          <span style={KICK}>said</span>
          <span style={KICK}>called</span>
        </div>
        {rows.map(cell)}
      </div>
    );
  }

  // A world round's three columns (ROUNDS-PLAN §6.2): you, them, and the
  // World's share of every option — the crowd from the aggregate the feed
  // holds, fetched once per question when it does not.
  function worldCols() {
    const split = rowQid ? LIVE.social.worldSplit(rowQid) : null;
    const themLabel = duo ? themName : (g.name || "The room");
    const themW = duo ? "44px" : "minmax(44px, 92px)";
    const cols = `minmax(0,1fr) 44px ${themW} 64px`;
    return (
      <div style={col(0)} aria-label="The world's split">
        <div style={{ display: "grid", gridTemplateColumns: cols, gap: 8, alignItems: "baseline", padding: "0 0 6px" }}>
          <span />
          <span style={KICK}>you</span>
          <span style={{ ...KICK, overflow: "hidden", textOverflow: "ellipsis" }}>{themLabel}</span>
          <span style={{ ...KICK, color: WORLD }}>World</span>
        </div>
        {opts.map((o, i) => {
          const chose = Object.keys(votes).filter((u) => u !== uid && onQ(u) && votes[u].optionIdx === i);
          const meHere = !!mine && onQ(uid) && mine.optionIdx === i;
          const pct = split && split.total > 0 ? Math.round(((split.counts[i] || 0) / split.total) * 100) : null;
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: cols, gap: 8, alignItems: "center", padding: "10px 0", borderTop: LD_HAIR }}>
              <span style={{ fontWeight: 700, fontSize: 14, textWrap: "pretty" }}>{o}</span>
              <span style={{ display: "flex", alignItems: "center", minHeight: 26 }}>{meHere && <YouChip size={22} />}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 3, minHeight: 26, flexWrap: "wrap" }}>
                {chose.map((u) => <DuelAv key={u} uid={u} name={names[u]} size={26} />)}
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontWeight: 800, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{pct == null ? "—" : `${pct}%`}</span>
                <span style={{ height: 4, borderRadius: 999, background: `color-mix(in oklch, ${WORLD} 18%, transparent)`, overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${pct ?? 0}%`, borderRadius: 999, background: WORLD }} />
                </span>
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // Who played, and who did not: marks for the people with an answer, your
  // pill (marked late when it was), and a dashed ring per member the reveal
  // recorded as there who never answered. Drawn only when a seat is open.
  function seats() {
    const played = roster.filter((u) => u !== uid && !!votes[u]);
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", paddingTop: 2 }} aria-label="Who played">
        {played.map((u) => <HaloAv key={u} uid={u} name={names[u]} size={30} on={false} />)}
        {mine && (myLate
          ? <span style={{ height: 30, padding: "0 10px", borderRadius: 999, display: "inline-flex", alignItems: "center", fontWeight: 800, fontSize: 12, color: "var(--surface)", background: "var(--ink)", whiteSpace: "nowrap" }}>you · late</span>
          : <YouChip size={30} />)}
        {openSeats.map((u) => <OpenSeat key={u} size={30} />)}
      </div>
    );
  }

  // The verdict and the calls, on one line. A group: where the room landed,
  // and whether you called it. A world round in a 1v1: your call and
  // theirs, since the table above carries no CALLED column there.
  function line() {
    const parts: React.ReactNode[] = [];
    if (!duo && counted >= 2 && winners.length) {
      parts.push(<span key="v">{"The room landed on " + winners.map((i) => labelIn(opts, i)).join(" · ")}</span>);
      if (myCall != null) {
        parts.push(roomHit
          ? <span key="c" style={{ fontWeight: 800, color: good }}><span aria-label="called it">✓</span> you called it</span>
          : <span key="c" style={{ fontWeight: 800, color: MISS }}>{"you called " + labelIn(opts, myCall)}</span>);
      }
    }
    if (duo && world && comparable) {
      parts.push(iCalled
        ? <span key="m" style={{ fontWeight: 800, color: good }}><span aria-label="called it">✓</span> you called it</span>
        : <span key="m" style={{ fontWeight: 800, color: MISS }}>{"you called " + labelIn(opts, (mine as RevealVote).guessIdx as number)}</span>);
      parts.push(theyCalled
        ? <span key="t" style={{ fontWeight: 800, color: good }}><span aria-label="called it">✓</span> {themName} called it</span>
        : <span key="t" style={{ fontWeight: 800, color: MISS }}>{`${themName} guessed ${labelIn(opts, (theirs as RevealVote).guessIdx as number)}`}</span>);
    }
    if (!parts.length) return null;
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", alignItems: "baseline", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>
        {parts}
      </div>
    );
  }
}

// One bar per option anybody chose: the share carries the fill, the faces
// sit on the right, and your own row wears the accent border. A late
// answer sits on its option too — marked, since it was not blind — and
// stays out of the tally the verdict is read against (revealTally).
function LdRevealBars({ reveal, opts, names, uid, tint }: {
  reveal: LiveReveal; opts: string[]; names: Record<string, string>; uid: string; tint: string;
}) {
  // R2/D270: a reveal on screen is the duel loop's payoff being
  // collected — the one signal rung 0 could never see (the reveal doc is
  // server-written; VIEWING it wrote nothing until now). Mount-scoped:
  // once per bars instance, a no-op unless the live session armed the
  // tally.
  React.useEffect(() => { note("revealSeen"); }, []);
  const votes = (reveal.votes || {}) as Record<string, RevealVote>;
  const rowQid = reveal.qid || "";
  const rows = revealTally(reveal, opts.length);
  const late = Object.keys(votes).filter((u) => votes[u].late
    && (typeof votes[u].qid !== "string" || !votes[u].qid || votes[u].qid === rowQid));
  const byOpt = new Map<number, { uids: string[]; late: string[] }>();
  for (const r of rows) byOpt.set(r.optionIdx, { uids: r.uids, late: [] });
  for (const u of late) {
    const i = votes[u].optionIdx;
    const row = byOpt.get(i) || { uids: [], late: [] };
    row.late.push(u);
    byOpt.set(i, row);
  }
  const order = [...byOpt.keys()].sort((a, b) => a - b);
  const total = order.reduce((a, i) => a + (byOpt.get(i) as { uids: string[]; late: string[] }).uids.length
    + (byOpt.get(i) as { uids: string[]; late: string[] }).late.length, 0) || 1;
  const mine = votes[uid];
  return (
    <div style={col(8)}>
      {order.map((i) => {
        const row = byOpt.get(i) as { uids: string[]; late: string[] };
        const isMine = !!mine && mine.optionIdx === i && (row.uids.includes(uid) || row.late.includes(uid));
        return (
          <div key={i} style={{
            position: "relative", overflow: "hidden", borderRadius: 14,
            border: isMine ? `1.5px solid color-mix(in oklch, ${tint} 55%, transparent)` : LD_LINE,
            background: "var(--surface-2)", boxShadow: "none",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0,
              width: ((row.uids.length + row.late.length) / total) * 100 + "%",
              background: `color-mix(in oklch, ${tint} 13%, transparent)` }} />
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", minHeight: 44, boxSizing: "border-box" }}>
              <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 13.5 }}>
                {opts[i] != null ? opts[i] : "Option " + (i + 1)}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {row.uids.filter((u) => u !== uid).map((u) => (
                  <DuelAv key={u} uid={u} name={names[u]} size={26} />
                ))}
                {row.late.filter((u) => u !== uid).map((u) => (
                  <DuelAv key={u} uid={u} name={names[u]} size={26} title={(names[u] || "Someone") + " · late"} />
                ))}
                {isMine && (row.late.includes(uid)
                  ? <span style={{ height: 26, padding: "0 9px", borderRadius: 999, display: "inline-flex", alignItems: "center", fontWeight: 800, fontSize: 12, color: "var(--surface)", background: "var(--ink)", whiteSpace: "nowrap", boxShadow: "0 0 0 1.5px var(--surface-2)" }}>you · late</span>
                  : <YouChip size={26} />)}
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
          Pool is locked while an answer of yours is sealed.
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
          Or send a link — they sign in when they open it.
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

// ── one room's card — fills the view, snaps into place ───────────
//
// Request 11's nine states, over the documents the card already holds:
// the group document (`round`, `played`, `roundDeadlineAt`), the latest
// reveal, and the history behind it. No new read. Which state draws is a
// function of three facts — whether you have sealed the open round,
// whether a next round is yours to answer, and whether a reveal stands —
// and the design's grammar for each is named beside it.
function LdCard({ g, vh, newest }: { g: LiveGroup; vh: number; newest: boolean }) {
  const S = LIVE.social;
  const uid = LIVE.uid || "";
  const duo = g.mode === "duo";
  // ROUNDS (ROUNDS-PLAN, D420). `q` is the NEXT round this account may
  // answer — the lowest unsealed one inside the lead — or null at the
  // lead's edge; `mine` is its answer to the OPEN round; `R.sealed` the
  // rounds it has sealed that have not revealed. A card is asked for the
  // next round the moment the last one is sealed: that is the volley.
  const q = S.todayQ(g.id);
  const mine = S.myDuelVote(g.id);
  const R = S.roundInfo(g.id) || { open: 1, next: 1 as number | null, sealed: [] as number[], lead: 5 };
  const atLead = q == null && R.sealed.length > 0;
  const deadline = deadlineMs(g.roundDeadlineAt);
  const left = useLeft(!duo && newest ? deadline : null);
  const reveal = S.revealFor(g.id) as LiveReveal | null;
  const members = g.memberUids || [];
  const names = g.memberNames || {};
  const themUid = duo ? (members.find((m) => m !== uid) || "") : "";
  const themName = firstName(names[themUid]) || "them";
  const romantic = g.duoMode === "romantic";
  const tint = duo ? (romantic ? ROMANCE : ACC_DUO) : ACC_GROUP;
  const openQ = S.roundQ(g.id, R.open) as { prompt: string; options: string[]; kind?: string } | null;

  const [menu, setMenu] = React.useState(false);
  // The answer, held locally between the two taps. A duo answers, then
  // guesses — the prototype's morph — but the WRITE is still one create
  // (D5: answers are create-only), so the pick waits here until the guess
  // lands and both go up together.
  const [pick, setPick] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [voteErr, setVoteErr] = React.useState<string | null>(null);
  // Browsing the run. `revealFor` is the latest, live-subscribed and free;
  // anything older is one ordered query per room, so it arrives on the tap
  // that asks for it rather than on the daily tab's first paint.
  const [at, setAt] = React.useState(0);
  const [histAsked, setHistAsked] = React.useState(false);
  const hist = (S.revealHistory(g.id) as LiveReveal[]) || [];
  const past = hist.length ? hist : (reveal ? [reveal] : []);
  const shown: LiveReveal | null = at === 0 ? null : (past[at - 1] || null);

  // A WORLD question as the round (ROUNDS-PLAN §6.2). In a 1v1 the guess
  // is asked only when it is a read: if the partner has already answered
  // this question in public, a guess would be a lookup, so the pick seals
  // on its own and the card says why. A group's world round takes no call
  // on the room at all — a room of public answers is a lookup too. The
  // partner's public answers are one capped query per pair per session.
  const world = !!q && q.kind === "world";
  React.useEffect(() => {
    if (world && duo) void S.loadPartnerAnswers(g.id);
  }, [world, duo, g.id]); // eslint-disable-line react-hooks/exhaustive-deps -- S is a module-level singleton
  const partnerKnown = world && duo && q ? S.partnerAnswer(g.id, q.id) : null;
  const guessless = world && (!duo || partnerKnown != null);
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

  // Rounds WAITING for you: inside the lead, sealed by somebody else and
  // not by you — off `played` on the group document, which says who has
  // answered and never what. Said once, in the band, when more than one.
  const playedMap = (g.played || {}) as Record<string, string[]>;
  let waiting = 0;
  for (let n = R.open; n < R.open + R.lead; n++) {
    const who = Array.isArray(playedMap[`r${n}`]) ? playedMap[`r${n}`] : [];
    if (who.some((u) => u !== uid) && !who.includes(uid)) waiting++;
  }
  const openPlayers = Array.isArray(playedMap[`r${R.open}`]) ? playedMap[`r${R.open}`] : [];

  // ── the run ──
  // One dot per reveal you played, oldest left, then the tail: a sealed
  // ring per round waiting on the others, a dashed seat per round waiting
  // on you. The first row's revealed dots open that reveal.
  const tail: DotKind[] = [
    ...R.sealed.map(() => "s" as DotKind),
    ...Array<DotKind>(Math.max(q ? 1 : 0, waiting)).fill("o"),
  ];
  const youDots: RunDot[] = [];
  const themDots: RunDot[] = [];
  past.map((r, i) => ({ r, i })).reverse().forEach(({ r, i }) => {
    const votes = (r.votes || {}) as Record<string, RevealVote>;
    const v = votes[uid];
    if (!v) return;
    const rn = typeof r.round === "number" ? `Round ${r.round}` : agoLabel(r.day, i + 1);
    const when = typeof r.round === "number" && r.day ? ` · ${agoLabel(r.day, i + 1)}` : "";
    const aria = (k: DotKind) => `${rn}${when} — ${DOT_TITLE[String(k)]}`;
    const rowQid = r.qid || "";
    const qOf = (x: RevealVote) => (typeof x.qid === "string" && x.qid ? x.qid : rowQid);
    let me: DotKind = "n";
    let them: DotKind = "n";
    if (v.late) me = "l";
    else if (duo) {
      const t = themUid ? votes[themUid] : undefined;
      const comparable = !!t && !t.late && qOf(v) === qOf(t)
        && typeof v.guessIdx === "number" && typeof t.guessIdx === "number";
      if (comparable) {
        me = v.guessIdx === (t as RevealVote).optionIdx ? 1 : 0;
        them = (t as RevealVote).guessIdx === v.optionIdx ? 1 : 0;
      }
    } else if (typeof v.guessIdx === "number" && qOf(v) === rowQid) {
      const bq = rowQid ? S.bankQ(rowQid) : null;
      const tally = revealTally(r, bq && Array.isArray(bq.options) ? bq.options.length : 0);
      const counted = tally.reduce((a, x) => a + x.uids.length, 0);
      if (counted >= 2) {
        const top = Math.max(...tally.map((x) => x.uids.length));
        me = tally.filter((x) => x.uids.length === top).some((x) => x.optionIdx === v.guessIdx) ? 1 : 0;
      }
    }
    youDots.push({ k: me, aria: aria(me), at: i + 1 });
    themDots.push({ k: them, aria: aria(them) });
  });
  const tailDots = tail.map((k) => ({ k, aria: DOT_TITLE[String(k)] }));
  const runRows: RunRow[] = [
    { label: "you", aria: duo ? `How well you read ${themName}` : "Your calls on where the room lands", color: ACC_GROUP, dots: [...youDots, ...tailDots] },
  ];
  if (duo && themUid) runRows.push({ label: themName, aria: `How well ${themName} reads you`, color: tint, dots: [...themDots, ...tailDots] });
  const runBlock = (youDots.length || tail.length) ? (
    <div style={col(6)}>
      <LdRun rows={runRows} acc={tint} onPick={(n) => setAt(n)} />
      {!histAsked && past.length > 0 && (
        <button onClick={loadOlder} aria-label="Load older rounds"
          style={{ alignSelf: "flex-start", border: "none", background: "none", padding: "2px 0", cursor: "pointer", color: "var(--ink-3)", fontSize: 12, fontWeight: 800, lineHeight: 1, WebkitAppearance: "none" }}>⋯ older rounds</button>
      )}
    </div>
  ) : null;

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      {duo && themUid
        ? <DuelAv uid={themUid} name={names[themUid]} size={30} />
        : <GroupMark gid={g.id} name={g.name} size={30} />}
      <span style={{ fontWeight: 800, fontSize: 15, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {duo && themUid ? themName : g.name}
      </span>
      {duo && romantic && <span aria-label="romantic mode" style={{ width: 7, height: 7, borderRadius: "50%", background: ROMANCE, flexShrink: 0 }} />}
      <button className="tap44" aria-label={"Manage " + (g.name || "this room")} aria-expanded={menu}
        onClick={() => setMenu((v) => !v)}
        style={{ marginLeft: "auto", border: "none", background: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 18, fontWeight: 800, padding: "0 3px", lineHeight: 1, WebkitAppearance: "none" }}>{"⋯"}</button>
    </div>
  );

  const kicker = (n: number, isWorld: boolean, right?: string | null) => (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
      <span style={{ display: "flex", gap: 5, alignItems: "baseline" }}>
        <span style={KICK}>{`Round ${n}`}</span>
        {isWorld && <span style={{ ...KICK, color: WORLD }}>· World</span>}
      </span>
      {right && <span style={{ ...KICK, fontVariantNumeric: "tabular-nums" }}>{right}</span>}
    </div>
  );
  const split = <div style={{ height: 0, borderTop: "0.5px solid var(--rule)" }} />;

  // ── the blocks ──
  const myOpen = mine && openQ ? S.myDuelCall(g.id, R.open) : null;
  const mineLabel = openQ && myOpen && openQ.options[myOpen.optionIdx] != null ? openQ.options[myOpen.optionIdx] : "—";

  // State 2 · their turn: what you sealed, and who it waits on. Nothing of
  // anyone else's before the reveal — a 1v1 draws the partner's answer as
  // redacted bars, a group draws who HAS played (haloed) and its one clock.
  const waitBlock = mine && openQ && (duo ? (
    <div style={col(12)} key="wait">
      <div style={serif(24)}>{openQ.prompt}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 6 }}>
        <YouChip size={22} />
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-3)" }}>said</span>
        <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: -0.2 }}>{mineLabel}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, borderTop: LD_HAIR, paddingTop: 12 }}>
        <DuelAv uid={themUid} name={names[themUid]} size={26} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink-2)" }}>
            {themName}’s answer
            {myOpen && myOpen.guessIdx != null && openQ.options[myOpen.guessIdx] != null && (
              <> · <span style={{ color: "var(--ink)", fontWeight: 800 }}>you called {openQ.options[myOpen.guessIdx]}</span></>
            )}
          </span>
          <span role="status" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)" }}>waiting on {themName}</span>
        </div>
        <span aria-hidden="true" style={{ display: "flex", gap: 3, alignItems: "center", flexShrink: 0 }}>
          {[22, 13, 18].map((w, i) => <span key={i} style={{ width: w, height: 11, borderRadius: 2, background: "color-mix(in oklch, var(--ink) 17%, transparent)" }} />)}
        </span>
      </div>
    </div>
  ) : (
    <div style={col(16)} key="wait">
      <div style={serif(24)}>{openQ.prompt}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-3)" }}>you said</span>
        <span style={{ fontWeight: 800, fontSize: 19, letterSpacing: -0.3 }}>{mineLabel}</span>
      </div>
      <div style={{ ...col(12), borderTop: "0.5px solid color-mix(in oklch, var(--rule), transparent 20%)", padding: "16px 0 2px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }} aria-label="Who has played">
          {members.filter((u) => u !== uid).map((u) => (
            <HaloAv key={u} uid={u} name={names[u]} size={34} on={openPlayers.includes(u)} />
          ))}
          <YouChip size={34} />
        </div>
        <div role="status" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)", fontVariantNumeric: "tabular-nums", textWrap: "pretty" }}>
          {left ? `Reveals when everyone has played · ${left} at the latest` : "Reveals when everyone has played, or at the deadline"}
        </div>
      </div>
    </div>
  ));

  // State 5 · at the lead: every round inside it sealed. What is waiting,
  // with your own picks, and when each opens — nothing called forbidden.
  const sealedList = atLead && (
    <div style={col(10)} key="sealed">
      <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.3 }}>
        {`${roundsWord(R.sealed.length)} waiting on ${duo ? themName : (g.name || "the room")}`}
      </div>
      <div style={col(0)}>
        {R.sealed.map((n) => {
          const rq = S.roundQ(g.id, n) as { prompt: string; options: string[]; kind?: string } | null;
          const call = S.myDuelCall(g.id, n);
          const parts: string[] = [];
          if (rq && rq.kind === "world") parts.push("World");
          if (rq && call && rq.options[call.optionIdx] != null) parts.push(`you: ${rq.options[call.optionIdx]}`);
          if (rq && call && call.guessIdx != null && rq.options[call.guessIdx] != null) parts.push(`called ${rq.options[call.guessIdx]}`);
          const dl = !duo && n === R.open ? left : null;
          return (
            <div key={n} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderTop: LD_HAIR }}>
              <span aria-label="sealed" style={{ width: 14, height: 14, marginTop: 3, borderRadius: "50%", flexShrink: 0, background: tint, boxShadow: `inset 0 0 0 2px ${GROUND}, inset 0 0 0 3.5px ${tint}` }} />
              <span style={{ width: 18, flexShrink: 0, paddingTop: 1, fontSize: 12.5, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--ink-3)" }}>{n}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3, textWrap: "pretty" }}>{rq ? rq.prompt : `Round ${n}`}</span>
                {parts.length > 0 && <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.4, color: "var(--ink-3)" }}>{parts.join(" · ")}</span>}
              </div>
              {dl && <span style={{ flexShrink: 0, paddingTop: 1, fontSize: 12.5, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--ink-3)", whiteSpace: "nowrap" }}>{dl}</span>}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.45, color: "var(--ink-2)", textWrap: "pretty" }}>
        {duo ? `Each reveals as ${themName} plays.` : "Each reveals when everyone has played, or at its deadline."}
      </div>
    </div>
  );

  // State 4 · several rounds waiting: the count said once.
  const band = waiting >= 2 && q && (
    <div style={col(2)} key="band">
      <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em", color: tint }}>{`${waiting} rounds waiting for you`}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.45 }}>
        {duo ? "each reveals as you answer" : "each reveals when everyone has played, or at its deadline"}
      </span>
    </div>
  );

  // State 1 · your turn: the question, then the read.
  const askBlock = q && pick == null && (
    <div style={col(12)} key="ask">
      {kicker(R.next ?? R.open, world, !duo && R.next === R.open && left ? `${left} left` : null)}
      <div style={serif(27)}>{q.prompt}</div>
      <div style={col(9)}>
        {q.options.map((o: string, i: number) => (
          <LdOption key={i} label={o} tint={tint} disabled={busy}
            onClick={() => (guessless ? void seal(i) : setPick(i))} />
        ))}
      </div>
      {world && duo && partnerKnown != null && (
        <div role="note" style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.45, color: "var(--ink-2)", textWrap: "pretty" }}>
          {`${themName} already answered this in the World feed, so there is no guess this round.`}
        </div>
      )}
      {voteErr && <div role="status" style={{ fontSize: 12.5, fontWeight: 600, color: "oklch(0.5 0.19 25)" }}>{voteErr}</div>}
    </div>
  );
  const guessBlock = q && pick != null && (
    <div style={{ ...col(12), animation: "popIn .3s cubic-bezier(0.2,0.8,0.2,1)" }} key="guess">
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>
        You picked <b style={{ color: "var(--ink)", fontWeight: 800 }}>{q.options[pick]}</b>.
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {duo
          ? <DuelAv uid={themUid} name={names[themUid]} size={38} />
          : <GroupMark gid={g.id} name={g.name} size={38} />}
        <div style={serif(27)}>{duo ? "And " + themName + " picked…?" : "And the room lands on…?"}</div>
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

  let body: React.ReactNode;
  if (shown) {
    // an earlier round, browsed through the run
    body = (
      <div style={col(12)} key={"past" + at}>
        <button onClick={() => setAt(0)}
          style={{ alignSelf: "flex-start", border: "none", background: "none", padding: 0, cursor: "pointer", fontWeight: 700, fontSize: 12, color: "var(--ink-2)", WebkitAppearance: "none" }}>{"‹"} back</button>
        <LdReveal g={g} reveal={shown} browsed={agoLabel(shown.day, at)} />
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
  } else {
    // The loop (state 3): the standing reveal above, the next round below.
    // Once you have sealed the open round, what you sealed takes the
    // reveal's place (state 2) and the reveal waits in the run. At the lead
    // the list is the whole card (state 5).
    const top: React.ReactNode[] = [];
    if (band) top.push(band);
    if (!atLead && waitBlock) top.push(waitBlock);
    else if (!atLead && reveal) top.push(<LdReveal key="reveal" g={g} reveal={reveal} />);
    const under = sealedList || guessBlock || askBlock
      || <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }} key="noq">No question yet — the deck is still loading.</div>;
    body = (
      <div style={col(16)} key="loop">
        {top}
        {top.length > 0 && <React.Fragment key="split">{split}</React.Fragment>}
        {under}
      </div>
    );
  }

  return (
    <div data-duel-card={g.id} style={{
      // A card fills the view while it still wants something from you, and
      // collapses to its content once it does not — a finished room
      // should not cost a screen of scrolling to get past.
      minHeight: atLead || shown ? 0 : Math.min(Math.max((vh || 540) - 190, 250), 380),
      boxSizing: "border-box",
      scrollSnapAlign: "start", scrollSnapStop: "always",
      display: "flex", flexDirection: "column", gap: 16,
      borderTop: LD_LINE, padding: "14px 1px 22px",
    }}>
      {header}
      {menu && <LdManage g={g} onClose={() => setMenu(false)} />}
      {menu && duo && members.length === 2 && (S.romanticPoolReady() || romantic) && (
        <LdModeRow g={g} sealed={R.sealed.length > 0} />
      )}
      {body}
      {!shown && runBlock}
    </div>
  );
}

// ── the rail: every room at a glance, dot = your turn ─────────────
function LdRail({ items, cur, onPick, onNew, duo }: {
  items: Array<{ g: LiveGroup; pending: boolean; themUid: string; label: string }>;
  cur: string; onPick: (id: string) => void; onNew: () => void; duo: boolean;
}) {
  const acc = duo ? ACC_DUO : ACC_GROUP;
  return (
    <div className="h-scroll" style={{ display: "flex", gap: 2, overflowX: "auto", padding: "6px 2px 6px" }}>
      {items.map(({ g, pending, themUid, label }) => {
        const sel = g.id === cur;
        return (
          <button key={g.id} onClick={() => onPick(g.id)} aria-current={sel ? "true" : undefined}
            aria-label={label + (pending ? " — your turn" : "")}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, border: "none", background: "none", cursor: "pointer", padding: "4px 7px", WebkitAppearance: "none", flexShrink: 0, minWidth: 56, minHeight: 44 }}>
            <span style={{ position: "relative", display: "inline-flex", borderRadius: duo ? "50%" : 14, padding: 2,
              boxShadow: sel ? `0 0 0 2px ${acc}` : "none", transition: "box-shadow .18s" }}>
              {duo && themUid
                ? <DuelAv uid={themUid} name={label} size={38} />
                : <GroupMark gid={g.id} name={g.name} size={38} />}
              {/* only the waiting state wears a mark — a check on every
                  room carried no information and made the rail read as
                  noise */}
              {pending && <span style={{ position: "absolute", top: -1, right: -1, width: 11, height: 11, borderRadius: "50%", background: acc, border: `2px solid ${GROUND}` }} />}
            </span>
            <span style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: sel ? 800 : 600, color: sel ? "var(--ink)" : "var(--ink-3)", whiteSpace: "nowrap", maxWidth: 64, overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
          </button>
        );
      })}
      <button onClick={onNew} aria-label={duo ? "Start a new 1v1" : "Create a group"}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, border: "none", background: "none", cursor: "pointer", padding: "4px 7px", WebkitAppearance: "none", flexShrink: 0, minWidth: 56, minHeight: 44 }}>
        <span style={{ width: 38, height: 38, margin: 2, borderRadius: duo ? "50%" : 11, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px dashed color-mix(in oklch, var(--ink-3) 55%, transparent)", color: "var(--ink-2)", fontSize: 19, fontWeight: 600, lineHeight: 1 }}>+</span>
        <span style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--ink-3)" }}>New</span>
      </button>
    </div>
  );
}

// ── the first run (request 11, state 9) ──────────────────────────
//
// One round of the game drawn with nothing invented: a World question
// stands in for the one a room would draw, SEALED on a hairline ballot,
// then REVEALED — your mark on a row and a dashed seat per person who is
// not here yet — and the one tap that starts a room. An invitation, when
// one is waiting, leads it and names who the reveal waits on.
function LdFirstRun({ mode, pendingCode, onCodeDone }: { mode?: string; pendingCode: string; onCodeDone: () => void }) {
  const duo = mode === "duo";
  const acc = duo ? ACC_DUO : ACC_GROUP;
  const [open, setOpen] = React.useState(false);
  const [, tick] = React.useState(0);
  React.useEffect(() => LIVE.subscribe(() => tick((t) => t + 1)), []);
  const want = duo ? "duo" : "group";
  const inv = (LIVE.social.invites() as Invite[]).find((i) => (i.mode || "group") === want) || null;
  const who = duo && inv ? (firstName(inv.fromName) || null) : null;
  // The stand-in: the first of today's questions an option index can
  // answer. None means no ballot — never a question made up here (D1).
  const deck = (typeof (LIVE as { deck?: () => unknown[] }).deck === "function" ? (LIVE as { deck: () => unknown[] }).deck() : []) as Array<{ prompt?: string; options?: string[] }>;
  const standIn = deck.find((x) => typeof x.prompt === "string" && Array.isArray(x.options) && x.options.length >= 2 && x.options.length <= 4) || null;
  const seats = duo ? 1 : 2;
  const startLabel = duo ? "Start a 1v1" : "Start a group";
  return (
    <div style={{ ...col(0), padding: "4px 1px 20px" }}>
      {pendingCode && <LdJoinPending code={pendingCode} onDone={onCodeDone} />}
      <LdInvites mode={mode} />
      {standIn && (
        <>
          <div style={{ ...col(12), padding: "4px 0 18px" }}>
            <span style={KICK}>Sealed</span>
            <div style={serif(25)}>{standIn.prompt}</div>
            <div style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${(standIn.options as string[]).length}, 1fr)`, borderTop: LD_LINE, borderBottom: LD_LINE }}>
              {(standIn.options as string[]).map((o, i) => (
                <div key={i} style={{ minHeight: 58, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", padding: "12px 14px", borderLeft: i ? LD_LINE : "none", fontWeight: 700, fontSize: 17, letterSpacing: "-0.015em", color: "var(--ink-3)", textAlign: "center" }}>{o}</div>
              ))}
              <span role="img" aria-label="sealed until the reveal" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 20, height: 20, borderRadius: "50%", background: acc, boxShadow: `0 0 0 3px ${GROUND}, inset 0 0 0 2px ${GROUND}, inset 0 0 0 3.5px ${acc}` }} />
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.45, textWrap: "pretty" }}>
              {duo ? "A World question stands in — a 1v1 draws its own." : "A World question stands in — a group draws its own."}
            </span>
          </div>
          <div style={{ ...col(12), padding: "14px 0 6px", borderTop: "0.5px solid var(--rule)" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
              <span style={KICK}>Revealed</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: acc, textAlign: "right", lineHeight: 1.35, textWrap: "pretty" }}>
                {duo ? `when ${who || "they"} ${who ? "plays" : "play"}` : "when everyone has played, or at the deadline"}
              </span>
            </div>
            <div style={col(8)}>
              {(standIn.options as string[]).map((o, i) => (
                <div key={i} style={{ position: "relative", overflow: "hidden", borderRadius: 14, border: i === 0 ? `1.5px solid color-mix(in oklch, ${acc} 55%, transparent)` : LD_LINE, background: "var(--surface-2)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", minHeight: 44, boxSizing: "border-box" }}>
                    <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 13.5 }}>{o}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {i === 0 && <YouChip size={26} />}
                      {Array.from({ length: seats }, (_, k) => <OpenSeat key={k} />)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.45 }}>
                {duo ? `Your guess at ${who || "their"}${who ? "’s" : ""} answer` : "Your call on where the room lands"}
              </span>
              <span aria-hidden="true" style={{ display: "flex", gap: 3, alignItems: "center" }}>
                {Array.from({ length: 7 }, (_, k) => (
                  <span key={k} style={{ width: 11, height: 11, borderRadius: "50%", flexShrink: 0, boxSizing: "border-box", border: `1.5px dashed color-mix(in oklch, ${acc} 72%, transparent)` }} />
                ))}
              </span>
            </div>
          </div>
        </>
      )}
      <div style={{ ...col(14), padding: "18px 0 6px", borderTop: "0.5px solid var(--rule)" }}>
        {!open && (duo ? (
          <button className="press" onClick={() => setOpen(true)} aria-label={startLabel}
            style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 48, textAlign: "left", padding: "8px 2px", border: "none", background: "none", color: "inherit", font: "inherit", cursor: "pointer", WebkitAppearance: "none" }}>
            <OpenSeat />
            <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14.5, letterSpacing: "-0.01em", color: "var(--ink)" }}>{startLabel}</span>
            <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1, color: "var(--ink-3)" }}>›</span>
          </button>
        ) : (
          <button className="press" onClick={() => setOpen(true)}
            style={{ width: "100%", minHeight: 48, border: "none", borderRadius: 999, padding: "13px 18px", background: acc, color: "#fff", font: "inherit", fontWeight: 800, fontSize: 14.5, letterSpacing: "-0.01em", cursor: "pointer", WebkitAppearance: "none" }}>{startLabel}</button>
        ))}
        {open && <LdOnboard mode={mode} />}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.45, textWrap: "pretty", padding: "14px 0 0", marginTop: 12, borderTop: "0.5px solid var(--rule)" }}>
        An invitation reaches you here, and a link a friend sends lands here too.
      </div>
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
  // prompts on this visit and does not resurface days later on a room
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

  // First run: no rail, no stack — one round of the game drawn, and the
  // one tap that starts a room (request 11, state 9).
  if (!has) {
    return <LdFirstRun mode={mode} pendingCode={pendingCode} onCodeDone={() => setPendingCode("")} />;
  }

  const items = groups.map((g) => {
    const members = g.memberUids || [];
    const themUid = duo ? (members.find((m) => m !== uid) || "") : "";
    // A ROOM THAT CANNOT BE PLAYED OWES YOU NOTHING. `todayQ` hands back a
    // question for any room whatever its membership, so a 1v1 you created
    // and whose partner has not joined would wear a "your turn" dot on the
    // rail — for ever — while the card directly beneath it renders
    // "Waiting for someone" with no options at all. Same condition the card
    // uses (`duo && members.length < 2`), so the two cannot disagree.
    const unplayable = duo && members.length < 2;
    return {
      g,
      pending: !unplayable && S.myDuelVote(g.id) == null && !!S.todayQ(g.id),
      themUid,
      label: (duo ? (firstName((g.memberNames || {})[themUid]) || g.name || "1v1") : (g.name || "Group")) as string,
    };
  });

  return (
    <div ref={rootRef} style={{ ...col(10), padding: "0 0 20px" }}>
      <div ref={railRef} style={{ position: "sticky", top: 0, zIndex: 6, margin: "-1px -16px 0", padding: "0 8px", background: "var(--surface-a, var(--surface))", borderBottom: "0.5px solid color-mix(in oklch, var(--rule), transparent 25%)" }}>
        <LdRail items={items} cur={cur} duo={duo}
          onPick={(id) => jumpTo('[data-duel-card="' + id + '"]')}
          onNew={() => jumpTo("[data-ld-new]")} />
      </div>
      {/* Invitations lead the stack. Someone asking to play with you
          outranks a card you have already finished. */}
      {pendingCode && <LdJoinPending code={pendingCode} onDone={() => setPendingCode("")} />}
      <LdInvites mode={mode} />
      <div style={col(0)}>
        {items.map(({ g }, i) => (
          <LdCard key={g.id} g={g} vh={vh} newest={i === 0} />
        ))}
      </div>
      <LdOnboard mode={mode} />
    </div>
  );
}

export default LiveDuelPanel;
