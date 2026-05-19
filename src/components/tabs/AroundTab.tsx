import { useState } from "react";
import { INTEREST_CATS } from "../../data/taxonomies";
import {
  Av,
  CompassRose,
  Kicker,
  Pill,
} from "../shared/primitives";
import { useAreaAggregate } from "../../lib/useAreaAggregate";
import { useGeolocation } from "../../lib/useGeolocation";
import { useNearbyPeople } from "../../lib/useNearbyPeople";
import { useWeather } from "../../lib/useWeather";
import {
  useDeviceHeading,
  compassLabel,
  solarBearing,
} from "../../lib/useDeviceHeading";
import { CirclePortrait } from "./around-portrait";
import { WeatherCard } from "./around-weather";

export interface NearbyPerson {
  id: string;
  name: string;
  init: string;
  age: number;
  dist: string;
  // null means "no match could be computed" — either the viewer
  // hasn't taken the Big Five test, or the discovered user hasn't,
  // or both. PersonRow renders "—" in this case.
  match: number | null;
  hue: number;
  role: string;
  interests: { t: string; c: string }[];
  values: string;
  note: string;
}

interface AroundTabProps {
  onPerson: (p: NearbyPerson) => void;
  onOpenTest: () => void;
  onAddPerson: () => void;
}

function PersonRow({ p, onClick }: { p: NearbyPerson; onClick: () => void }) {
  // Subline composes from whatever the discovered user has chosen
  // to share: role + age + distance + values. Empty pieces are
  // filtered so the line stays clean.
  const subParts = [
    p.role && p.role.trim(),
    p.age && p.age > 0 ? `${p.age}` : null,
    p.dist,
    p.values && p.values.trim(),
  ].filter(Boolean);
  return (
    <div onClick={onClick} className="card" style={{ display: "flex", gap: 14, alignItems: "center", cursor: "pointer", borderLeft: `3px solid oklch(0.55 0.12 ${p.hue})` }}>
      <Av init={p.init} hue={p.hue} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 16, fontWeight: 500, letterSpacing: "-0.01em" }}>{p.name}</div>
        <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: "0.04em", marginTop: 1 }}>
          {subParts.join(" · ")}
        </div>
        {p.note && p.note.trim() && (
          <div
            style={{
              fontSize: 12,
              color: "var(--ink-2)",
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              marginTop: 4,
              lineHeight: 1.35,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            “{p.note}”
          </div>
        )}
        <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
          {p.interests.slice(0, 4).map((it, i) => {
            const cat = INTEREST_CATS.find((c) => c.id === it.c);
            const hue = cat?.hue ?? 50;
            return (
              <span key={i} style={{
                fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.06em",
                padding: "2px 6px", borderRadius: 999,
                border: `0.5px solid oklch(0.78 0.08 ${hue})`,
                background: `oklch(0.96 0.03 ${hue})`,
                color: `oklch(0.32 0.13 ${hue})`,
              }}>
                <span style={{ marginRight: 3 }}>{cat?.glyph ?? "·"}</span>{it.t}
              </span>
            );
          })}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div
          className="fig-num"
          style={{
            fontSize: 26,
            color: p.match == null ? "var(--ink-3)" : "var(--ink)",
          }}
          title={p.match == null ? "take the Big Five test to see match" : undefined}
        >
          <em>{p.match == null ? "—" : p.match}</em>
        </div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.12em", color: "var(--ink-3)", textTransform: "uppercase" }}>match</div>
      </div>
    </div>
  );
}

