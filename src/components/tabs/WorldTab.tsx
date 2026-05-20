import { useMemo } from "react";
import { Kicker } from "../shared/primitives";
import { HBars } from "../shared/charts";
import { useGeolocation } from "../../lib/useGeolocation";
import { useActiveCities } from "../../lib/useActiveCities";
import { useNearbyCities } from "../../lib/useNearbyCities";
import { useEarthMetrics } from "../../lib/useEarthMetrics";
import {
  useWorldAggregates,
  type CountryBreakdown,
} from "../../lib/useWorldAggregates";
import { firebaseEnabled } from "../../lib/firebase";
import type { RemoteCity } from "../../lib/firebase";

const TRAIT_LABELS = ["Open", "Conscient.", "Extra.", "Agree.", "Neuro."];

// Lightweight ISO-2 → display name lookup for the most common
// countries. Falls back to the code itself for unknowns.
const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
  NO: "Norway",
  SE: "Sweden",
  DK: "Denmark",
  FI: "Finland",
  DE: "Germany",
  FR: "France",
  IT: "Italy",
  ES: "Spain",
  NL: "Netherlands",
  PT: "Portugal",
  PL: "Poland",
  CA: "Canada",
  AU: "Australia",
  NZ: "New Zealand",
  JP: "Japan",
  KR: "South Korea",
  CN: "China",
  IN: "India",
  BR: "Brazil",
  MX: "Mexico",
  AR: "Argentina",
  IL: "Israel",
  TR: "Turkey",
  RU: "Russia",
  UA: "Ukraine",
  ZA: "South Africa",
  EG: "Egypt",
  SG: "Singapore",
  HK: "Hong Kong",
  TW: "Taiwan",
  TH: "Thailand",
  ID: "Indonesia",
  PH: "Philippines",
  VN: "Vietnam",
  CH: "Switzerland",
  AT: "Austria",
  BE: "Belgium",
  IE: "Ireland",
  IS: "Iceland",
};
function countryName(code: string): string {
  return COUNTRY_NAMES[code] || code;
}

// CitySeed is the lightweight contract the rest of the app uses to open
// CityOverlay. Most fields are optional because the real Firestore docs
// only have Name + location + currentlyActive — everything else (mood,
// scores, blurb…) is editorial seed data that may or may not exist.
export interface CitySeed {
  name: string;
  country?: string;
  region?: string;
  pop?: string;
  mood?: string;
  match?: number;
  hue?: number;
  scores?: Record<string, number>;
  blurb?: string;
  currentlyActive?: number;
  distanceKm?: number;
}

interface WorldTabProps {
  onCity: (c: CitySeed) => void;
}

// Stable per-city colour without storing it on the doc — hash the name
// into the OKLCH hue circle.
function hueFor(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 360;
}

function toCitySeed(c: RemoteCity): CitySeed {
  return {
    name: c.name,
    hue: hueFor(c.name),
    currentlyActive: c.currentlyActive,
    distanceKm: c.distanceKm,
  };
}

