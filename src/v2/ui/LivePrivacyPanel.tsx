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
import LIVE from "../data/live";
// The handle is claimed here because this is where identity already
// lives — the display name is next door, and the two are different
// things: a name is what a reveal calls you, a handle is how someone
// finds you (D122).
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
  const [name, setName] = React.useState(() => {
    try { return localStorage.getItem("insight.displayName.v1") || ""; } catch { return ""; }
  });
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
  if (!LIVE.enabled) return null;

  const saveName = async () => {
    const n = name.trim().slice(0, 60);
    if (!n) return;
    setBusy(true); setErr(null);
    try {
      await LIVE.saveDisplayName(n);
      try { localStorage.setItem("insight.displayName.v1", n); } catch { /* best-effort */ }
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
          them in that order. */}
      <LpRow title={LIVE.handle ? `Your handle · ${atHandle(LIVE.handle)}` : "Your handle"}
        sub={LIVE.handle
          ? "Friends add you by this. Changing it frees the old one for someone else."
          : "Claim a handle so friends can add you to a circle without swapping codes."}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input value={handle} onChange={(e) => setHandle(e.target.value)}
            placeholder={LIVE.handle ? atHandle(LIVE.handle) : "@yourname"}
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
            {hBusy ? "…" : LIVE.handle ? "Change" : "Claim"}
          </button>
        </div>
      </LpRow>
      {(handleProblem(handle) || hMsg) && (
        <div role="status" style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600,
          color: "var(--ink-2)", margin: "-6px 0 10px" }}>
          {handleProblem(handle) || hMsg}
        </div>
      )}

      <LpRow title="Sign-in"
        sub={linked
          ? "Linked — your history now survives any device."
          // Since D6 turned Android system backup off (it would have copied
          // the local cache to Google Drive), linking is now the ONLY way an
          // anonymous session survives a phone swap. Say so plainly rather
          // than letting someone find out by losing everything.
          : "You're on an anonymous session — it lives only on this phone. Link Google so your history survives a lost or replaced device; same account, nothing moves."}>
        {btn(linked ? "Linked ✓" : "Link Google", link)}
      </LpRow>

      <LpRow title="Crash reports"
        sub={telemetry
          ? "On (default) — anonymous crash and error reports (uid only, never your answers) help fix bugs. Turn off any time."
          : "Off — this app sends no reports. Turn on to send anonymous crash reports (uid only, never your answers)."}>
        {btn(telemetry ? "On ✓" : "Off", toggleTelemetry)}
      </LpRow>

      {/* TEN BULLETS BEHIND A SUMMARY (D171), and the split is the whole
          point rather than a compromise.

          The owner's note was "you can remove almost the entire list — it
          is not needed", and the vision's principle behind it is right:
          this app removes text wherever text is standing in for a design.
          But this list is not decoration. Every bullet is a promise the
          rules or a function enforce, several exist because a specific
          decision made them true (D9's location, D84's presence, D98's
          public answers, D146's type cut), and both app stores require the
          disclosure to be reachable. Deleting them would not simplify the
          screen; it would make the screen stop being true.

          So the SCREEN loses the wall and the DISCLOSURE loses nothing.
          One sentence stays open — the bluntest one, the one CLAUDE.md
          insists on, because a user learning that their answers are public
          from a stranger quoting a vote back at them is the failure this
          panel exists to prevent. The rest is one tap away, in a `details`
          so the tap costs no JavaScript and screen readers get a real
          disclosure widget rather than a div pretending.

          If a future bullet is genuinely obsolete, delete THAT bullet with
          the decision that retires it. This is a layout change and must
          not be read as permission to thin the promises. */}
      <div style={{ padding: "11px 0", borderBottom: LP_LINE }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink-2)", lineHeight: 1.6 }}>
          <strong style={{ fontWeight: 800 }}>Your answers are public</strong>, under your display
          name, with the profile facts you have filled in. Nothing you answer here is private.
        </div>
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer", fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 800, color: "var(--ink-2)", WebkitAppearance: "none" }}>
            What leaves your device
          </summary>
        <ul style={{ margin: "8px 0 0", paddingLeft: 17, fontSize: 12.5, fontWeight: 500, color: "var(--ink-2)", lineHeight: 1.65 }}>
          {/* The first bullet, and deliberately the bluntest sentence in
              the app. D98 made answers public; a user learning that from
              a stranger quoting their vote back at them would be the
              worst possible way to find out.

              It says "age" and not "age band" since D155: the snapshot
              now carries BOTH, and the exact one is what a card naming a
              person prints. Naming the coarser of the two would be the
              same failure as the paragraph above describes, one field
              down. "profession" was missing outright — an anchor that has
              published since D8 and was never listed here. */}
          <li><strong>Your answers are public.</strong> Anyone using InSight can see what you
          answered, under your display name, along with the age, gender, city, country,
          education, profession, relationship status and height band you have filled in.
          That is what the app is for —
          it is how you see who answers like you — but it means nothing you answer here is
          private. Answer accordingly.</li>
          <li>That includes the political, personal and sensitive questions. There is no
          category of question that is held back, and no group size too small to show: counts
          are exact from the very first answer, so in a small cohort a count of 1 is visibly
          one person&apos;s answer.</li>
          <li>Your display name is shown with your answers. Leave it blank to appear
          as &ldquo;Someone&rdquo; — that hides the name, not the answers.</li>
          {/* The type cut's disclosure. Nothing NEW leaves the device for
              it — answers were already public and testResults already
              world-readable, and the cut is arithmetic anyone could have
              run on both. But "the app groups my answers by my
              personality type and shows that to strangers" is not
              something a user should have to derive from two other
              bullets, and the retroactive half is the part they cannot
              guess: it applies to answers given long before the type
              existed. `docs/data-inventory.md` carried a flat "nothing is
              ever cross-tabbed by a test result" and pointed HERE as the
              place it was stated in full; that claim is now narrower, so
              this is where the narrower one goes. */}
          <li>Your answers can be grouped by your Big Five type. That type is worked out
          from the test cards you answer in the feed, so it can change as you answer more —
          and because it is read fresh each time, it applies to <em>everything</em> you have
          ever answered, including answers you gave before you had a type at all. Your
          politics, values and social results are never used to group answers this way.</li>
          <li>Group &amp; 1v1 answers stay sealed until the next day&apos;s reveal — that is the
          game, not a privacy promise. Once revealed they read like every other answer.</li>
          {/* This line has been rewritten twice, and the second time the
              GUARANTEE changed rather than the wording. "No device
              location, ever" was true until D9 added the optional
              "Use my location" button. What survives is the part that
              actually matters and is still enforced by construction: the
              fix is resolved to a city in src/v2/data/locate.ts and the
              coordinate is discarded there — it is never returned to a
              caller, stored, or transmitted. Claiming "no location" now
              would be false, so it does not. */}
          <li>Location is optional and off until you ask for it. If you tap &ldquo;use my location&rdquo;, your phone works out the nearest city <em>on the device</em> and sends only that name — never your coordinates, which are never stored or transmitted. You can skip it and pick your city from a list instead, and your country follows from the city either way.</li>
          {/* D84. The presence cell is the second location-shaped thing the
              app can hold, and this bullet is its disclosure: what is shared
              (a ~1 km grid square, computed on the device, the coordinate
              discarded), who can read it (no user — the server answers only
              with a count), when (foreground, opted in), and the way out
              (off deletes the doc; deleting the account does too). If the
              mechanics change, this sentence changes in the same commit. */}
          <li>&ldquo;Right now, around you&rdquo; (the Near counter) is optional and off by default. While it&rsquo;s on and the app is open, your phone shares a ~200-metre grid square — worked out on the device from a precise fix, the coordinates discarded there — so the server can answer <em>how many</em> people are around you. No other user can ever read your square; a count is all that comes back. Your square keeps counting for up to three hours after you close the app, which is what lets a room stay populated while phones are in pockets; turning Near off (or deleting your account) deletes it immediately.</li>
          <li>No IP-based location lookup, no background or continuous location, no location history.</li>
          {/* This line has now been wrong twice, in opposite directions,
              and the second time is the one worth remembering. "No
              comments from strangers" stood here until the D106 sweep,
              and D83 had already made it false: world takes are exactly
              strangers' comments. The sweep replaced it with "always
              without a name" — a claim D98 had made false in the same
              commit that made answers public, and one the takes panel
              contradicts on screen, where it heads the composer "Takes ·
              posted under your name" and resolves every author through
              LIVE.nameFor. So the sweep meant to delete a false claim
              wrote a new one, of the worse kind: claiming an anonymity
              the app does not give reads as a protection, which is the
              exact failure this panel exists to prevent. Pinned by
              LivePrivacyPanel.test.tsx so the next rewrite has to argue
              with an assertion. */}
          <li>Takes are posted under your name — on world questions as well as inside a circle, the same name your answers carry. One take per person per question. Report a take, or hide that author on this device, from the take itself.</li>
          <li>No contacts. No ads, no tracking, no third-party analytics.</li>
        </ul>
        </details>
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

      {/* The topic-preference panel stood here (D128) and is gone (D172):
          how much of a subject you see is the algorithm's job, not a
          lever's. Muting a topic outright survives, in the feed's own
          topic sheet, which is where it was always reachable. */}
    </div>
  );
}

// Render-time lookup bridge for the spec layer (profile-overlay.jsx).
Object.assign(globalThis, { LivePrivacyPanel });

export default LivePrivacyPanel;
