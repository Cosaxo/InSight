import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import { C } from "../../theme";
import { P_TRAITS, CAT_META } from "../../data/constants";
import { calcSim, cvQuadrant, fmtDate, sharedInt } from "../../utils/helpers";
import type { Me, Person } from "../../types";
import { Card } from "../shared/Card";
import { SLabel } from "../shared/SLabel";
import { Av } from "../shared/Av";
import { CVBadge } from "../shared/CVBadge";
import { IcoBack } from "../icons/UtilIcons";
import { StatIco } from "../icons/StatIcons";
import { PoliticalCompass } from "../insights/PoliticalCompass";
import { ValuesCompass } from "../insights/ValuesCompass";
import { MediaCompare } from "../insights/MediaCompare";
import { LikesDislikesCompare } from "../insights/LikesDislikesCompare";
import { HeroesCompare } from "../insights/HeroesCompare";

interface PersonProfilePanelProps {
  person: Person;
  me: Me;
  onClose: () => void;
  onLog?: (id: string) => void;
}

export function PersonProfilePanel({
  person,
  me,
  onClose,
  onLog,
}: PersonProfilePanelProps) {
  const sim = calcSim(person, me);
  const shared = sharedInt(person);
  const radarData = P_TRAITS.map((trait, i) => ({
    trait,
    them: person.personality[i],
    me: me.personality[i],
  }));
  const simCol = sim > 75 ? C.teal : sim > 55 ? C.amber : C.coral;
  const personQ = cvQuadrant(person.cv);
  const myQ = cvQuadrant(me.cv);
  const sameQ = person.cv && personQ.name === myQ.name;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          background: `linear-gradient(135deg, ${person.color}20, ${person.color}08)`,
          borderRadius: 20,
          padding: "16px",
          border: `1.5px solid ${person.color}35`,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          onClick={onClose}
          aria-label="Back"
          style={{
            background: `${person.color}20`,
            border: "none",
            width: 36,
            height: 36,
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <IcoBack col={person.color} />
        </button>
        <Av init={person.init} color={person.color} size={50} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: person.color }}>
            {person.name}
          </div>
          {person.category && (
            <div
              style={{
                fontSize: 12,
                color: CAT_META[person.category]?.color,
                fontWeight: 600,
                marginTop: 2,
              }}
            >
              {CAT_META[person.category]?.label}
            </div>
          )}
          {person.cv && (
            <div style={{ marginTop: 5 }}>
              <CVBadge cv={person.cv} />
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: simCol,
              lineHeight: 1,
            }}
          >
            {sim}%
          </div>
          <div
            style={{
              fontSize: 10,
              color: C.muted,
              fontWeight: 700,
              letterSpacing: "0.8px",
              marginTop: 2,
            }}
          >
            MATCH
          </div>
        </div>
      </div>

      <Card sec="personality">
        <SLabel sec="personality">Personality comparison</SLabel>
        <ResponsiveContainer width="100%" height={185}>
          <RadarChart data={radarData}>
            <PolarGrid stroke={C.divider} />
            <PolarAngleAxis
              dataKey="trait"
              tick={{ fill: C.muted, fontSize: 10 }}
            />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              dataKey="them"
              stroke={person.color}
              fill={person.color}
              fillOpacity={0.22}
              strokeWidth={2}
            />
            <Radar
              dataKey="me"
              stroke={C.teal}
              fill={C.teal}
              fillOpacity={0.07}
              strokeWidth={1.5}
              dot={{ fill: C.teal, r: 2.5 }}
            />
          </RadarChart>
        </ResponsiveContainer>
        {radarData.map((d, i) => {
          const delta = d.them - d.me;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 7,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: C.muted,
                  width: 88,
                  flexShrink: 0,
                }}
              >
                {d.trait}
              </span>
              <div style={{ flex: 1, position: "relative", height: 5 }}>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: C.dim,
                    borderRadius: 3,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    height: "100%",
                    width: `${d.them}%`,
                    background: `${person.color}50`,
                    borderRadius: 3,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "15%",
                    height: "70%",
                    width: `${d.me}%`,
                    background: C.teal,
                    borderRadius: 3,
                    opacity: 0.85,
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  minWidth: 28,
                  textAlign: "right",
                  color:
                    delta > 6
                      ? C.coral
                      : delta < -6
                        ? C.teal
                        : C.muted,
                }}
              >
                {delta > 0 ? `+${delta}` : delta}
              </span>
            </div>
          );
        })}
      </Card>

      {person.political && (
        <Card sec="political">
          <SLabel sec="political">Political position</SLabel>
          <div style={{ maxWidth: 220, margin: "0 auto" }}>
            <PoliticalCompass
              group={person.political}
              me={me.political}
              groupColor={person.color}
              label={person.name.split(" ")[0]}
            />
          </div>
        </Card>
      )}

      {person.cv && (
        <Card sec="values">
          <SLabel sec="values">Core values compass</SLabel>
          <div style={{ maxWidth: 220, margin: "0 auto" }}>
            <ValuesCompass
              cv={person.cv}
              myCv={me.cv}
              groupColor={person.color}
              label={person.name.split(" ")[0]}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 8,
            }}
          >
            <div>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>
                {person.name.split(" ")[0]}
              </div>
              <CVBadge cv={person.cv} />
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>
                You
              </div>
              <CVBadge cv={me.cv} />
            </div>
          </div>
          {sameQ && (
            <div
              style={{
                marginTop: 10,
                padding: "10px 14px",
                borderRadius: 12,
                background: personQ.color,
                fontSize: 13,
                color: "#fff",
                fontWeight: 700,
                boxShadow: `0 3px 12px ${personQ.color}45`,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <StatIco name="checkAll" col="#fff" size={16} /> Same quadrant —
              strong values alignment
            </div>
          )}
        </Card>
      )}

      {shared.length > 0 && (
        <Card sec="interests">
          <SLabel sec="interests">Shared interests ({shared.length})</SLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {shared.map((int, i) => (
              <span
                key={i}
                style={{
                  padding: "4px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 500,
                  color: person.color,
                  background: `${person.color}12`,
                  border: `1px solid ${person.color}25`,
                }}
              >
                {int}
              </span>
            ))}
          </div>
        </Card>
      )}

      {person.hangouts && person.hangouts.length > 0 && (
        <Card>
          <SLabel>Recent hangouts</SLabel>
          {person.hangouts.slice(0, 3).map((h, i) => (
            <div
              key={i}
              style={{
                background: C.dim,
                borderRadius: 10,
                padding: "10px 12px",
                marginBottom: i < 2 ? 8 : 0,
                display: "flex",
                gap: 10,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: C.muted,
                  flexShrink: 0,
                  paddingTop: 1,
                }}
              >
                {fmtDate(h.date)}
              </span>
              <span style={{ fontSize: 13, color: C.text }}>{h.note}</span>
            </div>
          ))}
        </Card>
      )}

      {onLog && (
        <button
          onClick={() => onLog(person.id)}
          style={{
            width: "100%",
            background: C.teal,
            border: "none",
            color: "#fff",
            padding: "14px",
            borderRadius: 14,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Log hangout
        </button>
      )}

      <MediaCompare
        person={person}
        myMedia={me.media}
        personColor={person.color}
      />
      <LikesDislikesCompare
        person={person}
        myLikes={me.likes}
        myDislikes={me.dislikes}
        personColor={person.color}
      />
      <HeroesCompare
        person={person}
        myHeroes={me.heroes}
        personColor={person.color}
      />
    </div>
  );
}
