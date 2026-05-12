import { useState } from "react";
import { IS_DATA } from "../../data/seedData";
import { Kicker } from "../shared/primitives";
import { Compass2D, DotDensity } from "../shared/charts";
import { ProfileCompare } from "../insights/ProfileCompare";
import { MediaPopularity } from "../insights/MediaPopularity";
import { GroupBreakdown } from "../insights/GroupBreakdown";

export interface CitySeed {
  name: string;
  country: string;
  region: string;
  pop: string;
  mood: string;
  match: number;
  hue: number;
  scores?: Record<string, number>;
}

interface WorldTabProps {
  onCity: (c: CitySeed) => void;
}

export function WorldTab({ onCity }: WorldTabProps) {
  const D = IS_DATA;
  const E = D.earth;
  const [region, setRegion] = useState("all");
  const [country, setCountry] = useState("ALL");

  const visibleCities: CitySeed[] = D.cities.filter((c: CitySeed) => {
    if (region !== "all" && c.region !== region) return false;
    if (country !== "ALL" && c.country !== country) return false;
    return true;
  });
  const countriesInRegion =
    region === "all"
      ? D.cityCountries
      : [
          { code: "ALL", name: "everywhere", flag: "◯" },
          ...D.cityCountries.filter(
            (c: { code: string }) =>
              c.code !== "ALL" &&
              D.cities.some(
                (x: CitySeed) => x.country === c.code && x.region === region,
              ),
          ),
        ];

  return (
    <div className="fade-in">
      <div className="page-num">— vii —</div>
      <Kicker>Atlas · cities ranked by kindred match</Kicker>
      <div className="sec-head">
        <h2>
          An atlas of <em>elsewhere</em>
        </h2>
      </div>

      <div className="card" style={{ marginBottom: 14, position: "relative" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <Kicker>Today on Earth · {E.date}</Kicker>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "oklch(0.45 0.13 145)",
              letterSpacing: "0.1em",
            }}
          >
            · LIVE
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
            marginTop: 10,
          }}
        >
          <div>
            <div className="kicker">HUMANS</div>
            <div className="fig-num" style={{ fontSize: 26 }}>
              <em>{E.population}</em>
            </div>
            <div className="margin-note" style={{ fontSize: 11, marginTop: 1 }}>
              {E.popDelta}
            </div>
          </div>
          <div>
            <div className="kicker">ATMOSPHERIC CO₂</div>
            <div className="fig-num" style={{ fontSize: 26 }}>
              <em>{E.co2}</em>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--ink-3)",
                  marginLeft: 4,
                }}
              >
                ppm
              </span>
            </div>
            <div className="margin-note" style={{ fontSize: 11, marginTop: 1 }}>
              {E.co2Delta}
            </div>
          </div>
          <div>
            <div className="kicker">TEMP ANOMALY</div>
            <div className="fig-num" style={{ fontSize: 26 }}>
              <em>+{E.temp}</em>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--ink-3)",
                  marginLeft: 4,
                }}
              >
                °C
              </span>
            </div>
            <div className="margin-note" style={{ fontSize: 11, marginTop: 1 }}>
              {E.tempLabel}
            </div>
          </div>
          <div>
            <div className="kicker">ARCTIC SEA ICE</div>
            <div className="fig-num" style={{ fontSize: 26 }}>
              <em>{E.arcticIce}</em>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--ink-3)",
                  marginLeft: 4,
                }}
              >
                M km²
              </span>
            </div>
            <div className="margin-note" style={{ fontSize: 11, marginTop: 1 }}>
              {E.arcticDelta}
            </div>
          </div>
        </div>
        <div
          style={{
            borderTop: "0.5px dashed var(--rule)",
            marginTop: 14,
            paddingTop: 12,
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
            fontFamily: "var(--serif)",
            fontSize: 12,
            color: "var(--ink-2)",
          }}
        >
          <span>☾ {E.moon}</span>
          <span>· N: {E.seasonNorth}</span>
          <span>· S: {E.seasonSouth}</span>
          <span>
            · {E.quakes} quakes ≥{E.quakesMag}
          </span>
          <span>· sun {E.sun}</span>
        </div>
        <div
          className="margin-note"
          style={{ fontSize: 12, marginTop: 10, fontStyle: "italic" }}
        >
          {E.holiday} — {E.species.namedToday} new species named,{" "}
          {E.species.extinctToday} lost.
        </div>
      </div>

      <div
        className="card"
        style={{
          marginBottom: 14,
          display: "flex",
          justifyContent: "space-between",
          textAlign: "center",
        }}
      >
        <div>
          <div className="fig-num" style={{ fontSize: 28 }}>
            <em>{D.cities.length + 1}</em>
          </div>
          <div className="kicker">CITIES MAPPED</div>
        </div>
        <div>
          <div className="fig-num" style={{ fontSize: 28 }}>
            <em>
              {Math.round(
                D.cities.reduce(
                  (s: number, c: CitySeed) => s + c.match,
                  0,
                ) / D.cities.length,
              )}
            </em>
          </div>
          <div className="kicker">AVG MATCH</div>
        </div>
        <div>
          <div className="fig-num" style={{ fontSize: 28 }}>
            <em>
              {Math.max(...D.cities.map((c: CitySeed) => c.match))}
            </em>
          </div>
          <div className="kicker">HIGHEST</div>
        </div>
        <div>
          <div className="fig-num" style={{ fontSize: 28 }}>
            <em>{D.cityRegions.length - 1}</em>
          </div>
          <div className="kicker">CONTINENTS</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>Filter the atlas</Kicker>
        <div style={{ marginTop: 10 }}>
          <div className="kicker" style={{ marginBottom: 6 }}>
            BY REGION
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {D.cityRegions.map((r: string) => {
              const active = region === r;
              return (
                <button
                  key={r}
                  onClick={() => {
                    setRegion(r);
                    setCountry("ALL");
                  }}
                  style={{
                    padding: "5px 11px",
                    background: active ? "var(--ink)" : "var(--paper)",
                    color: active ? "var(--paper)" : "var(--ink-2)",
                    border:
                      "0.5px solid " + (active ? "var(--ink)" : "var(--rule)"),
                    borderRadius: 14,
                    fontFamily: "var(--serif)",
                    fontStyle: r === "all" ? "italic" : "normal",
                    fontSize: 12,
                    cursor: "pointer",
                    textTransform: "lowercase",
                  }}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="kicker" style={{ marginBottom: 6 }}>
            BY COUNTRY
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {countriesInRegion.map(
              (c: { code: string; name: string; flag: string }) => {
                const active = country === c.code;
                return (
                  <button
                    key={c.code}
                    onClick={() => setCountry(c.code)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 10px 5px 6px",
                      background: active
                        ? "oklch(0.95 0.04 38)"
                        : "var(--paper-2)",
                      color: active ? "var(--sienna)" : "var(--ink-2)",
                      border:
                        "0.5px solid " +
                        (active ? "var(--sienna)" : "var(--rule)"),
                      borderRadius: 14,
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 8,
                        letterSpacing: "0.06em",
                        padding: "1px 4px",
                        background: "var(--paper)",
                        border: "0.5px solid var(--rule)",
                        borderRadius: 3,
                      }}
                    >
                      {c.flag}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--serif)",
                        fontStyle: c.code === "ALL" ? "italic" : "normal",
                        fontSize: 12,
                      }}
                    >
                      {c.name}
                    </span>
                  </button>
                );
              },
            )}
          </div>
        </div>
        <div
          className="margin-note"
          style={{ marginTop: 10, fontStyle: "italic", fontSize: 12 }}
        >
          showing <em>{visibleCities.length}</em> of {D.cities.length} cities.
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>Cities mapped · pace × warmth</Kicker>
        <div style={{ marginTop: 6 }}>
          <Compass2D
            x={-30}
            y={20}
            label="Oslo (you)"
            xLabel={["Slow", "Fast"]}
            yLabel={["Warm", "Cool"]}
            size={280}
            comparePoints={[
              { x: -65, y: 70, label: "Lisbon", color: "oklch(0.55 0.12 38)" },
              { x: -45, y: 50, label: "Kyoto", color: "oklch(0.55 0.12 145)" },
              { x: 10, y: 30, label: "Cph", color: "oklch(0.55 0.12 220)" },
              { x: -10, y: -10, label: "Edin.", color: "oklch(0.55 0.12 280)" },
              { x: 60, y: 60, label: "CDMX", color: "oklch(0.55 0.12 12)" },
            ]}
          />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {visibleCities.length === 0 && (
          <div
            className="card"
            style={{
              textAlign: "center",
              padding: "20px",
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 13,
              color: "var(--ink-3)",
            }}
          >
            no cities match this filter — yet.
          </div>
        )}
        {visibleCities.map((c, i) => (
          <div
            key={c.name}
            onClick={() => onCity(c)}
            style={{ cursor: "pointer", position: "relative" }}
          >
            <div
              className="card"
              style={{ display: "flex", gap: 14, alignItems: "center" }}
            >
              <div
                style={{
                  width: 56,
                  height: 72,
                  background: `oklch(0.92 0.04 ${c.hue})`,
                  border: "0.5px solid var(--rule)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  position: "relative",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    fontSize: 22,
                    lineHeight: 1,
                    color: `oklch(0.30 0.13 ${c.hue})`,
                  }}
                >
                  {c.country}
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 8,
                    letterSpacing: "0.1em",
                    marginTop: 2,
                    color: "var(--ink-3)",
                  }}
                >
                  №{String(i + 1).padStart(2, "0")}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 18,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {c.name}
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: "var(--ink-3)",
                    letterSpacing: "0.06em",
                    marginTop: 2,
                    textTransform: "lowercase",
                  }}
                >
                  pop {c.pop} · {c.mood}
                </div>
                <div style={{ marginTop: 6 }}>
                  <DotDensity
                    value={c.match}
                    color={`oklch(0.55 0.12 ${c.hue})`}
                    dots={24}
                  />
                </div>
                {c.scores && (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 7,
                      flexWrap: "wrap",
                    }}
                  >
                    {IS_DATA.cityScoreCats
                      .map(
                        (cat: { id: string; glyph: string; label: string }) => ({
                          ...cat,
                          v: c.scores?.[cat.id] ?? 0,
                        }),
                      )
                      .sort(
                        (
                          a: { v: number },
                          b: { v: number },
                        ) => b.v - a.v,
                      )
                      .slice(0, 4)
                      .map(
                        (s: {
                          id: string;
                          glyph: string;
                          v: number;
                        }) => (
                          <span
                            key={s.id}
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: 9,
                              letterSpacing: "0.04em",
                              color: "var(--ink-2)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                            }}
                          >
                            <span style={{ color: `oklch(0.55 0.12 ${c.hue})` }}>
                              {s.glyph}
                            </span>
                            <span>
                              {s.id.slice(0, 4)}·{s.v}
                            </span>
                          </span>
                        ),
                      )}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div className="fig-num" style={{ fontSize: 28 }}>
                  <em>{c.match}</em>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <hr className="rule-dashed" />
      <ProfileCompare scope="world" accent="var(--c-world)" />
      <hr className="rule-dashed" />
      <GroupBreakdown scope="world" accent="var(--c-world)" />
      <hr className="rule-dashed" />
      <MediaPopularity scope="world" accent="var(--c-world)" />
    </div>
  );
}
