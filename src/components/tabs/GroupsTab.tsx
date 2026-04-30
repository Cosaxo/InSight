import { useState } from "react";
import { C, SEC } from "../../theme";
import { COMMUNITIES } from "../../data/profiles";
import type { Me } from "../../types";
import { Card } from "../shared/Card";
import { SLabel } from "../shared/SLabel";
import { HScroll } from "../shared/HScroll";
import { ContextBar } from "../shared/ContextBar";
import { CtxIco } from "../icons/CtxIcons";
import { PeopleInsightPanel } from "../insights/PeopleInsightPanel";

interface GroupsTabProps {
  me: Me;
}

export function GroupsTab({ me }: GroupsTabProps) {
  const [sel, setSel] = useState("technology");
  const [joined, setJoined] = useState<string[]>([
    "technology",
    "philosophy",
    "travel",
    "science",
  ]);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const comm = COMMUNITIES.find((c) => c.id === sel)!;
  const isJoined = joined.includes(sel);

  function handleJoinLeave() {
    if (isJoined) {
      setLeaveConfirm(true);
    } else {
      setJoined((prev) => [...prev, comm.id]);
      setLeaveConfirm(false);
    }
  }

  function confirmLeave() {
    setJoined((prev) => prev.filter((x) => x !== comm.id));
    setLeaveConfirm(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <ContextBar
        items={[
          { icon: <CtxIco name="groups" col={SEC.groups.accent} />, label: "Joined", value: String(joined.length), color: SEC.groups.accent, sub: "communities" },
          { icon: <CtxIco name="people" col={C.teal} />, label: "Total reach", value: "37k+", color: C.teal },
          { icon: <CtxIco name="target" col={C.coral} />, label: "Avg match", value: "80%", color: C.coral },
          { icon: <CtxIco name="fire" col={C.amber} />, label: "Top group", value: "Music", color: C.amber },
        ]}
      />
      <HScroll>
        {COMMUNITIES.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setSel(c.id);
              setLeaveConfirm(false);
            }}
            style={{
              padding: "8px 18px",
              borderRadius: 20,
              cursor: "pointer",
              fontFamily: "inherit",
              border: sel === c.id ? "none" : `1.5px solid ${C.divider}`,
              background: sel === c.id ? c.color : C.card,
              color: sel === c.id ? "#fff" : C.text,
              fontSize: 13,
              fontWeight: sel === c.id ? 700 : 400,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow:
                sel === c.id ? `0 3px 14px ${c.color}50` : C.shadow,
              transform: sel === c.id ? "scale(1.04)" : "scale(1)",
              transition: "all 0.18s cubic-bezier(.4,0,.2,1)",
            }}
          >
            {joined.includes(c.id) && (
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background:
                    sel === c.id ? "rgba(255,255,255,0.85)" : c.color,
                  flexShrink: 0,
                  boxShadow:
                    sel === c.id ? "none" : `0 0 6px ${c.color}60`,
                }}
              />
            )}
            {c.name}
          </button>
        ))}
      </HScroll>
      <Card
        style={{
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          borderLeft: `4px solid ${comm.color}`,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: `${comm.color}15`,
            border: `1.5px solid ${comm.color}40`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 18 }}>🫂</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.navy }}>
            {comm.name}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            {comm.members.toLocaleString()} members · {comm.compat}% match
          </div>
        </div>
        {leaveConfirm ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 6,
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: C.muted,
                textAlign: "right",
              }}
            >
              Leave {comm.name}?
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => setLeaveConfirm(false)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 10,
                  border: `1px solid ${C.divider}`,
                  background: "transparent",
                  color: C.muted,
                  fontFamily: "inherit",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmLeave}
                style={{
                  padding: "6px 12px",
                  borderRadius: 10,
                  border: "none",
                  background: C.red,
                  color: "#fff",
                  fontFamily: "inherit",
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Leave
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleJoinLeave}
            aria-label={isJoined ? `Leave ${comm.name}` : `Join ${comm.name}`}
            style={{
              background: isJoined ? "transparent" : comm.color,
              border: `1.5px solid ${isJoined ? C.divider : comm.color}`,
              color: isJoined ? C.muted : "#fff",
              padding: "9px 20px",
              borderRadius: 20,
              fontFamily: "inherit",
              fontSize: 13,
              cursor: "pointer",
              fontWeight: 700,
              boxShadow: isJoined ? "none" : `0 2px 10px ${comm.color}40`,
            }}
          >
            {isJoined ? "Leave" : "Join"}
          </button>
        )}
      </Card>
      <PeopleInsightPanel profile={comm} me={me} />
      <Card sec="groups">
        <SLabel sec="groups">Top discussion topics</SLabel>
        {comm.topics.map((t, i) => (
          <div
            key={i}
            style={{
              background: `${comm.color}10`,
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: i < comm.topics.length - 1 ? 8 : 0,
              display: "flex",
              alignItems: "center",
              gap: 10,
              border: `1px solid ${comm.color}20`,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: comm.color,
                fontWeight: 700,
                width: 22,
              }}
            >
              #{i + 1}
            </span>
            <span style={{ fontSize: 13, color: C.text }}>{t}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
