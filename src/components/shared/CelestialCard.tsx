import { useEffect, useMemo, useState } from "react";
import { C, SEC } from "../../theme";
import type { BodyState, CelestialSnapshot, GeoPoint } from "../../types";
import { celestialSnapshot } from "../../lib/astronomy";
import {
  readLastKnown,
  requestCurrentPosition,
  type GeoError,
} from "../../lib/geolocation";
import { Card } from "./Card";
import { SLabel } from "./SLabel";

const REFRESH_MS = 60_000; // astronomy is purely local; recompute every minute

function degToCompass(deg: number): string {
  const dirs = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  return dirs[Math.round(((deg % 360) / 22.5)) % 16];
}

function fmtTime(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function moonGlyph(phase: string): string {
  const map: Record<string, string> = {
    "New Moon": "🌑",
    "Waxing Crescent": "🌒",
    "First Quarter": "🌓",
    "Waxing Gibbous": "🌔",
    "Full Moon": "🌕",
    "Waning Gibbous": "🌖",
    "Last Quarter": "🌗",
    "Waning Crescent": "🌘",
  };
  return map[phase] ?? "🌙";
}

function PlanetRow({ p }: { p: BodyState }) {
  const accent = SEC.celestial.accent;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 0",
        borderBottom: `1px solid ${C.divider}`,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: p.isNakedEye ? `${accent}15` : C.dim,
          border: `1px solid ${p.isNakedEye ? `${accent}40` : C.divider}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: 700,
          color: p.isNakedEye ? accent : C.muted,
          flexShrink: 0,
        }}
      >
        {p.name[0]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>
          {p.name}
          {p.isNakedEye && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: accent,
                marginLeft: 8,
                padding: "2px 6px",
                background: `${accent}12`,
                borderRadius: 8,
              }}
            >
              VISIBLE
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
          {p.isUp
            ? `Alt ${Math.round(p.altitudeDeg)}° · ${degToCompass(p.azimuthDeg)} ${Math.round(p.azimuthDeg)}°`
            : `Below horizon · rises ${fmtTime(p.nextRise)}`}
          {p.magnitude !== undefined &&
            ` · mag ${p.magnitude.toFixed(1)}`}
        </div>
      </div>
    </div>
  );
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; point: GeoPoint };

export function CelestialCard() {
  const initial = readLastKnown();
  const [state, setState] = useState<State>(
    initial ? { kind: "ready", point: initial } : { kind: "idle" },
  );
  const [now, setNow] = useState(() => new Date());

  // Recompute every minute (sun/moon/planets shift visibly over ~tens of minutes).
  useEffect(() => {
    const iv = window.setInterval(() => setNow(new Date()), REFRESH_MS);
    return () => window.clearInterval(iv);
  }, []);

  const snapshot: CelestialSnapshot | null = useMemo(() => {
    if (state.kind !== "ready") return null;
    return celestialSnapshot(state.point, now);
  }, [state, now]);

  async function useMyLocation() {
    setState({ kind: "loading" });
    try {
      const p = await requestCurrentPosition();
      setState({ kind: "ready", point: p });
    } catch (e) {
      const err = e as GeoError;
      setState({
        kind: "error",
        message:
          err.code === "permission-denied"
            ? "Location permission denied. Enable it to see what's in the sky above you."
            : err.message || "Could not get your location",
      });
    }
  }

  const accent = SEC.celestial.accent;

  if (state.kind === "idle") {
    return (
      <Card sec="celestial">
        <SLabel sec="celestial">Above you now</SLabel>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>
          See which planets, the moon, and meteor showers are visible from
          your location right now.
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
      <Card sec="celestial">
        <SLabel sec="celestial">Above you now</SLabel>
        <div style={{ fontSize: 13, color: C.muted, padding: "8px 0" }}>
          Getting your location…
        </div>
      </Card>
    );
  }

  if (state.kind === "error") {
    return (
      <Card sec="celestial">
        <SLabel sec="celestial">Above you now</SLabel>
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

  if (!snapshot) return null;
  const { sun, moon, planets, activeShowers } = snapshot;
  const visiblePlanets = planets.filter((p) => p.isNakedEye);
  const otherPlanets = planets.filter((p) => !p.isNakedEye);

  return (
    <Card sec="celestial">
      <SLabel sec="celestial">Above you now</SLabel>

      {/* Sun & Moon summary row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            background: C.dim,
            borderRadius: 12,
            padding: "12px 14px",
          }}
        >
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>
            Sun {sun.isUp ? "above" : "below"} horizon
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.navy }}>
            {sun.isUp
              ? `Alt ${Math.round(sun.altitudeDeg)}°`
              : `Rises ${fmtTime(sun.nextRise)}`}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            {sun.isUp
              ? `Sets ${fmtTime(sun.nextSet)}`
              : `From ${degToCompass(sun.azimuthDeg)}`}
          </div>
        </div>
        <div
          style={{
            background: C.dim,
            borderRadius: 12,
            padding: "12px 14px",
          }}
        >
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>
            Moon {moon.illuminationPct}% lit
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.navy }}>
            {moonGlyph(moon.phaseName)} {moon.phaseName}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            {moon.isUp
              ? `Alt ${Math.round(moon.altitudeDeg)}° · sets ${fmtTime(moon.nextSet)}`
              : `Rises ${fmtTime(moon.nextRise)}`}
          </div>
        </div>
      </div>

      {/* Visible planets */}
      {visiblePlanets.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              fontSize: 11,
              color: accent,
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            Visible to the naked eye
          </div>
          {visiblePlanets.map((p) => (
            <PlanetRow key={p.name} p={p} />
          ))}
        </div>
      )}

      {/* Other planets */}
      {otherPlanets.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 11,
              color: C.muted,
              fontWeight: 600,
              marginBottom: 4,
              marginTop: visiblePlanets.length ? 10 : 0,
            }}
          >
            Other planets
          </div>
          {otherPlanets.map((p) => (
            <PlanetRow key={p.name} p={p} />
          ))}
        </div>
      )}

      {/* Meteor showers */}
      {activeShowers.length > 0 && (
        <div
          style={{
            marginTop: 14,
            padding: "10px 14px",
            borderRadius: 12,
            background: `${accent}10`,
            border: `1px solid ${accent}30`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: accent,
              fontWeight: 700,
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Meteor showers active
          </div>
          {activeShowers.map((s) => (
            <div
              key={s.name}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                color: C.navy,
                padding: "3px 0",
              }}
            >
              <span>
                ☄ {s.name} <span style={{ color: C.muted }}>· {s.radiant}</span>
              </span>
              <span style={{ fontSize: 12, color: C.muted }}>
                {s.daysToPeak === 0
                  ? "peaks today!"
                  : s.daysToPeak > 0
                    ? `peaks in ${s.daysToPeak}d`
                    : `peak was ${-s.daysToPeak}d ago`}
                {" · "}
                ~{s.peakZhr}/h
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
