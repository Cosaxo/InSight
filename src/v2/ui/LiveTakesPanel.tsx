// LiveTakesPanel — the circle's takes on one question, with the report
// control docs/MODERATION.md has been waiting on (D22 → D76 part 1).
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
// And the copy never promises removal. MOD_ADVISORY is true: verdicts
// record and hide nothing (the trust ladder's dry-run phase). "A moderator
// reviews flagged takes" is what is true; "this will be removed" is not.
import React from "react";
import LIVE, { TAKE_MAX_CHARS } from "../data/live";
import type { TakeDoc } from "../data/live";

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

function LtTakeRow({ take, gid, name, mine }: {
  take: TakeDoc;
  gid: string;
  name: string;
  mine: boolean;
}) {
  const [confirming, setConfirming] = React.useState(false);
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
        <LtMark name={name} />
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
        {!mine && !reported && !confirming && act("Report", () => setConfirming(true))}
      </div>

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
            fontFamily: "var(--sans)", fontSize: 13.5, fontWeight: 600,
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
  // One fetch per circle per session; the store holds the list. Takes are
  // opened, not watched — a standing listener per circle is the wrong cost
  // shape for a surface most days nobody writes in.
  React.useEffect(() => { void LIVE.social.loadTakes(gid); }, [gid]);

  // Circle-scoped by D1, and this panel has no world-scale variant to fall
  // into: every rule behind it resolves membership through the group doc.
  if (!LIVE.enabled || !gid || !qid) return null;

  const takes = LIVE.social.takes(gid, qid);
  const group = (LIVE.social.groups() as LiveGroupLite[]).find((g) => g.id === gid);
  const names = group?.memberNames || {};
  const uid = LIVE.uid;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
      {takes.map((t) => (
        <LtTakeRow
          key={t.id}
          take={t}
          gid={gid}
          // A member who has left keeps their take but not their entry in
          // memberNames. "Member" is the honest fallback; inventing a name
          // for a uid the circle no longer lists would be worse.
          name={names[t.authorUid] || "Member"}
          mine={!!uid && t.authorUid === uid}
        />
      ))}
      {!takes.length && (
        <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)" }}>
          No takes yet. Say the first thing.
        </span>
      )}
      <LtComposer gid={gid} qid={qid} />
    </div>
  );
}

// Render-time lookup bridge for the spec layer.
Object.assign(globalThis, { LiveTakesPanel });

export default LiveTakesPanel;
