// LiveSignInGate — the SCREEN of the first-launch account wall (D134).
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
// WHAT IT DOES NOT DO WHERE IT CAN AVOID IT: create an account. initLive()
// has already signed the session in anonymously by the time this renders,
// so Apple, Google and CREATE-with-email all LINK that session — same uid,
// every answer kept. Someone who answered before the gate appeared keeps
// their history. Signing IN to an account that already exists is the one
// path that cannot: two histories do not merge, and the screen says so in
// those words before it happens.
//
// BUILT TO design/front-door-2026-09-07 (visual request 9), which is the
// authority for the copy and the three behaviours a static reading loses:
// the toggle hides while the keyboard is up or a door is in flight, the
// legal footer hides while the keyboard is up, and every door dims while
// another is flying. Its README is the readable half of that canvas.
import React from "react";
import LIVE from "../data/live";
// Direct, not through LIVE: these are the paths that ABANDON the current
// session rather than upgrading it, and they are deliberately not on the
// store surface for spec-layer JSX to find by name.
import { googleSignIn, type EmailFailure } from "../../lib/firebase";

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
  // The stacked lockup (D302): full iris over the wordmark — at 44px the
  // full mark holds (compact is for below ~24px). Fills are the live
  // tokens, one dot per accent hue. The negative left margin trims the
  // artwork's built-in breathing room so the mark sits optically flush
  // with the text edge.
  return (
    <div style={{ marginBottom: 10 }}>
      <svg viewBox="0 0 100 100" width="44" height="44" aria-hidden="true"
        style={{ display: "block", margin: "0 0 12px -5px" }}>
        <path d="M50 33 L64.7 41.5 L64.7 58.5 L50 67 L35.3 58.5 L35.3 41.5 Z M50 33 L50 16 M64.7 41.5 L82.3 39.5 M64.7 58.5 L82.3 60.5 M50 67 L50 84 M35.3 58.5 L17.7 60.5 M35.3 41.5 L17.7 39.5"
          fill="none" stroke="oklch(0.62 0.012 70)" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="50" cy="16" r="5.5" fill="var(--c-around)" />
        <circle cx="70" cy="22.5" r="5.5" fill="var(--c-groups)" />
        <circle cx="82.3" cy="39.5" r="5.5" fill="var(--c-city)" />
        <circle cx="82.3" cy="60.5" r="5.5" fill="var(--c-likeness)" />
        <circle cx="70" cy="77.5" r="5.5" fill="var(--c-world)" />
        <circle cx="50" cy="84" r="5.5" fill="var(--c-today)" />
        <circle cx="30" cy="77.5" r="5.5" fill="var(--c-around)" />
        <circle cx="17.7" cy="60.5" r="5.5" fill="var(--c-groups)" />
        <circle cx="17.7" cy="39.5" r="5.5" fill="var(--c-city)" />
        <circle cx="30" cy="22.5" r="5.5" fill="var(--c-likeness)" />
        <circle cx="50" cy="33" r="6" fill="var(--c-today)" />
        <circle cx="64.7" cy="41.5" r="6" fill="var(--c-people)" />
        <circle cx="64.7" cy="58.5" r="6" fill="var(--c-groups)" />
        <circle cx="50" cy="67" r="6" fill="var(--c-world)" />
        <circle cx="35.3" cy="58.5" r="6" fill="var(--c-around)" />
        <circle cx="35.3" cy="41.5" r="6" fill="var(--c-likeness)" />
        <circle cx="50" cy="50" r="8" fill="var(--ink)" />
      </svg>
      <div style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 30, letterSpacing: "-0.03em" }}>
        In<span style={{ color: "var(--c-world)" }}>Sight</span>
      </div>
    </div>
  );
}

function GateBody({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: "var(--sans)", fontSize: 14.5, fontWeight: 500, lineHeight: 1.55,
      color: "var(--ink-2)", margin: "0 0 22px", textWrap: "pretty" }}>{children}</p>
  );
}

