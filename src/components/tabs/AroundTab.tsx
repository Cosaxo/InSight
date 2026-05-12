import { useState } from "react";
import { IS_DATA } from "../../data/seedData";
import {
  Av,
  CompassRose,
  Kicker,
  Pill,
} from "../shared/primitives";
import { DotDensity, RadarChart } from "../shared/charts";
import { ProfileCompare } from "../insights/ProfileCompare";
import { MediaPopularity } from "../insights/MediaPopularity";

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

function compassLabel(deg: number): string {
  const dirs = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  return dirs[Math.round(((deg % 360) / 22.5)) % 16];
}

interface AroundData {
  place: string;
  temp: number | string;
  tempUnit: string;
  feels: number | string;
  weather: string;
  high: number | string;
  low: number | string;
  aqi: number;
  aqiLabel: string;
  uv: number;
  uvLabel: string;
  humidity: number;
  wind: number;
  windDir: string;
  daylight: string;
  sunrise: string;
  sunset: string;
  moon: string;
  pollen: string;
  pressure: number;
  nearby: Record<string, number>;
  crowdedness: number;
}

function CompassWidget({ data }: { data: AroundData }) {
  const heading = 312;
  const sunAz = 84;
  const targets = [
    { label: "home", bearing: 220, dist: "0.6 km" },
    { label: "fjord", bearing: 195, dist: "1.1 km" },
    { label: "sun", bearing: sunAz, dist: "·", sun: true },
  ];
  const cardinals = [
    { label: "N", deg: 0 },
    { label: "E", deg: 90 },
    { label: "S", deg: 180 },
    { label: "W", deg: 270 },
  ];
  const rotateForFacing = (deg: number) => deg - heading;

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <Kicker>
        Compass · facing {Math.round(heading)}° {compassLabel(heading)}
      </Kicker>
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 10 }}>
        <div style={{ position: "relative", width: 150, height: 150, flexShrink: 0 }}>
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
                  x1={Math.sin(a) * 64} y1={-Math.cos(a) * 64}
                  x2={Math.sin(a) * (major ? 56 : 60)} y2={-Math.cos(a) * (major ? 56 : 60)}
                  stroke="var(--ink-2)" strokeWidth={major ? 0.8 : 0.4}
                />
              );
            })}
            {cardinals.map((c) => {
              const a = (rotateForFacing(c.deg) * Math.PI) / 180;
              const r = 70;
              return (
                <text key={c.label} x={Math.sin(a) * r} y={-Math.cos(a) * r + 4} textAnchor="middle"
                  fontFamily="var(--serif)" fontStyle="italic" fontSize="13"
                  fill={c.label === "N" ? "var(--c-around)" : "var(--ink-2)"}>
                  {c.label}
                </text>
              );
            })}
            {(() => {
              const a = (rotateForFacing(0) * Math.PI) / 180;
              return (
                <g>
                  <line x1="0" y1="0" x2={Math.sin(a) * 50} y2={-Math.cos(a) * 50}
                    stroke="var(--c-around)" strokeWidth="1.6" strokeLinecap="round" />
                  <polygon
                    points={`${Math.sin(a) * 50 - Math.cos(a) * 4},${-Math.cos(a) * 50 - Math.sin(a) * 4} ${Math.sin(a) * 58},${-Math.cos(a) * 58} ${Math.sin(a) * 50 + Math.cos(a) * 4},${-Math.cos(a) * 50 + Math.sin(a) * 4}`}
                    fill="var(--c-around)" />
                </g>
              );
            })()}
            {(() => {
              const a = (rotateForFacing(180) * Math.PI) / 180;
              return <line x1="0" y1="0" x2={Math.sin(a) * 44} y2={-Math.cos(a) * 44} stroke="var(--ink-3)" strokeWidth="1" strokeLinecap="round" />;
            })()}
            {(() => {
              const a = (rotateForFacing(sunAz) * Math.PI) / 180;
              return (
                <g>
                  <circle cx={Math.sin(a) * 48} cy={-Math.cos(a) * 48} r="4" fill="oklch(0.78 0.16 70)" />
                  <text x={Math.sin(a) * 48} y={-Math.cos(a) * 48 + 14} textAnchor="middle"
                    fontFamily="var(--mono)" fontSize="7" fill="var(--ink-3)" letterSpacing="0.1em">SUN</text>
                </g>
              );
            })()}
            <circle r="3" fill="var(--ink)" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 30, lineHeight: 1, letterSpacing: "-0.02em" }}>
            <em>{Math.round(heading)}</em><span style={{ fontSize: 16, color: "var(--ink-3)" }}>°</span>
          </div>
          <div className="margin-note" style={{ fontSize: 12, marginTop: 2 }}>
            heading {compassLabel(heading)} · {data.place.split(",")[0]}
          </div>
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "0.5px dashed var(--rule)" }}>
            {targets.map((t) => (
              <div key={t.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 14, height: 14, position: "relative" }}>
                    <span style={{ position: "absolute", inset: 0, transform: `rotate(${t.bearing - heading}deg)`, transformOrigin: "center" }}>
                      <span style={{
                        position: "absolute", top: 0, left: "50%",
                        width: 0, height: 0,
                        borderLeft: "4px solid transparent",
                        borderRight: "4px solid transparent",
                        borderBottom: `8px solid ${t.sun ? "oklch(0.78 0.16 70)" : "var(--ink-2)"}`,
                        transform: "translateX(-50%)",
                      }} />
                    </span>
                  </span>
                  <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 13 }}>{t.label}</span>
                </span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)" }}>{t.bearing}° · {t.dist}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Gauge({ value, max = 100, color, segments = 5 }: { value: number; max?: number; color: string; segments?: number }) {
  const idx = Math.min(segments - 1, Math.floor((value / max) * segments));
  return (
    <div style={{ display: "flex", gap: 2, height: 6, marginTop: 4 }}>
      {Array.from({ length: segments }).map((_, i) => (
        <div key={i} style={{ flex: 1, background: i <= idx ? color : "var(--paper-2)", border: "0.5px solid var(--rule)", borderRadius: 1 }} />
      ))}
    </div>
  );
}

