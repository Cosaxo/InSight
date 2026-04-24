// Thin typed client over WeatherAPI.com.
// Caches responses in localStorage to survive reloads and enable
// stale-while-revalidate behaviour (show cached instantly, refetch in the
// background). Keys are (lat, lng) rounded to 3 decimal places so tiny
// movements don't invalidate the cache.

import type { Ambient, AirQuality, GeoPoint } from "../types";

const API_BASE = "https://api.weatherapi.com/v1";
const CACHE_PREFIX = "insight.weather.";
const FRESH_MS = 5 * 60 * 1000; // considered fresh for 5 min
const MAX_CACHE_MS = 60 * 60 * 1000; // but show stale up to 1 h with refresh badge

export const weatherEnabled =
  typeof import.meta.env.VITE_WEATHER_API_KEY === "string" &&
  import.meta.env.VITE_WEATHER_API_KEY.length > 0;

function apiKey(): string {
  const k = import.meta.env.VITE_WEATHER_API_KEY as string | undefined;
  if (!k) throw new Error("VITE_WEATHER_API_KEY not set");
  return k;
}

function roundCoord(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function cacheKey(kind: "current", point: GeoPoint): string {
  return `${CACHE_PREFIX}${kind}.${roundCoord(point.lat)},${roundCoord(point.lng)}`;
}

function readCache<T>(key: string): { value: T; storedAt: number } | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({ value, storedAt: Date.now() }),
    );
  } catch {
    // storage full / disabled — ignore
  }
}

// ── Current weather + air quality ───────────────────────────────

interface CurrentResponse {
  location: { name: string; region?: string; country?: string };
  current: {
    temp_c: number;
    feelslike_c: number;
    condition: { text: string; code: number };
    is_day: 0 | 1;
    humidity: number;
    pressure_mb: number;
    wind_kph: number;
    wind_mph: number;
    wind_dir: string;
    wind_degree: number;
    uv: number;
    cloud: number;
    precip_mm: number;
    air_quality?: {
      co?: number;
      o3?: number;
      no2?: number;
      so2?: number;
      pm2_5?: number;
      pm10?: number;
      "us-epa-index"?: number;
      "gb-defra-index"?: number;
    };
  };
}

function toAmbient(raw: CurrentResponse, location: string): Ambient {
  const c = raw.current;
  const aq = c.air_quality;
  const air: AirQuality | undefined = aq
    ? {
        co: aq.co,
        o3: aq.o3,
        no2: aq.no2,
        so2: aq.so2,
        pm2_5: aq.pm2_5,
        pm10: aq.pm10,
        usEpaIndex: aq["us-epa-index"],
        gbDefraIndex: aq["gb-defra-index"],
      }
    : undefined;
  return {
    fetchedAt: Date.now(),
    location,
    tempC: c.temp_c,
    feelsLikeC: c.feelslike_c,
    conditionText: c.condition.text,
    conditionCode: c.condition.code,
    isDay: c.is_day === 1,
    humidity: c.humidity,
    pressureMb: c.pressure_mb,
    windKph: c.wind_kph,
    windMph: c.wind_mph,
    windDir: c.wind_dir,
    windDegree: c.wind_degree,
    uv: c.uv,
    cloudPct: c.cloud,
    precipMm: c.precip_mm,
    air,
  };
}

async function fetchCurrent(point: GeoPoint): Promise<Ambient> {
  const q = `${point.lat},${point.lng}`;
  const url = `${API_BASE}/current.json?key=${encodeURIComponent(apiKey())}&q=${encodeURIComponent(q)}&aqi=yes`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Weather API error ${res.status}`);
  }
  const raw = (await res.json()) as CurrentResponse;
  const locationLabel = raw.location
    ? [raw.location.name, raw.location.country].filter(Boolean).join(", ")
    : "Unknown";
  return toAmbient(raw, point.label ?? locationLabel);
}

export interface AmbientResult {
  value: Ambient;
  fromCache: boolean;
  stale: boolean;
}

// Stale-while-revalidate: returns cached instantly when present, and
// invokes onFresh() if we re-fetched a newer value.
export async function getAmbient(
  point: GeoPoint,
  onFresh?: (a: Ambient) => void,
): Promise<AmbientResult> {
  const key = cacheKey("current", point);
  const cached = readCache<Ambient>(key);

  const age = cached ? Date.now() - cached.storedAt : Infinity;
  const isFresh = age < FRESH_MS;
  const isUsableStale = age < MAX_CACHE_MS;

  if (cached && isFresh) {
    return { value: cached.value, fromCache: true, stale: false };
  }

  const fetchFresh = async () => {
    const fresh = await fetchCurrent(point);
    writeCache(key, fresh);
    return fresh;
  };

  if (cached && isUsableStale) {
    // Kick off revalidation without blocking — return stale immediately.
    fetchFresh()
      .then((f) => onFresh?.(f))
      .catch((e) => console.error("[weather] revalidate:", e));
    return { value: cached.value, fromCache: true, stale: true };
  }

  const fresh = await fetchFresh();
  return { value: fresh, fromCache: false, stale: false };
}
