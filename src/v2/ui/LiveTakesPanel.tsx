// LiveTakesPanel — takes on one question, with the report control
// docs/MODERATION.md has been waiting on (D22 → D78 part 1). Two scopes,
// one panel: a CIRCLE's takes (names from the group, D1's original grant)
// and, since D83, WORLD takes under the sentinel gid "world" — no names,
// one take per person per question, plus the mute control a world-scale
// UGC surface owes Apple guideline 1.2.
//
// Born in this repo, so it lives here as typed TSX; a globalThis assignment
// at the bottom keeps the spec layer's render-time lookup working.
//
// THREE THINGS HERE LOOK LIKE DESIGN CHOICES AND ARE ACTUALLY RULES.
// Each is called out again at its site, because each reads as an omission:
//
//   1. There is no reason picker. `v2_flags` accepts exactly
//      ["takeId", "gid", "uid", "at"] — there is no field to put one in,
//      and nothing downstream would read it: the moderation run derives
//      the policy line (H1–H5) from the take's own text. A picker would be
//      a form whose answer is discarded on send.
//   2. Reporting takes two taps. The demo's report is local and undoable
//      (`WF_REPORT.undo`); this one is `allow update, delete: if false` —
//      once cast, no client and no moderator can withdraw it. One tap on
//      an irreversible write is how a misplaced thumb becomes permanent.
//   3. A reported take stays on screen. The demo replaces it with a
//      tombstone; here the flag is unreadable by design (`allow read: if
//      false`), so a local hide has nothing to rehydrate from and would
//      reappear on the next load — a worse lie than never hiding it. The
//      soft-hide belongs to the moderator's verdict, not the reporter.
//
// And the copy still never promises removal — under enforcement
// (MOD_ADVISORY=false since D83) a remove verdict really hides, but the
// promise the panel makes stays the one that is true at the moment of
// reporting: "a moderator reviews flagged takes against the posted
// policy". What happens next is the verdict's to say.
import React from "react";
import LIVE, { TAKE_MAX_CHARS } from "../data/live";
import type { TakeDoc } from "../data/live";
import { isMutedAuthor, muteAuthor, subscribeMutes } from "../data/mutes";

const LT_LINE = "1px solid color-mix(in oklch, var(--rule), transparent 25%)";

interface LiveGroupLite {
  id: string;
  memberNames?: Record<string, string>;
}

function ltErr(e: unknown): string {
  return String((e instanceof Error && e.message) || e);
}

// Same initial-disc vocabulary the Groups mirror uses, so a circle's people
// look like themselves across the two surfaces.
function LtMark({ name }: { name: string }) {
  const init = (name || "?").trim().slice(0, 1).toUpperCase() || "?";
  return (
    <span aria-hidden="true" style={{
      width: 30, height: 30, borderRadius: "50%", flexShrink: 0, display: "flex",
      alignItems: "center", justifyContent: "center", fontFamily: "var(--sans)",
      fontWeight: 800, fontSize: 11.5, background: "var(--surface-3)", color: "var(--ink-2)",
    }}>{init}</span>
  );
}