function AroundEnv({ data }: { data: AroundData }) {
  const Sky = () => (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <circle cx="17" cy="18" r="7" stroke="oklch(0.55 0.13 80)" strokeWidth="1.2" fill="oklch(0.95 0.06 80)" />
      <g stroke="oklch(0.55 0.13 80)" strokeWidth="1" strokeLinecap="round">
        <line x1="17" y1="6" x2="17" y2="9" />
        <line x1="6" y1="18" x2="9" y2="18" />
        <line x1="9.5" y1="10.5" x2="11.5" y2="12.5" />
        <line x1="24.5" y1="10.5" x2="22.5" y2="12.5" />
      </g>
      <ellipse cx="26" cy="28" rx="11" ry="6" fill="var(--paper)" stroke="var(--ink-2)" strokeWidth="1" />
      <ellipse cx="22" cy="26" rx="6" ry="4" fill="var(--paper)" stroke="var(--ink-2)" strokeWidth="0.8" />
    </svg>
  );
  return (
    <div className="card" style={{ marginTop: 14, position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <Kicker>Around you · {data.place}</Kicker>
        <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "oklch(0.45 0.13 145)", letterSpacing: "0.1em" }}>· LIVE</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8, paddingBottom: 12, borderBottom: "0.5px dashed var(--rule)" }}>
        <Sky />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 32, lineHeight: 1, letterSpacing: "-0.02em" }}>
            {data.temp}<span style={{ fontSize: 18, color: "var(--ink-3)" }}>{data.tempUnit}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", marginLeft: 8 }}>feels {data.feels}°</span>
          </div>
          <div className="margin-note" style={{ fontSize: 12, marginTop: 2 }}>{data.weather} · H {data.high}° L {data.low}°</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em" }}>AIR · AQI</span>
            <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 12 }}>{data.aqiLabel}</span>
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 20, marginTop: 2 }}><em>{data.aqi}</em></div>
          <Gauge value={data.aqi} max={150} color="oklch(0.65 0.14 145)" />
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em" }}>UV INDEX</span>
            <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 12 }}>{data.uvLabel}</span>
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 20, marginTop: 2 }}><em>{data.uv}</em></div>
          <Gauge value={data.uv} max={11} color="oklch(0.65 0.15 60)" />
        </div>
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em" }}>HUMIDITY</div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 20, marginTop: 2 }}><em>{data.humidity}</em>%</div>
          <Gauge value={data.humidity} max={100} color="oklch(0.65 0.13 220)" />
        </div>
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em" }}>WIND</div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 20, marginTop: 2 }}>
            <em>{data.wind}</em><span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", marginLeft: 4 }}>km/h {data.windDir}</span>
          </div>
          <Gauge value={data.wind} max={50} color="oklch(0.55 0.04 250)" />
        </div>
      </div>
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "0.5px dashed var(--rule)" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em", marginBottom: 6 }}>SUN · {data.daylight}</div>
        <div style={{ position: "relative", height: 28 }}>
          <svg width="100%" height="28" viewBox="0 0 280 28" preserveAspectRatio="none">
            <path d="M 8 24 Q 140 -8 272 24" stroke="var(--ink-2)" strokeWidth="0.7" fill="none" strokeDasharray="2 3" />
            <line x1="8" y1="24" x2="272" y2="24" stroke="var(--rule)" strokeWidth="0.5" />
            <circle cx="180" cy="11" r="4" fill="oklch(0.75 0.16 70)" />
          </svg>
          <span style={{ position: "absolute", left: 0, bottom: -2, fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-3)" }}>{data.sunrise}</span>
          <span style={{ position: "absolute", right: 0, bottom: -2, fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-3)" }}>{data.sunset}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12, fontFamily: "var(--serif)", fontSize: 12, color: "var(--ink-2)" }}>
        <span>☾ {data.moon}</span><span>· pollen: {data.pollen}</span><span>· {data.pressure} hPa</span>
      </div>
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, paddingTop: 12, borderTop: "0.5px dashed var(--rule)" }}>
        {Object.entries(data.nearby).map(([k, v]) => (
          <div key={k} style={{ textAlign: "center" }}>
            <div className="fig-num" style={{ fontSize: 22 }}><em>{v}</em></div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 8, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{k}</div>
          </div>
        ))}
      </div>
      <div className="margin-note" style={{ fontSize: 11, marginTop: 8, fontStyle: "italic" }}>
        crowdedness · {data.crowdedness}% of typical
      </div>
    </div>
  );
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

