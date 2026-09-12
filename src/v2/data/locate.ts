// One coarse location fix, turned into a city name, on this device (D9).
//
// THE CONTRACT THIS MODULE EXISTS TO KEEP: a latitude and longitude enter
// this file and do not leave it. `locateCity()` returns a catalogue key
// ("Oslo, NO") and a rough distance for the confirmation line; the
// coordinate itself is never returned to a caller, never logged, never
// persisted, and never sent anywhere. Keeping the resolution inside one
// small module — rather than handing coordinates to the UI and resolving
// there — is what makes that checkable by reading one file.
//
// Consequently there is no server involved and no reverse-geocoding
// service: the answer comes from the bundled catalogue, offline, on a
// plane, on a burner with no SIM.
//
// Everything here is optional. Every failure path returns a reason the UI
// can show and leaves the manual picker exactly as it was.
import { Capacitor } from "@capacitor/core";
import { loadPlaces, nearestPlace, placeKey } from "./places";
import { presenceCell } from "./geo";

export type LocateFail =
  | "unsupported"   // no geolocation on this platform/browser at all
  | "denied"        // the user said no, or the OS has it switched off
  | "unavailable"   // hardware/OS could not produce a fix
  | "timeout"       // took too long — usually indoors, usually transient
  | "no-match";     // a fix, but the catalogue produced nothing (empty file)

export type LocateResult =
  | { ok: true; key: string; km: number }
  | { ok: false; reason: LocateFail };

// PRECISE SINCE D175, and the flag does two jobs — but NOT, as this said
// until tonight, "both halves of this decision". There is a third: the
// alias `requestPermissions` is called with, below. This flag is what
// `getCurrentPosition` asks the OS for; the permission call asked for
// something else entirely, and the mismatch was a second system dialog
// per tap and a fix nobody had agreed to the accuracy of. Three halves,
// and they have to agree: this boolean, the requested alias, and the
// manifest cap that came off beside them.
//
// This was `false` — the coarse request that made the
// old ~1 km grid the honest ceiling. A venue-scale Near needs a fix that
// can actually resolve one; the alternative was a finer grid computed from
// a kilometre-wide measurement, which is invented precision.
//
// `maximumAge` drops with it: a ten-minute-old fix was fine for "which
// city", and is not fine for "which building" — a cached position from the
// last neighbourhood would place you in a room you left.
const OPTS = { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 };

// A COARSE FIRST FIX IS NOT A COARSE DEVICE. `locateCell` refuses anything
// wider than the presence cell (CELL_M, below), and until 2026-09-11 it
// refused after ONE sample — which is the sample a phone is least able to
// make: the radios are cold, and the first thing CoreLocation or the
// Android fused provider hands back is the wifi/cell estimate, hundreds of
// metres wide, while the GNSS fix is still converging. Reported from a
// device as Near simply not switching on, under "No location fix — try
// again outside" (which was also the wrong sentence — see `imprecise`).
//
// So a coarse reading buys more samples rather than a refusal: fresh ones
// (`maximumAge: 0` — the platform must not hand back the same cached
// estimate), spaced far enough apart to be a different measurement, and
// the whole loop still inside the wall-clock deadline below. Three is
// where a warming GNSS fix has usually landed and is two samples more than
// the budget that shipped; the refusal is unchanged for a device that
// really cannot do better.
const PRECISE_TRIES = 3;
const RETRY_GAP_MS = 1200;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// A wall-clock deadline for the WHOLE operation, permission prompt included.
//
// OPTS.timeout does not cover the prompt: the Geolocation spec says the time
// taken to acquire the user's permission is explicitly NOT counted toward
// it. So a prompt that is dismissed-without-choosing, or an app backgrounded
// while it is up, leaves getCurrentPosition pending FOREVER — verified in a
// browser, where the button sat on "Finding your nearest city…" past 14s
// with a 12s timeout set. The native permissions promise can hang the same
// way for the same reason.
//
// 30s is chosen to be longer than a person needs to read a system prompt and
// tap it, and shorter than "this is broken".
const DEADLINE_MS = 30000;

function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  // The losing promise is not cancellable — the platform gives us no handle
  // — so it is left to settle into nothing. Its rejection is swallowed here
  // rather than surfacing as an unhandled rejection minutes later, and a
  // late-arriving position is simply dropped: nothing downstream is
  // listening, and a coordinate that reaches no caller cannot leak.
  void work.catch(() => {});
  return Promise.race([
    work,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("deadline")), ms),
    ),
  ]);
}

