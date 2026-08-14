// The Near-presence opt-in flag (D84) — deliberately its OWN tiny store
// rather than a field inside live.ts: live.ts is purge-exempt as the
// dispatcher, and an opt-in that survived an account switch would turn
// presence ON for whoever signs in next on this phone. Sharing your
// block's headcount is a per-person choice; it dies with the account that
// made it (purge listener below) and starts OFF for every new one.
//
// The flag is all this module holds. The loop, the cell and the count
// live in live.ts (LIVE.near), which imports this — one direction, no
// cycle.

const LS = "insight.nearPresence.v1";

let on: boolean = (() => {
  try { return localStorage.getItem(LS) === "1"; } catch { return false; }
})();

// No subscriber list. This store carried one, plus a subscribeNearOptIn to
// feed it, from D84 until D137 — nothing ever subscribed, so the Set was
// permanently empty and both notify loops were no-ops. The single reader
// (live.ts) calls nearOptedIn() at the point of use, which is why the
// subscription was never needed. Re-add both together if that changes.
export function nearOptedIn(): boolean {
  return on;
}

export function setNearOptIn(next: boolean): void {
  if (on === next) return;
  on = next;
  try {
    if (next) localStorage.setItem(LS, "1");
    else localStorage.removeItem(LS);
  } catch { /* best-effort — the in-memory choice still holds this session */ }
}

// D51: every local store hears the purge. Drop to the fresh-boot value
// without re-writing — the wipe just removed the key, and saving would
// re-create it.
if (typeof window !== "undefined") {
  window.addEventListener("insight:local-purge", () => { on = false; });
}
