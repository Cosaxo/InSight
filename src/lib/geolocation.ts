// Permission-on-demand geolocation.
// The API key on the weather side works with lat/lng pairs only in this
// project — we don't ask for a city name. When the user taps "Use my
// location" we call the Geolocation API; the result is cached in
// localStorage as a last-known fallback (so the user doesn't have to
// re-grant on every visit, and we show something if they're offline).

import type { GeoPoint } from "../types";

const LAST_KNOWN_KEY = "insight.geo.lastKnown";

export function readLastKnown(): GeoPoint | null {
  try {
    const raw = window.localStorage.getItem(LAST_KNOWN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GeoPoint;
  } catch {
    return null;
  }
}

function writeLastKnown(point: GeoPoint): void {
  try {
    window.localStorage.setItem(LAST_KNOWN_KEY, JSON.stringify(point));
  } catch {
    // ignore
  }
}

export function clearLastKnown(): void {
  try {
    window.localStorage.removeItem(LAST_KNOWN_KEY);
  } catch {
    // ignore
  }
}

export interface GeoError {
  code: "unsupported" | "permission-denied" | "unavailable" | "timeout";
  message: string;
}

export async function requestCurrentPosition(): Promise<GeoPoint> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw {
      code: "unsupported",
      message: "Geolocation is not supported by this browser",
    } satisfies GeoError;
  }

  return new Promise<GeoPoint>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point: GeoPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        writeLastKnown(point);
        resolve(point);
      },
      (err) => {
        const code: GeoError["code"] =
          err.code === 1
            ? "permission-denied"
            : err.code === 2
              ? "unavailable"
              : err.code === 3
                ? "timeout"
                : "unavailable";
        reject({ code, message: err.message } satisfies GeoError);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  });
}
