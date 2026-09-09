// The one live thing the Tweaks panel ever exported.
//
// WHY IT IS ITS OWN MODULE. `useTweaks` is the shell's tweak state — which
// tab, which population, which zoom, plus the one surviving display flag —
// and app-shell reads it on every render. The PANEL around it is
// design-time tooling that production cannot open at all: its only
// `setOpen(true)` sits behind `if (!import.meta.env.DEV) return`, which
// Vite eliminates.
//
// Sharing a module meant ~11.8 KB of that unopenable panel — the controls,
// the drag handling and a 6.7 KB stylesheet string — sat in the ENTRY
// chunk, where check:bundle has the least headroom in the repo. Splitting
// it moves the panel to src/dev/ behind a DEV-only dynamic import and
// leaves this, which is the part that runs.
//
// It also has to leave `spec/`: check:globals rule 2 asks whether a spec
// module loads, and the publication block the old file carried is what
// kept rolldown from dropping the bytes (D210 measured 917 → 896 KB from
// removing exactly that kind of line).

import React from 'react';

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
export function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null
      ? keyOrEdits : { [keyOrEdits]: val };
    setValues((prev) => ({ ...prev, ...edits }));
    // Host-editor persistence — prototype tooling. Gated on DEV so the
    // literal is dead-code-eliminated from a production bundle: in a
    // shipped app there is no host, window.parent === window, and this
    // posts a wildcard-origin message to ourselves for nothing.
    if (import.meta.env.DEV) {
      window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*');
    }
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react — the parent message only reaches the host, not peers.
    // NOT gated: this is real in-app wiring, and the values themselves are
    // set above, so the panel's own controls (dark mode included) work
    // exactly as before in production.
    window.dispatchEvent(new CustomEvent('tweakchange', { detail: edits }));
  }, []);
  return [values, setTweak];
}
