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
import { PRESENCE_CELL_DEG, presenceCell } from "./geo";

export type LocateFail =
  | "unsupported"   // no geolocation on this platform/browser at all
  | "denied"        // the user said no, or the OS has it switched off
  | "unavailable"   // hardware/OS could not produce a fix
  | "timeout"       // took too long — usually indoors, usually transient
  | "no-match";     // a fix, but the catalogue produced nothing (empty file)

/**
 * `locateCell`'s reasons: every LocateFail, plus the one that belongs to
 * the cell path alone.
 *
 * Split rather than added to LocateFail, because CityPicker renders a
 * message per reason from a total Record — and a coarse fix is a perfectly
 * good answer to "which city". Widening the shared union would have made
 * the picker carry a sentence it can never show, which is the copy this
 * repo's own rule (COPY.md) exists to keep out.
 */
export type LocateCellFail =
  | LocateFail
  | "imprecise";    // a fix too coarse to name a ~200 m cell

export type LocateResult =
  | { ok: true; key: string; km: number }
  | { ok: false; reason: LocateFail };

// PRECISE SINCE D175, and the flag does two jobs. It is the accuracy of
// the fix, and on Android 12+ it is also what @capacitor/geolocation asks
// the OS for: `false` requested COARSE alone, `true` requests the
// [COARSE, FINE] alias (GeolocationPlugin.kt, getAlias). Both halves of
// this decision are therefore this one boolean plus the manifest cap that
// came off beside it.
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

/**
 * The widest a fix may be and still name a Near cell, in metres.
 *
 * DERIVED FROM THE GRID rather than typed, so the two cannot drift: one
 * cell is PRESENCE_CELL_DEG of latitude, and a degree of latitude is
 * ~111.32 km everywhere. At 0.002° that is ~223 m — the edge of the square
 * the id claims the phone is inside, which is exactly the resolution the
 * reading has to have for the claim to mean anything.
 *
 * Latitude, not longitude, because longitude shrinks with the cosine of
 * latitude: at 60°N a cell is ~111 m wide and ~223 m tall. Using the
 * larger edge is the permissive choice of the two, and the one that keeps
 * this a floor on nonsense rather than a second accuracy policy.
 *
 * The numbers it separates are not close. A GPS fix is 5-50 m; Android's
 * APPROXIMATE grant is 1-3 km. Nothing real lands near 223.
 */
const CELL_M = PRESENCE_CELL_DEG * 111_320;

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

async function getCoords(): Promise<{ lat: number; lon: number; acc: number | null }> {
  if (Capacitor.isNativePlatform()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    // requestPermissions first rather than letting getCurrentPosition
    // trigger it: this is invoked from an explicit "Use my location" tap,
    // and a prompt that appears without one is the thing users report as
    // creepy even when the data handling is fine.
    //
    // ASK FOR THE ALIAS THE FIX ACTUALLY NEEDS. This said
    // `["coarseLocation"]` — the pairing D175 left behind when it flipped
    // `enableHighAccuracy` to true, and the comment on OPTS above states
    // the rule this line was breaking. On Android 12+ the plugin picks its
    // alias from the getCurrentPosition call, not from this one
    // (GeolocationPlugin.kt getAlias): `true` selects LOCATION_ALIAS,
    // which is annotated [COARSE, FINE], and Capacitor's Bridge reports a
    // multi-string alias as granted only if EVERY string is
    // ("multiple permissions with the same alias must all be true,
    // otherwise all false"). So a granted coarse-only request left
    // `location` ungranted and the plugin fired a second system dialog
    // immediately after ours — two prompts for one tap.
    const perm = await Geolocation.requestPermissions({ permissions: ["location"] });
    // Either alias is enough to PROCEED, which matches what the plugin
    // itself does (handlePermissionResult checks COARSE alone). Android
    // 12+ offers precise/approximate inside the one dialog, and a user who
    // picks approximate has answered — refusing them a city because the
    // fine half is missing would be a worse answer than a coarse one.
    // What must not happen is a ~200 m Near cell minted from that reading,
    // and `locateCell` is where that is refused.
    const state = perm.location || perm.coarseLocation;
    if (state !== "granted") throw new Error("permission denied");
    const pos = await Geolocation.getCurrentPosition(OPTS);
    return { lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy };
  }
  // Web. navigator.geolocation is absent in insecure contexts and in some
  // embedded webviews, which is a different failure from a refusal.
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("unsupported");
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        acc: typeof pos.coords.accuracy === "number" ? pos.coords.accuracy : null,
      }),
      reject,
      OPTS,
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
  let coords: { lat: number; lon: number };
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
  let coords: { lat: number; lon: number; acc: number | null };
  try {
    coords = await withDeadline(getCoords(), DEADLINE_MS);
  } catch (err) {
    const msg = String((err as Error)?.message || "");
    if (msg === "unsupported") return { ok: false, reason: "unsupported" };
    return { ok: false, reason: classify(err) };
  }
  // A CELL IS ONLY AS REAL AS THE FIX UNDER IT.
  //
  // The comment on OPTS calls this out by name — "a finer grid computed
  // from a kilometre-wide measurement, which is invented precision" — and
  // nothing enforced it. Android 12+ lets a user grant APPROXIMATE inside
  // the same dialog that asks for precise, and the plugin proceeds on that
  // (handlePermissionResult checks the coarse alias alone). The reading
  // that comes back is 1-3 km wide; folding it through `presenceCell`
  // produces a confident ~200 m id for a neighbourhood the phone may not
  // be standing in, and the room it then joins is a claim about strangers'
  // whereabouts as much as the viewer's own.
  //
  // Refused rather than widened: a coarser Near grid is D9's ~1 km cell,
  // which D175 replaced deliberately, and re-deriving it per device would
  // make the same id mean different things on different phones.
  //
  // `locateCity` does NOT carry this guard and must not — a catalogue
  // containment is exactly the question a coarse fix can answer, and the
  // nearest city to a 2 km-wide reading is very nearly always the right
  // one. This is the one caller whose output is finer than that.
  if (coords.acc !== null && coords.acc > CELL_M) {
    return { ok: false, reason: "imprecise" };
  }
  const cell = presenceCell(coords.lat, coords.lon);
  if (!cell) return { ok: false, reason: "unavailable" };
  return { ok: true, cell };
}

// No globalThis publication: the one consumer (CityPicker) is typed TSX
// and imports locateCity/locateSupported directly. A global here would be
// a name the spec scanner tracks with no caller behind it.
const LOCATE = { city: locateCity, supported: locateSupported };

export default LOCATE;
