import { useCallback, useEffect, useState } from "react";
import { C, SEC } from "../../theme";
import type { Ambient, GeoPoint } from "../../types";
import { weatherEnabled, getAmbient } from "../../lib/weather";
import {
  readLastKnown,
  requestCurrentPosition,
  type GeoError,
} from "../../lib/geolocation";
import { cToF, loadUnits, saveUnits, type Units } from "../../lib/units";
import { Card } from "./Card";
import { SLabel } from "./SLabel";
import { Skeleton } from "./Skeleton";

const REFRESH_MS = 5 * 60 * 1000;

type State =
  | { kind: "disabled" }
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: Ambient; stale: boolean };

// US EPA air-quality index (1..6) → colour + label.
function aqiMeta(epa?: number): { label: string; color: string } | null {
  if (!epa) return null;
  const table: [string, string][] = [
    ["Good", C.teal],
    ["Moderate", C.green],
    ["USG", C.amber],
    ["Unhealthy", C.coral],
    ["Very Unhealthy", C.red],
    ["Hazardous", C.purple],
  ];
  const [label, color] = table[Math.min(Math.max(epa, 1), 6) - 1];
  return { label, color };
}

function uvMeta(uv: number): { label: string; color: string } {
  if (uv < 3) return { label: "Low", color: C.teal };
  if (uv < 6) return { label: "Moderate", color: C.amber };
  if (uv < 8) return { label: "High", color: C.coral };
  if (uv < 11) return { label: "Very high", color: C.red };
  return { label: "Extreme", color: C.purple };
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs === 1 ? "1 hr ago" : `${hrs} hr ago`;
}

export function AmbientCard() {
  const initialPoint = readLastKnown();
  const [point, setPoint] = useState<GeoPoint | null>(initialPoint);
  const [state, setState] = useState<State>(() =>
    !weatherEnabled
      ? { kind: "disabled" }
      : initialPoint
        ? { kind: "loading" }
        : { kind: "idle" },
  );
  const [units, setUnits] = useState<Units>(() => loadUnits());

  const toggleTemp = () => {
    const u = { ...units, temp: units.temp === "C" ? "F" : "C" } as Units;
    setUnits(u);
    saveUnits(u);
  };
  const toggleSpeed = () => {
    const u = {
      ...units,
      speed: units.speed === "kph" ? "mph" : "kph",
    } as Units;
    setUnits(u);
    saveUnits(u);
  };

  const load = useCallback(async (p: GeoPoint) => {
    try {
      const r = await getAmbient(p, (fresh) => {
        setState({ kind: "ready", data: fresh, stale: false });
      });
      setState({ kind: "ready", data: r.value, stale: r.stale });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load weather";
      setState({ kind: "error", message: msg });
    }
  }, []);

  // Load when we have a point (from cache on first render, or after the user
  // taps). Network I/O only — the setState calls inside `load` run in
  // microtask callbacks after the fetch resolves, not synchronously.
  useEffect(() => {
    if (!weatherEnabled || !point) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      void load(point);
    });
    return () => {
      cancelled = true;
    };
  }, [point, load]);

  // Refresh on tab focus + every 5 min while visible.
  useEffect(() => {
    if (!point) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void load(point);
    };
    document.addEventListener("visibilitychange", onVisible);
    const iv = window.setInterval(() => void load(point), REFRESH_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(iv);
    };
  }, [point, load]);

  async function useMyLocation() {
    setState({ kind: "loading" });
    try {
      const p = await requestCurrentPosition();
      setPoint(p);
    } catch (e) {
      const err = e as GeoError;
      setState({
        kind: "error",
        message:
          err.code === "permission-denied"
            ? "Location permission denied. Enable it in browser settings to see live weather."
            : err.message || "Could not get your location",
      });
    }
  }

  if (state.kind === "disabled") return null;

  const accent = SEC.ambient.accent;

  if (state.kind === "idle") {
    return (
      <Card sec="ambient">
        <SLabel sec="ambient">Ambient</SLabel>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>
          See weather, air quality, and UV for where you are right now.
        </div>
        <button
          onClick={useMyLocation}
          style={{
            width: "100%",
            padding: "11px",
            borderRadius: 12,
            border: "none",
            background: accent,
            color: "#fff",
            fontFamily: "inherit",
            fontSize: 13,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Use my location
        </button>
      </Card>
    );
  }

  if (state.kind === "loading") {
    return (
      <Card sec="ambient">
        <SLabel sec="ambient">Ambient</SLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton height={42} width="55%" radius={8} />
          <Skeleton height={11} width="40%" radius={4} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginTop: 6,
            }}
          >
            <Skeleton height={48} radius={12} />
            <Skeleton height={48} radius={12} />
            <Skeleton height={48} radius={12} />
            <Skeleton height={48} radius={12} />
          </div>
        </div>
      </Card>
    );
  }

  if (state.kind === "error") {
    return (
      <Card sec="ambient">
        <SLabel sec="ambient">Ambient</SLabel>
        <div style={{ fontSize: 13, color: C.coral, marginBottom: 10 }}>
          {state.message}
        </div>
        <button
          onClick={useMyLocation}
          style={{
            padding: "9px 14px",
            borderRadius: 10,
            border: `1px solid ${C.divider}`,
            background: "transparent",
            color: C.muted,
            fontFamily: "inherit",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </Card>
    );
  }

  const a = state.data;
  const temp = units.temp === "C" ? a.tempC : cToF(a.tempC);
  const feels = units.temp === "C" ? a.feelsLikeC : cToF(a.feelsLikeC);
  const wind = units.speed === "kph" ? a.windKph : a.windMph;

  const aqi = aqiMeta(a.air?.usEpaIndex);
  const uv = uvMeta(a.uv);

  const tiles: { label: string; value: string; color?: string }[] = [
    ...(aqi
      ? [{ label: "Air quality", value: aqi.label, color: aqi.color }]
      : []),
    { label: "UV", value: `${Math.round(a.uv)} · ${uv.label}`, color: uv.color },
    { label: "Humidity", value: `${a.humidity}%` },
    {
      label: "Wind",
      value: `${Math.round(wind)} ${units.speed} ${a.windDir}`,
    },
  ];

  return (
    <Card sec="ambient">
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.8px",
              color: accent,
              fontWeight: 700,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            {a.location}
          </div>
          <button
            onClick={toggleTemp}
            aria-label="Toggle temperature unit"
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              margin: 0,
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
              color: C.navy,
            }}
          >
            <span style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}>
              {Math.round(temp)}°{units.temp}
            </span>
          </button>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            {a.conditionText} · feels {Math.round(feels)}°{units.temp}
          </div>
        </div>
        <div
          style={{
            textAlign: "right",
            fontSize: 10,
            color: C.muted,
            flexShrink: 0,
          }}
        >
          {state.stale ? "Stale · " : ""}
          {relativeTime(a.fetchedAt)}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginTop: 12,
        }}
      >
        {tiles.map((t, i) => (
          <div
            key={i}
            onClick={t.label === "Wind" ? toggleSpeed : undefined}
            style={{
              background: C.dim,
              borderRadius: 12,
              padding: "10px 12px",
              cursor: t.label === "Wind" ? "pointer" : "default",
            }}
          >
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>
              {t.label}
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: t.color || C.navy,
                marginTop: 2,
              }}
            >
              {t.value}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          fontSize: 10,
          color: C.muted,
          marginTop: 10,
          textAlign: "center",
        }}
      >
        Tap temperature or wind to toggle units
      </div>
    </Card>
  );
}
