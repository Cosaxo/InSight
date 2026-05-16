// useWeather — current weather for the user's position, with a
// per-hour per-grid-cell localStorage cache so we don't hammer
// Open-Meteo on every render.
//
// Data sources (no API key required, free tier, no auth):
//   - https://api.open-meteo.com/v1/forecast  (temp, humidity,
//     wind, weather code, daily high/low, UV index, sunrise/sunset)
//   - https://air-quality-api.open-meteo.com/v1/air-quality  (US AQI)
//
// Caching: lat/long rounded to 2 decimal places (~1.1 km grid),
// keyed alongside the current ISO hour. Cache TTL is one hour;
// anything older is re-fetched. Cache lives in localStorage so a
// short reload doesn't re-fetch.

import { useEffect, useState } from "react";
import type { GeoPosition } from "./useGeolocation";

export interface WeatherData {
  temp: number;          // °C
  feels: number;
  weatherCode: number;   // WMO weather code
  weatherLabel: string;  // "scattered clouds"
  high: number;          // today's high
  low: number;           // today's low
  humidity: number;      // %
  windSpeed: number;     // km/h
  windDirection: number; // degrees the wind is coming FROM
  windDirLabel: string;  // "NW" etc.
  uv: number;            // 0..11+
  uvLabel: string;
  aqi: number | null;    // US AQI 0..500 — null if air-quality fetch failed
  aqiLabel: string | null;
  sunrise: string;       // "HH:MM" in the user's local timezone
  sunset: string;        // same
  daylight: string;      // "11h 23m"
}

// WMO weather code → short prose label. Source:
// https://www.nodc.noaa.gov/archive/arc0021/0002199/1.1/data/0-data/HTML/WMO-CODE/WMO4677.HTM
function weatherLabelFor(code: number): string {
  if (code === 0) return "clear";
  if (code === 1) return "mostly clear";
  if (code === 2) return "partly cloudy";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 61 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "showers";
  if (code >= 85 && code <= 86) return "snow showers";
  if (code >= 95) return "thunder";
  return "weather";
}

function uvLabelFor(uv: number): string {
  if (uv < 3) return "low";
  if (uv < 6) return "moderate";
  if (uv < 8) return "high";
  if (uv < 11) return "very high";
  return "extreme";
}

function aqiLabelFor(aqi: number): string {
  if (aqi <= 50) return "clean";
  if (aqi <= 100) return "moderate";
  if (aqi <= 150) return "unhealthy · sensitive";
  if (aqi <= 200) return "unhealthy";
  if (aqi <= 300) return "very unhealthy";
  return "hazardous";
}

function compassLabel(deg: number): string {
  const dirs = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  return dirs[Math.round((deg % 360) / 22.5) % 16];
}

function isoTimeShort(iso: string): string {
  // "2026-05-14T05:14" → "05:14"
  const m = iso.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : iso;
}

function durationBetween(sunriseIso: string, sunsetIso: string): string {
  const a = new Date(sunriseIso).getTime();
  const b = new Date(sunsetIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return "—";
  const mins = Math.round((b - a) / 60_000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

// Round to 2 decimal places (~1.1 km). Cache key per grid cell so
// people near each other share cache entries on the same device.
function gridKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)}_${lng.toFixed(2)}`;
}

// Current ISO hour: "2026-05-14-13"
function hourKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}`;
}

function cacheKey(lat: number, lng: number): string {
  return `insight.weather.${gridKey(lat, lng)}.${hourKey()}.v1`;
}

interface CachedWeather {
  ts: number;
  data: WeatherData;
}

