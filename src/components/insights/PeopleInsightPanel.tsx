import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import { C } from "../../theme";
import { P_TRAITS } from "../../data/constants";
import { cvQuadrant } from "../../utils/helpers";
import type { Me, Profile } from "../../types";
import { Card } from "../shared/Card";
import { SLabel } from "../shared/SLabel";
import { BarFill } from "../shared/BarFill";
import { CVBadge } from "../shared/CVBadge";
import { PoliticalCompass } from "./PoliticalCompass";
import { ValuesCompass } from "./ValuesCompass";

interface PeopleInsightPanelProps {
  profile: Profile;
  me: Me;
}

export function PeopleInsightPanel({ profile, me }: PeopleInsightPanelProps) {
  const radarData = P_TRAITS.map((trait, i) => ({
    trait,
    group: profile.personality[i],
    me: me.personality[i],
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card sec="personality">
        <SLabel sec="personality">Personality profile</SLabel>
        <ResponsiveContainer width="100%" height={200}>
          <RadarChart data={radarData}>
            <PolarGrid stroke={C.divider} />
            <PolarAngleAxis dataKey="trait" tick={{ fill: C.muted, fontSize: 11 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              dataKey="group"
              stroke={profile.color}
              fill={profile.color}
              fillOpacity={0.22}
              strokeWidth={2}
            />
            <Radar
              dataKey="me"
              stroke={C.teal}
              fill={C.teal}
              fillOpacity={0.08}
              strokeWidth={1.5}
              dot={{ fill: C.teal, r: 3 }}
            />
          </RadarChart>
        </ResponsiveContainer>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 20,
            fontSize: 12,
            color: C.muted,
            marginBottom: 14,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                width: 12,
                height: 3,
                background: profile.color,
                borderRadius: 2,
                display: "inline-block",
              }}
            />
            {profile.name}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                width: 12,
                height: 3,
                background: C.teal,
                borderRadius: 2,
                display: "inline-block",
              }}
            />
            You
          </span>
        </div>
        {radarData.map((d, i) => {
          const delta = d.group - d.me;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: C.muted,
                  width: 90,
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
                    width: `${d.group}%`,
                    background: `${profile.color}50`,
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
                  color: delta > 6 ? C.coral : delta < -6 ? C.teal : C.muted,
                }}
              >
                {delta > 0 ? `+${delta}` : delta}
              </span>
            </div>
          );
        })}
      </Card>

      <Card sec="political">
        <SLabel sec="political">Political position</SLabel>
        <div style={{ maxWidth: 256, margin: "0 auto 12px" }}>
          <PoliticalCompass
            group={profile.political}
            me={me.political}
            groupColor={profile.color}
          />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          {[
            {
              label: "Group econ",
              val: profile.political.econ,
              color: profile.color,
            },
            {
              label: "Group social",
              val: profile.political.social,
              color: profile.color,
            },
            { label: "Your econ", val: me.political.econ, color: C.teal },
            { label: "Your social", val: me.political.social, color: C.teal },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                background: C.dim,
                borderRadius: 12,
                padding: "10px 12px",
              }}
            >
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>
                {s.val > 0 ? `+${s.val}` : s.val}
                <span
                  style={{
                    fontSize: 10,
                    color: C.muted,
                    fontWeight: 400,
                  }}
                >
                  {" "}
                  {i < 2
                    ? s.val < 0
                      ? "Left"
                      : "Right"
                    : s.val < 0
                      ? "Lib"
                      : "Auth"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card sec="values">
        <SLabel sec="values">Core values compass</SLabel>
        <div style={{ maxWidth: 256, margin: "0 auto" }}>
          <ValuesCompass
            cv={profile.cv}
            myCv={me.cv}
            groupColor={profile.color}
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
          <CVBadge cv={profile.cv} />
          <CVBadge cv={me.cv} />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginTop: 10,
          }}
        >
          {[
            {
              label: "Group indiv.",
              val: profile.cv?.indiv || 0,
              color: profile.color,
              axis: "indiv" as const,
            },
            {
              label: "Group change",
              val: profile.cv?.change || 0,
              color: profile.color,
              axis: "change" as const,
            },
            {
              label: "Your indiv.",
              val: me.cv?.indiv || 0,
              color: cvQuadrant(me.cv).color,
              axis: "indiv" as const,
            },
            {
              label: "Your change",
              val: me.cv?.change || 0,
              color: cvQuadrant(me.cv).color,
              axis: "change" as const,
            },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                background: C.dim,
                borderRadius: 12,
                padding: "10px 12px",
              }}
            >
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: s.color }}>
                {s.val > 0 ? `+${s.val}` : s.val}
                <span
                  style={{
                    fontSize: 10,
                    color: C.muted,
                    fontWeight: 400,
                  }}
                >
                  {" "}
                  {s.axis === "indiv"
                    ? s.val < 0
                      ? "Individ."
                      : "Collective"
                    : s.val < 0
                      ? "Stability"
                      : "Change"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card sec="interests">
        <SLabel sec="interests">Top interests</SLabel>
        {profile.interests.map((int, i) => (
          <div
            key={i}
            style={{
              marginBottom: i < profile.interests.length - 1 ? 10 : 0,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                marginBottom: 5,
              }}
            >
              <span style={{ color: C.text }}>{int.label}</span>
              <span style={{ color: profile.color, fontWeight: 600 }}>
                {int.pct}%
              </span>
            </div>
            <BarFill value={int.pct} color={profile.color} />
          </div>
        ))}
        <div
          style={{
            marginTop: 14,
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {profile.values.map((v, i) => (
            <span
              key={i}
              style={{
                padding: "4px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 500,
                color: profile.color,
                background: `${profile.color}12`,
                border: `1px solid ${profile.color}25`,
              }}
            >
              {v}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
