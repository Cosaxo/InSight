// LivePrivacyPanel — the account & data panel (Phase 5), shown at the
// top of the profile's General tab in live mode.
//
// Its job did not change at D98, but every sentence in it did. This
// panel exists so that what the app SAYS about who can see what matches
// what firestore.rules actually does. That used to mean explaining a
// set of protections; it now means stating plainly that answers are
// public and attributable, which is a thing a user must be told clearly
// rather than left to discover. A panel that still promised owner-only
// answers would be the exact UI-says-it, server-doesn't failure this
// product defines itself against — just pointed the other way.
//
// Born in this repo (not ported from the design prototype), so it
// lives here as typed TSX. A globalThis assignment at the bottom
// keeps the spec layer's render-time lookup working unchanged.
import React from "react";
import LIVE, { localName } from "../data/live";
import Avatar from "./Avatar";
// The handle is claimed here because this is where identity already
// lives — the display name is next door, and the two are different
// things: a name is what a reveal calls you, a handle is how someone
// finds you (D122). Since D190 the first-run screen asks for both, and
// this row is what remains for the accounts that predate it: a claim for
// an account with no handle, and the handle itself for one that has.
import { atHandle, handleProblem, normalizeHandle } from "../data/handles";
// The hosted origin for the legal pages. Lives in data/links.ts now so
// invites and legal links share one constant — a domain change stays a
// single edit (D3).
import { SITE_ORIGIN as LP_SITE } from "../data/links";
import { setTelemetryEnabled, telemetryEnabled } from "../../lib/sentry";
// Lazy, for the bundle budget: this panel is eager (spec-index), and the
// interests panel plus its store put the total 2 KB over. It is also the
// right thing to defer on the merits — it renders inside the account
// screen, which nothing on the first frame opens.

const LP_LINE = "1px solid color-mix(in oklch, var(--rule), transparent 25%)";

