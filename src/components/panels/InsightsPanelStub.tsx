import { C, SEC } from "../../theme";
import { Card } from "../shared/Card";
import { SLabel } from "../shared/SLabel";
import { IcoBack } from "../icons/UtilIcons";

interface InsightsPanelStubProps {
  onClose: () => void;
}

// Placeholder for the full Personal Insights panel (mood/habits/fitness/
// nutrition/finance). It lives in a follow-up wave so the rest of the app
// can ship now.
export function InsightsPanelStub({ onClose }: InsightsPanelStubProps) {
  const sections = [
    { key: "mood", icon: "😊", label: "Mood", copy: "Log daily mood and track trends over time." },
    { key: "habits", icon: "✓", label: "Habits", copy: "Build streaks for habits you care about." },
    { key: "fitness", icon: "◈", label: "Fitness", copy: "Log workouts, intensity, and calories burned." },
    { key: "nutrition", icon: "◉", label: "Nutrition", copy: "Track meals, calories, and macros." },
    { key: "finance", icon: "₵", label: "Finance", copy: "Monitor income, spending, and savings." },
  ] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onClose}
          aria-label="Close insights"
          style={{
            background: "transparent",
            border: "none",
            padding: 4,
            cursor: "pointer",
            display: "flex",
            flexShrink: 0,
          }}
        >
          <IcoBack col={C.teal} />
        </button>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.navy }}>
          Personal Insights
        </div>
      </div>

      <Card>
        <SLabel>Coming soon</SLabel>
        <div style={{ fontSize: 14, color: C.text, lineHeight: 1.55 }}>
          Track mood, habits, fitness, nutrition, and finance — all in one
          place. This panel is the next feature being wired up.
        </div>
      </Card>

      {sections.map((s) => {
        const sec = SEC[s.key as keyof typeof SEC];
        return (
          <div
            key={s.key}
            style={{
              background: sec.bg,
              borderLeft: `4px solid ${sec.accent}`,
              borderRadius: 14,
              padding: "14px 16px",
              display: "flex",
              gap: 14,
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                color: sec.accent,
                fontWeight: 700,
                border: `1.5px solid ${sec.border}`,
              }}
            >
              {s.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: sec.accent,
                }}
              >
                {s.label}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                {s.copy}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
