import { useState } from "react";
import { IS_DATA } from "../../data/seedData";
import {
  Av,
  CompassRose,
  Kicker,
  Pill,
} from "../shared/primitives";
import { useGeolocation } from "../../lib/useGeolocation";
import { useNearbyPeople } from "../../lib/useNearbyPeople";

export interface NearbyPerson {
  id: string;
  name: string;
  init: string;
  age: number;
  dist: string;
  match: number;
  hue: number;
  role: string;
  interests: { t: string; c: string }[];
  values: string;
  note: string;
}

interface AroundTabProps {
  onPerson: (p: NearbyPerson) => void;
}

function PersonRow({ p, onClick }: { p: NearbyPerson; onClick: () => void }) {
  return (
    <div onClick={onClick} className="card" style={{ display: "flex", gap: 14, alignItems: "center", cursor: "pointer", borderLeft: `3px solid oklch(0.55 0.12 ${p.hue})` }}>
      <Av init={p.init} hue={p.hue} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 16, fontWeight: 500, letterSpacing: "-0.01em" }}>{p.name}</div>
        <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: "0.04em", marginTop: 1 }}>
          {p.role} · {p.dist} · {p.values}
        </div>
        <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
          {p.interests.slice(0, 4).map((it, i) => {
            const cat = IS_DATA.interestCats.find((c: { id: string }) => c.id === it.c);
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
        <div className="fig-num" style={{ fontSize: 26 }}><em>{p.match}</em></div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.12em", color: "var(--ink-3)", textTransform: "uppercase" }}>match</div>
      </div>
    </div>
  );
}

export function AroundTab({ onPerson }: AroundTabProps) {
  const [mode, setMode] = useState<"radar" | "list">("radar");
  const { position, loading: geoLoading, error: geoError, request } =
    useGeolocation();
  const { people: nearby, source } = useNearbyPeople(position, 10);

  const cx = 160, cy = 160;
  const placed = nearby.map((p) => {
    const angle = (p.hue / 360) * Math.PI * 2 - Math.PI / 2;
    const r = 145 - (p.match / 100) * 110;
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

      <div style={{ display: "flex", gap: 8, margin: "12px 0 4px" }}>
        <Pill color="sienna" active={mode === "radar"} onClick={() => setMode("radar")}>Radar</Pill>
        <Pill color="sage" active={mode === "list"} onClick={() => setMode("list")}>List</Pill>
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

    </div>
  );
}
