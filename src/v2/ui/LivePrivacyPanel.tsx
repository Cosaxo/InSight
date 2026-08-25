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
import NAV from "../data/nav";
import { loadMine as loadPurchases, mine as myPurchases, subscribePurchases } from "../data/purchases";
import Avatar from "./Avatar";
// The handle is a FACT here, never a control (D211). The claim control
// this panel carried for accounts that predate D190's first-run screen
// was read on a device as an offer to change the handle — which is
// exactly the thing D190 §2 abolished, and a control that looks like the
// abolished thing is as bad as having it. Identity is asked at sign-in
// (LiveProfileSetup); this panel only states what the account holds.
import { atHandle } from "../data/handles";
// The hosted origin for the legal pages. Lives in data/links.ts now so
// invites and legal links share one constant — a domain change stays a
// single edit (D3).
import { SITE_ORIGIN as LP_SITE } from "../data/links";

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
  const [busy, setBusy] = React.useState(false);
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [photoMsg, setPhotoMsg] = React.useState<string | null>(null);
  // whether this account holds any purchase — decides the room's door row
  // below (one session-cached mine-only query; empty for almost everyone)
  React.useEffect(() => {
    if (!LIVE.enabled) return;
    const un = subscribePurchases(() => tick((t) => t + 1));
    void loadPurchases().catch(() => { /* no row, which is the true state we can show */ });
    return un;
  }, []);
  const bought = LIVE.enabled && (myPurchases() || []).length > 0;
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
  const nuke = async () => {
    setBusy(true); setErr(null);
    try { await LIVE.deleteAccount(); location.reload(); }
    catch (e) { setErr(String((e instanceof Error && e.message) || e)); setBusy(false); }
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

      {/* The handle, as the FACT it is (D211) — and only when there is one.
          Under the name on purpose: the name is what a reveal calls you and
          can be anything, the handle is unique and is how a friend reaches
          you — and someone reading top to bottom meets them in that order.

          THE CLAIM CONTROL IS GONE. D190 made a handle claimed-once and
          left this row a claim form "for the accounts that predate that
          screen and for anyone who skipped it" — and that form is exactly
          what the owner's own device drew (LIVE.handle is "" until the
          profile doc hydrates, and for any account that skipped the
          screen), where it reads as an offer to pick a handle from
          settings — the thing D190 §2 abolished. A control that looks
          like the abolished thing is as bad as having it. The handle is
          asked where identity is set (LiveProfileSetup, at first run); an
          account that skipped it stays handle-less and can still be added
          to circles by invite code.

          THREE ROWS LEFT WITH IT (D211): Sign-in — the D134 gate walls
          every release build behind Google, so the row could only ever
          read "Linked ✓", and on a build without the gate a link control
          in settings is not the fix for a session that should have been
          linked at the door. Crash reports — the toggle is gone and
          reporting is on (D76 amended); a recorded opt-out from an older
          build is still honoured at every send site (sentry.ts), because
          removing a switch must not flip anyone's recorded choice. */}
      {LIVE.handle ? (
        <LpRow title="Your handle" sub="Friends add you by this. It can’t be changed.">
          <span style={{ fontFamily: "var(--mono, monospace)", fontSize: 13.5, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
            {atHandle(LIVE.handle)}
          </span>
        </LpRow>
      ) : null}

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

      {/* The buyer's room's door — the account sheet is its natural home
          (PAID-PLAN §7, D288). Rendered only for an account that HAS
          purchases: the buying path's own door is the composer, and a
          standing row about contracts almost nobody holds is furniture.
          One session-cached mine-only query decides it. */}
      {bought && (
        <LpRow title="Asked by you"
          sub="Your paid questions and their reports — live public numbers, nothing private.">
          {btn("Open →", () => NAV.openAskedByYou())}
        </LpRow>
      )}

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
