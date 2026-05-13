import { IS_DATA } from "../../data/seedData";
import { Kicker } from "../shared/primitives";
import { Donut, RadarChart } from "../shared/charts";
import { useCityRatings } from "../../lib/useCityRatings";
import type { CityRating } from "../../types";
import type { CitySeed } from "../tabs/WorldTab";

interface CityScoreCat {
  id: string;
  label: string;
  glyph: string;
  tip: string;
}

interface CityOverlayProps {
  city: CitySeed & { blurb?: string };
  onClose: () => void;
}

// Map the 8 city-score axes to keys in the user's CityRating (the
// shape useCityRatings produces). Where there's no honest overlap,
// the value stays undefined and we use a neutral 50 in the radar.
const SCORE_TO_RATING: Record<string, keyof CityRating | undefined> = {
  commute: "transport",
  safety: "safety",
  beauty: "architecture",
  food: "food",
  nature: "nature",
  nightlife: "nightlife",
  climate: undefined, // no rating axis covers climate
  cost: "cost",
};

// Derive a HOME_MAP-shaped object from the user's highest-rated city
// (sum of all 1-5 star ratings). Returns null when the user hasn't
// rated any city yet — caller hides the comparison line in that case.
function deriveHomeVals(
  ratings: ReturnType<typeof useCityRatings>["ratings"],
  cats: CityScoreCat[],
): { name: string; values: number[] } | null {
  const entries = Object.entries(ratings);
  if (entries.length === 0) return null;
  // Pick the city with the highest total rating as "home" — most
  // loved is the most honest proxy for the user's ideal.
  let best: { name: string; total: number; r: CityRating } | null = null;
  for (const [name, r] of entries) {
    const total = Object.values(r).reduce(
      (s, v) => s + (typeof v === "number" ? v : 0),
      0,
    );
    if (total <= 0) continue;
    if (!best || total > best.total) best = { name, total, r };
  }
  if (!best) return null;
  const values = cats.map((cat) => {
    const ratingKey = SCORE_TO_RATING[cat.id];
    if (!ratingKey) return 50;
    const stars = best!.r[ratingKey];
    return typeof stars === "number" ? Math.round(stars * 20) : 50;
  });
  return { name: best.name, values };
}

