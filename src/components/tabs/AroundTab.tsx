import { useState } from "react";
import { C, SEC } from "../../theme";
import { AROUND_PROFILE, NEARBY_PEOPLE } from "../../data/profiles";
import type { Me } from "../../types";
import { Card } from "../shared/Card";
import { Pill } from "../shared/Pill";
import { Av } from "../shared/Av";
import { CVBadge } from "../shared/CVBadge";
import { ContextBar } from "../shared/ContextBar";
import { AmbientCard } from "../shared/AmbientCard";
import { PeopleInsightPanel } from "../insights/PeopleInsightPanel";
import { PersonProfilePanel } from "../panels/PersonProfilePanel";

interface AroundTabProps {
  me: Me;
}

export function AroundTab({ me }: AroundTabProps) {
  const [mode, setMode] = useState<"people" | "area">("people");
  const [selId, setSelId] = useState<string | null>(null);
  const selected = NEARBY_PEOPLE.find((p) => p.id === selId);

  if (selected) {
    return (
      <PersonProfilePanel
        person={selected}
        me={me}
        onClose={() => setSelId(null)}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <ContextBar
        items={[
          { icon: "📍", label: "Location", value: "Oslo", color: SEC.around.accent, sub: "Norway" },
          { icon: "📡", label: "Radius", value: "5 km", color: SEC.around.accent },
          { icon: "👥", label: "Nearby", value: "2,847", color: C.coral },
          { icon: "🎯", label: "Avg match", value: "67%", color: C.amber },
          { icon: "✨", label: "Like you", value: "312", color: C.purple },
        ]}
      />
      <AmbientCard />
      <div style={{ display: "flex", gap: 8 }}>
        <Pill
          active={mode === "people"}
          color={C.teal}
          onClick={() => setMode("people")}
        >
          People
        </Pill>
        <Pill
          active={mode === "area"}
          color={C.purple}
          onClick={() => setMode("area")}
        >
          Area profile
        </Pill>
      </div>
      {mode === "area" ? (
        <div>
          <Card
            style={{
              padding: "14px 16px",
              marginBottom: 12,
              borderLeft: `4px solid ${SEC.around.accent}`,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: SEC.around.accent }}>
              👥 People near you — Oslo
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {AROUND_PROFILE.subtitle}
            </div>
          </Card>
          <PeopleInsightPanel profile={AROUND_PROFILE} me={me} />
        </div>
      ) : (
        <div>
          <div
            style={{
              fontSize: 12,
              color: C.muted,
              paddingLeft: 2,
              marginBottom: 8,
            }}
          >
            Sorted by compatibility — tap to explore
          </div>
          {NEARBY_PEOPLE.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelId(p.id)}
              style={{
                background: C.card,
                borderRadius: 18,
                padding: "14px 16px",
                boxShadow: C.shadow,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: 10,
                borderLeft: `4px solid ${p.color}`,
                overflow: "hidden",
              }}
            >
              <Av init={p.init} color={p.color} size={46} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.navy }}>
                  {p.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: C.muted,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.interests.slice(0, 3).join(" · ")}
                </div>
                <div style={{ marginTop: 4 }}>
                  <CVBadge cv={p.cv} />
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color:
                      (p.match || 0) > 75
                        ? C.teal
                        : (p.match || 0) > 60
                          ? C.amber
                          : C.muted,
                    lineHeight: 1,
                  }}
                >
                  {p.match}%
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color:
                      (p.match || 0) > 75
                        ? C.teal
                        : (p.match || 0) > 60
                          ? C.amber
                          : C.muted,
                    fontWeight: 600,
                  }}
                >
                  {(p.match || 0) > 75
                    ? "High"
                    : (p.match || 0) > 60
                      ? "Mid"
                      : "Low"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