function ltWhen(ms: number): string {
  if (!ms) return "now";
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

// ── one take, with the control that flags it ─────────────────────────

function LtTakeRow({ take, gid, name, mine, world }: {
  take: TakeDoc;
  gid: string;
  name: string;
  mine: boolean;
  world?: boolean;
}) {
  const [confirming, setConfirming] = React.useState(false);
  // The world row's second control (guideline 1.2's block): local, silent,
  // and confirmed like Report — one tap should not vanish a person with no
  // way back, and there is no unhide surface yet.
  const [muting, setMuting] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const reported = LIVE.social.flagged(take.id);

  const act = (label: string, onClick: () => void, on = false) => (
    <button className="press" onClick={onClick} disabled={busy} style={{
      border: "none", background: "none", padding: "2px 0", cursor: busy ? "default" : "pointer",
      fontFamily: "var(--sans)", fontWeight: 800, fontSize: 11.5,
      color: on ? "var(--ink)" : "var(--ink-3)", WebkitAppearance: "none", whiteSpace: "nowrap",
    }}>{label}</button>
  );

  async function send() {
    setBusy(true);
    setErr("");
    try {
      await LIVE.social.flagTake(gid, take.id);
      setConfirming(false);
    } catch (e) {
      // The optimistic mark is already rolled back in the store; surface
      // the failure rather than leaving a control that looks like it fired.
      setErr(ltErr(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setErr("");
    try {
      await LIVE.social.deleteTake(gid, take.id);
    } catch (e) {
      setErr(ltErr(e));
      setBusy(false);
    }
  }

  return (
    <div style={{
      border: LT_LINE, borderRadius: 12, background: "var(--surface)",
      padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <LtMark name={mine ? "You" : name} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
            <span style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 12.5, color: "var(--ink)" }}>
              {mine ? "You" : name}
            </span>
            <span style={{ fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 600, color: "var(--ink-3)" }}>
              {ltWhen(take.createdAt)}
            </span>
          </div>
          <div style={{ fontFamily: "var(--sans)", fontSize: 13, lineHeight: 1.45, fontWeight: 500, color: "var(--ink)", overflowWrap: "anywhere" }}>
            {take.text}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, paddingLeft: 40 }}>
        <span style={{ flex: 1 }} />
        {/* Your own words are yours to withdraw — the delete rule gates on
            authorUid, so this control only exists where it can succeed.
            There is no edit: an edited take invalidates the flags already
            cast on what it used to say. */}
        {mine && act("Delete", () => void remove())}
        {/* A reported take keeps its place in the list. See the header: the
            flag is unreadable, so a local hide could not survive a reload,
            and hiding is the moderator's verdict to make. */}
        {!mine && reported && (
          <span style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 11.5, color: "var(--ink-3)" }}>
            Reported
          </span>
        )}
        {world && !mine && !confirming && !muting && act("Hide author", () => setMuting(true))}
        {!mine && !reported && !confirming && !muting && act("Report", () => setConfirming(true))}
      </div>

      {muting && (
        <div style={{
          display: "flex", flexDirection: "column", gap: 8, paddingLeft: 40,
          borderTop: LT_LINE, paddingTop: 8,
        }}>
          <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.45 }}>
            Hide every take from this author, on this device? Nothing is sent
            and they won’t know — but there’s no unhide yet.
          </span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {act("Hide", () => { muteAuthor(take.authorUid); setMuting(false); }, true)}
            {act("Cancel", () => setMuting(false))}
          </div>
        </div>
      )}

      {confirming && !reported && (
        <div style={{
          display: "flex", flexDirection: "column", gap: 8, paddingLeft: 40,
          borderTop: LT_LINE, paddingTop: 8,
        }}>
          {/* No reason chips, unlike the demo's four. `v2_flags` has no
              field to carry one and the run reads the take's text to pick
              its own policy line — a picker here would discard its answer
              on send. */}
          <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.45 }}>
            Report this take? A moderator reviews flagged takes against the
            posted policy. You cannot undo a report.
          </span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {act(busy ? "Reporting…" : "Report", () => void send(), true)}
            {act("Cancel", () => { setConfirming(false); setErr(""); })}
          </div>
        </div>
      )}

      {err && (
        <span role="alert" style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-2)", paddingLeft: 40 }}>
          That didn’t send. {err}
        </span>
      )}
    </div>
  );
}

// ── the composer ─────────────────────────────────────────────────────

function LtComposer({ gid, qid }: { gid: string; qid: string }) {
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const body = text.trim();
  const left = TAKE_MAX_CHARS - text.length;

  async function post() {
    if (!body || busy) return;
    setBusy(true);
    setErr("");
    try {
      await LIVE.social.postTake(gid, qid, body);
      setText("");
    } catch (e) {
      setErr(ltErr(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={text}
          // The cap is the rule's (`text.size() <= 280`); stopping the typing
          // is kinder than letting the write be refused, but the rule is
          // still the enforcement — postTake slices again on the way out.
          maxLength={TAKE_MAX_CHARS}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void post(); }}
          placeholder="Add your take…"
          aria-label="Add your take"
          style={{
            flex: 1, border: LT_LINE, borderRadius: 999, padding: "10px 16px",
            fontFamily: "var(--sans)", fontSize: "var(--field-size)", fontWeight: 600,
            background: "var(--surface-2)", color: "var(--ink)", outline: "none", minWidth: 0,
          }}
        />
        <button className="press" onClick={() => void post()} disabled={!body || busy} style={{
          border: "none", background: "none", padding: "6px 2px",
          fontFamily: "var(--sans)", fontWeight: 800, fontSize: 12.5,
          color: body && !busy ? "var(--ink)" : "var(--ink-3)",
          cursor: body && !busy ? "pointer" : "default", WebkitAppearance: "none",
        }}>{busy ? "…" : "Post"}</button>
      </div>
      {left <= 40 && (
        <span style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 700, color: "var(--ink-3)", textAlign: "right" }}>
          {left}
        </span>
      )}
      {err && (
        <span role="alert" style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-2)" }}>
          That didn’t post. {err}
        </span>
      )}
    </div>
  );
}