// Distinguishing a refusal from a failure matters: "you said no" needs a
// different sentence from "we couldn't get a fix, try again". The web and
// native APIs report them differently, so both are normalised here.
const WEB_CODES: Record<number, LocateFail> = { 1: "denied", 2: "unavailable", 3: "timeout" };

function classify(err: unknown): LocateFail {
  const e = err as { code?: number; message?: string } | null;
  if (e && typeof e.code === "number" && WEB_CODES[e.code]) return WEB_CODES[e.code];
  const msg = String((e && e.message) || err || "").toLowerCase();
  if (msg === "deadline") return "timeout";
  if (msg.includes("denied") || msg.includes("permission")) return "denied";
  if (msg.includes("timeout") || msg.includes("timed out")) return "timeout";
  return "unavailable";
}

/** `fresh` forbids a cached position — see PRECISE_TRIES: a retry that is
 *  allowed to answer from the last minute's cache is not a second
 *  measurement, it is the same coarse one again. */
async function getCoords(fresh = false): Promise<{ lat: number; lon: number; accuracy: number }> {
  const opts = fresh ? { ...OPTS, maximumAge: 0 } : OPTS;
  if (Capacitor.isNativePlatform()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    // requestPermissions first rather than letting getCurrentPosition
    // trigger it: this is invoked from an explicit "Use my location" tap,
    // and a prompt that appears without one is the thing users report as
    // creepy even when the data handling is fine.
    //
    // ASK FOR THE ALIAS THAT MATCHES WHAT WE THEN REQUEST. This asked for
    // `coarseLocation` and immediately called getCurrentPosition with
    // enableHighAccuracy true — whose own getAlias then asks for
    // [COARSE, FINE], from inside the plugin, with no tap behind it. Two
    // dialogs for one tap, the second one the exact unprompted prompt the
    // paragraph above exists to prevent. Not confined to Android 12+
    // either: on API 24-30 getAlias always returns the location alias, so
    // the second request went out there too.
    const perm = await Geolocation.requestPermissions({ permissions: ["location"] });
    // A user may grant "Approximate only" on Android 12+. That is a real
    // grant and the city path is exactly what it is good for; what it must
    // not do is silently feed a ~1 km reading into a 200 m grid, so the
    // accuracy travels with the fix and locateCell refuses below.
    const precise = perm.location === "granted";
    const state = precise ? "granted" : (perm.coarseLocation || perm.location);
    if (state !== "granted") throw new Error("permission denied");
    const pos = await Geolocation.getCurrentPosition({ ...opts, enableHighAccuracy: precise });
    return { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy };
  }
  // Web. navigator.geolocation is absent in insecure contexts and in some
  // embedded webviews, which is a different failure from a refusal.
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("unsupported");
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      reject,
      opts,
    );
  });
}

/**
 * Resolve the nearest city, or a reason why not.
 *
 * Returns the catalogue KEY, not a coordinate. Callers cannot obtain the
 * user's position through this module even by accident.
 */
export async function locateCity(): Promise<LocateResult> {
  // Accuracy is read and DELIBERATELY IGNORED here: matching a reading to
  // the nearest city in a shipped list is exactly what an approximate fix
  // is good for, and refusing one would turn a legitimate "Approximate
  // only" grant into a broken button.
  let coords: { lat: number; lon: number; accuracy: number };
  try {
    coords = await withDeadline(getCoords(), DEADLINE_MS);
  } catch (err) {
    const msg = String((err as Error)?.message || "");
    if (msg === "unsupported") return { ok: false, reason: "unsupported" };
    return { ok: false, reason: classify(err) };
  }
  // The catalogue may not be loaded yet if this is the first thing tapped.
  let places;
  try {
    places = await loadPlaces();
  } catch {
    return { ok: false, reason: "no-match" };
  }
  const hit = nearestPlace(places, coords.lat, coords.lon);
  if (!hit) return { ok: false, reason: "no-match" };
  // `coords` goes out of scope here and is never surfaced. The only values
  // that escape are a catalogue key and a rounded distance.
  return { ok: true, key: placeKey(hit.place), km: hit.km };
}

/** Whether the "Use my location" affordance can do anything on this build. */
export function locateSupported(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  return typeof navigator !== "undefined" && !!navigator.geolocation;
}

/**
 * The presence cell's own size, in metres, as the ceiling a fix has to beat.
 *
 * PRESENCE_CELL_DEG is 0.002° (functions/src/pure.ts). One degree of
 * latitude is ~111 km everywhere, so the cell is ~222 m tall; it is
 * narrower in longitude the further from the equator, so the tall side is
 * the generous reading and the one to compare against.
 */
