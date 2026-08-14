// LiveDuelPanel — the LIVE group/duo panel (Phase 3). Replaces the
// demo GroupDailyBody / DuoBody when LIVE is enabled: real groups
// with server-minted invite codes, today's question from the shared
// deterministic rotation, sealed votes, and yesterday's materialized
// reveal. This is also the v2 first-run: with no groups yet, the
// panel IS the create-or-join flow.
//
// Born in this repo (not ported from the design prototype), so it
// lives here as typed TSX. A globalThis assignment at the bottom
// keeps the spec layer's render-time lookup working unchanged.
import React from "react";
import LIVE from "../data/live";
import { consumeJoinCode, inviteLinkFor } from "../data/links";
// Handles and invitations (D122) — how a circle gains a member now. The
// code survives inside the share link for people who have no account
// yet; it is no longer something anyone types.
import { atHandle, handleProblem, normalizeHandle } from "../data/handles";
import { inviteLine, type Invite } from "../data/invites";
// LAZY, and that is a measurement rather than a style (D147). Not a
// globalThis lookup either way — both panels are typed TSX in this
// directory and D39's ratchet only moves down — but this panel is reached
// from the daily tab, which is eager and first-screen. A static import put
// the whole takes panel into the first-paint graph for a thread that
// renders under a revealed duel, and `npm run check:bundle` counts a
// statically-imported chunk whether or not anything renders it.
const LiveTakesPanel = React.lazy(() => import("./LiveTakesPanel"));

