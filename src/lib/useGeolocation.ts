// useGeolocation — one hook, two underlying implementations.
//
// Native (iOS / Android via Capacitor): @capacitor/geolocation handles
// the permission prompt natively and returns coordinates with whatever
// accuracy the user granted (coarse or fine).
//
// Web: navigator.geolocation.getCurrentPosition. The browser shows its
// own permission UI; we don't get to customise it.
//
// Deliberately lazy: nothing happens until a caller invokes `request()`.
// We don't want the City tab silently asking for location on first
// render — the user clicks "use my location" and only then does the OS
// prompt appear.

import { useCallback, useState } from "react";
import { Capacitor } from "@capacitor/core";

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number; // metres
  timestamp: number;
}

export interface GeolocationState {
  position: GeoPosition | null;
  loading: boolean;
  error: string | null;
  denied: boolean; // user said no — caller can show a "rejected" state
  request: () => Promise<GeoPosition | null>;
}

export function useGeolocation(): GeolocationState {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const request = useCallback(async (): Promise<GeoPosition | null> => {
    setLoading(true);
    setError(null);
    try {
      let pos: GeoPosition;
      if (Capacitor.isNativePlatform()) {
        // Dynamic import keeps the plugin out of the web bundle.
        const { Geolocation } = await import("@capacitor/geolocation");
        const perm = await Geolocation.requestPermissions();
        if (perm.location === "denied" && perm.coarseLocation === "denied") {
          setDenied(true);
          throw new Error("Location permission denied");
        }
        const r = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false, // coarse is plenty for city + nearby people
          timeout: 10_000,
          maximumAge: 60_000, // a one-minute-old fix is fine
        });
        pos = {
          latitude: r.coords.latitude,
          longitude: r.coords.longitude,
          accuracy: r.coords.accuracy,
          timestamp: r.timestamp,
        };
      } else {
        if (!("geolocation" in navigator)) {
          throw new Error("Geolocation not supported in this browser");
        }
        pos = await new Promise<GeoPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (r) =>
              resolve({
                latitude: r.coords.latitude,
                longitude: r.coords.longitude,
                accuracy: r.coords.accuracy,
                timestamp: r.timestamp,
              }),
            (err) => {
              if (err.code === err.PERMISSION_DENIED) setDenied(true);
              reject(new Error(err.message || "Geolocation failed"));
            },
            { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
          );
        });
      }
      setPosition(pos);
      return pos;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { position, loading, error, denied, request };
}

// Haversine distance in kilometres — small enough to inline everywhere.
export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
