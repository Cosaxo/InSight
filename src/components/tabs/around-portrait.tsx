// around-portrait.tsx — the "circle portrait" mode for AroundTab.
//
// Renamed from the old "Area portrait" which compared the user
// against a fictional "Oslo profile". This honest version compares
// the user against their actual circle (useRelations): an averaged
// Big Five radar with the user's vector overlaid.
//
// Big Five comes from RemoteProfile.personality (5-number vector
// in OCEAN order) when the user has taken the test, and from each
// Person.personality on add-a-person. When either side is missing
// we render an empty-state pointer instead of a hollow radar.

import { useMemo } from "react";
import { useProfile } from "../../lib/useProfile";
import { useRelations } from "../../lib/useRelations";
import type { AreaAggregate } from "../../lib/useAreaAggregate";
import { Kicker } from "../shared/primitives";
import { RadarChart } from "../shared/charts";

const BIG5 = ["Open", "Conscientious", "Extra", "Agreeable", "Stable"];

interface CirclePortraitProps {
  onOpenTest: () => void;
  onAddPerson: () => void;
  // Optional cross-user aggregate for "you vs your area" — when
  // present and meeting k-anonymity, an extra card renders below
  // the circle radar. Null when no aggregate exists for the user's
  // current geohash5 cell.
  area?: AreaAggregate | null;
}

export function CirclePortrait({
  onOpenTest,
  onAddPerson,
  area,
}: CirclePortraitProps) {
  const { profile } = useProfile();
  const { people } = useRelations();

  // The user's vector. Big Five comes from RemoteProfile.personality
  // and must be a length-5 numeric array.
  const meVec = profile.personality;
  const meReady =
    Array.isArray(meVec) &&
    meVec.length === 5 &&
    meVec.every((n) => typeof n === "number");

  // The circle's averaged vector. Only count people who have a
  // valid 5-number personality vector (most user-added Persons
  // default to [50,50,50,50,50] but that's still a valid average
  // input — they read as "neutral" until overridden).
  const circleVec = useMemo(() => {
    if (!people.length) return null;
    const valid = people.filter(
      (p) =>
        Array.isArray(p.personality) &&
        p.personality.length === 5 &&
        p.personality.every((n) => typeof n === "number"),
    );
    if (valid.length === 0) return null;
    const sums = [0, 0, 0, 0, 0];
    for (const p of valid) {
      const v = p.personality as number[];
      for (let i = 0; i < 5; i++) sums[i] += v[i];
    }
    return sums.map((s) => Math.round(s / valid.length));
  }, [people]);

  // Per-trait spread across the circle. Used to show "how spread
  // out is your circle on each trait" beneath the radar.
  const spread = useMemo(() => {
    if (!people.length) return null;
    const buckets: number[][] = [[], [], [], [], []];
    for (const p of people) {
      const v = p.personality;
      if (
        !Array.isArray(v) ||
        v.length !== 5 ||
        !v.every((n: unknown) => typeof n === "number")
      ) {
        continue;
      }
      for (let i = 0; i < 5; i++) buckets[i].push(v[i]);
    }
    return buckets.map((vals, i) => {
      if (vals.length === 0) {
        return { label: BIG5[i], min: 0, max: 0, n: 0 };
      }
      return {
        label: BIG5[i],
        min: Math.min(...vals),
        max: Math.max(...vals),
        n: vals.length,
      };
    });
  }, [people]);

  if (!meReady) {
    return (
      <div style={{ marginTop: 12 }}>
        <div className="card" style={{ padding: 22, textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 36,
              fontStyle: "italic",
              color: "var(--ink-3)",
            }}
          >
            ◌
          </div>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 16,
              marginTop: 6,
            }}
          >
            take the personality test first.
          </div>
          <div
            className="margin-note"
            style={{ marginTop: 8, fontSize: 12, lineHeight: 1.5 }}
          >
            "Your portrait needs your own Big Five before it can
            compare anything. Five questions — under a minute."
          </div>
          <button
            type="button"
            onClick={onOpenTest}
            style={{
              marginTop: 12,
              padding: "8px 14px",
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
            → TAKE THE TEST
          </button>
        </div>
      </div>
    );
  }

  if (!circleVec) {
    return (
      <div style={{ marginTop: 12 }}>
        <div className="card" style={{ padding: 22, textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 36,
              fontStyle: "italic",
              color: "var(--ink-3)",
            }}
          >
            ◌
          </div>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 16,
              marginTop: 6,
            }}
          >
            no circle yet to compare against.
          </div>
          <div
            className="margin-note"
            style={{ marginTop: 8, fontSize: 12, lineHeight: 1.5 }}
          >
            "Add the people you keep close. Their averaged Big Five
            becomes the comparison line on your portrait — the
            shape of who you've gathered."
          </div>
          <button
            type="button"
            onClick={onAddPerson}
            style={{
              marginTop: 12,
              padding: "8px 14px",
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
            + ADD A PERSON
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>You vs your circle · radar</Kicker>
        <div style={{ marginTop: 8 }}>
          <RadarChart
            values={meVec!}
            compareValues={circleVec}
            labels={BIG5}
            color="var(--sienna)"
            compareColor="var(--ink-3)"
            size={260}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: 14,
            justifyContent: "center",
            fontFamily: "var(--mono)",
            fontSize: 9.5,
            color: "var(--ink-3)",
            letterSpacing: "0.08em",
            marginTop: 4,
          }}
        >
          <span>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                background: "var(--sienna)",
                borderRadius: 2,
                marginRight: 5,
              }}
            />
            YOU
          </span>
          <span>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                background: "var(--ink-3)",
                borderRadius: 2,
                marginRight: 5,
              }}
            />
            YOUR CIRCLE · {people.length}
          </span>
        </div>
      </div>

      {spread && (
        <div className="card">
          <Kicker>Spread · how varied your circle is</Kicker>
          <div style={{ marginTop: 10 }}>
            {spread.map((s, i) => {
              const me = meVec![i];
              return (
                <div key={s.label} style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: 13,
                      marginBottom: 4,
                    }}
                  >
                    <span>{s.label}</span>
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 9.5,
                        color: "var(--ink-3)",
                      }}
                    >
                      you {me}
                    </span>
                  </div>
                  <SpreadRow min={s.min} max={s.max} you={me} n={s.n} />
                </div>
              );
            })}
          </div>
          <div
            className="margin-note"
            style={{ marginTop: 8, fontSize: 11, fontStyle: "italic" }}
          >
            "{circleSpreadCopy(spread, people.length)}"
          </div>
        </div>
      )}

      {area && (
        <div className="card" style={{ marginTop: 12 }}>
          <Kicker>
            You vs your area · {area.count}{" "}
            {area.count === 1 ? "soul" : "souls"} within 5 km
          </Kicker>
          <div style={{ marginTop: 8 }}>
            <RadarChart
              values={meVec!}
              compareValues={area.mean}
              labels={BIG5}
              color="var(--sienna)"
              compareColor="oklch(0.55 0.10 250)"
              size={260}
            />
          </div>
          <div
            style={{
              display: "flex",
              gap: 14,
              justifyContent: "center",
              fontFamily: "var(--mono)",
              fontSize: 9.5,
              color: "var(--ink-3)",
              letterSpacing: "0.08em",
              marginTop: 4,
            }}
          >
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  background: "var(--sienna)",
                  borderRadius: 2,
                  marginRight: 5,
                }}
              />
              YOU
            </span>
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  background: "oklch(0.55 0.10 250)",
                  borderRadius: 2,
                  marginRight: 5,
                }}
              />
              YOUR AREA · {area.count}
            </span>
          </div>
          <div
            className="margin-note"
            style={{
              marginTop: 8,
              fontSize: 11,
              fontStyle: "italic",
              lineHeight: 1.5,
            }}
          >
            "Anonymous average of everyone in your ~5 km cell who's
            taken the test and consents to sharing. Published only
            when the cell has 5+ contributors — no individual
            shows up here."
          </div>
        </div>
      )}
    </div>
  );
}