function readCache(lat: number, lng: number): WeatherData | null {
  try {
    const raw = localStorage.getItem(cacheKey(lat, lng));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedWeather;
    if (Date.now() - parsed.ts > 60 * 60 * 1000) return null; // 1 hour TTL
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(lat: number, lng: number, data: WeatherData): void {
  try {
    localStorage.setItem(
      cacheKey(lat, lng),
      JSON.stringify({ ts: Date.now(), data } satisfies CachedWeather),
    );
  } catch {
    // quota etc. — fine, hook still returns data for this session
  }
}

async function fetchOpenMeteo(
  lat: number,
  lng: number,
  signal: AbortSignal,
): Promise<WeatherData> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "weather_code",
      "wind_speed_10m",
      "wind_direction_10m",
    ].join(","),
  );
  url.searchParams.set("hourly", "uv_index");
  url.searchParams.set(
    "daily",
    ["temperature_2m_max", "temperature_2m_min", "sunrise", "sunset"].join(","),
  );
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "1");
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("temperature_unit", "celsius");

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  type OM = {
    current: {
      temperature_2m: number;
      apparent_temperature: number;
      relative_humidity_2m: number;
      weather_code: number;
      wind_speed_10m: number;
      wind_direction_10m: number;
    };
    hourly: { time: string[]; uv_index: number[] };
    daily: {
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      sunrise: string[];
      sunset: string[];
    };
  };
  const j = (await res.json()) as OM;

  // Find the nearest hourly entry for "now" to grab the live UV.
  const now = new Date();
  const nowIso = now.toISOString().slice(0, 13); // "2026-05-14T13"
  let uv = 0;
  const idx = j.hourly.time.findIndex((t) => t.startsWith(nowIso));
  if (idx >= 0) uv = j.hourly.uv_index[idx] ?? 0;
  else uv = j.hourly.uv_index[0] ?? 0;

  const sunriseIso = j.daily.sunrise[0];
  const sunsetIso = j.daily.sunset[0];

  return {
    temp: Math.round(j.current.temperature_2m),
    feels: Math.round(j.current.apparent_temperature),
    weatherCode: j.current.weather_code,
    weatherLabel: weatherLabelFor(j.current.weather_code),
    high: Math.round(j.daily.temperature_2m_max[0]),
    low: Math.round(j.daily.temperature_2m_min[0]),
    humidity: Math.round(j.current.relative_humidity_2m),
    windSpeed: Math.round(j.current.wind_speed_10m),
    windDirection: Math.round(j.current.wind_direction_10m),
    windDirLabel: compassLabel(j.current.wind_direction_10m),
    uv: Math.round(uv),
    uvLabel: uvLabelFor(uv),
    aqi: null, // filled in by the air-quality fetch below
    aqiLabel: null,
    sunrise: isoTimeShort(sunriseIso),
    sunset: isoTimeShort(sunsetIso),
    daylight: durationBetween(sunriseIso, sunsetIso),
  };
}

async function fetchAirQuality(
  lat: number,
  lng: number,
  signal: AbortSignal,
): Promise<{ aqi: number; label: string } | null> {
  try {
    const url = new URL(
      "https://air-quality-api.open-meteo.com/v1/air-quality",
    );
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lng));
    url.searchParams.set("current", "us_aqi");
    const res = await fetch(url.toString(), { signal });
    if (!res.ok) return null;
    type Aq = { current: { us_aqi: number } };
    const j = (await res.json()) as Aq;
    const aqi = Math.round(j.current.us_aqi);
    return { aqi, label: aqiLabelFor(aqi) };
  } catch {
    return null;
  }
}

export function useWeather(position: GeoPosition | null): {
  data: WeatherData | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!position) {
      setData(null);
      return;
    }
    const lat = position.latitude;
    const lng = position.longitude;

    // Cache hit? Use it without re-fetching.
    const cached = readCache(lat, lng);
    if (cached) {
      setData(cached);
      return;
    }

    setLoading(true);
    setError(null);
    const controller = new AbortController();
    (async () => {
      try {
        const weather = await fetchOpenMeteo(lat, lng, controller.signal);
        const air = await fetchAirQuality(lat, lng, controller.signal);
        const merged: WeatherData = air
          ? { ...weather, aqi: air.aqi, aqiLabel: air.label }
          : weather;
        writeCache(lat, lng, merged);
        setData(merged);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
    // We deliberately depend on lat/long rather than `position` so a
    // new GeoPosition object with the same coordinates doesn't
    // re-trigger the fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.latitude, position?.longitude]);

  return { data, loading, error };
}
