// Pure-function astronomy computations. No network. Given (lat, lng, date)
// returns current altitude/azimuth/magnitude/rise/set for the sun, moon,
// and the 5 classical naked-eye planets, plus any active meteor shower.
//
// Visibility heuristic for "naked-eye right now":
//   altitude > 5°  &&  magnitude < 5.0
// (Moon excepted — it's always naked-eye when above the horizon.)
//
// Planet magnitudes vary over time; astronomy-engine's Illumination() gives
// the current apparent magnitude for each body.

import * as A from "astronomy-engine";
import type {
  ActiveShower,
  BodyState,
  CelestialSnapshot,
  GeoPoint,
  MoonState,
  PlanetName,
  SunState,
} from "../types";
import { METEOR_SHOWERS } from "../data/meteorShowers";

const PLANETS: { name: PlanetName; body: A.Body }[] = [
  { name: "Mercury", body: A.Body.Mercury },
  { name: "Venus", body: A.Body.Venus },
  { name: "Mars", body: A.Body.Mars },
  { name: "Jupiter", body: A.Body.Jupiter },
  { name: "Saturn", body: A.Body.Saturn },
];

function rise(body: A.Body, obs: A.Observer, from: Date): Date | null {
  const t = A.SearchRiseSet(body, obs, +1, from, 1);
  return t ? t.date : null;
}
function set(body: A.Body, obs: A.Observer, from: Date): Date | null {
  const t = A.SearchRiseSet(body, obs, -1, from, 1);
  return t ? t.date : null;
}

function computeBody(
  name: string,
  body: A.Body,
  obs: A.Observer,
  now: Date,
): BodyState {
  const eq = A.Equator(body, now, obs, true, true);
  const h = A.Horizon(now, obs, eq.ra, eq.dec, "normal");
  const isUp = h.altitude > 0;
  let magnitude: number | undefined;
  try {
    magnitude = A.Illumination(body, now).mag;
  } catch {
    // Not all bodies support Illumination — safe to ignore.
  }
  const isNakedEye =
    isUp &&
    h.altitude > 5 &&
    (magnitude === undefined || magnitude < 5.0);
  return {
    name,
    altitudeDeg: h.altitude,
    azimuthDeg: h.azimuth,
    magnitude,
    isUp,
    isNakedEye,
    // Cheap rise/set lookahead; skip for sub-second calls.
    nextRise: isUp ? null : rise(body, obs, now),
    nextSet: isUp ? set(body, obs, now) : null,
  };
}

// Map ecliptic longitude (0..360) to a human phase name.
export function moonPhaseName(lon: number): string {
  const n = ((lon % 360) + 360) % 360;
  if (n < 22.5 || n >= 337.5) return "New Moon";
  if (n < 67.5) return "Waxing Crescent";
  if (n < 112.5) return "First Quarter";
  if (n < 157.5) return "Waxing Gibbous";
  if (n < 202.5) return "Full Moon";
  if (n < 247.5) return "Waning Gibbous";
  if (n < 292.5) return "Last Quarter";
  return "Waning Crescent";
}

function computeMoon(obs: A.Observer, now: Date): MoonState {
  const base = computeBody("Moon", A.Body.Moon, obs, now);
  const ill = A.Illumination(A.Body.Moon, now);
  const lon = A.MoonPhase(now);
  return {
    ...base,
    phaseName: moonPhaseName(lon),
    illuminationPct: Math.round(ill.phase_fraction * 100),
    // Moon is naked-eye whenever above the horizon.
    isNakedEye: base.isUp,
  };
}

function computeSun(obs: A.Observer, now: Date): SunState {
  return computeBody("Sun", A.Body.Sun, obs, now);
}

// ── Meteor showers ──────────────────────────────────────────────

// Resolve "MM-DD" against a reference year, returning a Date anchored at
// start-of-day. Handles year wrap for windows like the Quadrantids
// (12-28 → 01-12).
function parseMMDD(
  mmdd: string,
  referenceYear: number,
  referenceMonth: number,
): Date {
  const [m, d] = mmdd.split("-").map(Number);
  // If the window crosses year boundaries (e.g. Dec 28 → Jan 12) and the
  // parsed month is ahead of the reference month, roll backwards a year.
  let year = referenceYear;
  if (referenceMonth < 6 && m > 6) year -= 1;
  if (referenceMonth > 6 && m < 6) year += 1;
  return new Date(year, m - 1, d);
}

export function activeShowers(now: Date = new Date()): ActiveShower[] {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const out: ActiveShower[] = [];
  for (const s of METEOR_SHOWERS) {
    const start = parseMMDD(s.startDay, year, month);
    const end = parseMMDD(s.endDay, year, month);
    if (end < start) {
      // Window wraps the new year — extend end by 365 days.
      end.setFullYear(end.getFullYear() + 1);
    }
    if (now >= start && now <= end) {
      const peak = new Date(
        s.peakMonth < month ? year + 1 : year,
        s.peakMonth - 1,
        s.peakDay,
      );
      // Recompute year if peak is before start (edge case for year-wrap)
      if (peak < start) peak.setFullYear(peak.getFullYear() + 1);
      const daysToPeak = Math.round(
        (peak.getTime() - now.getTime()) / (24 * 3600 * 1000),
      );
      out.push({ ...s, daysToPeak });
    }
  }
  return out;
}

// ── Top-level snapshot ──────────────────────────────────────────

export function celestialSnapshot(
  point: GeoPoint,
  now: Date = new Date(),
): CelestialSnapshot {
  const obs = new A.Observer(point.lat, point.lng, 0);
  return {
    computedAt: now.getTime(),
    observer: point,
    sun: computeSun(obs, now),
    moon: computeMoon(obs, now),
    planets: PLANETS.map((p) => computeBody(p.name, p.body, obs, now)),
    activeShowers: activeShowers(now),
  };
}
