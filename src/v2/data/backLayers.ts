// backLayers.ts — the transient layers Android's back button has to peel
// before the shell's own levels.
//
// WHY THIS EXISTS. `back.ts` owns the platform wiring and says, correctly,
// that "the shell owns the meaning of back". The shell's handler
// (app-shell.jsx) peels person → city → overlay → tab, and it knew nothing
// about bottom sheets, because every `Sheet` holds its open state locally
// inside whichever module rendered it. There is no single place the shell
// could read to find out one was up.
//
// So back from an open sheet fell through every branch, returned false, and
// `back.ts` called `App.exitApp()` — the exact failure its own header
// describes ("a back press that quits from an overlay reads as a crash
// rather than a missing handler"), one layer deeper than the case it was
// written for. On the default tab with no overlay: tap the ⓘ on today's
// question, press back, and the app quits with the sheet still on screen.
// First-minute path on the primary surface.
//
// D24 gave sheets Escape and a focus trap. That is the keyboard path; this
// is the Android one, and the two are separate mechanisms because Escape is
// a DOM event a focused dialog can receive and the back button is not.
//
// A STACK rather than a single slot, because sheets nest: the feed's card
// sheet can open the explain sheet over it, and back should take them one
// at a time in the order they arrived.
//
// A real module rather than another `window.X` publication: `primitives.jsx`
// and `app-shell.jsx` are both off the global bridge already, so an import
// keeps check:globals rule 4 flat instead of adding two references to a
// count that may only go down (D39).

type Closer = () => void;

const stack: Closer[] = [];

/**
 * Register a layer. Returns the remover to call on unmount.
 *
 * Pass a STABLE closure — a `Sheet` whose `onClose` prop is a fresh arrow
 * every render must read the latest one through a ref rather than
 * re-registering, or the effect churns the stack on every parent render and
 * the LIFO order stops meaning anything.
 */
export function pushBackLayer(close: Closer): () => void {
  stack.push(close);
  return () => {
    // lastIndexOf, not pop: the layer being removed is USUALLY the top, but
    // not always — closeTopBackLayer has already removed it when back is
    // what closed it, and an unmount ordering under React 19's concurrent
    // rendering is not something this module should assume. A miss (-1) is
    // the ordinary case after a back press, not an error.
    const i = stack.lastIndexOf(close);
    if (i >= 0) stack.splice(i, 1);
  };
}

/**
 * Close the topmost layer. True if there was one — which is exactly the
 * shape `back.ts` wants back from the shell's handler.
 */
export function closeTopBackLayer(): boolean {
  const close = stack.pop();
  if (!close) return false;
  try {
    close();
  } catch {
    // Same reasoning as back.ts's own guard around the handler: a throwing
    // closer must not strand the user with a dead back button. The layer is
    // already off the stack, so the next press moves on to the one below.
  }
  return true;
}

/** How many layers are up. For tests and for nothing else. */
export function backLayerCount(): number {
  return stack.length;
}

/**
 * Drop every layer WITHOUT closing it.
 *
 * For the test harness, which mounts and unmounts the app repeatedly in one
 * process: module state outlives a render tree, so a sheet left up by one
 * case would still be on the stack for the next one. Not called by the app —
 * closing a layer is always what removes it there.
 */
export function resetBackLayers(): void {
  stack.length = 0;
}
