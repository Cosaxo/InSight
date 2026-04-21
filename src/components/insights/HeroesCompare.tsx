import { C } from "../../theme";
import type { Hero, Person } from "../../types";
import { Card } from "../shared/Card";
import { SLabel } from "../shared/SLabel";
import { StatIco } from "../icons/StatIcons";

interface HeroesCompareProps {
  person: Person;
  myHeroes: Hero[];
  personColor: string;
}

export function HeroesCompare({
  person,
  myHeroes,
  personColor,
}: HeroesCompareProps) {
  if (!person.heroes || !person.heroes.length) return null;
  const myNames = myHeroes.map((h) => h.name.toLowerCase());
  const sharedHeroes = person.heroes.filter((h) =>
    myNames.includes(h.name.toLowerCase()),
  );

  return (
    <Card sec="heroes">
      <SLabel sec="heroes">Top 3 people of all time</SLabel>

      {sharedHeroes.length > 0 && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: `${C.teal}10`,
            border: `1px solid ${C.teal}25`,
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <StatIco name="people" col={C.teal} size={18} />
          <span
            style={{ fontSize: 13, color: C.teal, fontWeight: 600 }}
          >
            You both admire {sharedHeroes.map((h) => h.name).join(" & ")}
          </span>
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 11,
            color: personColor,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          {person.name.split(" ")[0]}'s heroes
        </div>
        {person.heroes.slice(0, 3).map((h, i) => {
          const isShared = myNames.includes(h.name.toLowerCase());
          return (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 12,
                marginBottom: i < 2 ? 10 : 0,
                padding: "10px 12px",
                borderRadius: 10,
                background: isShared ? `${C.teal}08` : C.dim,
                border: isShared ? `1px solid ${C.teal}25` : "none",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: personColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#fff",
                  flexShrink: 0,
                  boxShadow: `0 2px 8px ${personColor}45`,
                }}
              >
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{ fontSize: 13, fontWeight: 700, color: C.navy }}
                >
                  {h.name}
                  <span
                    style={{
                      fontSize: 11,
                      color: C.muted,
                      fontWeight: 400,
                    }}
                  >
                    {" "}
                    · {h.role}
                  </span>
                  {isShared && (
                    <span
                      style={{
                        fontSize: 10,
                        color: C.teal,
                        fontWeight: 600,
                        marginLeft: 6,
                      }}
                    >
                      ✓ shared
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: C.muted,
                    marginTop: 2,
                    fontStyle: "italic",
                  }}
                >
                  "{h.reason}"
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <div
          style={{
            fontSize: 11,
            color: C.teal,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          Your heroes
        </div>
        {myHeroes.slice(0, 3).map((h, i) => {
          const isShared = (person.heroes || [])
            .map((x) => x.name.toLowerCase())
            .includes(h.name.toLowerCase());
          return (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 12,
                marginBottom: i < 2 ? 10 : 0,
                padding: "10px 12px",
                borderRadius: 10,
                background: isShared ? `${C.teal}08` : C.dim,
                border: isShared ? `1px solid ${C.teal}25` : "none",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: C.teal,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#fff",
                  flexShrink: 0,
                  boxShadow: `0 2px 8px ${C.teal}45`,
                }}
              >
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{ fontSize: 13, fontWeight: 700, color: C.navy }}
                >
                  {h.name}
                  <span
                    style={{
                      fontSize: 11,
                      color: C.muted,
                      fontWeight: 400,
                    }}
                  >
                    {" "}
                    · {h.role}
                  </span>
                  {isShared && (
                    <span
                      style={{
                        fontSize: 10,
                        color: C.teal,
                        fontWeight: 600,
                        marginLeft: 6,
                      }}
                    >
                      ✓ shared
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: C.muted,
                    marginTop: 2,
                    fontStyle: "italic",
                  }}
                >
                  "{h.reason}"
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
