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

const listeners = new Set<() => void>();

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
  listeners.forEach((f) => { try { f(); } catch { /* one listener must not stop the rest */ } });
}

export function subscribeNearOptIn(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

// D51: every local store hears the purge. Notify without re-writing — the
// wipe just removed the key, and saving would re-create it.
if (typeof window !== "undefined") {
  window.addEventListener("insight:local-purge", () => {
    on = false;
    listeners.forEach((f) => { try { f(); } catch { /* see above */ } });
  });
}
