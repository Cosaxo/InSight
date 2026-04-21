import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import { C } from "../../theme";
import { P_TRAITS, MEDIA_OPTIONS } from "../../data/constants";
import { cvQuadrant } from "../../utils/helpers";
import type { Hero, Me, MediaKey, MediaMap, TestType } from "../../types";
import { Card } from "../shared/Card";
import { SLabel } from "../shared/SLabel";
import { BarFill } from "../shared/BarFill";
import { Av } from "../shared/Av";
import { CVBadge } from "../shared/CVBadge";
import { AddChipInput } from "../shared/AddChipInput";
import { IcoBack } from "../icons/UtilIcons";
import { PoliticalCompass } from "../insights/PoliticalCompass";
import { ValuesCompass } from "../insights/ValuesCompass";
import { HeroAddForm } from "./HeroAddForm";

interface ProfilePanelProps {
  me: Me;
  onClose: () => void;
  onTest: (t: TestType) => void;
  onUpdateMedia: (m: MediaMap) => void;
  onUpdateLikes: (l: string[]) => void;
  onUpdateDislikes: (d: string[]) => void;
  onUpdateHeroes: (h: Hero[]) => void;
  onResetDefaults: () => void;
}

export function ProfilePanel({
  me,
  onClose,
  onTest,
  onUpdateMedia,
  onUpdateLikes,
  onUpdateDislikes,
  onUpdateHeroes,
  onResetDefaults,
}: ProfilePanelProps) {
  const radarData = P_TRAITS.map((trait, i) => ({
    trait,
    score: me.personality[i],
  }));
  const polLabel =
    me.political.econ < 0 && me.political.social < 0
      ? "Libertarian-left"
      : me.political.econ < 0
        ? "Liberal-left"
        : me.political.social < 0
          ? "Libertarian-right"
          : "Conservative-right";
  const myCV = cvQuadrant(me.cv);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onClose}
          aria-label="Close profile"
          style={{
            background: "transparent",
            border: "none",
            padding: 4,
            cursor: "pointer",
            display: "flex",
          }}
        >
          <IcoBack col={C.teal} />
        </button>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.navy }}>
          Your profile
        </div>
      </div>

      <Card sec="personality">
        <SLabel sec="personality">Personality — Big Five</SLabel>
        <ResponsiveContainer width="100%" height={195}>
          <RadarChart data={radarData}>
            <PolarGrid stroke={C.divider} />
            <PolarAngleAxis
              dataKey="trait"
              tick={{ fill: C.muted, fontSize: 11 }}
            />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              dataKey="score"
              stroke={C.teal}
              fill={C.teal}
              fillOpacity={0.22}
              strokeWidth={2}
              dot={{ fill: C.teal, r: 4 }}
            />
          </RadarChart>
        </ResponsiveContainer>
        {P_TRAITS.map((t, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 12, color: C.muted, width: 90, flexShrink: 0 }}>
              {t}
            </span>
            <div style={{ flex: 1 }}>
              <BarFill value={me.personality[i]} color={C.teal} />
            </div>
            <span
              style={{
                fontSize: 12,
                color: C.teal,
                fontWeight: 600,
                width: 28,
                textAlign: "right",
              }}
            >
              {me.personality[i]}
            </span>
          </div>
        ))}
        <button
          onClick={() => onTest("personality")}
          style={{
            width: "100%",
            marginTop: 12,
            padding: "12px",
            borderRadius: 14,
            border: "none",
            background: C.teal,
            color: "#fff",
            fontFamily: "inherit",
            fontSize: 14,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Retake personality test
        </button>
      </Card>

      <Card sec="political">
        <SLabel sec="political">Political compass</SLabel>
        <div style={{ maxWidth: 240, margin: "0 auto 12px" }}>
          <PoliticalCompass
            group={me.political}
            me={me.political}
            groupColor={C.teal}
            label="You"
          />
        </div>
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <span
            style={{
              padding: "5px 14px",
              borderRadius: 20,
              background: `${C.purple}12`,
              border: `1px solid ${C.purple}30`,
              fontSize: 12,
              fontWeight: 600,
              color: C.purple,
            }}
          >
            {polLabel}
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <div style={{ background: C.dim, borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>Economic</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.purple }}>
              {me.political.econ > 0 ? `+${me.political.econ}` : me.political.econ}
              <span style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>
                {" "}
                {me.political.econ < 0 ? "Left" : "Right"}
              </span>
            </div>
          </div>
          <div style={{ background: C.dim, borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>Social</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.purple }}>
              {me.political.social > 0 ? `+${me.political.social}` : me.political.social}
              <span style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>
                {" "}
                {me.political.social < 0 ? "Lib" : "Auth"}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => onTest("political")}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: 14,
            border: "none",
            background: C.purple,
            color: "#fff",
            fontFamily: "inherit",
            fontSize: 14,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Retake political test
        </button>
      </Card>

      <Card sec="values">
        <SLabel sec="values">Core values compass</SLabel>
        <div style={{ maxWidth: 240, margin: "0 auto 12px" }}>
          <ValuesCompass cv={me.cv} myCv={me.cv} groupColor={myCV.color} label="You" />
        </div>
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <CVBadge cv={me.cv} />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <div style={{ background: C.dim, borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>
              Individual / Collective
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: myCV.color }}>
              {(me.cv?.indiv || 0) > 0
                ? `+${me.cv?.indiv || 0}`
                : me.cv?.indiv || 0}
              <span style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>
                {" "}
                {(me.cv?.indiv || 0) < 0 ? "Individual" : "Collective"}
              </span>
            </div>
          </div>
          <div style={{ background: C.dim, borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>
              Stability / Change
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: myCV.color }}>
              {(me.cv?.change || 0) > 0
                ? `+${me.cv?.change || 0}`
                : me.cv?.change || 0}
              <span style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>
                {" "}
                {(me.cv?.change || 0) < 0 ? "Stability" : "Change"}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => onTest("values")}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: 14,
            border: "none",
            background: C.coral,
            color: "#fff",
            fontFamily: "inherit",
            fontSize: 14,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Retake core values test
        </button>
      </Card>

      <Card sec="media">
        <SLabel sec="media">Your media taste</SLabel>
        {(Object.entries(MEDIA_OPTIONS) as [MediaKey, typeof MEDIA_OPTIONS[MediaKey]][]).map(
          ([key, meta]) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 15 }}>{meta.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>
                  {meta.label}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {meta.genres.map((g, i) => {
                  const selected = (me.media[key] || []).includes(g);
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        const cur = me.media[key] || [];
                        const next = selected
                          ? cur.filter((x) => x !== g)
                          : [...cur, g];
                        onUpdateMedia({ ...me.media, [key]: next });
                      }}
                      style={{
                        padding: "4px 11px",
                        borderRadius: 20,
                        fontSize: 11,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        border: `1px solid ${selected ? meta.color + "50" : C.divider}`,
                        background: selected ? `${meta.color}15` : C.dim,
                        color: selected ? meta.color : C.muted,
                        fontWeight: selected ? 600 : 400,
                      }}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>
          ),
        )}
      </Card>

      <Card sec="likes">
        <SLabel sec="likes">Likes and dislikes</SLabel>
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 11,
              color: C.teal,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Things you like
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 5,
              marginBottom: 8,
            }}
          >
            {me.likes.map((l, i) => (
              <span
                key={i}
                style={{
                  padding: "4px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  background: `${C.teal}15`,
                  color: C.teal,
                  border: `1px solid ${C.teal}30`,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                + {l}
                <button
                  onClick={() =>
                    onUpdateLikes(me.likes.filter((_, j) => j !== i))
                  }
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: C.teal,
                    fontSize: 12,
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <AddChipInput
            placeholder="Add something you like..."
            onAdd={(v) => onUpdateLikes([...me.likes, v])}
            color={C.teal}
          />
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              color: C.coral,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Things you dislike
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 5,
              marginBottom: 8,
            }}
          >
            {me.dislikes.map((d, i) => (
              <span
                key={i}
                style={{
                  padding: "4px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  background: `${C.coral}10`,
                  color: C.coral,
                  border: `1px solid ${C.coral}25`,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                – {d}
                <button
                  onClick={() =>
                    onUpdateDislikes(me.dislikes.filter((_, j) => j !== i))
                  }
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: C.coral,
                    fontSize: 12,
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <AddChipInput
            placeholder="Add something you dislike..."
            onAdd={(v) => onUpdateDislikes([...me.dislikes, v])}
            color={C.coral}
          />
        </div>
      </Card>

      <Card sec="heroes">
        <SLabel sec="heroes">Top 3 people of all time</SLabel>
        {me.heroes.slice(0, 3).map((h, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 10,
              padding: "10px 12px",
              borderRadius: 10,
              background: C.dim,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: C.purple,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 800,
                color: "#fff",
                flexShrink: 0,
                boxShadow: `0 2px 8px ${C.purple}45`,
              }}
            >
              {i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>
                {h.name}
                <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>
                  {" "}
                  · {h.role}
                </span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: C.muted,
                  fontStyle: "italic",
                }}
              >
                "{h.reason}"
              </div>
            </div>
            <button
              onClick={() =>
                onUpdateHeroes(me.heroes.filter((_, j) => j !== i))
              }
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: C.muted,
                fontSize: 16,
                padding: 4,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        ))}
        {me.heroes.length < 3 && (
          <HeroAddForm onAdd={(h) => onUpdateHeroes([...me.heroes, h])} />
        )}
      </Card>

      <Card>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <Av
            init={(me.displayName || "?")
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
            color={C.teal}
            size={44}
          />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.navy }}>
              {me.displayName || "Your account"}
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>
              Stored locally on this device
            </div>
          </div>
        </div>
        <button
          onClick={onResetDefaults}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: 14,
            border: `1.5px solid ${C.divider}`,
            background: "transparent",
            color: C.muted,
            fontFamily: "inherit",
            fontSize: 14,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Reset to defaults
        </button>
      </Card>
    </div>
  );
}
