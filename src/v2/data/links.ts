// Invite links — the intake half. A share produces
// https://prvfire33.web.app/join/<CODE>; this module turns that URL back
// into a pending join when the app is opened by it.
//
// THREE SHAPES REACH HERE, and since D232 all three end in one button
// rather than a filled-in text field (LdJoinPending):
//
//   · https://…/join/CODE      — the shared link. Opens the app directly
//                                only once assetlinks.json carries the
//                                real Play signing SHA-256; until then
//                                Android lands on the page below.
//   · https://…/join.html?c=…  — that page's own query form.
//   · insight://join/CODE      — the custom scheme, registered on BOTH
//                                platforms since D232 and the reason the
//                                fingerprint is no longer what stands
//                                between a tapped invite and the app.
//                                web/join.html's one button navigates
//                                here. A scheme cannot be verified, so
//                                what travels it is an invite token and
//                                never a credential.
//
// The pending code is a session note, not durable state: it survives the
// tab/app-shell handoff and dies with the session, so a stale invite
// never resurfaces days later.
import { reportError } from "../../lib/sentry";

// One origin for every outward link (privacy page, invites). If a real
// domain ever replaces the .web.app default, this is the single edit —
// D3's "no code change beyond LP_SITE" promise widened to two consumers
// by making both read the same constant.
export const SITE_ORIGIN = "https://prvfire33.web.app";

const PENDING_KEY = "insight.pendingJoin";

// The server mints 8 chars from CODE_ALPHABET (functions/src/pure.ts —
// no 0/O/1/I/L). The parser is looser on length so a future mint-size
// change does not strand links, but strict on charset: anything else is
// a mistyped or hostile URL, not a code.
const CODE_RE = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6,12}$/;

export function inviteLinkFor(code: string): string {
  return `${SITE_ORIGIN}/join/${code}`;
}

// Accepts the shapes a join URL can arrive in: the canonical /join/CODE
// path, the fallback page's /join.html?c=CODE, and a bare "join/CODE"
// from a custom scheme. Returns the normalized code or null.
export function parseJoinCode(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url, SITE_ORIGIN);
  } catch {
    return null;
  }
  // In a custom scheme (insight://join/CODE) "join" lands in the hostname
  // and the code alone is the path — so match on host+path, not path alone.
  const fromPath = /(?:^|\/)join\/([^/?#]+)/.exec(u.hostname + u.pathname);
  const raw = (fromPath && fromPath[1]) || u.searchParams.get("c") || "";
  const code = decodeURIComponent(raw).trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

export function stashJoinCode(code: string): void {
  try { sessionStorage.setItem(PENDING_KEY, code); } catch { /* best-effort */ }
}

// Read-and-clear: the code prefills one join form once. Leaving it would
// re-prefill every later visit to the panel with an invite the user
// already acted on (or declined).
export function consumeJoinCode(): string | null {
  try {
    const c = sessionStorage.getItem(PENDING_KEY);
    if (c) sessionStorage.removeItem(PENDING_KEY);
    return c && CODE_RE.test(c) ? c : null;
  } catch {
    return null;
  }
}

// Boot hook. Native: the OS hands the URL to a running (or launching)
// app via appUrlOpen. Web: a dev/preview build reached at /join/CODE
// directly. Both funnel into the same stash + a nudge onto the Daily
// tab, where the group panel consumes the code.
export function initDeepLinks(): void {
  const apply = (url: string) => {
    const code = parseJoinCode(url);
    if (!code) return;
    stashJoinCode(code);
    const w = window as unknown as { goTab?: (t: string) => void };
    if (w.goTab) w.goTab("track");
    window.dispatchEvent(new Event("insight-live-update"));
  };
  try {
    if (typeof location !== "undefined") apply(location.href);
  } catch { /* non-browser context */ }
  void (async () => {
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;
      const { App } = await import("@capacitor/app");
      await App.addListener("appUrlOpen", (e) => apply(e.url));
    } catch (err) {
      reportError(err, { where: "deepLinks" });
    }
  })();
}