// `label` is a STRING PROP, so an HTML entity in it renders literally —
// "phone&rsquo;s answers" is what the first version of the in-use button
// showed, and only the test caught it. Use \u2019 in a prop and &rsquo;
// in JSX text; they are not interchangeable.
function GateButton({ label, onClick, busy, dim, disabled, variant }: {
  label: string;
  onClick: () => void;
  busy?: boolean;
  dim?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}) {
  const secondary = variant === "secondary";
  return (
    <button className="press" onClick={onClick} disabled={disabled || busy}
      style={{ width: "100%", marginTop: 10, border: GATE_LINE, borderRadius: 999,
        padding: "14px 18px",
        background: secondary ? "var(--surface)" : "var(--ink)",
        color: secondary ? "var(--ink)" : "var(--surface)",
        cursor: disabled || busy ? "default" : "pointer",
        fontFamily: "var(--sans)", fontWeight: 800, fontSize: 15,
        WebkitAppearance: "none",
        // Dim is the OTHER doors while one is flying, and it is not the
        // same as busy: the tapped door keeps full contrast and shows the
        // spinner, so the screen says which one you are waiting on.
        opacity: busy ? 0.7 : dim ? 0.4 : 1,
        transition: "opacity .12s" }}>
      {busy ? "\u2026" : label}
    </button>
  );
}

function GateField({ id, label, ...rest }: {
  id: string; label: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label htmlFor={id} style={{ display: "block", marginTop: 10 }}>
      <span style={{ display: "block", fontFamily: "var(--sans)", fontSize: 12,
        fontWeight: 700, color: "var(--ink-3)", marginBottom: 5 }}>{label}</span>
      {/* fontSize is the TOKEN, never a literal — 16 included. styles.css
          owns the number and the reasoning (a field under 16px makes iOS
          zoom the whole fixed app shell and nothing zooms it back), and
          `check:touch-zoom` fails a literal precisely so the number stays
          in one place. It caught this line. */}
      <input id={id} {...rest}
        style={{ width: "100%", border: GATE_LINE, borderRadius: 14,
          padding: "13px 15px", background: "var(--surface)", color: "var(--ink)",
          fontFamily: "var(--sans)", fontWeight: 600,
          fontSize: "var(--field-size)",
          WebkitAppearance: "none" }} />
    </label>
  );
}

// A quiet control that is a link in everything but markup — the toggle,
// Cancel, Forgot password?, and each error's way out all wear it.
function GateQuiet({ label, onClick, disabled, lead }: {
  label: string; onClick: () => void; disabled?: boolean; lead?: string;
}) {
  return (
    <div style={{ textAlign: "center", marginTop: 12 }}>
      {lead && <span style={{ fontFamily: "var(--sans)", fontSize: 13.5, fontWeight: 600,
        color: "var(--ink-3)", marginRight: 6 }}>{lead}</span>}
      <button className="press" onClick={onClick} disabled={disabled}
        style={{ border: "none", background: "none", padding: "6px 2px", minHeight: 34,
          cursor: disabled ? "default" : "pointer", fontFamily: "var(--sans)",
          fontWeight: 800, fontSize: 13.5, color: "var(--ink)",
          WebkitAppearance: "none", opacity: disabled ? 0.5 : 1 }}>
        {label}
      </button>
    </div>
  );
}

