// LiveSignInGate — the SCREEN of the first-launch account wall (D133).
// SignInGate.tsx decides whether it is ever rendered and dynamic-imports
// this file; see its header for why the two are separate (3 KB of
// first-paint weight for a screen only one build shows).
//
// THIS REVERSES D3 FOR ONE BUILD, DELIBERATELY. D3 is anonymous-first and
// says the upgrade is "never a wall", and that decision is unchanged for
// the public build: this gate is off unless `VITE_REQUIRE_SIGNIN=true`, and
// only `ios-release.yml` sets it. The reason it is worth having on the test
// track is the thing D3 was protecting against, arriving from the other
// side — D6 turned Android system backup off and iOS never had it, so an
// anonymous session lives on ONE phone and dies with it. A tester who
// answers for two weeks and then replaces a handset has produced nothing.
// A wall costs a tap; the alternative cost a fortnight of somebody's
// evenings.
//
// It is a flag rather than a code change so the public build can drop it
// without a diff, and so a bad day on the test track is one variable away
// from being over.
//
// WHAT IT DOES NOT DO: create an account. `initLive()` has already signed
// the session in anonymously by the time this renders, so the button LINKS
// that session — same uid, every answer kept. Which matters more than it
// sounds: a tester who has already answered under this build keeps their
// history when the gate first appears.
import React from "react";
import LIVE from "../data/live";
// Direct, not through LIVE: this is the one path that abandons the current
// session rather than upgrading it, and it is deliberately not on the store
// surface for spec-layer JSX to find by name.
import { googleSignIn } from "../../lib/firebase";

const GATE_LINE = "1px solid color-mix(in oklch, var(--rule), transparent 25%)";

function GateShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "var(--surface-2)", color: "var(--ink)",
      display: "flex", flexDirection: "column", justifyContent: "center",
      padding: "0 26px", paddingTop: "env(safe-area-inset-top)",
      paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)",
      overflowY: "auto", zIndex: 40,
    }}>
      <div style={{ width: "100%", maxWidth: 420, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

function GateTitle() {
  return (
    <div style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 30, letterSpacing: "-0.03em", marginBottom: 10 }}>
      in<span style={{ color: "var(--c-world)" }}>Sight</span>
    </div>
  );
}

function GateBody({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: "var(--sans)", fontSize: 14.5, fontWeight: 500, lineHeight: 1.55,
      color: "var(--ink-2)", margin: "0 0 22px", textWrap: "pretty" }}>{children}</p>
  );
}

function GateButton({ label, onClick, busy }: {
  label: string;
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button className="press" onClick={onClick} disabled={busy}
      style={{ width: "100%", border: GATE_LINE, borderRadius: 999, padding: "14px 18px",
        background: "var(--ink)", color: "var(--surface)", cursor: busy ? "default" : "pointer",
        fontFamily: "var(--sans)", fontWeight: 800, fontSize: 15,
        WebkitAppearance: "none", opacity: busy ? 0.5 : 1 }}>
      {busy ? "…" : label}
    </button>
  );
}

/**
 * The Google account already belongs to another InSight uid.
 *
 * Firebase refuses the link rather than merging, which is correct — two
 * histories cannot become one — so the only way forward is to sign in to
 * the existing account and leave this session's answers behind. That is a
 * DESTRUCTIVE choice from the user's side, so it is a second, named button
 * with the consequence written on it, never something the first tap does
 * quietly. At first launch there is nothing to lose and the sentence still
 * holds; on a session that has answered, it is the only warning there is.
 */
const IN_USE = /credential-already-in-use|email-already-in-use|account-exists/i;

// Rendered ONLY when SignInGate has already established that this build
// requires an account and the session is not linked yet. It therefore has
// no pass-through arm and takes no children: a screen that could also
// decide not to be a screen is two rules for one thing, and the version of
// this that shipped nowhere had both.
function LiveSignInGate() {
  const [, tick] = React.useState(0);
  React.useEffect(() => LIVE.subscribe(() => tick((t) => t + 1)), []);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [inUse, setInUse] = React.useState(false);

  const clean = (e: unknown) => String((e instanceof Error && e.message) || e).replace(/^.*?: */, "");

  const link = async () => {
    setBusy(true); setErr(null);
    try {
      await LIVE.linkGoogle();
    } catch (e) {
      // The store's auth observer is what flips `linked`, and it will not
      // fire for a failed link — so the error has to land on screen or the
      // gate just sits there.
      if (IN_USE.test(String((e instanceof Error && e.message) || e))) setInUse(true);
      else setErr(clean(e));
    }
    setBusy(false);
  };

  const signInToExisting = async () => {
    setBusy(true); setErr(null);
    try {
      // live.ts's auth observer sees the uid change and runs
      // resetForNewUid, which is what clears this session's local state —
      // so nothing here has to know how to do that.
      await googleSignIn();
    } catch (e) { setErr(clean(e)); }
    setBusy(false);
  };

  // Boot has not attached. Not the demo app: this build's whole premise is
  // that answers are kept, and demo answers are not kept. Says why, because
  // a phone has no console to ask (the `bootError` argument, D77).
  if (!LIVE.enabled) {
    return (
      <GateShell>
        <GateTitle />
        <GateBody>
          Can&rsquo;t reach InSight yet{LIVE.bootError ? ` — ${LIVE.bootError}` : ""}.
          This build keeps your answers to a real account, so it waits for a
          connection rather than showing you sample questions.
        </GateBody>
        <GateButton label="Try again" onClick={() => location.reload()} busy={busy} />
      </GateShell>
    );
  }

  return (
    <GateShell>
      <GateTitle />
      <GateBody>
        {inUse
          ? "That Google account already has an InSight history. Signing in to it "
            + "leaves this phone's answers behind — they are not merged."
          : "Sign in so your answers survive this phone. This is a test build: "
            + "without an account, everything you answer lives only on this "
            + "device and is gone with it."}
      </GateBody>
      <GateButton
        label={inUse ? "Sign in and leave this phone's answers" : "Continue with Google"}
        onClick={() => void (inUse ? signInToExisting() : link())}
        busy={busy}
      />
      {inUse && (
        <button className="press" onClick={() => { setInUse(false); setErr(null); }} disabled={busy}
          style={{ width: "100%", marginTop: 10, border: "none", background: "none", padding: "10px 0",
            cursor: "pointer", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 13.5,
            color: "var(--ink-3)", WebkitAppearance: "none" }}>
          Use a different account
        </button>
      )}
      {err && (
        <div role="alert" style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600,
          color: "oklch(0.5 0.19 25)", marginTop: 14, lineHeight: 1.5 }}>{err}</div>
      )}
    </GateShell>
  );
}

export default LiveSignInGate;