const CELL_M = 222;

/**
 * The cell path's failures — the city path's, plus the one only it can
 * have. `imprecise` is a WORKING location service whose reading is wider
 * than the square we would publish from it: a grant of "Approximate"
 * rather than "Precise", or a device that never got past its wifi
 * estimate. It is not `unavailable` and must never be reported as one —
 * "No location fix — try again outside" is advice for a phone that has no
 * fix at all, and a phone standing outside with Precise Location off will
 * follow it forever.
 *
 * Kept off `LocateFail` rather than added to it, because the city path
 * cannot produce it: `locateCity` reads accuracy and deliberately ignores
 * it (matching a reading to a shipped city list is exactly what an
 * approximate fix is for), so a sentence for it in the CityPicker's map
 * would be copy for a state that cannot happen.
 */
export type LocateCellFail = LocateFail | "imprecise";

export type LocateCellResult =
  | { ok: true; cell: string }
  | { ok: false; reason: LocateCellFail };

/**
 * Resolve the presence-grid cell (D84), or a reason why not.
 *
 * Same containment rule as locateCity, one notch coarser: the fix is
 * folded to a ~200 m grid id inside this function and the coordinate never
 * escapes. This module remains the only code that ever holds one, and no
 * caller can obtain a position — or anything finer than the cell — through
 * it. Same coarse permission, same wall-clock deadline, same failure
 * vocabulary, so the UI reuses the CityPicker's failure copy.
 */
export async function locateCell(): Promise<LocateCellResult> {
  const started = Date.now();
  // The best reading so far, kept only to decide the refusal's WORDING: a
  // coarse fix that never improves is `imprecise`, and no coordinate from
  // it leaves this function either way.
  let coarsest: { lat: number; lon: number; accuracy: number } | null = null;
  let fine: { lat: number; lon: number; accuracy: number } | null = null;

  for (let i = 0; i < PRECISE_TRIES && !fine; i += 1) {
    // The deadline covers the WHOLE operation, prompt included, so each
    // attempt gets what is left of it rather than a fresh thirty seconds.
    const left = DEADLINE_MS - (Date.now() - started);
    if (left <= 0) break;
    let coords: { lat: number; lon: number; accuracy: number };
    try {
      coords = await withDeadline(getCoords(i > 0), left);
    } catch (err) {
      const msg = String((err as Error)?.message || "");
      // A FAILED RETRY IS NOT A FAILED LOCATE. The first attempt is the one
      // that carries the permission prompt and the real failures; once a
      // reading is in hand, a later timeout means only that this sample
      // did not arrive, and the refusal below should speak about the
      // reading we have rather than about the sample we lost.
      if (coarsest) break;
      if (msg === "unsupported") return { ok: false, reason: "unsupported" };
      return { ok: false, reason: classify(err) };
    }
    // A platform that does not report accuracy at all keeps the behaviour
    // Near shipped with rather than losing the feature: the refusal is for
    // a fix MEASURED coarse, not for one whose accuracy is unknown.
    if (!Number.isFinite(coords.accuracy) || coords.accuracy <= CELL_M) fine = coords;
    else {
      if (!coarsest || coords.accuracy < coarsest.accuracy) coarsest = coords;
      if (i < PRECISE_TRIES - 1) await sleep(RETRY_GAP_MS);
    }
  }

  // A FIX COARSER THAN THE CELL IS NOT A CELL. An "Approximate only" grant
  // on Android 12+, or iOS with Precise Location off, returns a
  // grid-quantised reading of roughly a kilometre or three; folding that
  // into a 0.002° square publishes a room the user is not standing in, and
  // nobody can tell from the outside. That is D175's own "invented
  // precision", pointed at Near instead of at the grid size. What changed
  // at 2026-09-11 is only what the refusal is CALLED: this reported
  // "unavailable", and the card turned that into "No location fix — try
  // again outside", which is unfollowable advice for a phone whose fix is
  // working and merely wide.
  if (!fine) return { ok: false, reason: coarsest ? "imprecise" : "unavailable" };
  const cell = presenceCell(fine.lat, fine.lon);
  if (!cell) return { ok: false, reason: "unavailable" };
  return { ok: true, cell };
}

// No globalThis publication: the one consumer (CityPicker) is typed TSX
// and imports locateCity/locateSupported directly. A global here would be
// a name the spec scanner tracks with no caller behind it.
const LOCATE = { city: locateCity, supported: locateSupported };

export default LOCATE;