const LD_LINE = "1px solid color-mix(in oklch, var(--rule), transparent 25%)";
const LD_NAME_LS = "insight.displayName.v1";

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
interface LiveReveal {
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
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14, padding: "18px 16px" }}>
      <div style={{ fontWeight: 800, fontSize: 21, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
        {duo ? "Start a 1v1" : "Start your group"}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink-2)", lineHeight: 1.45 }}>
        {duo
          ? "One question a day, both answers sealed until tomorrow — and only if you both play."
          : "One question a day for your circle. Answers are sealed until tomorrow, then revealed with names."}
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
function LdReveal({ g, reveal }: { g: LiveGroup; reveal: LiveReveal }) {
  const uid = LIVE.uid;
  const names = { ...(g.memberNames || {}), ...(reveal.names || {}) };
  const votes = reveal.votes || {};
  const rowQid = reveal.qid || null;
  // resolve the revealed question's prompt + options from the seeded bank
  const bankQ = reveal.qid ? LIVE.social.bankQ(reveal.qid) : null;
  const duo = g.mode === "duo";
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
  const onQuestion = Object.keys(votes).filter((u) => qidOf(votes[u]) === rowQid);
  const offQuestion = Object.keys(votes).filter((u) => qidOf(votes[u]) !== rowQid);
  return (
    <div style={{ borderRadius: 12, border: LD_LINE, background: "var(--surface-2)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="kicker" style={{ marginBottom: 0 }}>Yesterday · revealed</div>
      {bankQ && <div style={{ fontWeight: 800, fontSize: 15.5, lineHeight: 1.2 }}>{bankQ.prompt}</div>}
      {onQuestion.map((u) => voteRow(u, opts))}
      {offQuestion.map((u) => {
        // One block per member who was asked something else: their prompt,
        // then their answer read against THEIR options. Their vote is not in
        // the counts this card implies, and saying so is the honest version
        // of what used to be a silent mislabel.
        const theirQ = LIVE.social.bankQ(qidOf(votes[u]) as string) as
          { prompt?: string; options?: string[] } | null;
        return (
          <div key={u} style={{ borderTop: LD_LINE, paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: "var(--ink-3)" }}>
              {who(u) === "you" ? "You were" : who(u) + " was"} asked a different question
            </div>
            {theirQ && theirQ.prompt && (
              <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.25 }}>{theirQ.prompt}</div>
            )}
            {voteRow(u, optsFor(theirQ))}
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

  function voteRow(u: string, list: string[]) {
    const v = votes[u];
    const guessed = duo && typeof v.guessIdx === "number";
    // in a duo, your read of the OTHER: did their guess about you land?
    const other = (g.memberUids || []).find((m) => m !== u);
    const otherVote = other ? votes[other] : undefined;
    // …but only when you were both answering the same question. Across a
    // split, "called it" would compare a guess about one prompt to an answer
    // about another and land on true by coincidence.
    const comparable = !!otherVote && qidOf(otherVote) === qidOf(v);
    const called = guessed && comparable && v.guessIdx === (otherVote as RevealVote).optionIdx;
    return (
      <div key={u} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 13.5 }}>
        <span style={{ fontWeight: 800, minWidth: 64, textTransform: u === uid ? "lowercase" : "none" }}>{who(u)}</span>
        <span style={{ fontWeight: 600, color: "var(--ink-2)", flex: 1 }}>{labelIn(list, v.optionIdx)}</span>
        {guessed && comparable && (
          <span style={{ fontSize: 11.5, fontWeight: 800, color: called ? "oklch(0.5 0.12 170)" : "oklch(0.55 0.13 60)" }}>
            {called ? "called it" : "guessed " + labelIn(list, v.guessIdx as number)}
          </span>
        )}
      </div>
    );
  }
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
    catch { setErr("Couldn’t switch pools — check your connection and try again."); }
    setBusy(false);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span className="kicker" style={{ marginBottom: 0, flex: 1 }}>Question pool</span>
        {(["friends", "romantic"] as const).map((m) => (
          <button key={m} className="press" onClick={() => void flip(m)}
            disabled={busy || sealed} aria-pressed={current === m}
            style={{ border: current === m ? "2px solid var(--accent, var(--ink))" : LD_LINE,
              borderRadius: 999, padding: "6px 13px", cursor: busy || sealed ? "default" : "pointer",
              fontFamily: "var(--sans)", fontWeight: 700, fontSize: 12.5,
              background: current === m ? "color-mix(in oklch, var(--accent, var(--ink)) 9%, var(--surface-2))" : "var(--surface-2)",
              color: "var(--ink)", opacity: busy || sealed ? 0.55 : 1, WebkitAppearance: "none" }}>
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

// ── one group's daily card ───────────────────────────────────────
function LdGroupCard({ g }: { g: LiveGroup }) {
  const S = LIVE.social;
  const duo = g.mode === "duo";
  const q = S.todayQ(g.id);
  const mine = S.myDuelVote(g.id);
  const reveal = S.revealFor(g.id) as LiveReveal | null;
  const [guess, setGuess] = React.useState<number | null>(null);
  const [pick, setPick] = React.useState<number | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [voteErr, setVoteErr] = React.useState<string | null>(null);
  // Leaving. Two-step, because the last member out takes the group and every
  // reveal in it (leaveGroupV2's recursiveDelete) — the same reason the
  // privacy panel's delete confirms.
  const [confirmLeave, setConfirmLeave] = React.useState(false);
  const [leaveErr, setLeaveErr] = React.useState<string | null>(null);
  const members = g.memberUids || [];
  const copy = () => {
    try {
      // the LINK, not the bare code — pasteable anywhere, lands on the
      // hosted /join page (or straight in the app once app-links verify)
      void navigator.clipboard.writeText(g.inviteCode ? inviteLinkFor(g.inviteCode) : "");
      setCopied(true); setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  };
  const leave = async () => {
    setLeaveErr(null);
    try { await S.leaveGroup(g.id); }
    catch { setLeaveErr("Couldn\u2019t leave \u2014 check your connection and try again."); }
  };
  const submit = async () => {
    if (pick == null) return;
    setVoteErr(null);
    try { await S.voteDuel(g.id, pick, duo && guess != null ? guess : undefined); }
    catch { setVoteErr("That didn’t save — check your connection and try again."); }
  };
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 15px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontWeight: 800, fontSize: 17, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
        {duo && (g.streak || 0) > 0 && <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--accent, var(--ink-2))" }}>{g.streak}-day run</span>}
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)" }}>{members.length}{duo ? "/2" : ""}</span>
        <button onClick={copy} aria-label="Copy invite link — for someone who has no account yet" title="Copy invite link" style={{ border: LD_LINE, background: "var(--surface-2)", borderRadius: 8, padding: "4px 9px", cursor: "pointer", fontFamily: "var(--mono, monospace)", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.1em", color: "var(--ink-2)", WebkitAppearance: "none" }}>
          {copied ? "copied ✓" : g.inviteCode}
        </button>
      </div>
      {duo && members.length < 2 && (
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.4 }}>
          Add them by handle, or send the link above — the duel starts when
          they accept.
        </div>
      )}
      {/* Room for one more: the add row, until the circle is full. Above
          the day's question rather than below it, because a circle with
          nobody in it has nothing else worth doing. */}
      {members.length < (duo ? 2 : 32) && <LdAddByHandle g={g} />}
      {duo && members.length === 2 && (S.romanticPoolReady() || g.duoMode === "romantic") && (
        <LdModeRow g={g} sealed={mine != null} />
      )}
      {/* The only way out of a circle short of deleting the account.
          LIVE.social.leaveGroup has shipped since the social layer landed and
          had ZERO call sites in any live surface — the demo panel's Leave
          button is swapped out when live is on — while STORE-FORMS.md
          answered Apple guideline 1.2 with it. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {confirmLeave ? (
          <>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>
              {members.length <= 1
                ? "You\u2019re the last one here — leaving deletes this circle and its history."
                : "Leave this circle? You keep the days you played; you stop seeing new ones."}
            </span>
            <button className="press" onClick={() => setConfirmLeave(false)}
              style={{ border: LD_LINE, background: "transparent", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 700, color: "var(--ink-2)", WebkitAppearance: "none" }}>
              Cancel
            </button>
            <button className="press" onClick={() => { void leave(); }}
              style={{ border: "none", background: "var(--ochre-ink, var(--ink))", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 800, color: "#fff", WebkitAppearance: "none" }}>
              Leave
            </button>
          </>
        ) : (
          <button className="press" onClick={() => setConfirmLeave(true)}
            style={{ marginLeft: "auto", border: "none", background: "transparent", padding: "2px 0", cursor: "pointer", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 700, color: "var(--ink-3)", WebkitAppearance: "none" }}>
            Leave circle
          </button>
        )}
      </div>
      {leaveErr && (
        <div role="status" style={{ fontSize: 12.5, fontWeight: 600, color: "oklch(0.5 0.19 25)" }}>{leaveErr}</div>
      )}
      {reveal && <LdReveal g={g} reveal={reveal} />}
      {q && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 20, lineHeight: 1.15, letterSpacing: "-0.02em" }}>{q.prompt}</div>
          {mine ? (
            <div style={{ borderRadius: 12, border: LD_LINE, background: "var(--surface-2)", padding: "12px 14px", fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.45 }}>
              Sealed: <b style={{ color: "var(--ink)" }}>{q.options[mine.optionIdx] != null ? q.options[mine.optionIdx] : "—"}</b>
              {" · "}{(() => {
                const t = new Date(); t.setUTCHours(24, 0, 0, 0);
                const hhmm = t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                // "Takes open with it": the composer mounts on the REVEAL,
                // never beside a sealed answer (free text there is the vote,
                // in prose — see LdReveal). Saying so here is what makes the
                // feature findable before the first reveal has ever landed.
                return duo ? "revealed after " + hhmm + " — if you both play. Takes open with the reveal." : "revealed with names after " + hhmm + ". Takes open with the reveal.";
              })()}
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {q.options.map((o, i) => (
                  <button key={i} className="press" onClick={() => setPick(i)}
                    style={{ border: pick === i ? "2px solid var(--accent, var(--ink))" : LD_LINE, borderRadius: 12, padding: "12px 14px", textAlign: "left", cursor: "pointer", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 15, background: pick === i ? "color-mix(in oklch, var(--accent, var(--ink)) 9%, var(--surface-2))" : "var(--surface-2)", color: "var(--ink)", WebkitAppearance: "none" }}>
                    {o}
                  </button>
                ))}
              </div>
              {duo && members.length === 2 && pick != null && (
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <div className="kicker" style={{ marginBottom: 0 }}>And your guess — what did they pick?</div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {q.options.map((o, i) => (
                      <button key={i} className="press" onClick={() => setGuess(i)}
                        style={{ border: guess === i ? "2px solid var(--accent, var(--ink))" : LD_LINE, borderRadius: 999, padding: "7px 14px", cursor: "pointer", fontWeight: 700, fontSize: 13, background: "var(--surface-2)", color: "var(--ink)", WebkitAppearance: "none" }}>
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <LdBtn primary disabled={pick == null || (duo && members.length === 2 && guess == null)} onClick={() => void submit()}>
                {duo ? "Seal answer + guess" : "Seal your answer"}
              </LdBtn>
              {voteErr && <div style={{ fontSize: 12.5, fontWeight: 600, color: "oklch(0.5 0.19 25)" }}>{voteErr}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LiveDuelPanel({ mode }: { mode?: string }) {
  const [, tick] = React.useState(0);
  React.useEffect(() => LIVE.subscribe(() => tick((t) => t + 1)), []);
  if (!LIVE.enabled) return null;
  const groups = LIVE.social.groups(mode === "duo" ? "duo" : "group") as LiveGroup[];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "4px 1px 20px" }}>
      {/* Invitations lead. Someone asking to play with you outranks the
          create form, and on a first run it is the only thing on the
          screen that is about a person rather than a form. */}
      <LdInvites mode={mode} />
      {groups.map((g) => <LdGroupCard key={g.id} g={g} />)}
      <LdOnboard mode={mode} />
    </div>
  );
}

// Render-time lookup bridge for the spec layer (daily-split.jsx).
Object.assign(globalThis, { LiveDuelPanel });

export default LiveDuelPanel;
