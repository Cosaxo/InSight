// The Mirror tab's module, remembered once its chunk has landed (D353).
//
// WHY A MODULE FOR ONE VARIABLE. The Mirror rides loadMirrorTab()
// (spec-index.js) after first paint, and app-shell renders it through a
// slot — state plus an import, mirror-tab.jsx's MapSlot shape, because a
// React.lazy caches a rejection and the tab boundary is keyed per tab, so
// one failed chunk fetch would make the app's main tab "This view hit a
// snag" for the rest of the session. A slot's state starts empty, though,
// so every open would pay one blank frame before the effect's import
// resolved — even when the prewarm finished a minute ago and the module is
// sitting in the browser's module cache. ESM has no synchronous read of
// that cache. This is one: the loader remembers the namespace here, the
// slot's state initializer peeks at it, and a prewarmed Mirror renders in
// the tap's own tick. That is the guard check:bundle's header said this
// tab needed and the overlays did not: the Mirror is one tap from first
// paint, and a tab that flashes empty on every open would be a worse
// trade than the bytes it saves.
//
// Both sides import this rather than spec-index.js publishing a global for
// app-shell to read (the shape `window.loadOverlays` still has, with its
// reasons at the foot of spec-index.js): a `window.X` read would raise
// check:globals rule 4, and nothing here needs global scope — it is the
// data/mapCue shape, a typed seam both files can import. Session-only,
// nothing persisted, nothing for the purge to sweep.

import type { ComponentType } from "react";

export interface MirrorModule {
  MirrorTab: ComponentType<Record<string, unknown>>;
}

let remembered: MirrorModule | null = null;

/** Called by whoever resolved the chunk — the prewarm or the slot. */
export function rememberMirror<T extends MirrorModule>(m: T): T {
  remembered = m;
  return m;
}

/** The module if a load has landed, else null — never starts one. */
export function peekMirror(): MirrorModule | null {
  return remembered;
}

/** Test seam: forget, so a suite can rehearse the cold tap. */
export function _forgetMirrorForTest(): void {
  remembered = null;
}
