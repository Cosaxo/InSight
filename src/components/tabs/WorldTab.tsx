import { C, SEC } from "../../theme";
import { WORLD_PROFILE } from "../../data/profiles";
import type { Me } from "../../types";
import { Card } from "../shared/Card";
import { SLabel } from "../shared/SLabel";
import { BarFill } from "../shared/BarFill";
import { ContextBar } from "../shared/ContextBar";
import { CelestialCard } from "../shared/CelestialCard";
import { PeopleInsightPanel } from "../insights/PeopleInsightPanel";

interface WorldTabProps {
  me: Me;
}

const CULTURAL_ALIGNMENT = [
  { region: "Scandinavia", pct: 87, color: C.teal },
  { region: "Western Europe", pct: 74, color: C.purple },
  { region: "East Asia", pct: 61, color: C.green },
  { region: "North America", pct: 52, color: C.amber },
  { region: "S. Europe", pct: 48, color: C.coral },
  { region: "Latin America", pct: 41, color: C.pink },
];

export function WorldTab({ me }: WorldTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <ContextBar
        items={[
          { icon: "🌍", label: "Population", value: "8.1B", color: SEC.world.accent, sub: "humans" },
          { icon: "🧭", label: "Alignment", value: "31%", color: C.coral },
          { icon: "⚖️", label: "Politically", value: "Lib-left", color: C.amber },
          { icon: "🧠", label: "Openness", value: "52 / 100", color: C.purple },
          { icon: "🗺️", label: "Scandinavia", value: "87%", color: C.green, sub: "cultural fit" },
        ]}
      />
      <Card style={{ padding: "14px 16px", borderLeft: `4px solid ${SEC.world.accent}` }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: SEC.world.accent }}>
          🌍 World Population
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
          Global aggregate · 8.1 billion people
        </div>
      </Card>
      <PeopleInsightPanel profile={WORLD_PROFILE} me={me} />
      <CelestialCard />
      <Card sec="world">
        <SLabel sec="world">Your cultural alignment</SLabel>
        {CULTURAL_ALIGNMENT.map((a, i) => (
          <div
            key={i}
            style={{
              marginBottom: i < CULTURAL_ALIGNMENT.length - 1 ? 10 : 0,
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
              <span style={{ color: C.text }}>{a.region}</span>
              <span style={{ color: a.color, fontWeight: 600 }}>{a.pct}%</span>
            </div>
            <BarFill value={a.pct} color={a.color} />
          </div>
        ))}
      </Card>
    </div>
  );
}