export function AroundTab({ onPerson, onOpenTest, onAddPerson }: AroundTabProps) {
  const [mode, setMode] = useState<"radar" | "list" | "portrait">("radar");
  const { position, loading: geoLoading, error: geoError, request } =
    useGeolocation();
  const { people: nearby, source } = useNearbyPeople(position, 10);
  const { data: weather, loading: weatherLoading } = useWeather(position);
  const { data: areaAggregate } = useAreaAggregate(position);

  const cx = 160, cy = 160;
  const placed = nearby.map((p) => {
    const angle = (p.hue / 360) * Math.PI * 2 - Math.PI / 2;
    // Unknown match → render on the middle ring (match = 50). The
    // PersonRow shows "—" so the visual hint is consistent with
    // the "we don't know yet" semantic.
    const m = p.match ?? 50;
    const r = 145 - (m / 100) * 110;
    return { ...p, x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  });

  return (
    <div className="fade-in">
      <div className="page-num">— iii —</div>
      <Kicker>Chapter one · your vicinity</Kicker>
      <div className="sec-head"><h2>Souls within walking distance</h2></div>

      {/* "Use my location" CTA — only shown when we haven't tried yet. */}
      {!position && (
        <div
          className="card"
          style={{
            marginBottom: 10,
            padding: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <Kicker>See who's actually nearby</Kicker>
            <div
              className="margin-note"
              style={{ marginTop: 4, fontSize: 12 }}
            >
              {geoError
                ? geoError
                : "Tap to use your location — we'll find the people around you."}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void request()}
            disabled={geoLoading}
            style={{
              padding: "8px 14px",
              background: "var(--ink)",
              color: "var(--paper)",
              border: "none",
              borderRadius: 99,
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: "0.12em",
              cursor: geoLoading ? "wait" : "pointer",
              opacity: geoLoading ? 0.6 : 1,
            }}
          >
            {geoLoading ? "…" : "↑ USE LOCATION"}
          </button>
        </div>
      )}

      {/* When we have a location but nobody nearby is discoverable yet,
          we're falling back to seed data — be honest about that. */}
      {position && source === "seed" && (
        <div
          className="margin-note"
          style={{
            fontSize: 11,
            color: "var(--ink-3)",
            marginBottom: 8,
            fontStyle: "italic",
          }}
        >
          Nobody discoverable in your area yet — showing the seed
          cast. Turn on "discoverable" in Sharing to be one of them.
        </div>
      )}

      {/* Live weather + sunrise/sunset from Open-Meteo. Only rendered
          when geolocation is granted (the hook reads from `position`,
          falling back to null when missing). The card itself handles
          loading + error states. */}
      {position && (
        <WeatherCard data={weather} loading={weatherLoading} />
      )}

      {/* Live compass — reads device orientation (magnetometer when
          available). iOS needs an explicit permission grant via a
          user gesture; the widget surfaces a "tap to enable" button
          when so. Shows the cardinals rotated to face current
          heading, plus the sun's bearing when geolocation grants us
          a position to compute it from. */}
      <CompassWidget position={position} />


      <div style={{ display: "flex", gap: 8, margin: "12px 0 4px", flexWrap: "wrap" }}>
        <Pill color="sienna" active={mode === "radar"} onClick={() => setMode("radar")}>Radar</Pill>
        <Pill color="sage" active={mode === "list"} onClick={() => setMode("list")}>List</Pill>
        <Pill active={mode === "portrait"} onClick={() => setMode("portrait")}>Circle portrait</Pill>
      </div>

      {mode === "radar" && (
        <div>
          <div className="compass-wrap">
            <CompassRose />
            <svg viewBox="0 0 320 320" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
              <circle cx={cx} cy={cy} r="6" fill="var(--ink)" />
              <text x={cx} y={cy + 22} textAnchor="middle" style={{ font: "italic 11px Fraunces, serif", fill: "var(--ink-2)" }}>you</text>
              {placed.map((p) => (
                <g key={p.id} style={{ cursor: "pointer" }} onClick={() => onPerson(p)}>
                  <circle cx={p.x} cy={p.y} r="13" fill={`oklch(0.88 0.06 ${p.hue})`} stroke={`oklch(0.45 0.13 ${p.hue})`} strokeWidth="0.8" />
                  <text x={p.x} y={p.y + 3.5} textAnchor="middle" style={{ font: "500 9.5px Inter, sans-serif", fill: `oklch(0.30 0.13 ${p.hue})` }}>{p.init}</text>
                </g>
              ))}
            </svg>
          </div>
          <div style={{ textAlign: "center", fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 13, color: "var(--ink-3)", marginTop: -4 }}>
            closer to center · stronger match
          </div>
          <hr className="rule-dashed" />
          <Kicker>Top match · tap to read</Kicker>
          <PersonRow p={nearby[0]} onClick={() => onPerson(nearby[0])} />
        </div>
      )}

      {mode === "list" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {nearby.map((p) => <PersonRow key={p.id} p={p} onClick={() => onPerson(p)} />)}
        </div>
      )}

      {mode === "portrait" && (
        <CirclePortrait
          onOpenTest={onOpenTest}
          onAddPerson={onAddPerson}
          area={areaAggregate}
        />
      )}
    </div>
  );
}

// ─── CompassWidget — live magnetic compass with sun overlay ──────
//
// Reads `deviceorientation` via useDeviceHeading. On iOS, asks for
// permission on first tap (the OS requires a user gesture for it).
// On platforms without a magnetometer, surfaces a polite "not
// available" line rather than failing silently.
//
// Sun bearing is computed from the geolocation we already have for
// the weather card — no extra API call. Hidden when the sun is
// below the horizon (you can't point at something you can't see).

interface CompassWidgetProps {
  position: { latitude: number; longitude: number } | null;
}

function CompassWidget({ position }: CompassWidgetProps) {
  const {
    heading,
    needsPermission,
    requestPermission,
    permissionDenied,
    supported,
  } = useDeviceHeading();

  if (!supported) {
    // Most desktop browsers (no orientation sensor). Skip silently
    // rather than show a useless card.
    return null;
  }

  const sun =
    position != null
      ? solarBearing(position.latitude, position.longitude)
      : null;

  // Rotate cardinals + targets so the bearing points "up" relative
  // to the device's current heading. Falls back to a fixed
  // north-up rose when heading isn't known yet.
  const facing = heading ?? 0;
  const rotate = (bearing: number) => bearing - facing;

  const cardinals = [
    { label: "N", deg: 0 },
    { label: "E", deg: 90 },
    { label: "S", deg: 180 },
    { label: "W", deg: 270 },
  ];

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <Kicker>
        Compass ·{" "}
        {heading == null
          ? "waiting for sensor"
          : `facing ${Math.round(heading)}° ${compassLabel(heading)}`}
      </Kicker>
      <div
        style={{
          display: "flex",
          gap: 14,
          alignItems: "center",
          marginTop: 10,
        }}
      >
        <div
          style={{
            position: "relative",
            width: 150,
            height: 150,
            flexShrink: 0,
          }}
        >
          <svg viewBox="-80 -80 160 160" width="150" height="150">
            <circle r="74" fill="var(--paper)" stroke="var(--ink-2)" strokeWidth="0.8" />
            <circle r="64" fill="none" stroke="var(--rule)" strokeWidth="0.5" strokeDasharray="2 2" />
            <circle r="44" fill="none" stroke="var(--rule)" strokeWidth="0.4" strokeDasharray="1 3" />
            {Array.from({ length: 24 }).map((_, i) => {
              const a = ((i * 15) * Math.PI) / 180;
              const major = i % 6 === 0;
              return (
                <line
                  key={i}
                  x1={Math.sin(a) * 64}
                  y1={-Math.cos(a) * 64}
                  x2={Math.sin(a) * (major ? 56 : 60)}
                  y2={-Math.cos(a) * (major ? 56 : 60)}
                  stroke="var(--ink-2)"
                  strokeWidth={major ? 0.8 : 0.4}
                />
              );
            })}
            {cardinals.map((c) => {
              const a = (rotate(c.deg) * Math.PI) / 180;
              return (
                <text
                  key={c.label}
                  x={Math.sin(a) * 50}
                  y={-Math.cos(a) * 50 + 3.5}
                  textAnchor="middle"
                  style={{
                    font: "600 11px Inter, sans-serif",
                    fill: c.label === "N" ? "oklch(0.55 0.16 12)" : "var(--ink-2)",
                  }}
                >
                  {c.label}
                </text>
              );
            })}
            {/* Heading needle: always pointing "up" because the
                cardinals rotate around it. Two-tone so it reads as a
                pointer not a tick. */}
            <line x1="0" y1="0" x2="0" y2="-60" stroke="var(--ink)" strokeWidth="1.4" />
            <polygon points="0,-68 -4,-58 4,-58" fill="var(--ink)" />
            {/* Sun marker — only when sun is above horizon. */}
            {sun && (() => {
              const a = (rotate(sun.azimuth) * Math.PI) / 180;
              return (
                <g>
                  <circle
                    cx={Math.sin(a) * 64}
                    cy={-Math.cos(a) * 64}
                    r="3.5"
                    fill="oklch(0.78 0.14 75)"
                    stroke="oklch(0.45 0.13 55)"
                    strokeWidth="0.6"
                  />
                </g>
              );
            })()}
          </svg>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {needsPermission && !permissionDenied && (
            <button
              type="button"
              onClick={() => void requestPermission()}
              style={{
                padding: "8px 12px",
                background: "var(--ink)",
                color: "var(--paper)",
                border: "none",
                borderRadius: 99,
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.12em",
                cursor: "pointer",
              }}
            >
              ENABLE COMPASS
            </button>
          )}
          {permissionDenied && (
            <div
              className="margin-note"
              style={{ fontSize: 11, color: "var(--ink-3)" }}
            >
              Compass access blocked. Re-enable Motion & Orientation in
              your browser settings.
            </div>
          )}
          {!needsPermission && heading == null && (
            <div
              className="margin-note"
              style={{ fontSize: 11, color: "var(--ink-3)" }}
            >
              No magnetometer signal yet. Move the device in a figure-8
              to calibrate.
            </div>
          )}
          {sun && (
            <div
              style={{
                marginTop: needsPermission ? 8 : 0,
                fontFamily: "var(--mono)",
                fontSize: 10.5,
                color: "var(--ink-2)",
                letterSpacing: "0.05em",
              }}
            >
              sun · {Math.round(sun.azimuth)}°{" "}
              {compassLabel(sun.azimuth)} · {Math.round(sun.altitude)}°
              up
            </div>
          )}
          <div
            style={{
              marginTop: 6,
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 11,
              color: "var(--ink-3)",
              lineHeight: 1.4,
            }}
          >
            Approximate · indoor magnetic fields throw readings off by
            10-30°.
          </div>
        </div>
      </div>
    </div>
  );
}
