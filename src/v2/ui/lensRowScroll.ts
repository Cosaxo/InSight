// "Opening a tab walks the row to the top of the scroller" — once, for
// every stop that has a row (D190).
//
// The Mirror's tab row is pinned to the BOTTOM of the screen (D155's
// shape, the prototype's `MirrorLenses`), so the panel a tap opens starts
// below the fold. What makes the row usable is this: on open, the row
// scrolls up to the top of the app's scroller and the panel follows it in.
//
// IT WAS COPIED, AND THE COPY IS WHY THIS FILE EXISTS. LiveCohortBody and
// NearLiveBody each carried their own version, subtly different in how
// they found the scroller, and D155 shipped a THIRD state of it: the ref was
// declared, the ref was attached, and nothing ever read it — so the row
// pinned correctly and then sat there, leaving the panel below the fold on
// every cohort stop. Nothing could catch that (a dangling ref is valid
// TypeScript, valid eslint, invisible to check:globals, and the tab tests
// assert the panel MOUNTS, which it did). Circle and Groups getting rows
// would have made it four copies of a thing that has already been wrong
// once.
//
// 60ms is the prototype's own number, and it is not a guess: the panel
// mounts in the same commit as the tab flip, so measuring immediately
// measures the row before the body it is about to sit above exists — and
// scrolls to a position that stops being right one frame later.
import React from "react";

/**
 * @param open  the id of the tab that is open, "" for none. A change is
 *              what triggers the scroll, so it must be the state the row
 *              renders from.
 * @param ref   the row's wrapper — the element that carries `marginTop: auto`.
 */
export function useLensRowScroll(
  open: string,
  ref: React.RefObject<HTMLDivElement | null>,
): void {
  React.useEffect(() => {
    const row = ref.current;
    if (!open || !row) return;
    // The scroller is the app's (.app-body), not ours — walk up to it, and
    // take the first ancestor that both overflows and can actually scroll.
    let sp: HTMLElement | null = row.parentElement;
    while (sp && !(sp.scrollHeight > sp.clientHeight && /(auto|scroll)/.test(getComputedStyle(sp).overflowY))) {
      sp = sp.parentElement;
    }
    if (!sp) return;
    const scroller = sp;
    const t = setTimeout(() => {
      const top = row.getBoundingClientRect().top
        - scroller.getBoundingClientRect().top + scroller.scrollTop - 12;
      scroller.scrollTo({ top, behavior: "smooth" });
    }, 60);
    return () => clearTimeout(t);
    // `ref` is a ref object and never changes identity; listing it would
    // be noise, but eslint cannot know that.
  }, [open, ref]);
}