function SpreadRow({
  min,
  max,
  you,
  n,
}: {
  min: number;
  max: number;
  you: number;
  n: number;
}) {
  if (n === 0) {
    return (
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          color: "var(--ink-3)",
        }}
      >
        no data
      </div>
    );
  }
  // Render a min..max band with a marker at the user's position.
  return (
    <div
      style={{
        position: "relative",
        height: 8,
        background: "var(--paper-2)",
        border: "0.5px solid var(--rule)",
        borderRadius: 4,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: `${min}%`,
          width: `${Math.max(2, max - min)}%`,
          top: 0,
          bottom: 0,
          background: "var(--ink-3)",
          opacity: 0.45,
          borderRadius: 4,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `calc(${you}% - 1px)`,
          top: -2,
          bottom: -2,
          width: 2,
          background: "var(--sienna)",
        }}
        title={`you · ${you}`}
      />
    </div>
  );
}

function circleSpreadCopy(
  spread: { label: string; min: number; max: number; n: number }[],
  total: number,
): string {
  // Pick the trait with the widest spread to anchor the line.
  let widest = spread[0];
  for (const s of spread) {
    if (s.max - s.min > widest.max - widest.min) widest = s;
  }
  if (widest.n === 0) {
    return "Add a few people and the lines start to mean something.";
  }
  return `${total} ${total === 1 ? "person" : "people"} in your circle — widest spread on ${widest.label.toLowerCase()}.`;
}
