// The Near-presence opt-in (D84) — deliberately its OWN tiny store rather
// than a field inside live.ts: live.ts is purge-exempt as the dispatcher,
// and an opt-in that survived an account switch would turn presence ON for
// whoever signs in next on this phone. Sharing your block's headcount is a
// per-person choice; it dies with the account that made it (purge listener
// below) and starts OFF for every new one.
//
// A SWITCH AGAIN SINCE D365 — off or on, the shape D84 shipped. D174 put a
// third state between them (`session`: visible for two hours, then not)
// and made it the default, on the argument that forgetting is the failure
// mode worth designing against. The owner's call (2026-09-05) retires it:
// "near should only have off and on option". What `on` means is D174's
// `always`, unchanged — no deadline on the SETTING, and every beat still
// writes an `until` capped at the linger (live.ts), so it means "visible
// whenever the app is open, and for up to three hours after" — small
// enough to stand behind. The linger, the `until` on the doc and the cap
// in firestore.rules (D174 §§2–3) all stand; only the timed option and
// the deadline it needed are gone.
//
// The loop, the cell and the count live in live.ts (LIVE.near), which
// imports this — one direction, no cycle.

const LS = "insight.nearPresence.v1";
/** D174's session deadline lived here. Read once more to sweep it, never
 * written again. */
const LS_UNTIL = "insight.nearPresence.until.v1";

function readOn(): boolean {
  try {
    const raw = localStorage.getItem(LS);
    // "1" is D84's boolean and is the value written again since D365;
    // "always" is what D174 wrote for the standing option — same meaning.
    if (raw === "1" || raw === "always") return true;
    // A phone upgrading mid-SESSION lands OFF, on purpose: the timed
    // option was a promise about when you stop being visible, and the
    // upgrade must not quietly turn two hours into no deadline. The doc
    // it wrote carries its own `until`, so the server stops counting it
    // by itself; the keys are swept so the next read is a plain miss.
    if (raw === "session") {
      localStorage.removeItem(LS);
      localStorage.removeItem(LS_UNTIL);
    }
  } catch { /* fall through to off */ }
  return false;
}

let on: boolean = readOn();

// No subscriber list. This store carried one, plus a subscribeNearOptIn to
// feed it, from D84 until D137 — nothing ever subscribed, so the Set was
// permanently empty and both notify loops were no-ops. The single reader
// (live.ts) calls this at the point of use, which is why the subscription
// was never needed. Re-add both together if that changes.
export function nearOptedIn(): boolean {
  return on;
}

export function setNearOn(next: boolean): void {
  on = next;
  try {
    if (!next) { localStorage.removeItem(LS); localStorage.removeItem(LS_UNTIL); return; }
    localStorage.setItem(LS, "1");
    // Nothing writes a deadline any more; a stale one from a D174 build
    // must not outlive the switch that replaced it.
    localStorage.removeItem(LS_UNTIL);
  } catch { /* best-effort — the in-memory choice still holds this session */ }
}

// D51: every local store hears the purge. Drop to the fresh-boot value
// without re-writing — the wipe just removed the key, and saving would
// re-create it.
if (typeof window !== "undefined") {
  window.addEventListener("insight:local-purge", () => { on = false; });
}