export function WorldTab({ onCity }: WorldTabProps) {
  const E = useEarthMetrics();
  const { position, loading: geoLoading, request } = useGeolocation();
  const { cities: activeCities, loading: activeLoading, error: activeError } =
    useActiveCities(50);
  const { cities: nearbyCities } = useNearbyCities(position, 500);
  const world = useWorldAggregates();

  // Top 6 nearby cities — only shown when the user has granted location.
  const nearbyTop = useMemo(
    () => nearbyCities.filter((c) => !c.fromSeed).slice(0, 6),
    [nearbyCities],
  );

  const totalActive = activeCities.reduce(
    (s, c) => s + (c.currentlyActive ?? 0),
    0,
  );

  return (
    <div className="fade-in">
      <Kicker>World · the planet at a glance</Kicker>
      <div className="sec-head">
        <h2>
          The <em>world</em>
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
          {E.isLive && (
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 9,
                color: "oklch(0.45 0.13 145)",
                letterSpacing: "0.1em",
              }}
              title="CO₂ from NOAA · temp anomaly from NASA · ice from NSIDC, via global-warming.org"
            >
              · LIVE
            </span>
          )}
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
              <em>{E.temp}</em>
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
              {E.tempDelta}
            </div>
          </div>
          <div>
            <div className="kicker">ARCTIC ICE</div>
            <div className="fig-num" style={{ fontSize: 26 }}>
              <em>{E.ice}</em>
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
              {E.iceDelta}
            </div>
          </div>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginBottom: 14,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
        }}
      >
        <div>
          <div className="fig-num" style={{ fontSize: 28 }}>
            <em>{activeCities.length}</em>
          </div>
          <div className="kicker">CITIES MAPPED</div>
        </div>
        <div>
          <div className="fig-num" style={{ fontSize: 28 }}>
            <em>{totalActive.toLocaleString()}</em>
          </div>
          <div className="kicker">ACTIVE NOW</div>
        </div>
        <div>
          <div className="fig-num" style={{ fontSize: 28 }}>
            <em>{nearbyTop.length || "—"}</em>
          </div>
          <div className="kicker">NEAR YOU</div>
        </div>
      </div>

      <UserbaseCard world={world} />

      {/* "Use my location" CTA — only when location not yet granted. */}
      {!position && firebaseEnabled && (
        <div
          className="card"
          style={{
            marginBottom: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <Kicker>See what's near</Kicker>
            <div
              className="margin-note"
              style={{ marginTop: 4, fontSize: 12 }}
            >
              Tap to pull in cities close to you alongside the global list.
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

      {/* Nearby strip — small inline list of close cities. */}
      {nearbyTop.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <Kicker>Near you</Kicker>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {nearbyTop.map((nc) => (
              <button
                key={nc.uid}
                type="button"
                onClick={() =>
                  onCity({
                    name: nc.name,
                    hue: hueFor(nc.name),
                    distanceKm: nc.distanceKm,
                  })
                }
                className="stamp"
                style={{
                  cursor: "pointer",
                  background: "var(--paper-2)",
                  border: "0.5px solid var(--rule)",
                }}
              >
                {nc.name}
                {nc.distanceKm > 0
                  ? ` · ${nc.distanceKm < 1 ? "<1" : nc.distanceKm.toFixed(0)}km`
                  : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      <Kicker>
        {firebaseEnabled
          ? "Cities · ranked by people active right now"
          : "Sign in to load the world atlas"}
      </Kicker>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginTop: 10,
        }}
      >
        {activeError && (
          <div
            className="card"
            style={{
              textAlign: "center",
              padding: 16,
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 13,
              color: "var(--ink-3)",
            }}
          >
            {activeError}
          </div>
        )}
        {activeLoading && activeCities.length === 0 && (
          <div
            className="margin-note"
            style={{ fontSize: 12, fontStyle: "italic" }}
          >
            loading the atlas…
          </div>
        )}
        {!activeLoading && activeCities.length === 0 && firebaseEnabled && (
          <div
            className="card"
            style={{
              textAlign: "center",
              padding: 16,
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 13,
              color: "var(--ink-3)",
            }}
          >
            no active cities yet — the world's quiet.
          </div>
        )}
        {activeCities.map((c, i) => {
          const hue = hueFor(c.name);
          const seed = toCitySeed(c);
          return (
            <div
              key={c.uid}
              onClick={() => onCity(seed)}
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
                    background: `oklch(0.92 0.04 ${hue})`,
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
                      color: `oklch(0.30 0.13 ${hue})`,
                    }}
                  >
                    {c.name.charAt(0).toUpperCase()}
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
                    {c.currentlyActive
                      ? `${c.currentlyActive} active`
                      : "quiet right now"}
                    {position && c.distanceKm > 0
                      ? ` · ${c.distanceKm.toFixed(0)} km`
                      : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div
                    className="fig-num"
                    style={{ fontSize: 22, color: `oklch(0.55 0.12 ${hue})` }}
                  >
                    <em>{c.currentlyActive ?? 0}</em>
                  </div>
                  <div className="kicker" style={{ fontSize: 8 }}>
                    LIVE
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── UserbaseCard ─────────────────────────────────────────────────
//
// Surfaces stats computed nightly by the rebuildWorldAggregates
// Cloud Function. One Firestore read per session powers four
// sub-views: total userbase + global personality average + top
// interests globally + per-country breakdown for the largest
// countries.

function UserbaseCard({
  world,
}: {
  world: ReturnType<typeof useWorldAggregates>;
}) {
  if (world.loading) {
    return (
      <div className="card" style={{ marginBottom: 14, padding: 14 }}>
        <Kicker>Userbase · loading…</Kicker>
      </div>
    );
  }
  if (world.error) {
    return (
      <div className="card" style={{ marginBottom: 14, padding: 14 }}>
        <Kicker>Userbase</Kicker>
        <div
          className="margin-note"
          style={{ marginTop: 8, fontSize: 12, color: "oklch(0.55 0.16 12)" }}
        >
          {world.error}
        </div>
      </div>
    );
  }
  if (!world.snapshot) {
    return (
      <div className="card" style={{ marginBottom: 14, padding: 14 }}>
        <Kicker>Userbase</Kicker>
        <div
          className="margin-note"
          style={{ marginTop: 8, fontSize: 12, fontStyle: "italic" }}
        >
          The first aggregate snapshot hasn't been written yet. Runs
          nightly via the rebuildWorldAggregates Cloud Function;
          stats appear here once enough users have opted into
          discovery.
        </div>
      </div>
    );
  }

  const snap = world.snapshot;
  const sortedCountries = Object.entries(snap.byCountry)
    .sort((a, b) => b[1].userCount - a[1].userCount)
    .slice(0, 8);

  return (
    <>
      <div className="card" style={{ marginBottom: 14, padding: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <Kicker>Userbase · global</Kicker>
          <span
            className="fig-num"
            style={{ fontSize: 18, fontStyle: "italic" }}
          >
            {snap.totalUsers.toLocaleString()}
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
            <div className="kicker">USERS · DISCOVERABLE</div>
            <div className="fig-num" style={{ fontSize: 22, marginTop: 2 }}>
              <em>{snap.totalUsers.toLocaleString()}</em>
            </div>
          </div>
          <div>
            <div className="kicker">COUNTRIES · ABOVE K</div>
            <div className="fig-num" style={{ fontSize: 22, marginTop: 2 }}>
              <em>{snap.countriesRepresented}</em>
            </div>
          </div>
        </div>

        {snap.globalPersonalityAvg && (
          <div style={{ marginTop: 14 }}>
            <Kicker>Personality · global average</Kicker>
            <div style={{ marginTop: 8 }}>
              <HBars
                items={snap.globalPersonalityAvg.map((v, i) => ({
                  label: TRAIT_LABELS[i],
                  value: v,
                  color: "var(--sage)",
                }))}
              />
            </div>
          </div>
        )}

        {snap.globalTopInterests.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <Kicker>Top interests · global</Kicker>
            <div
              style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}
            >
              {snap.globalTopInterests.slice(0, 12).map((i) => (
                <span
                  key={i.name}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    letterSpacing: "0.06em",
                    background: "var(--paper-2)",
                    border: "0.5px solid var(--rule)",
                    color: "var(--ink-2)",
                  }}
                >
                  {i.name}
                  <span
                    style={{
                      marginLeft: 6,
                      color: "var(--ink-3)",
                    }}
                  >
                    {i.count}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div
          className="margin-note"
          style={{ marginTop: 12, fontSize: 11, fontStyle: "italic" }}
        >
          Rebuilt daily. Personality + per-country breakdowns require
          at least 20 users per cell for an honest aggregate.
        </div>
      </div>

      {sortedCountries.length > 0 && (
        <div className="card" style={{ marginBottom: 14, padding: 14 }}>
          <Kicker>By country · top {sortedCountries.length}</Kicker>
          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {sortedCountries.map(([code, cb]) => (
              <CountryRow key={code} code={code} cb={cb} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function CountryRow({ code, cb }: { code: string; cb: CountryBreakdown }) {
  const topInterest = cb.topInterests[0];
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "var(--paper-2)",
        border: "0.5px solid var(--rule)",
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 15,
          }}
        >
          {countryName(code)}
        </span>
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            color: "var(--ink-3)",
            letterSpacing: "0.08em",
          }}
        >
          {cb.userCount.toLocaleString()} USERS
        </span>
      </div>
      {cb.personalityAvg && (
        <div style={{ marginTop: 6 }}>
          <div
            style={{
              display: "flex",
              gap: 4,
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--ink-3)",
              letterSpacing: "0.06em",
            }}
          >
            {cb.personalityAvg.map((v, i) => (
              <span
                key={i}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "2px 4px",
                  background: "var(--paper)",
                  borderRadius: 4,
                }}
                title={TRAIT_LABELS[i]}
              >
                {TRAIT_LABELS[i].slice(0, 1)} {v}
              </span>
            ))}
          </div>
        </div>
      )}
      {topInterest && (
        <div
          className="margin-note"
          style={{ marginTop: 6, fontSize: 11, fontStyle: "italic" }}
        >
          Top interest: <em>{topInterest.name}</em>{" "}
          ({Math.round((topInterest.count / cb.userCount) * 100)}%)
        </div>
      )}
    </div>
  );
}
