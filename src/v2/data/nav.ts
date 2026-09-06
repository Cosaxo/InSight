// The shell's cross-links, as a registry rather than a bridge (D248).
//
// WHY THIS IS NOT AN ORDINARY CONVERSION. Every other module taken off the
// global bridge (D39 through D247) exported a value: a data store, a
// component, a fold. These eight are CLOSURES OVER THE SHELL'S LIVE STATE
// — `goTab` calls `setTab`, `openOverlay` calls `setOv`, `openPerson`
// calls `setPerson` — registered in an app-shell effect on mount and
// deleted on unmount. There is no value to export.
//
// AND THE DIRECTION IS THE PROBLEM. Building the reference graph out of
// `spec-globals.mjs`'s own maps (the procedure src/v2/README.md records)
// showed six of app-shell's fifteen consumers in a two-cycle with it, and
// every one is the same shape: **the shell reads the consumer's COMPONENT
// because it renders it, and the consumer reads the shell's NAV FUNCTION
// because it navigates.** `daily-split.jsx` ← `DailySplit`, `mirror-tab.jsx`
// ← `MirrorTab`, `search-overlay.jsx` ← `SearchOverlay`, and so on. So
// `import { goTab } from './app-shell.jsx'` would have made a real ESM
// cycle out of a real bidirectional dependency, and the README is explicit
// that this is where the bridge is load-bearing rather than legacy: ESM
// handles cyclic value bindings badly and the failure is a
// temporal-dead-zone error that appears only at render.
//
// A registry has no such direction. This module depends on NOTHING, the
// shell imports it to REGISTER, and consumers import it to CALL — so the
// cycle is not broken so much as never drawn. It is the shape
// `data/backLayers`, `data/mapCue.ts` and `spec/swipe-back.js` already
// have, all three of which app-shell imports for the same reason.
//
// It also collects three typed readers that were casting their way across:
// `data/links.ts`, `data/push.ts` and `ui/EmptyField.tsx` each wrote
// `window as unknown as { goTab?: … }` to reach the same doors. One typed
// surface replaces all of them.
//
// THE PRESENCE CHECK STAYS, and is not the guard shape D108 calls dead.
// Those were LOAD-ORDER guards — "has the module evaluated yet" — and an
// imported binding cannot be unset, so they were unreachable. This one is
// a DATA condition with a real false case: the shell registers on mount
// and clears on unmount, so a handler genuinely may not be there, and a
// call before mount must no-op rather than throw.

/** Every door the shell opens for the rest of the app. */
export interface NavHandlers {
  /** Switch tabs by id — the tab bar's own axis. */
  goTab: (id: string) => void;
  /**
   * Any nav key from anywhere, including a cross-tab jump. Swipe uses it.
   *
   * Answers whether it navigated (D265). A key can now be REFUSED by the
   * shell rather than only by being unknown — the Patterns tab is absent
   * from the bar until the data can carry it — and a swipe that reached
   * for it has to spring back rather than sit where the finger left it.
   */
  goNav: (key: string) => boolean;
  /** Open one of the deferred overlays by key. */
  openOverlay: (key: string) => void;
  /** Open the profile overlay on a named sub-tab. */
  openProfileTab: (subId?: string) => void;
  /** Open a city's profile by name — no-ops on a name that matches nothing. */
  openCity: (name: string) => void;
  /** Open a person's profile by record, id or name. */
  openPerson: (who: unknown) => void;
  openLogicTest: () => void;
  /** Open the buyer's room — "Asked by you" (PAID-PLAN §7, D288). */
  openAskedByYou: () => void;
}

export type NavKey = keyof NavHandlers;

let handlers: Partial<NavHandlers> = {};

/**
 * Register some or all of the doors. Returns the teardown, which removes
 * exactly the keys this call added.
 *
 * Partial and additive because app-shell registers in TWO effects with
 * different dependency lists — `openLogicTest`/`openAskedByYou` re-register
 * when `openDeferred` changes identity, the rest are mount-only — and a
 * whole-object set would have the second wipe the first.
 *
 * The teardown removes only its own keys for the same reason: the two
 * effects tear down independently, and clearing everything would take the
 * other effect's handlers with it.
 */
export function registerNav(part: Partial<NavHandlers>): () => void {
  const keys = Object.keys(part) as NavKey[];
  handlers = { ...handlers, ...part };
  return () => {
    const next = { ...handlers };
    // Identity-checked: if the shell remounted and re-registered before
    // this teardown ran, the live handler is not the one this call added
    // and must survive. Deleting by key alone would strand the new shell.
    for (const k of keys) if (next[k] === part[k]) delete next[k];
    handlers = next;
  };
}

/** True when the shell is mounted and this door exists. */
export function canNav(key: NavKey): boolean {
  return typeof handlers[key] === "function";
}

/**
 * The doors themselves. Each no-ops when the shell has not registered —
 * see the header on why that check is a data condition and not a dead
 * load-order guard.
 */
const NAV = {
  goTab(id: string): void { handlers.goTab?.(id); },
  /** False when the shell is not mounted OR refused the key — either way
   * nothing moved, which is what a caller with an animation to finish
   * needs to know. */
  goNav(key: string): boolean { return handlers.goNav?.(key) ?? false; },
  openOverlay(key: string): void { handlers.openOverlay?.(key); },
  openProfileTab(subId?: string): void { handlers.openProfileTab?.(subId); },
  openCity(name: string): void { handlers.openCity?.(name); },
  openPerson(who: unknown): void { handlers.openPerson?.(who); },
  openLogicTest(): void { handlers.openLogicTest?.(); },
  openAskedByYou(): void { handlers.openAskedByYou?.(); },
  can: canNav,
};

export default NAV;