/**
 * The account already belongs to another InSight uid.
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

// The design gives every failure a way out rather than a description, and
// this table is that decision in one place. `action` is null where there
// is nothing to offer but reading the sentence again.
const FAILURES: Record<EmailFailure, { say: string; action: null | "create" | "signin" | "forgot" }> = {
  offline: { say: "You\u2019re offline. Check your connection, then try again.", action: null },
  "wrong-password": { say: "That password doesn\u2019t match this address.", action: "forgot" },
  "no-account": { say: "No account uses this address yet.", action: "create" },
  taken: { say: "This address already has an account.", action: "signin" },
  weak: { say: "Pick a password of at least six characters.", action: null },
  "bad-address": { say: "That doesn\u2019t look like an email address.", action: null },
  other: { say: "That didn\u2019t work. Try again in a moment.", action: null },
};

// Rendered ONLY when SignInGate has already established that this build
// requires an account and the session is not linked yet. It therefore has
// no pass-through arm and takes no children: a screen that could also
// decide not to be a screen is two rules for one thing, and the version of
// this that shipped nowhere had both.
function LiveSignInGate() {
  const [, tick] = React.useState(0);
  React.useEffect(() => LIVE.subscribe(() => tick((t) => t + 1)), []);

  const [screen, setScreen] = React.useState<"door" | "reset">("door");
  const [expanded, setExpanded] = React.useState(false);
  const [mode, setMode] = React.useState<"signin" | "create">("signin");
  const [flight, setFlight] = React.useState<null | "apple" | "google" | "email">(null);
  const [failure, setFailure] = React.useState<EmailFailure | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [inUse, setInUse] = React.useState(false);
  const [address, setAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  // A proxy for the keyboard, and the honest one available to a WebView:
  // a text field having focus is when the keyboard is up. The design hides
  // the toggle and the footer then, so a 375-high phone still shows the
  // password field and its button.
  const [typing, setTyping] = React.useState(false);

  const signin = mode === "signin";
  const inFlight = flight !== null;
  const clean = (e: unknown) => String((e instanceof Error && e.message) || e).replace(/^.*?: */, "");

  // One wrapper for every door: it owns the flight flag, clears the last
  // failure, and routes the already-in-use case to the destructive arm.
  // Each door passing its own try/catch was how the Google-only version
  // grew three copies of the same four lines.
  const fly = async (which: "apple" | "google" | "email", run: () => Promise<void>) => {
    setFlight(which); setErr(null); setFailure(null);
    try {
      await run();
    } catch (e) {
      const f = (e as { failure?: EmailFailure }).failure;
      if (f) setFailure(f);
      else if (IN_USE.test(String((e instanceof Error && e.message) || e))) setInUse(true);
      // The store's auth observer is what flips `linked`, and it will not
      // fire for a failed attempt — so the error has to land on screen or
      // the gate just sits there.
      else setErr(clean(e));
    }
    setFlight(null);
  };

  const submitEmail = () => fly("email", () =>
    signin ? LIVE.emailSignIn(address.trim(), password)
           : LIVE.emailCreate(address.trim(), password));

  // The verify screen's three controls. Each keeps its own word rather
  // than sharing `err`: "still not confirmed" is not an error, it is the
  // answer to the question the button asked.
  const [verifyWord, setVerifyWord] = React.useState<string | null>(null);
  const checkVerified = async () => {
    setFlight("email"); setVerifyWord(null);
    try {
      // A false here re-renders nothing on its own — needsEmailVerify is
      // unchanged — so the screen has to say so itself or the tap looks
      // broken. A true flips the flag in the store and this component
      // unmounts with the wall.
      const ok = await LIVE.refreshVerification();
      if (!ok) setVerifyWord("Not confirmed yet. Open the link, then tap again.");
    } catch (e) { setVerifyWord(clean(e)); }
    setFlight(null);
  };
  const resend = async () => {
    setFlight("email"); setVerifyWord(null);
    try {
      await LIVE.sendVerification();
      // sendVerification is best-effort and never throws (firebaseImpl
      // says why), so this sentence is about what was ATTEMPTED. Claiming
      // delivery would be the one thing it cannot know.
      setVerifyWord("Sent again. It can take a minute to arrive.");
    } catch (e) { setVerifyWord(clean(e)); }
    setFlight(null);
  };
  const startOver = async () => {
    setFlight("email"); setVerifyWord(null);
    try {
      await LIVE.abandonSignIn();
    } catch (e) { setVerifyWord(clean(e)); }
    setFlight(null);
  };

  const sendReset = () => fly("email", async () => {
    await LIVE.emailReset(address.trim());
    setScreen("reset");
  });

  const signInToExisting = async () => {
    setFlight("google"); setErr(null);
    try {
      // live.ts's auth observer sees the uid change and runs
      // resetForNewUid, which is what clears this session's local state —
      // so nothing here has to know how to do that.
      await googleSignIn();
    } catch (e) { setErr(clean(e)); }
    setFlight(null);
  };

  // Boot has not attached. Not the demo app: this build's whole premise is
  // that answers are kept, and demo answers are not kept. Says why, because
  // a phone has no console to ask (the `bootError` argument, D77).
  if (!LIVE.enabled) {
    return (
      <GateShell>
        <GateTitle />
        <GateBody>
          Can&rsquo;t reach InSight yet{LIVE.bootError ? ` \u2014 ${LIVE.bootError}` : ""}.
          This build keeps your answers to a real account, so it waits for a
          connection rather than showing you sample questions.
        </GateBody>
        <GateButton label="Try again" onClick={() => location.reload()} />
      </GateShell>
    );
  }

  // THE ACCOUNT EXISTS AND THE ADDRESS DOES NOT YET BELONG TO ANYONE.
  // Its own screen, ahead of every other, because the wall is up for a
  // different reason here: there is nothing to sign in to and no door to
  // choose — the account is made, and one link stands between it and the
  // app. Reached on a relaunch as well as straight after the create, so
  // it names the address from the STORE rather than from the field above,
  // which a relaunch has emptied.
  if (LIVE.needsEmailVerify) {
    const at = LIVE.accountEmail || address.trim();
    return (
      <GateShell>
        <GateTitle />
        <div style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 19,
          letterSpacing: "-0.02em", marginBottom: 8 }}>Confirm your address</div>
        <GateBody>
          We sent a link to <strong>{at || "your address"}</strong>. Open it, then come back.
        </GateBody>
        <GateButton label={"I\u2019ve confirmed it"} onClick={() => void checkVerified()}
          busy={inFlight} />
        <GateQuiet label="Send it again" disabled={inFlight} onClick={() => void resend()} />
        {verifyWord && (
          <div role="alert" style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600,
            color: "var(--ink-2)", marginTop: 14, lineHeight: 1.5, textAlign: "center" }}>
            {verifyWord}
          </div>
        )}
        {/* The way out of a typo, and the reason this screen is not a
            locked room: the account keeps the wrong address, this device
            gets a fresh anonymous session, and the doors come back. */}
        <GateQuiet label="Use a different address" disabled={inFlight}
          onClick={() => void startOver()} />
      </GateShell>
    );
  }

  // The reset confirmation. Its own screen because there is nothing to do
  // here but leave for an inbox, and a form still on display would invite
  // a second send.
  if (screen === "reset") {
    return (
      <GateShell>
        <GateTitle />
        <div style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 19,
          letterSpacing: "-0.02em", marginBottom: 8 }}>Check your inbox</div>
        <GateBody>
          We sent a reset link to <strong>{address.trim() || "your address"}</strong>. It works for an hour.
        </GateBody>
        <GateButton label="Open Mail" onClick={() => {
          // iOS has no "open the mail app" API from a WebView; the mail
          // scheme is what there is, and a device without a mail client
          // simply does nothing rather than erroring.
          try { location.href = "message://"; } catch { /* no mail client */ }
        }} />
        <GateQuiet label="Back to sign in" onClick={() => {
          setScreen("door"); setExpanded(true); setMode("signin"); setFailure(null);
        }} />
      </GateShell>
    );
  }

  if (inUse) {
    return (
      <GateShell>
        <GateTitle />
        <GateBody>
          That account already has an InSight history. Signing in to it leaves
          this phone&rsquo;s answers behind &mdash; they are not merged.
        </GateBody>
        <GateButton label={"Sign in and leave this phone\u2019s answers"}
          onClick={() => void signInToExisting()} busy={inFlight} />
        <GateQuiet label="Use a different account" disabled={inFlight}
          onClick={() => { setInUse(false); setErr(null); }} />
        {err && (
          <div role="alert" style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600,
            color: "oklch(0.5 0.19 25)", marginTop: 14, lineHeight: 1.5 }}>{err}</div>
        )}
      </GateShell>
    );
  }

  const f = failure ? FAILURES[failure] : null;
  const primaryLabel = failure === "offline" ? "Try again" : signin ? "Sign in" : "Create account";

  return (
    <GateShell>
      <GateTitle />
      <GateBody>One question a day. See what everyone&rsquo;s answers say about each other.</GateBody>

      {(f || err) && (
        <div role="alert" style={{ fontFamily: "var(--sans)", fontSize: 13, fontWeight: 600,
          color: "oklch(0.5 0.19 25)", marginBottom: 4, lineHeight: 1.5 }}>
          {f ? f.say : err}
          {f?.action === "create" && (
            <button className="press" onClick={() => { setMode("create"); setFailure(null); }}
              style={{ border: "none", background: "none", padding: "4px 6px", minHeight: 32,
                cursor: "pointer", fontFamily: "var(--sans)", fontWeight: 800, fontSize: 13,
                color: "var(--ink)", WebkitAppearance: "none" }}>Create one</button>
          )}
          {f?.action === "signin" && (
            <button className="press" onClick={() => { setMode("signin"); setFailure(null); }}
              style={{ border: "none", background: "none", padding: "4px 6px", minHeight: 32,
                cursor: "pointer", fontFamily: "var(--sans)", fontWeight: 800, fontSize: 13,
                color: "var(--ink)", WebkitAppearance: "none" }}>Sign in instead</button>
          )}
        </div>
      )}

      {/* The email form sits ABOVE the divider when it is open, which is
          the design's ordering: opening email promotes it to the primary
          door rather than leaving it a footnote under two buttons. */}
      {expanded && (
        <>
          <GateField id="gate-email" label="Email" type="email" value={address}
            autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            inputMode="email"
            onFocus={() => setTyping(true)} onBlur={() => setTyping(false)}
            onChange={(e) => { setAddress(e.target.value); setFailure(null); }} />
          <GateField id="gate-password" label="Password" type="password" value={password}
            autoComplete={signin ? "current-password" : "new-password"}
            onFocus={() => setTyping(true)} onBlur={() => setTyping(false)}
            onChange={(e) => { setPassword(e.target.value); setFailure(null); }} />
          {signin && (
            <GateQuiet label="Forgot password?" disabled={inFlight || !address.trim()}
              onClick={() => void sendReset()} />
          )}
          <GateButton label={primaryLabel} onClick={() => void submitEmail()}
            busy={flight === "email"} dim={inFlight && flight !== "email"}
            disabled={!address.trim() || !password} />
          {!typing && !inFlight && (
            <GateQuiet lead={signin ? "New here?" : "Have an account?"}
              label={signin ? "Create an account" : "Sign in"}
              onClick={() => { setMode(signin ? "create" : "signin"); setFailure(null); }} />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0 2px" }}>
            <div style={{ flex: 1, height: 1, background: "var(--rule)" }} />
            <span style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 700,
              color: "var(--ink-3)" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "var(--rule)" }} />
          </div>
        </>
      )}

      {/* Apple leads on iOS: guideline 4.8 wants it offered as prominently
          as any other social login, and its label follows the mode where
          Google's does not (the design's asymmetry, kept). */}
      <GateButton label={signin ? "Sign in with Apple" : "Sign up with Apple"}
        onClick={() => void fly("apple", () => LIVE.linkApple())}
        busy={flight === "apple"} dim={inFlight && flight !== "apple"} />
      <GateButton label="Continue with Google" variant="secondary"
        onClick={() => void fly("google", () => LIVE.linkGoogle())}
        busy={flight === "google"} dim={inFlight && flight !== "google"} />

      <GateQuiet label={expanded ? "Cancel" : "Use email instead"} disabled={inFlight}
        onClick={() => { setExpanded(!expanded); setFailure(null); setErr(null); }} />

      {/* The honest sentence, then the legal one. Both hide while the
          keyboard is up so a small phone keeps the field and its button on
          screen; neither is decoration, so neither is dropped otherwise. */}
      {!typing && (
        <>
          <p style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 700,
            color: "var(--ink-2)", margin: "20px 0 0", textAlign: "center" }}>
            Answers on InSight are public, yours included.
          </p>
          <p style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 500,
            color: "var(--ink-3)", margin: "8px 0 0", textAlign: "center", lineHeight: 1.5 }}>
            By continuing you agree to the{" "}
            <a href="https://prvfire33.web.app/terms.html" target="_blank" rel="noreferrer noopener"
              style={{ color: "var(--ink-2)", fontWeight: 700 }}>Terms</a>{" "}
            and the{" "}
            <a href="https://prvfire33.web.app/privacy.html" target="_blank" rel="noreferrer noopener"
              style={{ color: "var(--ink-2)", fontWeight: 700 }}>Privacy Policy</a>.
          </p>
        </>
      )}
    </GateShell>
  );
}

export default LiveSignInGate;
