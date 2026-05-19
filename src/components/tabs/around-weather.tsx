// around-weather.tsx — the live weather card for AroundTab.
//
// Reads `data: WeatherData | null` + `loading` from useWeather (which
// is driven by useGeolocation in the parent). Renders the same
// shape as the original AroundEnv (temperature, AQI, UV, humidity,
// wind, sunrise/sunset arc) — but now backed by real Open-Meteo data
// rather than seed.
//
// AQI is best-effort: when the air-quality endpoint fails or
// returns null, the AQI block is omitted instead of asserting a
// fake reading.

import { Kicker } from "../shared/primitives";
import type { WeatherData } from "../../lib/useWeather";

function Gauge({
  value,
  max,
  color,
  segments = 5,
}: {
  value: number;
  max: number;
  color: string;
  segments?: number;
}) {
  const idx = Math.min(
    segments - 1,
    Math.floor((Math.max(0, value) / max) * segments),
  );
  return (
    <div style={{ display: "flex", gap: 2, height: 6, marginTop: 4 }}>
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            background: i <= idx ? color : "var(--paper-2)",
            border: "0.5px solid var(--rule)",
            borderRadius: 1,
          }}
        />
      ))}
    </div>
  );
}

function Sky() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <circle
        cx="17"
        cy="18"
        r="7"
        stroke="oklch(0.55 0.13 80)"
        strokeWidth="1.2"
        fill="oklch(0.95 0.06 80)"
      />
      <g stroke="oklch(0.55 0.13 80)" strokeWidth="1" strokeLinecap="round">
        <line x1="17" y1="6" x2="17" y2="9" />
        <line x1="6" y1="18" x2="9" y2="18" />
        <line x1="9.5" y1="10.5" x2="11.5" y2="12.5" />
        <line x1="24.5" y1="10.5" x2="22.5" y2="12.5" />
      </g>
      <ellipse
        cx="26"
        cy="28"
        rx="11"
        ry="6"
        fill="var(--paper)"
        stroke="var(--ink-2)"
        strokeWidth="1"
      />
      <ellipse
        cx="22"
        cy="26"
        rx="6"
        ry="4"
        fill="var(--paper)"
        stroke="var(--ink-2)"
        strokeWidth="0.8"
      />
    </svg>
  );
}

// Sun's daytime progress 0..1 used to position the sun glyph on the
// arc. Returns null when the user is currently outside today's day
// window (before sunrise or after sunset).
function sunProgress(sunrise: string, sunset: string): number | null {
  const [srH, srM] = sunrise.split(":").map(Number);
  const [ssH, ssM] = sunset.split(":").map(Number);
  if (
    Number.isNaN(srH) ||
    Number.isNaN(srM) ||
    Number.isNaN(ssH) ||
    Number.isNaN(ssM)
  ) {
    return null;
  }
  const now = new Date();
  const minsNow = now.getHours() * 60 + now.getMinutes();
  const minsSr = srH * 60 + srM;
  const minsSs = ssH * 60 + ssM;
  if (minsNow < minsSr || minsNow > minsSs) return null;
  if (minsSs <= minsSr) return null;
  return (minsNow - minsSr) / (minsSs - minsSr);
}

export function WeatherCard({
  data,
  loading,
}: {
  data: WeatherData | null;
  loading: boolean;
}) {
  if (loading && !data) {
    return (
      <div className="card" style={{ marginTop: 14, padding: 14 }}>
        <Kicker>around you</Kicker>
        <div
          className="margin-note"
          style={{ marginTop: 8, fontSize: 12, fontStyle: "italic" }}
        >
          fetching weather…
        </div>
      </div>
    );
  }
  if (!data) return null;

  const progress = sunProgress(data.sunrise, data.sunset);

  return (
    <div className="card" style={{ marginTop: 14, position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <Kicker>Around you</Kicker>
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
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginTop: 8,
          paddingBottom: 12,
          borderBottom: "0.5px dashed var(--rule)",
        }}
      >
        <Sky />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 32,
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            {data.temp}
            <span style={{ fontSize: 18, color: "var(--ink-3)" }}>°C</span>
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--ink-3)",
                marginLeft: 8,
              }}
            >
              feels {data.feels}°
            </span>
          </div>
          <div className="margin-note" style={{ fontSize: 12, marginTop: 2 }}>
            {data.weatherLabel} · H {data.high}° L {data.low}°
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginTop: 12,
        }}
      >
        {/* AQI is best-effort — render only when fetched. */}
        {data.aqi !== null && data.aqiLabel !== null && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  color: "var(--ink-3)",
                  letterSpacing: "0.1em",
                }}
              >
                AIR · AQI
              </span>
              <span
                style={{
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  fontSize: 12,
                }}
              >
                {data.aqiLabel}
              </span>
            </div>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: 20,
                marginTop: 2,
              }}
            >
              <em>{data.aqi}</em>
            </div>
            <Gauge value={data.aqi} max={150} color="oklch(0.65 0.14 145)" />
          </div>
        )}

        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 9,
                color: "var(--ink-3)",
                letterSpacing: "0.1em",
              }}
            >
              UV INDEX
            </span>
            <span
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 12,
              }}
            >
              {data.uvLabel}
            </span>
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 20, marginTop: 2 }}>
            <em>{data.uv}</em>
          </div>
          <Gauge value={data.uv} max={11} color="oklch(0.65 0.15 60)" />
        </div>

        <div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--ink-3)",
              letterSpacing: "0.1em",
            }}
          >
            HUMIDITY
          </div>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 20,
              marginTop: 2,
            }}
          >
            <em>{data.humidity}</em>%
          </div>
          <Gauge value={data.humidity} max={100} color="oklch(0.65 0.13 220)" />
        </div>

        <div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--ink-3)",
              letterSpacing: "0.1em",
            }}
          >
            WIND
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 20, marginTop: 2 }}>
            <em>{data.windSpeed}</em>
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--ink-3)",
                marginLeft: 4,
              }}
            >
              km/h {data.windDirLabel}
            </span>
          </div>
          <Gauge value={data.windSpeed} max={50} color="oklch(0.55 0.04 250)" />
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: "0.5px dashed var(--rule)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 9,
            color: "var(--ink-3)",
            letterSpacing: "0.1em",
            marginBottom: 6,
          }}
        >
          SUN · {data.daylight}
        </div>
        <div style={{ position: "relative", height: 28 }}>
          <svg
            width="100%"
            height="28"
            viewBox="0 0 280 28"
            preserveAspectRatio="none"
          >
            <path
              d="M 8 24 Q 140 -8 272 24"
              stroke="var(--ink-2)"
              strokeWidth="0.7"
              fill="none"
              strokeDasharray="2 3"
            />
            <line
              x1="8"
              y1="24"
              x2="272"
              y2="24"
              stroke="var(--rule)"
              strokeWidth="0.5"
            />
            {progress !== null && (
              <circle
                cx={8 + (272 - 8) * progress}
                // Mirror the parabolic path: y = 24 + (-8 - 24) * 4 * x * (1-x)
                // where x is progress 0..1.
                cy={24 + (-8 - 24) * 4 * progress * (1 - progress)}
                r="4"
                fill="oklch(0.75 0.16 70)"
              />
            )}
          </svg>
          <span
            style={{
              position: "absolute",
              left: 0,
              bottom: -2,
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--ink-3)",
            }}
          >
            {data.sunrise}
          </span>
          <span
            style={{
              position: "absolute",
              right: 0,
              bottom: -2,
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--ink-3)",
            }}
          >
            {data.sunset}
          </span>
        </div>
      </div>
    </div>
  );
}