// ── the panel ────────────────────────────────────────────────────────

function LiveTakesPanel({ gid, qid }: { gid: string; qid: string }) {
  const [, tick] = React.useState(0);
  React.useEffect(() => LIVE.subscribe(() => tick((t) => t + 1)), []);
  React.useEffect(() => subscribeMutes(() => tick((t) => t + 1)), []);
  // One fetch per scope per session; the store holds the list. Takes are
  // opened, not watched — a standing listener is the wrong cost shape for
  // a surface most days nobody writes in. qid rides along for the world
  // scope, whose query and cache are per-question; a circle ignores it.
  React.useEffect(() => { void LIVE.social.loadTakes(gid, qid); }, [gid, qid]);
  // Read before the hooks below so they can depend on it — the early
  // `return null` guard sits after every hook, which is what keeps the
  // hook order stable across the enabled/disabled flip.
  const takesForNames = LIVE.enabled && gid && qid ? LIVE.social.takes(gid, qid) : [];
  // World takes carry `authorUid` and no author name, so the names have to
  // be resolved separately (D98). Batched, into the same session cache the
  // voters panel fills — a question whose who-voted sheet has already been
  // opened usually pays nothing here. Circle takes skip it: their names
  // ride on the group document already.
  const authorUids = takesForNames.map((t) => t.authorUid);
  const authorKey = authorUids.join(",");
  React.useEffect(() => {
    // authorKey (a joined string), not authorUids: a fresh array identity
    // every render would re-run this effect forever.
    if (gid === "world" && authorKey) void LIVE.loadNames(authorKey.split(","));
  }, [gid, authorKey]);

  // Takes carry names at BOTH scopes since D98. `world` still branches the
  // composer (one take per person per question, enforced by the doc id)
  // and the mute control, but no longer the authorship.
  const world = gid === "world";
  if (!LIVE.enabled || !gid || !qid) return null;

  const uid = LIVE.uid;
  // The mute filter is display-only and local (data/mutes.ts) — the block
  // control 1.2 expects. Your own take always shows, muted or not: you
  // cannot lose your own words to a fat-fingered self-mute.
  const takes = LIVE.social.takes(gid, qid)
    .filter((t) => !world || t.authorUid === uid || !isMutedAuthor(t.authorUid));
  const group = world ? undefined : (LIVE.social.groups() as LiveGroupLite[]).find((g) => g.id === gid);
  const names = group?.memberNames || {};
  // World scope: one take per person per question — the doc id enforces it
  // (qid_uid, rules), so the composer folds away instead of inviting a
  // write the server must refuse.
  const mineAlready = world && !!uid && takes.some((t) => t.authorUid === uid);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
      {world && (
        <span style={{ fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)" }}>
          Takes · posted under your name
        </span>
      )}
      {takes.map((t) => (
        <LtTakeRow
          key={t.id}
          take={t}
          gid={gid}
          // Named at both scopes since D98 — the anonymity was always a
          // client-side string choice, never a rule: `authorUid` has been
          // on the take document and readable all along.
          //
          // The fallbacks differ because the sources do. A circle knows
          // its members by name off the group doc, so a missing entry
          // means someone who has LEFT — "Member" is the honest word. At
          // world scale the name comes from the author's own profile via
          // the shared cache, and its absence means an account that has
          // set none: "Someone", which is the absence of a name rather
          // than a pseudonym invented to fill the gap (D1).
          name={world
            ? (LIVE.nameFor(t.authorUid) || "Someone")
            : (names[t.authorUid] || "Member")}
          mine={!!uid && t.authorUid === uid}
          world={world}
        />
      ))}
      {!takes.length && (
        <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)" }}>
          No takes yet. Say the first thing.
        </span>
      )}
      {mineAlready ? (
        <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)" }}>
          One take per question — delete yours to write a new one.
        </span>
      ) : (
        <LtComposer gid={gid} qid={qid} />
      )}
    </div>
  );
}

export default LiveTakesPanel;