function LpRow({ title, sub, children }: {
  title: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: LP_LINE }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14.5 }}>{title}</div>
        {sub && <div style={{ fontWeight: 500, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.4, marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function LivePrivacyPanel() {
  const [, tick] = React.useState(0);
  React.useEffect(() => LIVE.subscribe(() => tick((t) => t + 1)), []);
  // The profile's name first, this device's copy of it second (D190): the
  // local mirror is what the app can read before hydration lands, not a
  // second source of truth, and reading it first showed a stale name to
  // anyone who had renamed on another device.
  const [name, setName] = React.useState(() => LIVE.displayName || localName());
  const [saved, setSaved] = React.useState(false);
  const [handle, setHandle] = React.useState("");
  const [hBusy, setHBusy] = React.useState(false);
  const [hMsg, setHMsg] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [confirmDel, setConfirmDel] = React.useState(false);
  // Derived from auth via the store, not local state seeded to false: the
  // panel is remounted on every subtab change (profile-overlay.jsx keys on
  // it), so a Google-linked user was told they were anonymous and offered a
  // link that then failed with auth/provider-already-linked.
  const [linkedNow, setLinkedNow] = React.useState(false);
  const linked = LIVE.linked || linkedNow;
  const [telemetry, setTelemetry] = React.useState(telemetryEnabled);
  const [err, setErr] = React.useState<string | null>(null);
  const [photoMsg, setPhotoMsg] = React.useState<string | null>(null);
  if (!LIVE.enabled) return null;

  // The three outcomes worth a sentence, and "removed" is the one that
  // matters: a face a moderator took down is FROZEN against re-upload
  // (firestore.rules), so "try again" would be a loop with no exit.
  const PHOTO_FAIL: Record<string, string> = {
    "too-big": "That picture is too large even after shrinking — try another.",
    removed: "This photo was removed by moderation, so it can’t be replaced here.",
    unavailable: "Couldn’t save that picture just now.",
  };
  const pickPhoto = async (file: File) => {
    setPhotoMsg("Saving…");
    const r = await LIVE.setAvatar(file);
    setPhotoMsg(r.ok ? null : (PHOTO_FAIL[r.reason || ""] || PHOTO_FAIL.unavailable));
  };
  const saveName = async () => {
    const n = name.trim().slice(0, 60);
    if (!n) return;
    setBusy(true); setErr(null);
    try {
      // The store writes the device mirror too, so this panel no longer
      // owns that key (D190) — one writer, and a rename reaches every
      // reader of it.
      await LIVE.saveDisplayName(n);
      setSaved(true); setTimeout(() => setSaved(false), 1800);
    } catch (e) { setErr(String((e instanceof Error && e.message) || e)); }
    setBusy(false);
  };
  const saveHandle = async () => {
    const h = normalizeHandle(handle);
    // The button is disabled without one, so this is the belt on the
    // braces — and it is the same fold the callable runs, so a handle
    // that gets here is one the server will accept or refuse on
    // availability alone.
    if (!h) return;
    setHBusy(true); setHMsg(null);
    try {
      await LIVE.social.claimHandle(h);
      setHandle("");
      setHMsg(`Claimed ${atHandle(h)}`);
      setTimeout(() => setHMsg(null), 2400);
    } catch (e) {
      // "already-exists" is the ONE failure worth its own sentence: it is
      // the common one, it is not the user's mistake, and the raw
      // callable message is a Firebase error code.
      const raw = String((e instanceof Error && e.message) || e);
      setHMsg(/already-exists|taken/i.test(raw) ? `${atHandle(h)} is taken.` : raw.replace(/^.*?: */, ""));
    }
    setHBusy(false);
  };
  const link = async () => {
    setBusy(true); setErr(null);
    try { await LIVE.linkGoogle(); setLinkedNow(true); } catch (e) { setErr(String((e instanceof Error && e.message) || e)); }
    setBusy(false);
  };
  const nuke = async () => {
    setBusy(true); setErr(null);
    try { await LIVE.deleteAccount(); location.reload(); }
    catch (e) { setErr(String((e instanceof Error && e.message) || e)); setBusy(false); }
  };
  const toggleTelemetry = () => {
    const next = !telemetry;
    setTelemetryEnabled(next);
    setTelemetry(next);
  };
  const btn = (label: string, onClick: () => void, danger?: boolean) => (
    <button className="press" onClick={onClick} disabled={busy}
      style={{ border: LP_LINE, borderRadius: 999, cursor: "pointer", padding: "8px 15px",
        fontFamily: "var(--sans)", fontWeight: 800, fontSize: 12.5, WebkitAppearance: "none",
        background: danger ? "oklch(0.55 0.19 25)" : "var(--surface-2)",
        color: danger ? "#fff" : "var(--ink)", opacity: busy ? 0.5 : 1, whiteSpace: "nowrap" }}>{label}</button>
  );

  return (
    <div className="card" style={{ marginBottom: 14, padding: "14px 16px" }}>
      <div className="kicker" style={{ marginBottom: 4 }}>Account &amp; privacy</div>

      {/* THE FACE, ABOVE THE NAME (D178). Both answer "who are you to
          other people", and the photo is the louder half — so it goes
          first, and its sub-line is the disclosure rather than an
          instruction. A photo shows to anyone who can already see your
          name, which since D177 includes people standing near you.

          Reported like a take, not reviewed before it shows (the owner's
          call): the same loop takes have had since D83, so a face carries
          the report control every named surface draws and a remove verdict
          hides it everywhere at once. */}
      <LpRow title="Your photo"
        sub="Shows anywhere your name shows. Reportable like a comment — taking it down is instant.">
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Avatar uid={LIVE.uid || ""} name={name} size={38} />
          <label className="press" style={{
            border: LP_LINE, borderRadius: 999, padding: "7px 13px", cursor: "pointer",
            fontFamily: "var(--sans)", fontWeight: 700, fontSize: 12.5, color: "var(--ink-2)",
          }}>
            {LIVE.myFace() ? "Replace" : "Add photo"}
            {/* A plain file input rather than a camera plugin: it opens the
                photo library on iOS and Android inside the WebView, needs
                no new native permission, and adds nothing to the store
                forms beyond the photo itself. */}
            <input type="file" accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void pickPhoto(f); }} />
          </label>
          {LIVE.myFace() ? btn("Remove", () => LIVE.removeAvatar()) : null}
        </div>
      </LpRow>
      {photoMsg && (
        <div role="status" style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", margin: "-4px 0 10px" }}>
          {photoMsg}
        </div>
      )}

      <LpRow title="Your name" sub="What group and 1v1 partners see in reveals.">
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a name"
            style={{ border: LP_LINE, borderRadius: 9, padding: "8px 11px", width: 132,
              fontFamily: "var(--sans)", fontSize: "var(--field-size)", fontWeight: 600, color: "var(--ink)",
              background: "var(--surface-2)", outline: "none", minWidth: 0 }} />
          {btn(saved ? "Saved ✓" : "Save", saveName)}
        </div>
      </LpRow>

      {/* The handle. Under the name on purpose: the name is what a reveal
          calls you and can be anything, the handle is unique and is how a
          friend reaches you — and someone reading top to bottom meets
          them in that order.

          CLAIMED ONCE (D190). This row offered a "Change" button, and the
          rename behind it was real: claimHandleV2 took the new key and
          released the old one in one transaction, so the name you had
          handed people became free for a stranger to take the same
          minute. That is the whole failure — a handle is an ADDRESS, and
          an address that can be reassigned is one nobody can be given.
          The callable refuses a change now; this shows the handle as the
          fact it is, and the claim control is only ever drawn for an
          account that has none.

          It is asked at sign-in since D190 (LiveProfileSetup), so the
          control here is for the accounts that predate that screen and
          for anyone who skipped it. */}
      {LIVE.handle ? (
        <LpRow title="Your handle" sub="Friends add you by this. It can’t be changed.">
          <span style={{ fontFamily: "var(--mono, monospace)", fontSize: 13.5, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
            {atHandle(LIVE.handle)}
          </span>
        </LpRow>
      ) : (
        <>
          <LpRow title="Your handle"
            sub="Claim a handle so friends can add you to a circle without swapping codes. You only get to pick once.">
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input value={handle} onChange={(e) => setHandle(e.target.value)}
                placeholder="@yourname"
                autoCapitalize="none" autoCorrect="off" spellCheck={false}
                aria-label="Your handle"
                style={{ border: LP_LINE, borderRadius: 9, padding: "8px 11px", width: 132,
                  fontFamily: "var(--sans)", fontSize: "var(--field-size)", fontWeight: 600, color: "var(--ink)",
                  background: "var(--surface-2)", outline: "none", minWidth: 0 }} />
              <button className="press" onClick={() => void saveHandle()}
                disabled={hBusy || !normalizeHandle(handle)}
                style={{ border: LP_LINE, borderRadius: 999, cursor: hBusy ? "default" : "pointer", padding: "8px 15px",
                  fontFamily: "var(--sans)", fontWeight: 800, fontSize: 12.5, WebkitAppearance: "none",
                  background: "var(--surface-2)", color: "var(--ink)",
                  opacity: hBusy || !normalizeHandle(handle) ? 0.5 : 1, whiteSpace: "nowrap" }}>
                {hBusy ? "…" : "Claim"}
              </button>
            </div>
          </LpRow>
          {(handleProblem(handle) || hMsg) && (
            <div role="status" style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600,
              color: "var(--ink-2)", margin: "-6px 0 10px" }}>
              {handleProblem(handle) || hMsg}
            </div>
          )}
        </>
      )}

      <LpRow title="Sign-in"
        sub={linked
          ? "Linked — your history now survives any device."
          // Since D6 turned Android system backup off (it would have copied
          // the local cache to Google Drive), linking is now the ONLY way an
          // anonymous session survives a phone swap. Say so plainly rather
          // than letting someone find out by losing everything.
          : "Anonymous session — it lives only on this phone. Link Google and your history survives a lost device."}>
        {btn(linked ? "Linked ✓" : "Link Google", link)}
      </LpRow>

      <LpRow title="Crash reports"
        sub={telemetry
          ? "On — anonymous crash reports (uid only, never your answers)."
          : "Off — no reports are sent."}>
        {btn(telemetry ? "On ✓" : "Off", toggleTelemetry)}
      </LpRow>

      {/* ONE SENTENCE AND A LINK (D183), where ten bullets behind a
          summary stood (D172).

          D172's comment said a layout change "must not be read as
          permission to thin the promises", and this is not one: the owner
          asked for the list to leave the app and be disclosed elsewhere,
          and "elsewhere" already existed. web/privacy.html is the
          canonical copy, both stores require it to be reachable on the
          open web anyway, and it is linked directly below.

          What the move actually cost, and what was done about it: the
          bullets were the only thing CI could see. LivePrivacyPanel.test
          pinned D9's location promise, D84's presence square, D146's type
          cut and D98's exact counts BY ASSERTING ON THEM, so deleting the
          list deletes the assertions' subject. scripts/check-policy-claims
          is where those assertions went — same claims, same failure, one
          file over.

          And opening that page to move them into found three of them
          already stale: it still said "kilometre-sized" (D175 shrank the
          grid five-fold), "goes stale within minutes" (D174 made it three
          hours) and "a count is all that comes back" (D177 made the room
          readable). The app was right and the policy was wrong the whole
          time — which is the argument FOR one canonical copy, and the
          reason the gate exists rather than a promise to keep it updated.

          The sentence that stays is the bluntest one, the one CLAUDE.md
          insists on: a user learning that their answers are public from a
          stranger quoting a vote back at them is the failure this panel
          exists to prevent, and no link is a substitute for it. */}
      <div style={{ padding: "11px 0", borderBottom: LP_LINE }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink-2)", lineHeight: 1.6 }}>
          <strong style={{ fontWeight: 800 }}>Your answers are public</strong>, under your display
          name, with the profile facts you have filled in. Nothing you answer here is private.
        </div>
        {/* Until now these pages shipped inside the bundle and were linked
            from nowhere — reachable only by knowing the filename. Both
            stores also require the policy to be reachable on the open web,
            so it is served from Firebase Hosting and linked here rather
            than opened from the bundle: one canonical copy, and the link
            keeps working when someone pastes it outside the app. */}
        <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 600 }}>
          <a href={`${LP_SITE}/privacy.html`} target="_blank" rel="noreferrer noopener"
            style={{ color: "var(--accent)", textDecoration: "none" }}>Privacy policy</a>
          <span style={{ color: "var(--ink-3)", padding: "0 7px" }}>·</span>
          <a href={`${LP_SITE}/terms.html`} target="_blank" rel="noreferrer noopener"
            style={{ color: "var(--accent)", textDecoration: "none" }}>Terms</a>
        </div>
      </div>

      <LpRow title="Delete everything"
        sub={confirmDel ? "This wipes your profile, answers, and auth account. There is no undo." : "Your account, answers, and group memberships."}>
        {confirmDel ? (
          <div style={{ display: "flex", gap: 6 }}>
            {btn("Cancel", () => setConfirmDel(false))}
            {btn("Yes, delete", nuke, true)}
          </div>
        ) : btn("Delete…", () => setConfirmDel(true))}
      </LpRow>

      {err && <div style={{ fontSize: 12, fontWeight: 600, color: "oklch(0.5 0.19 25)", marginTop: 8 }}>{err.replace(/^.*?: */, "")}</div>}

      {/* The topic-preference panel stood here (D128) and is gone (D173):
          how much of a subject you see is the algorithm's job, not a
          lever's. Muting a topic outright survives, in the feed's own
          topic sheet, which is where it was always reachable. */}
    </div>
  );
}

// Render-time lookup bridge for the spec layer (profile-overlay.jsx).
Object.assign(globalThis, { LivePrivacyPanel });

export default LivePrivacyPanel;
