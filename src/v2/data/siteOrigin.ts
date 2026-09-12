// One origin for every outward link and every asset the app draws from
// hosting — the privacy page, invites, the shareable results page, and
// since D421 the pick tiles' pictures. If a real domain ever replaces the
// .web.app default, this is the single edit ON THE CLIENT SIDE (D3's "no
// code change beyond LP_SITE" promise, widened to every consumer by making
// them all read the same constant). Its own module rather than a line in
// links.ts so that a module which only needs the origin — catalogArt.ts,
// imported by the feed's tiles — does not drag the deep-link plumbing in
// behind it.
//
// THE SERVER HAS ITS OWN, and this comment said "the single edit" full
// stop until 2026-09-12, when the claim was measured and was false:
// functions/src/paid.ts hardcoded the origin twice, on the Stripe return
// URLs, so a domain change would have moved every link in the app and
// still walked a paying buyer back to the old host. A Cloud Function
// cannot import this module — separate package, separate tsconfig,
// separate deploy — so the swap is two edits, this line and ops.ts's
// SITE_ORIGIN, each of which names the other. The web pages under web/
// use relative links and need neither.
export const SITE_ORIGIN = "https://prvfire33.web.app";
