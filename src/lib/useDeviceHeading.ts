// useDeviceHeading — magnetic-compass heading from the device.
//
// Web exposes orientation via the `deviceorientation` event:
//   - On iOS Safari, you must call DeviceOrientationEvent.requestPermission()
//     in response to a user gesture. The event then provides
//     `webkitCompassHeading` (degrees true relative to north, already
//     corrected for device rotation).
//   - On Android Chrome and on Capacitor's WebView, the event provides
//     `alpha` — degrees clockwise from magnetic north when the device's
//     z-axis is aligned to the geographic north pole. We just use
//     360 - alpha to convert to a heading bearing.
//
// Returns:
//   - `heading`: 0..360 (or null if unavailable)
//   - `needsPermission`: true on iOS until requestPermission() is called
//   - `requestPermission`: invoke from a user gesture
//
// Honest about limits: indoor environments + magnetic interference from
// laptops / steel structures throw heading off by 10-30°. The hook
// surfaces what the OS gives us; the UI consumer should label heading
// as "approximate" rather than authoritative.

import { useEffect, useState, useCallback } from "react";

interface DeviceOrientationEventIOS extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

interface DeviceOrientationEventStaticIOS {
  requestPermission?: () => Promise<"granted" | "denied">;
}

export interface DeviceHeading {
  heading: number | null;
  needsPermission: boolean;
  requestPermission: () => Promise<void>;
  permissionDenied: boolean;
  supported: boolean;
}

export function useDeviceHeading(): DeviceHeading {
  // Feature-detect once on mount. SSR-safe — the `typeof window` guard
  // keeps this from running during static eval.
  const supported =
    typeof window !== "undefined" &&
    typeof DeviceOrientationEvent !== "undefined";
  const needsPermissionAtStart =
    supported &&
    typeof (
      (DeviceOrientationEvent as unknown) as DeviceOrientationEventStaticIOS
    ).requestPermission === "function";

  const [heading, setHeading] = useState<number | null>(null);
  const [needsPermission, setNeedsPermission] = useState(needsPermissionAtStart);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Attach the listener. On iOS we don't attach until permission is
  // granted (the listener will never fire otherwise). Elsewhere we
  // attach immediately and the heading just stays null on devices
  // without a magnetometer.
  useEffect(() => {
    if (!supported || needsPermission) return;
    const handler = (event: DeviceOrientationEvent) => {
      const ios = event as DeviceOrientationEventIOS;
      // webkitCompassHeading: 0..360 already in true-north terms.
      if (typeof ios.webkitCompassHeading === "number") {
        setHeading(ios.webkitCompassHeading);
        return;
      }
      // Standard alpha: 0..360 from device's local frame; subtract
      // from 360 to flip to a compass bearing (0 = north).
      if (typeof event.alpha === "number") {
        setHeading((360 - event.alpha) % 360);
      }
    };
    window.addEventListener("deviceorientation", handler, true);
    return () => window.removeEventListener("deviceorientation", handler, true);
  }, [supported, needsPermission]);

  const requestPermission = useCallback(async () => {
    if (!supported) return;
    const ctor = (DeviceOrientationEvent as unknown) as DeviceOrientationEventStaticIOS;
    if (typeof ctor.requestPermission !== "function") {
      setNeedsPermission(false);
      return;
    }
    try {
      const result = await ctor.requestPermission();
      if (result === "granted") {
        setNeedsPermission(false);
        setPermissionDenied(false);
      } else {
        setPermissionDenied(true);
      }
    } catch {
      setPermissionDenied(true);
    }
  }, [supported]);

  return {
    heading,
    needsPermission,
    requestPermission,
    permissionDenied,
    supported,
  };
}

// Cardinal letter for a heading. 16-point compass like the original
// widget used so it reads like a paper map.
export function compassLabel(deg: number): string {
  const dirs = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  return dirs[Math.round(((deg % 360) / 22.5)) % 16];
}

// Approximate solar azimuth (degrees from north) given lat/lng and a
// timestamp. Uses NOAA's simplified Solar Position Algorithm; good
// to within ~1° for compass use without pulling in a sun-pos library.
// Returns null when the sun is below the horizon (can't point at
// something you can't see).
export function solarBearing(
  lat: number,
  lng: number,
  date: Date = new Date(),
): { azimuth: number; altitude: number } | null {
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;
  // Julian day.
  const ms = date.getTime();
  const jd = ms / 86_400_000 + 2_440_587.5;
  const n = jd - 2_451_545.0; // days since J2000
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * rad;
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad;
  const epsilon = 23.439 * rad;
  const sinDec = Math.sin(epsilon) * Math.sin(lambda);
  const declination = Math.asin(sinDec);
  const rightAsc = Math.atan2(
    Math.cos(epsilon) * Math.sin(lambda),
    Math.cos(lambda),
  );
  // Greenwich Mean Sidereal Time → local sidereal time → hour angle.
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const lst = (gmst * 15 + lng) * rad;
  const ha = lst - rightAsc;
  const latR = lat * rad;
  const sinAlt =
    Math.sin(latR) * sinDec + Math.cos(latR) * Math.cos(declination) * Math.cos(ha);
  const altitude = Math.asin(sinAlt) * deg;
  if (altitude < -1) return null; // below horizon
  const az = Math.atan2(
    -Math.cos(declination) * Math.sin(ha),
    Math.sin(declination) * Math.cos(latR) -
      Math.cos(declination) * Math.sin(latR) * Math.cos(ha),
  ) * deg;
  const azimuth = (az + 360) % 360;
  return { azimuth, altitude };
}
