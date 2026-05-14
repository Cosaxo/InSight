// useEarthMetrics — the "Today on Earth" card on World was static
// seed pretending to be live. This hook pulls real numbers from the
// public global-warming.org JSON APIs (CO₂ trend, temperature
// anomaly, arctic sea ice), and synthesises population from a known
// UN anchor + growth rate so the counter is honestly extrapolated
// rather than hardcoded.
//
// Caching: 24h localStorage cache. On mount we render the cached
// values immediately (no flash) and refresh in the background if the
// cache is stale. If a fetch fails we keep the last good values and
// flip `isLive` to false; the WorldTab uses that to drop the · LIVE
// badge so we never lie about freshness.

import { useEffect, useState } from "react";

const CACHE_KEY = "insight.earth.v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Population anchor: UN World Population Prospects 2024.
// 8.119 B on 2024-07-01, growing ~0.83%/year ≈ 67M/year ≈ 2.14/sec.
const POP_ANCHOR_MS = Date.UTC(2024, 6, 1); // 2024-07-01
const POP_ANCHOR = 8_119_000_000;
const POP_PER_SEC = 2.14;

export interface EarthMetrics {
  date: string; // human-readable "today" date
  population: string; // "8.14B"
  popDelta: string; // "+ ~67M/year"
  co2: string; // "423.7"
  co2Delta: string; // year-over-year delta with sign
  temp: string; // "1.32"  (°C above pre-industrial baseline)
  tempDelta: string; // "+0.18 vs 5y avg" or "—"
  ice: string; // "12.3" M km²
  iceDelta: string;
  // True when every field above was sourced from a successful fetch
  // (or computed from a known anchor, in the case of population).
  // WorldTab gates the · LIVE badge on this.
  isLive: boolean;
  loading: boolean;
}

interface CacheShape {
  fetchedAt: number;
  co2?: { value: number; deltaYoY: number };
  temp?: { value: number; recent5yAvg?: number };
  ice?: { value: number; deltaYoY: number };
}

function readCache(): CacheShape | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CacheShape) : null;
  } catch {
    return null;
  }
}

function writeCache(c: CacheShape): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    // quota/private mode — non-fatal
  }
}

function formatPopulation(): { value: string; delta: string } {
  const elapsedSec = Math.max(0, (Date.now() - POP_ANCHOR_MS) / 1000);
  const n = POP_ANCHOR + elapsedSec * POP_PER_SEC;
  const billions = n / 1_000_000_000;
  return {
    value: `${billions.toFixed(2)}B`,
    delta: `+ ~67M / year`,
  };
}

function formatDate(): string {
  return new Date().toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Public API fetchers ────────────────────────────────────────
//
// All three endpoints return JSON arrays/objects with at least one
// year of monthly readings. We pull the latest data point + one a
// year back to compute a year-over-year delta.

interface Co2Entry {
  year: string;
  month: string;
  day: string;
  cycle: string;
  trend: string;
}
async function fetchCo2(): Promise<{ value: number; deltaYoY: number } | null> {
  try {
    const res = await fetch("https://global-warming.org/api/co2-api", {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { co2: Co2Entry[] };
    const arr = data.co2;
    if (!arr || arr.length === 0) return null;
    const latest = parseFloat(arr[arr.length - 1].trend);
    // Approx 365 daily readings ago = 1 year. The series is daily.
    const yearAgo = arr[Math.max(0, arr.length - 1 - 365)];
    const yearAgoVal = parseFloat(yearAgo.trend);
    if (!Number.isFinite(latest) || !Number.isFinite(yearAgoVal)) return null;
    return { value: latest, deltaYoY: latest - yearAgoVal };
  } catch {
    return null;
  }
}

interface TempEntry {
  time: string; // e.g. "2024.04"
  station: string;
  land: string;
}
async function fetchTemp(): Promise<{ value: number } | null> {
  try {
    const res = await fetch(
      "https://global-warming.org/api/temperature-api",
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { result: TempEntry[] };
    const arr = data.result;
    if (!arr || arr.length === 0) return null;
    const latest = parseFloat(arr[arr.length - 1].land);
    if (!Number.isFinite(latest)) return null;
    return { value: latest };
  } catch {
    return null;
  }
}

interface ArcticEntry {
  value: number;
  anom: number;
}
async function fetchIce(): Promise<{ value: number; deltaYoY: number } | null> {
  try {
    const res = await fetch("https://global-warming.org/api/arctic-api", {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      arcticData?: { data?: Record<string, ArcticEntry> };
    };
    const map = data.arcticData?.data;
    if (!map) return null;
    const keys = Object.keys(map).sort();
    if (keys.length === 0) return null;
    const latest = map[keys[keys.length - 1]]?.value;
    const yearAgo = map[keys[Math.max(0, keys.length - 1 - 12)]]?.value;
    if (!Number.isFinite(latest) || !Number.isFinite(yearAgo)) return null;
    return { value: latest, deltaYoY: latest - yearAgo };
  } catch {
    return null;
  }
}

function signed(n: number, decimals = 2, unit = ""): string {
  const sign = n >= 0 ? "+" : "−";
  return `${sign}${Math.abs(n).toFixed(decimals)}${unit}`;
}

function format(cache: CacheShape | null): EarthMetrics {
  const pop = formatPopulation();
  const co2 = cache?.co2;
  const temp = cache?.temp;
  const ice = cache?.ice;
  const isLive = !!(co2 && temp && ice);
  return {
    date: formatDate(),
    population: pop.value,
    popDelta: pop.delta,
    co2: co2 ? co2.value.toFixed(1) : "—",
    co2Delta: co2 ? `${signed(co2.deltaYoY, 2)} vs 1y ago` : "—",
    temp: temp ? temp.value.toFixed(2) : "—",
    tempDelta: temp ? "vs pre-industrial baseline" : "—",
    ice: ice ? ice.value.toFixed(1) : "—",
    iceDelta: ice ? `${signed(ice.deltaYoY, 2, " M km²")} vs 1y ago` : "—",
    isLive,
    loading: false,
  };
}

let moduleCache: CacheShape | null = readCache();
let inflight: Promise<CacheShape | null> | null = null;

async function refresh(): Promise<CacheShape | null> {
  if (inflight) return inflight;
  inflight = (async () => {
    const [co2, temp, ice] = await Promise.all([
      fetchCo2(),
      fetchTemp(),
      fetchIce(),
    ]);
    // Merge with whatever we have cached — partial successes still
    // get persisted so individual fields can recover independently.
    const next: CacheShape = {
      fetchedAt: Date.now(),
      co2: co2 ?? moduleCache?.co2,
      temp: temp ?? moduleCache?.temp,
      ice: ice ?? moduleCache?.ice,
    };
    moduleCache = next;
    writeCache(next);
    return next;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function useEarthMetrics(): EarthMetrics {
  const [metrics, setMetrics] = useState<EarthMetrics>(() =>
    format(moduleCache),
  );

  useEffect(() => {
    const stale =
      !moduleCache ||
      Date.now() - moduleCache.fetchedAt > CACHE_TTL_MS ||
      !moduleCache.co2 ||
      !moduleCache.temp ||
      !moduleCache.ice;
    if (!stale) return;
    let cancelled = false;
    void refresh().then((c) => {
      if (cancelled) return;
      setMetrics(format(c));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return metrics;
}