export function CityOverlay({ city, onClose }: CityOverlayProps) {
  const cats: CityScoreCat[] = IS_DATA.cityScoreCats;
  const { ratings } = useCityRatings();
  // Real cities pulled from Firestore don't have the 8-axis scores
  // editorial layer. Without scores there's nothing honest to render
  // for the radar / overall / breakdown cards, so we gate all three.
  const hasScores =
    !!city.scores && Object.keys(city.scores).length > 0;
  const scores = city.scores || {};
  const total = cats.reduce((s, c) => s + (scores[c.id] || 0), 0);
  const avg = Math.round(total / cats.length);

  // "Home" baseline now derives from the user's highest-rated city
  // (via useCityRatings), translating the rating axes into the
  // 8-axis score schema. Null when the user has rated nothing —
  // the radar comparison line is hidden in that case.
  const home = deriveHomeVals(ratings, cats);
  const cityVals = cats.map((c) => scores[c.id] || 0);

  const ranked = cats
    .map((c) => ({ ...c, v: scores[c.id] || 0 }))
    .sort((a, b) => b.v - a.v);
  const tops = ranked.slice(0, 3);
  const bots = ranked.slice(-2);

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="overlay-inner"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overlay-close" onClick={onClose}>
          ×
        </div>

        <Kicker>
          Atlas entry{city.region ? ` · ${city.region.toLowerCase()}` : ""}
        </Kicker>
        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            marginTop: 8,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              width: 64,
              height: 80,
              background: `oklch(0.92 0.04 ${city.hue})`,
              border: "0.5px solid var(--rule)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              position: "relative",
            }}
          >
            <div
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 26,
                color: `oklch(0.30 0.13 ${city.hue})`,
              }}
            >
              {city.country}
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 8,
                letterSpacing: "0.1em",
                marginTop: 4,
                color: "var(--ink-3)",
              }}
            >
              {city.country}-VISA
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                fontFamily: "var(--serif)",
                fontSize: 28,
                fontStyle: "italic",
                margin: "0 0 4px",
                letterSpacing: "-0.01em",
                lineHeight: 1.05,
              }}
            >
              {city.name}
            </h2>
            <div className="kicker">
              POP {city.pop} · {city.mood}
            </div>
            {city.blurb && (
              <div
                className="margin-note"
                style={{ marginTop: 6, fontStyle: "italic", fontSize: 13 }}
              >
                "{city.blurb}"
              </div>
            )}
          </div>
          <Donut
            value={city.match ?? 0}
            color={`oklch(0.55 0.12 ${city.hue ?? 220})`}
            label="MATCH"
            size={64}
          />
        </div>

        {hasScores && (
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
              <div className="fig-num" style={{ fontSize: 26 }}>
                <em>{avg}</em>
              </div>
              <div className="kicker">OVERALL</div>
            </div>
            <div>
              <div className="fig-num" style={{ fontSize: 26 }}>
                <em>{Math.max(...cityVals)}</em>
              </div>
              <div className="kicker">BEST</div>
            </div>
            <div>
              <div className="fig-num" style={{ fontSize: 26 }}>
                <em>{Math.min(...cityVals)}</em>
              </div>
              <div className="kicker">WORST</div>
            </div>
          </div>
        )}

        {hasScores && (
          <div className="card" style={{ marginBottom: 14 }}>
            <Kicker>
              Eight axes
              {home ? ` · ${city.name} vs. ${home.name}` : ` · ${city.name}`}
            </Kicker>
            <div style={{ marginTop: 8 }}>
              <RadarChart
                values={cityVals}
                compareValues={home ? home.values : undefined}
                compareColor="var(--ink-3)"
                labels={cats.map((c) => c.label)}
                color={`oklch(0.55 0.12 ${city.hue})`}
                size={280}
              />
            </div>
            <div
              style={{
                display: "flex",
                gap: 14,
                fontFamily: "var(--mono)",
                fontSize: 9,
                color: "var(--ink-3)",
                letterSpacing: "0.08em",
                marginTop: 4,
              }}
            >
              <span>
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 2,
                    background: `oklch(0.55 0.12 ${city.hue})`,
                    verticalAlign: "middle",
                    marginRight: 5,
                  }}
                />
                {city.name.toUpperCase()}
              </span>
              {home && (
                <span>
                  <span
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 2,
                      background: "var(--ink-3)",
                      verticalAlign: "middle",
                      marginRight: 5,
                    }}
                  />
                  {home.name.toUpperCase()} · YOUR BEST-RATED
                </span>
              )}
            </div>
            {!home && (
              <div
                className="margin-note"
                style={{ marginTop: 8, fontSize: 11, fontStyle: "italic" }}
              >
                Rate a few cities to see a "you-vs-here" comparison.
              </div>
            )}
          </div>
        )}

        {hasScores && (
        <div className="card" style={{ marginBottom: 14 }}>
          <Kicker>The full report</Kicker>
          <div
            style={{
              marginTop: 12,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {ranked.map((r) => {
              const accent = `oklch(0.55 0.12 ${city.hue})`;
              const homeIdx = cats.findIndex((c) => c.id === r.id);
              const homeVal =
                home && homeIdx >= 0 ? home.values[homeIdx] : null;
              return (
                <div key={r.id}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 12,
                          color: accent,
                          width: 16,
                        }}
                      >
                        {r.glyph}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--serif)",
                          fontStyle: "italic",
                          fontSize: 14,
                        }}
                      >
                        {r.label}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 9,
                          color: "var(--ink-3)",
                          letterSpacing: "0.06em",
                        }}
                      >
                        · {r.tip}
                      </span>
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 11,
                        color: "var(--ink)",
                      }}
                    >
                      {r.v}
                    </span>
                  </div>
                  <div
                    style={{
                      position: "relative",
                      height: 6,
                      background: "var(--paper-2)",
                      border: "0.5px solid var(--rule)",
                      borderRadius: 3,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: `${r.v}%`,
                        background: accent,
                        opacity: 0.65,
                      }}
                    />
                    {homeVal != null && (
                      <span
                        title={`${home?.name}: ${homeVal}`}
                        style={{
                          position: "absolute",
                          left: `calc(${homeVal}% - 1px)`,
                          top: -2,
                          bottom: -2,
                          width: 2,
                          background: "var(--ink)",
                          opacity: 0.55,
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {home && (
            <div
              className="margin-note"
              style={{
                marginTop: 10,
                fontSize: 11,
                fontStyle: "italic",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 2,
                  height: 8,
                  background: "var(--ink)",
                  opacity: 0.55,
                }}
              />
              <span>marker = {home.name}'s score (your best-rated)</span>
            </div>
          )}
        </div>
        )}

        <div
          className="card"
          style={{
            marginBottom: 14,
            background: `oklch(0.97 0.02 ${city.hue})`,
            borderColor: `oklch(0.85 0.06 ${city.hue})`,
          }}
        >
          <Kicker>Where {city.name} would treat you well</Kicker>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginTop: 8,
            }}
          >
            {tops.map((r) => (
              <span
                key={r.id}
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  padding: "5px 10px",
                  background: "var(--paper)",
                  border: `0.5px solid oklch(0.55 0.12 ${city.hue})`,
                  color: `oklch(0.32 0.13 ${city.hue})`,
                  borderRadius: 999,
                }}
              >
                {r.glyph} {r.label.toUpperCase()} · {r.v}
              </span>
            ))}
          </div>
          <div className="kicker" style={{ marginTop: 14, marginBottom: 6 }}>
            WHERE IT WOULDN'T
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {bots.map((r) => (
              <span
                key={r.id}
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  padding: "5px 10px",
                  background: "var(--paper-2)",
                  border: "0.5px dashed var(--rule)",
                  color: "var(--ink-3)",
                  borderRadius: 999,
                }}
              >
                {r.glyph} {r.label.toUpperCase()} · {r.v}
              </span>
            ))}
          </div>
        </div>

        <button
          style={{
            width: "100%",
            marginTop: 4,
            padding: 14,
            background: "transparent",
            border: "1px dashed var(--rule)",
            borderRadius: 12,
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 15,
            color: "var(--ink-3)",
            cursor: "pointer",
          }}
        >
          + add {city.name} to the wishlist
        </button>
      </div>
    </div>
  );
}
