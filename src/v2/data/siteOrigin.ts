// One origin for every outward link and every asset the app draws from
// hosting — the privacy page, invites, the shareable results page, and
// since D420 the pick tiles' pictures. If a real domain ever replaces the
// .web.app default, this is the single edit (D3's "no code change beyond
// LP_SITE" promise, widened to every consumer by making them all read the
// same constant). Its own module rather than a line in links.ts so that a
// module which only needs the origin — catalogArt.ts, imported by the
// feed's tiles — does not drag the deep-link plumbing in behind it.
export const SITE_ORIGIN = "https://prvfire33.web.app";