function AreaPortrait() {
  const traits = [
    { label: "Open", v: 72, avg: 64 },
    { label: "Warm", v: 68, avg: 71 },
    { label: "Reserved", v: 56, avg: 48 },
    { label: "Curious", v: 81, avg: 70 },
    { label: "Settled", v: 64, avg: 58 },
  ];
  return (
    <div style={{ marginTop: 12 }}>
      <div className="card-deckle" style={{ background: "var(--paper-2)", borderRadius: 12, marginBottom: 12 }}>
        <div className="margin-note" style={{ marginBottom: 6 }}>The Oslo profile, in five strokes —</div>
        <div style={{ fontFamily: "var(--serif)", fontSize: 14, fontStyle: "italic", color: "var(--ink-2)", lineHeight: 1.5 }}>
          {IS_DATA.city.notes}
        </div>
      </div>
      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>You vs Oslo · radar</Kicker>
        <div style={{ marginTop: 8 }}>
          <RadarChart
            values={traits.map((t) => t.v)} compareValues={traits.map((t) => t.avg)}
            labels={traits.map((t) => t.label)}
            color="var(--sienna)" compareColor="var(--ink-3)" size={260}
          />
        </div>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.08em", marginTop: 4 }}>
          <span><span style={{ display: "inline-block", width: 8, height: 8, background: "var(--sienna)", borderRadius: 2, marginRight: 5 }} />YOU</span>
          <span><span style={{ display: "inline-block", width: 8, height: 8, background: "var(--ink-3)", borderRadius: 2, marginRight: 5 }} />OSLO</span>
        </div>
      </div>
      <div className="card">
        <Kicker>Distribution · how Oslo scores</Kicker>
        <div style={{ marginTop: 10 }}>
          {traits.map((t) => (
            <div key={t.label} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 13, marginBottom: 4 }}>
                <span>{t.label}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)" }}>you {t.v}</span>
              </div>
              <DotDensity value={t.v} color="var(--sienna)" dots={28} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AroundTab({ onPerson }: AroundTabProps) {
  const [mode, setMode] = useState<"radar" | "list" | "area">("radar");
  const D = IS_DATA;
  const nearby: NearbyPerson[] = D.nearby;

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
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <span className="stamp">Oslo · 5 km</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", alignSelf: "center", letterSpacing: "0.06em" }}>
          2,847 souls · 312 like you
        </span>
      </div>

      <AroundEnv data={D.around} />
      <CompassWidget data={D.around} />

      <div style={{ display: "flex", gap: 8, margin: "12px 0 4px" }}>
        <Pill color="sienna" active={mode === "radar"} onClick={() => setMode("radar")}>Radar</Pill>
        <Pill color="sage" active={mode === "list"} onClick={() => setMode("list")}>List</Pill>
        <Pill active={mode === "area"} onClick={() => setMode("area")}>Area portrait</Pill>
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

      {mode === "area" && <AreaPortrait />}

      {mode !== "area" && (
        <>
          <hr className="rule-dashed" />
          <ProfileCompare scope="around" accent="var(--c-around)" />
          <hr className="rule-dashed" />
          <MediaPopularity scope="around" accent="var(--c-around)" />
        </>
      )}
    </div>
  );
}
