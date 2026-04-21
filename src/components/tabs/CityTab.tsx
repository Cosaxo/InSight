import { useMemo, useState } from "react";
import { C, SEC } from "../../theme";
import { CITY_FLAGS } from "../../data/constants";
import { CITY_PROFILES } from "../../data/profiles";
import type { CityRating, CityRatings, Me, Profile } from "../../types";
import { Card } from "../shared/Card";
import { SLabel } from "../shared/SLabel";
import { HScroll } from "../shared/HScroll";
import { Toast } from "../shared/Toast";
import { ContextBar } from "../shared/ContextBar";
import { PeopleInsightPanel } from "../insights/PeopleInsightPanel";

const CITY_COLOR_CYCLE = [
  C.teal,
  C.purple,
  C.coral,
  C.amber,
  C.blue,
  C.pink,
  C.cyan,
  C.green,
];

function cityInsightProfile(name: string, index: number): Profile {
  const known = CITY_PROFILES[name];
  if (known) return known;
  return {
    name,
    subtitle: "Custom city",
    color: CITY_COLOR_CYCLE[index % CITY_COLOR_CYCLE.length],
    personality: [60, 60, 55, 65, 60],
    political: { econ: -5, social: -8 },
    cv: { indiv: -5, change: 10 },
    interests: [
      { label: "Local life", pct: 70 },
      { label: "Culture", pct: 60 },
      { label: "Food", pct: 65 },
      { label: "Nature", pct: 50 },
      { label: "Design", pct: 40 },
    ],
    values: [
      "Community",
      "Heritage",
      "Local pride",
      "Sustainability",
      "Openness",
    ],
  };
}

const RCATS: { key: keyof CityRating; label: string; color: string }[] = [
  { key: "food", label: "Food", color: C.coral },
  { key: "nightlife", label: "Nightlife", color: C.purple },
  { key: "culture", label: "Culture", color: C.teal },
  { key: "architecture", label: "Arch.", color: C.amber },
  { key: "safety", label: "Safety", color: C.green },
  { key: "cost", label: "Cost", color: C.cyan },
  { key: "nature", label: "Nature", color: C.green },
  { key: "transport", label: "Transport", color: C.muted },
];

interface CityTabProps {
  me: Me;
  ratings: CityRatings;
  onRate: (cityName: string, key: keyof CityRating, value: number) => void;
}

export function CityTab({ me, ratings, onRate }: CityTabProps) {
  const cities = useMemo(() => Object.keys(CITY_PROFILES), []);
  const [city, setCity] = useState<string>(cities[0] || "Oslo");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toast, setToast] = useState(false);

  function avg(name: string): string {
    const r = ratings[name];
    if (!r) return "—";
    const v = Object.values(r).filter(
      (x): x is number => typeof x === "number",
    );
    if (!v.length) return "—";
    return (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1);
  }

  function handleRate(cityName: string, key: keyof CityRating, value: number) {
    onRate(cityName, key, value);
    setToast(true);
    setTimeout(() => setToast(false), 1600);
  }

  const ratedCities = cities.filter(
    (c) => ratings[c] && Object.keys(ratings[c]).length > 0,
  );
  const sortedByScore = [...ratedCities].sort(
    (a, b) => parseFloat(avg(b) || "0") - parseFloat(avg(a) || "0"),
  );
  const bestCity = sortedByScore[0];
  const cityIdx = cities.indexOf(city);
  const profile = cityInsightProfile(city, Math.max(cityIdx, 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {toast && <Toast message="Rating saved" color={C.teal} icon="✓" />}
      <ContextBar
        items={[
          { icon: "🏙️", label: "City", value: city, color: SEC.city.accent },
          { icon: "✈️", label: "Visited", value: String(ratedCities.length), color: C.teal, sub: "rated" },
          { icon: "🌍", label: "Available", value: String(cities.length), color: C.purple },
          {
            icon: "⭐",
            label: "Best rated",
            value: bestCity ? `${avg(bestCity)}★` : "—",
            color: C.amber,
          },
          {
            icon: "📊",
            label: "Your avg",
            value: avg(city) !== "—" ? `${avg(city)}★` : "Rate it!",
            color: C.coral,
          },
        ]}
      />

      <HScroll>
        {cities.map((c, i) => {
          const col = cityInsightProfile(c, i).color;
          const active = city === c;
          return (
            <button
              key={c}
              onClick={() => setCity(c)}
              style={{
                padding: "8px 14px",
                borderRadius: 20,
                cursor: "pointer",
                fontFamily: "inherit",
                border: active ? "none" : `1.5px solid ${C.divider}`,
                background: active ? col : C.card,
                color: active ? "#fff" : C.text,
                fontSize: 13,
                fontWeight: active ? 700 : 400,
                flexShrink: 0,
                boxShadow: active ? `0 3px 14px ${col}50` : C.shadow,
                transform: active ? "scale(1.04)" : "scale(1)",
                transition: "all 0.18s cubic-bezier(.4,0,.2,1)",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span>{CITY_FLAGS[c] || "📍"}</span>
              {c}
              {ratings[c] && (
                <span style={{ fontSize: 10, opacity: 0.7 }}>★</span>
              )}
            </button>
          );
        })}
      </HScroll>

      <Card
        style={{
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          borderLeft: `4px solid ${profile.color}`,
        }}
      >
        <span style={{ fontSize: 34 }}>{CITY_FLAGS[city] || "📍"}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.navy }}>
            {city}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            {profile.subtitle}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          {avg(city) !== "—" ? (
            <div style={{ fontSize: 20, fontWeight: 800, color: C.amber }}>
              ★ {avg(city)}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: C.muted }}>Not rated yet</div>
          )}
          <div style={{ fontSize: 10, color: C.muted }}>your rating</div>
        </div>
      </Card>

      <PeopleInsightPanel profile={profile} me={me} />

      <Card>
        <SLabel sec="city">Rate cities you've visited</SLabel>
        {cities.map((c) => {
          const isExp = expanded === c;
          const r = ratings[c] || {};
          const a = avg(c);
          return (
            <div
              key={c}
              style={{
                borderRadius: 12,
                overflow: "hidden",
                background: C.dim,
                marginBottom: 8,
              }}
            >
              <div
                onClick={() => setExpanded(isExp ? null : c)}
                style={{
                  padding: "11px 14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 16 }}>{CITY_FLAGS[c] || "📍"}</span>
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: 600,
                    color: C.navy,
                  }}
                >
                  {c}
                </span>
                {a !== "—" ? (
                  <span
                    style={{ fontSize: 13, fontWeight: 700, color: C.amber }}
                  >
                    ★ {a}
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: C.muted }}>
                    tap to rate
                  </span>
                )}
                <span
                  style={{
                    fontSize: 12,
                    color: isExp ? C.teal : C.muted,
                  }}
                >
                  {isExp ? "▲" : "▼"}
                </span>
              </div>
              {isExp && (
                <div
                  style={{
                    background: C.card,
                    padding: "12px 14px",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  {RCATS.map((cat) => (
                    <div
                      key={cat.key}
                      style={{
                        background: C.dim,
                        borderRadius: 10,
                        padding: "10px 12px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: cat.color,
                          fontWeight: 600,
                          marginBottom: 6,
                        }}
                      >
                        {cat.label}
                      </div>
                      <span>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span
                            key={n}
                            onClick={() => handleRate(c, cat.key, n)}
                            style={{
                              color:
                                n <= (r[cat.key] || 0) ? cat.color : C.dim,
                              fontSize: 18,
                              cursor: "pointer",
                            }}
                          >
                            ★
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
