// The Near-presence opt-in (D84) — deliberately its OWN tiny store rather
// than a field inside live.ts: live.ts is purge-exempt as the dispatcher,
// and an opt-in that survived an account switch would turn presence ON for
// whoever signs in next on this phone. Sharing your block's headcount is a
// per-person choice; it dies with the account that made it (purge listener
// below) and starts OFF for every new one.
//
// THREE STATES SINCE D173, not a boolean:
//
//   off      no presence doc at all. The default, and the only state a
//            fresh account or a purged one lands in.
//   session  visible for PRESENCE_SESSION_MIN, then not. The default when
//            someone first turns it on, because the default IS the
//            decision — the other two are for people who mean them.
//   always   no deadline on the SETTING. Not "my position never expires":
//            every beat still writes an `until` capped at the linger, so
//            this means "visible whenever the app is open", which is a
//            small enough claim to stand behind.
//
// The session's DEADLINE is the interesting part and it is held here
// rather than derived. A deadline that lived only in memory would reset
// every time the app was reopened, which turns "two hours" into "two hours
// from whenever you last looked" — a longer promise than the one the
// control makes, and longer in the direction that matters.
//
// What actually enforces the deadline is the `until` field live.ts writes
// on each beat, clamped to it: closing the app ten minutes before the
// deadline cannot leave a position standing for a further linger. This
// store decides WHEN; the doc is what makes it true, and firestore.rules
// caps how far out any client may push it.
//
// The loop, the cell and the count live in live.ts (LIVE.near), which
// imports this — one direction, no cycle.

const LS = "insight.nearPresence.v1";
/** The session deadline, epoch ms. Absent unless the mode is `session`. */
const LS_UNTIL = "insight.nearPresence.until.v1";

export type NearMode = "off" | "session" | "always";

/** How long the timed option lasts. Mirrors PRESENCE_SESSION_MIN. */
export const NEAR_SESSION_MS = 120 * 60_000;

function readMode(): NearMode {
  try {
    const raw = localStorage.getItem(LS);
    // "1" is D84's boolean, and a phone upgrading carries it. Read it as
    // `always`, which is what it meant: a standing opt-in with no deadline.
    if (raw === "1" || raw === "always") return "always";
    if (raw === "session") return "session";
  } catch { /* fall through to off */ }
  return "off";
}

function readUntil(): number {
  try { return Number(localStorage.getItem(LS_UNTIL)) || 0; } catch { return 0; }
}

let mode: NearMode = readMode();
let until: number = readUntil();

/**
 * The mode, with an EXPIRED session reported as off.
 *
 * Checked at the point of use rather than on a timer: a timer does not run
 * while the app is closed, and the one moment this has to be right is the
 * moment the app comes back after being shut for three hours.
 */
export function nearMode(): NearMode {
  if (mode === "session" && until && Date.now() >= until) return "off";
  return mode;
}

/** Epoch ms the session ends, or 0 when there is no deadline. */
export function nearUntil(): number {
  return nearMode() === "session" ? until : 0;
}

// No subscriber list. This store carried one, plus a subscribeNearOptIn to
// feed it, from D84 until D137 — nothing ever subscribed, so the Set was
// permanently empty and both notify loops were no-ops. The single reader
// (live.ts) calls this at the point of use, which is why the subscription
// was never needed. Re-add both together if that changes.
export function nearOptedIn(): boolean {
  return nearMode() !== "off";
}

export function setNearMode(next: NearMode): void {
  mode = next;
  until = next === "session" ? Date.now() + NEAR_SESSION_MS : 0;
  try {
    if (next === "off") { localStorage.removeItem(LS); localStorage.removeItem(LS_UNTIL); return; }
    localStorage.setItem(LS, next);
    if (until) localStorage.setItem(LS_UNTIL, String(until));
    else localStorage.removeItem(LS_UNTIL);
  } catch { /* best-effort — the in-memory choice still holds this session */ }
}

// D51: every local store hears the purge. Drop to the fresh-boot value
// without re-writing — the wipe just removed the key, and saving would
// re-create it.
if (typeof window !== "undefined") {
  window.addEventListener("insight:local-purge", () => { mode = "off"; until = 0; });
}
