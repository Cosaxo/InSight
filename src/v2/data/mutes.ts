// Muted take authors — the viewer's local "stop showing me this person"
// list, the blocking control Apple guideline 1.2 expects a UGC surface to
// carry alongside report + policy. World takes are the surface that needs
// it (D83): a circle already has membership and Leave, but a stranger's
// takes follow you across every world question until something client-side
// says stop.
//
// LOCAL ONLY, by design. A mute is the viewer's preference, not a claim
// about the author, so it writes no document, feeds no moderation count
// and is invisible to everyone including the muted account. The uid it
// keys on is the pseudonymous authorUid a world take already carries —
// muting reveals nothing the take list had not already shown.
//
// In-memory Set + localStorage, same shape as the spec layer's stores;
// the purge listener drops to fresh-boot state without save() so the
// wipe (D51) is not undone by the next write.

const LS = "insight.mutedTakeAuthors.v1";

function load(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(LS) || "[]");
    return new Set(Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

let muted = load();
const listeners = new Set<() => void>();

function save(): void {
  try { localStorage.setItem(LS, JSON.stringify([...muted])); } catch { /* best-effort */ }
  listeners.forEach((f) => { try { f(); } catch { /* one listener throwing must not stop the rest */ } });
}

export function isMutedAuthor(uid: string): boolean {
  return muted.has(uid);
}

export function muteAuthor(uid: string): void {
  if (!uid || muted.has(uid)) return;
  muted.add(uid);
  save();
}

// NB: there is no unmuteAuthor. One existed, called by nothing, from the day
// this store landed until D137 — no surface ever offered the undo, so the
// only way back today is the account panel's local purge (D51). Deleted
// rather than kept as scaffolding: a half-built API reads as a shipped
// feature, and the gap is easier to see when the function is not there.
export function subscribeMutes(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

// D51: every local store hears the purge. Notify without save() — saving
// would re-create the key the wipe just removed.
if (typeof window !== "undefined") {
  window.addEventListener("insight:local-purge", () => {
    muted = new Set();
    listeners.forEach((f) => { try { f(); } catch { /* see save() */ } });
  });
}
