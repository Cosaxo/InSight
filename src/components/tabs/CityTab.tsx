import { useState } from "react";
import { IS_DATA } from "../../data/seedData";
import { Kicker } from "../shared/primitives";
import { Donut, RadarChart } from "../shared/charts";
import { ProfileCompare } from "../insights/ProfileCompare";
import { MediaPopularity } from "../insights/MediaPopularity";
import { GroupBreakdown } from "../insights/GroupBreakdown";

type CityScore = Record<string, number>;

export function CityTab() {
  const c = IS_DATA.city;
  const [ratings, setRatings] = useState<CityScore>(c.score);
  const cats: { k: string; label: string }[] = [
    { k: "culture", label: "Culture" },
    { k: "nature", label: "Nature" },
    { k: "food", label: "Food" },
    { k: "pace", label: "Pace" },
    { k: "openness", label: "Openness" },
    { k: "cost", label: "Cost" },
  ];

  const totalRating = Object.values(ratings).reduce(
    (s, v) => s + (v as number),
    0,
  );

  return (
    <div className="fade-in">
      <div className="page-num">— xi —</div>
      <Kicker>Field notes · the city you live in</Kicker>
      <div className="sec-head">
        <h2>
          A passport for <em>Oslo</em>
        </h2>
      </div>

      <div className="card" style={{ position: "relative", marginBottom: 16 }}>
        <div className="tape" />
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "var(--paper)",
              border: "1.5px solid var(--c-city)",
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
                color: "var(--c-city)",
                lineHeight: 1,
              }}
            >
              O
            </div>
            <div
              style={{
                position: "absolute",
                bottom: -6,
                fontFamily: "var(--mono)",
                fontSize: 7,
                color: "var(--c-city)",
                letterSpacing: "0.16em",
                background: "var(--paper-2)",
                padding: "0 4px",
              }}
            >
              OSLO
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
              {c.name}, NO
            </div>
            <div className="kicker" style={{ marginTop: 2 }}>
              POP {c.pop} · LIVED {c.lived} · MATCH {c.yourMatch}%
            </div>
          </div>
          <Donut
            value={c.yourMatch}
            color="var(--c-city)"
            label="MATCH"
            size={64}
          />
        </div>
        <div className="margin-note" style={{ marginTop: 10 }}>
          "{c.notes}"
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <Kicker>Six dimensions · radar</Kicker>
        <div style={{ marginTop: 8 }}>
          <RadarChart
            values={cats.map(({ k }) => ratings[k] * 20)}
            labels={cats.map((c) => c.label)}
            color="var(--c-city)"
            size={260}
          />
        </div>
      </div>

      <Kicker>Rate this place · tap stars</Kicker>
      <div style={{ marginTop: 8 }}>
        {cats.map(({ k, label }) => (
          <div
            key={k}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 0",
              borderBottom: "0.5px solid var(--rule)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 15,
              }}
            >
              {label}
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  className={"star" + (n <= ratings[k] ? " on" : "")}
                  style={{ fontSize: 18, cursor: "pointer" }}
                  onClick={() => setRatings((r) => ({ ...r, [k]: n }))}
                >
                  ✦
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <Kicker>Stamps collected</Kicker>
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}
        >
          {c.visited.map((v: string) => (
            <span key={v} className="stamp">
              {v}
            </span>
          ))}
        </div>
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
              <em>{c.lived}</em>
            </div>
            <div className="kicker">YEARS LIVED</div>
          </div>
          <div>
            <div className="fig-num">
              <em>{c.pop}</em>
            </div>
            <div className="kicker">POPULATION</div>
          </div>
          <div>
            <div className="fig-num">
              <em>{c.visited.length}</em>
            </div>
            <div className="kicker">NORDIC TRIPS</div>
          </div>
          <div>
            <div className="fig-num">
              <em>{totalRating}</em>/30
            </div>
            <div className="kicker">YOUR RATING</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <Kicker>Other cities · how Oslo sits</Kicker>
        <div
          className="margin-note"
          style={{ fontSize: 12, marginTop: 4, marginBottom: 10 }}
        >
          population, give or take.
        </div>
        {[
          { name: "Oslo", pop: 709, color: "var(--c-city)" },
          { name: "Bergen", pop: 290, color: "var(--ink-3)" },
          { name: "Stavanger", pop: 148, color: "var(--ink-3)" },
          { name: "Trondheim", pop: 215, color: "var(--ink-3)" },
          { name: "Tromsø", pop: 78, color: "var(--ink-3)" },
        ].map((city) => (
          <div
            key={city.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                width: 78,
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 13,
              }}
            >
              {city.name}
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
                  width: `${(city.pop / 800) * 100}%`,
                  background: city.color,
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
              {city.pop}k
            </span>
          </div>
        ))}
      </div>

      <hr className="rule-dashed" />
      <ProfileCompare scope="city" accent="var(--c-city)" />
      <hr className="rule-dashed" />
      <GroupBreakdown scope="city" accent="var(--c-city)" />
      <hr className="rule-dashed" />
      <MediaPopularity scope="city" accent="var(--c-city)" />
    </div>
  );
}
