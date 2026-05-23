import { useMemo, useState } from "react";
import { Kicker } from "../shared/primitives";
import { Donut, RadarChart } from "../shared/charts";
import { useCityRatings } from "../../lib/useCityRatings";
import { useCityAggregate } from "../../lib/useCityAggregate";
import { useGeolocation } from "../../lib/useGeolocation";
import { useNearbyCities, type NearbyCity } from "../../lib/useNearbyCities";
import type { CityRating } from "../../types";

type CityScoreKey =
  | "beauty"
  | "commute"
  | "safety"
  | "culture"
  | "nature"
  | "food"
  | "cost";

const RATING_CATS: { k: CityScoreKey; label: string }[] = [
  { k: "beauty", label: "Beauty" },
  { k: "commute", label: "Commute" },
  { k: "safety", label: "Safety" },
  { k: "culture", label: "Culture" },
  { k: "nature", label: "Nature" },
  { k: "food", label: "Food" },
  { k: "cost", label: "Cost" },
];

export function CityTab() {
  const { position, loading: geoLoading, error: geoError, request } = useGeolocation();
  const { cities, loading: citiesLoading } = useNearbyCities(position, 500);
  // User's manual override — null means "track the nearest city". Once
  // they tap one of the nearby chips this sticks until they tap again.
  const [pickedUid, setPickedUid] = useState<string | null>(null);

  const selectedCity: NearbyCity | null = useMemo(() => {
    if (pickedUid) {
      const found = cities.find((c) => c.uid === pickedUid);
      if (found) return found;
    }
    return cities[0] ?? null;
  }, [cities, pickedUid]);

  // If the user-picked city falls out of the result set (they
  // travelled), `selectedCity`'s fallback to `cities[0]` quietly
  // takes over. We deliberately keep `pickedUid` set so coming back
  // into range restores their pick.

  const { ratings: stored, setRating } = useCityRatings();
  const { aggregate: communityAgg } = useCityAggregate(
    selectedCity?.name ?? null,
  );
  // When no city is selected (location not granted yet), render the
  // CTA only — the rest of the tab needs a real city to anchor on.
  if (!selectedCity) {
    return (
      <div className="fade-in">
        <Kicker>City · where you live</Kicker>
        <div className="sec-head">
          <h2>
            Your <em>city</em>
          </h2>
        </div>
        <div
          className="card"
          style={{
            marginBottom: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <Kicker>Pick by where you are</Kicker>
            <div
              className="margin-note"
              style={{ marginTop: 4, fontSize: 12 }}
            >
              {geoError
                ? geoError
                : "Tap to use your current location — the City tab will follow you."}
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
      </div>
    );
  }

  const c = selectedCity;
  const userOverrides = stored[c.name] ?? {};
  // Star ratings are scoped per city name — switching cities swaps the
  // override set. No seed defaults anymore: real cities start unrated.
  const ratings: Record<CityScoreKey, number> = RATING_CATS.reduce(
    (acc, { k }) => {
      acc[k] = (userOverrides[k as keyof CityRating] as number) ?? 0;
      return acc;
    },
    {} as Record<CityScoreKey, number>,
  );
  const cats = RATING_CATS;

  const onStar = (key: CityScoreKey, value: number) => {
    setRating(c.name, key as keyof CityRating, value);
  };

  const totalRating = Object.values(ratings).reduce((s, v) => s + v, 0);
  const cityInitial = c.name.charAt(0).toUpperCase();
  const cityAccent = c.hue != null ? `oklch(0.55 0.14 ${c.hue})` : "var(--c-city)";
  const countryTag = c.country ? `, ${c.country}` : "";
  const popLabel = c.pop ?? "—";
  const matchLabel = c.match ?? 0;

  return (
    <div className="fade-in">
      <Kicker>City · where you live</Kicker>
      <div className="sec-head">
        <h2>
          <em>{c.name}</em>
        </h2>
      </div>

      {/* "Use my location" CTA — only shows when we haven't tried yet. */}
      {!position && (
        <div
          className="card"
          style={{
            marginBottom: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <Kicker>Pick by where you are</Kicker>
            <div
              className="margin-note"
              style={{ marginTop: 4, fontSize: 12 }}
            >
              {geoError
                ? geoError
                : "Tap to use your current location — the City tab will follow you."}
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

      <div className="card" style={{ position: "relative", marginBottom: 16 }}>
        <div className="tape" />
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "var(--paper)",
              border: `1.5px solid ${cityAccent}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <div
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 22,
                color: cityAccent,
                lineHeight: 1,
              }}
            >
              {cityInitial}
            </div>
            <div
              style={{
                position: "absolute",
                bottom: -6,
                fontFamily: "var(--mono)",
                fontSize: 7,
                color: cityAccent,
                letterSpacing: "0.16em",
                background: "var(--paper-2)",
                padding: "0 4px",
              }}
            >
              {c.name.slice(0, 6).toUpperCase()}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: 22,
                letterSpacing: "-0.01em",
              }}
            >
              {c.name}
              {countryTag}
            </div>
            <div className="kicker" style={{ marginTop: 2 }}>
              POP {popLabel}
              {position && c.distanceKm > 0 ? ` · ${c.distanceKm.toFixed(1)} KM` : ""}
              {" · MATCH "}
              {matchLabel}%
            </div>
          </div>
          <Donut
            value={matchLabel}
            color={cityAccent}
            label="MATCH"
            size={64}
          />
        </div>
        {c.blurb && (
          <div className="margin-note" style={{ marginTop: 10 }}>
            "{c.blurb}"
          </div>
        )}
        {c.fromSeed && position && (
          <div
            className="margin-note"
            style={{ marginTop: 6, fontSize: 10, color: "var(--ink-3)" }}
          >
            (no Firestore entry for this city — falling back to seed data)
          </div>
        )}
      </div>

      {/* Nearby cities · tap to switch */}
      {cities.length > 1 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <Kicker>
            {position ? "Nearby cities · tap to switch" : "Cities · tap to switch"}
          </Kicker>
          {citiesLoading && (
            <div className="margin-note" style={{ fontSize: 11, marginTop: 6 }}>
              looking…
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              marginTop: 8,
            }}
          >
            {cities.slice(0, 8).map((nc) => {
              const active = nc.uid === c.uid;
              return (
                <button
                  key={nc.uid}
                  type="button"
                  onClick={() => setPickedUid(nc.uid)}
                  className="stamp"
                  style={{
                    cursor: "pointer",
                    background: active ? "var(--ink)" : "var(--paper-2)",
                    color: active ? "var(--paper)" : "var(--ink)",
                    border: "0.5px solid var(--rule)",
                  }}
                >
                  {nc.name}
                  {position && nc.distanceKm > 0
                    ? ` · ${nc.distanceKm < 1 ? "<1" : nc.distanceKm.toFixed(0)}km`
                    : ""}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <Kicker>Seven dimensions · radar</Kicker>
        <div style={{ marginTop: 8 }}>
          <RadarChart
            values={cats.map(({ k }) => ratings[k] * 20)}
            labels={cats.map((c) => c.label)}
            color={cityAccent}
            size={260}
          />
        </div>
      </div>

      <Kicker>Rate this place · seven dimensions</Kicker>
      <div
        className="margin-note"
        style={{ marginTop: 4, marginBottom: 8, fontSize: 11.5, fontStyle: "italic" }}
      >
        Tap stars for your rating. Community average appears next to
        it once at least three people have rated this city.
      </div>
      <div style={{ marginTop: 8 }}>
        {cats.map(({ k, label }) => {
          const yours = ratings[k];
          const community = communityAgg?.byDimension?.[k];
          return (
            <div
              key={k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 0",
                borderBottom: "0.5px solid var(--rule)",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  fontSize: 15,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {label}
              </span>
              {community && (
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    letterSpacing: "0.06em",
                    color: "var(--ink-3)",
                    minWidth: 70,
                    textAlign: "right",
                  }}
                  title={`${community.count} ${community.count === 1 ? "rater" : "raters"}`}
                >
                  community {community.avg.toFixed(1)}
                </span>
              )}
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    className={"star" + (n <= yours ? " on" : "")}
                    style={{ fontSize: 18, cursor: "pointer" }}
                    onClick={() => onStar(k, n)}
                  >
                    ✦
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <Kicker>City vitals</Kicker>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginTop: 10,
          }}
        >
          <div>
            <div className="fig-num">
              <em>{popLabel}</em>
            </div>
            <div className="kicker">POPULATION</div>
          </div>
          <div>
            <div className="fig-num">
              <em>{position && c.distanceKm > 0 ? `${c.distanceKm.toFixed(0)}km` : "—"}</em>
            </div>
            <div className="kicker">FROM YOU</div>
          </div>
          <div>
            <div className="fig-num">
              <em>{cities.length || "—"}</em>
            </div>
            <div className="kicker">CITIES NEARBY</div>
          </div>
          <div>
            <div className="fig-num">
              <em>{totalRating}</em>/{cats.length * 5}
            </div>
            <div className="kicker">YOUR RATING</div>
          </div>
        </div>
      </div>

      {/* Distance bar chart of the next few nearest cities. */}
      {cities.length > 1 && position && (
        <div className="card" style={{ marginTop: 16 }}>
          <Kicker>How close, in kilometres</Kicker>
          <div style={{ marginTop: 8 }}>
            {cities.slice(0, 6).map((nc) => {
              const maxKm = Math.max(...cities.slice(0, 6).map((x) => x.distanceKm), 1);
              const active = nc.uid === c.uid;
              return (
                <div
                  key={nc.uid}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      width: 90,
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: 13,
                      color: active ? "var(--ink)" : "var(--ink-2)",
                    }}
                  >
                    {nc.name}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 7,
                      background: "var(--paper-2)",
                      border: "0.5px solid var(--rule)",
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${(nc.distanceKm / maxKm) * 100}%`,
                        background: active ? cityAccent : "var(--ink-3)",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      width: 50,
                      textAlign: "right",
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      color: "var(--ink-3)",
                    }}
                  >
                    {nc.distanceKm < 1
                      ? "<1km"
                      : `${nc.distanceKm.toFixed(0)}km`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
