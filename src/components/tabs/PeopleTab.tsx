import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { C } from "../../theme";
import { CAT_META } from "../../data/constants";
import { calcSim, fmtDate } from "../../utils/helpers";
import type { Me, Person, RelationCategory } from "../../types";
import { Card } from "../shared/Card";
import { SLabel } from "../shared/SLabel";
import { HScroll } from "../shared/HScroll";
import { Pill } from "../shared/Pill";
import { Av } from "../shared/Av";
import { CVBadge } from "../shared/CVBadge";
import { ContextBar } from "../shared/ContextBar";
import { PersonProfilePanel } from "../panels/PersonProfilePanel";

const COLS = [C.teal, C.purple, C.green, C.amber, C.coral, C.pink, C.cyan];
const RINGS: { r: number; cats: RelationCategory[] }[] = [
  { r: 55, cats: ["family"] },
  { r: 100, cats: ["close"] },
  { r: 148, cats: ["friend", "work"] },
  { r: 192, cats: ["acquaintance"] },
];
const CV = 210;

const CATS: { id: "all" | RelationCategory; label: string; color: string }[] = [
  { id: "all", label: "All", color: C.navy },
  { id: "family", label: "Family", color: C.red },
  { id: "close", label: "Close", color: C.teal },
  { id: "friend", label: "Friends", color: C.green },
  { id: "work", label: "Work", color: C.amber },
  { id: "acquaintance", label: "Acquaint.", color: C.muted },
];

interface PeopleTabProps {
  me: Me;
  relations: Person[];
  setRelations: Dispatch<SetStateAction<Person[]>>;
}

export function PeopleTab({ me, relations, setRelations }: PeopleTabProps) {
  const [cat, setCat] = useState<(typeof CATS)[number]["id"]>("all");
  const [view, setView] = useState<"list" | "circles">("list");
  const [search, setSearch] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [logT, setLogT] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newCat, setNewCat] = useState<RelationCategory>("friend");
  const [logNote, setLogNote] = useState("");
  const [logDate, setLogDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const filtered = useMemo(
    () =>
      relations
        .filter((p) => cat === "all" || p.category === cat)
        .filter((p) =>
          p.name.toLowerCase().includes(search.toLowerCase()),
        ),
    [relations, cat, search],
  );

  const selected = relations.find((p) => p.id === selId);
  if (selected) {
    return (
      <PersonProfilePanel
        person={selected}
        me={me}
        onClose={() => setSelId(null)}
        onLog={(id) => {
          setLogT(id);
          setSelId(null);
        }}
      />
    );
  }

  function addPerson() {
    if (!newName.trim()) return;
    const init = newName
      .trim()
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    setRelations((prev) => [
      ...prev,
      {
        id: `r${Date.now()}`,
        name: newName.trim(),
        init,
        color: COLS[prev.length % COLS.length],
        category: newCat,
        personality: [60, 60, 60, 60, 60],
        political: { econ: 0, social: 0 },
        cv: { indiv: 0, change: 0 },
        interests: [],
        values: [],
        hangouts: [],
      },
    ]);
    setNewName("");
    setAddOpen(false);
  }

  function logHangout(id: string) {
    if (!logNote.trim()) return;
    setRelations((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              hangouts: [
                { date: logDate, note: logNote },
                ...(p.hangouts || []),
              ],
            }
          : p,
      ),
    );
    setLogNote("");
    setLogT(null);
  }

  function moveCat(id: string, c: RelationCategory) {
    setRelations((prev) =>
      prev.map((p) => (p.id === id ? { ...p, category: c } : p)),
    );
  }

  const ringPeople = RINGS.map((ring) => ({
    ...ring,
    people: relations
      .filter((p) => p.category && ring.cats.includes(p.category))
      .slice(0, 10),
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <ContextBar
        items={[
          { icon: "👥", label: "People", value: String(relations.length), color: C.green },
          {
            icon: "❤️",
            label: "Family",
            value: String(relations.filter((p) => p.category === "family").length),
            color: C.red,
          },
          {
            icon: "⭐",
            label: "Close",
            value: String(relations.filter((p) => p.category === "close").length),
            color: C.teal,
          },
          {
            icon: "🤝",
            label: "Friends",
            value: String(relations.filter((p) => p.category === "friend").length),
            color: C.green,
          },
          { icon: "🕐", label: "Last seen", value: "Today", color: C.amber },
        ]}
      />

      <HScroll>
        {CATS.map((c) => (
          <Pill
            key={c.id}
            active={cat === c.id}
            color={c.color}
            onClick={() => setCat(c.id)}
          >
            {c.label}
            {c.id === "all" ? ` (${relations.length})` : ""}
          </Pill>
        ))}
      </HScroll>

      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people..."
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 12,
              border: `1px solid ${C.divider}`,
              background: C.card,
              color: C.text,
              fontFamily: "inherit",
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>
        <button
          onClick={() => setView((v) => (v === "list" ? "circles" : "list"))}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: `1px solid ${C.divider}`,
            background: C.card,
            color: C.muted,
            fontFamily: "inherit",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          {view === "list" ? "Map" : "List"}
        </button>
        <button
          onClick={() => setAddOpen(!addOpen)}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "none",
            background: C.teal,
            color: "#fff",
            fontFamily: "inherit",
            fontSize: 12,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          + Add
        </button>
      </div>

      {addOpen && (
        <Card>
          <SLabel>Add person</SLabel>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name..."
            style={{
              width: "100%",
              padding: "11px 14px",
              borderRadius: 12,
              border: `1px solid ${C.divider}`,
              background: C.dim,
              color: C.text,
              fontFamily: "inherit",
              fontSize: 14,
              outline: "none",
              marginBottom: 10,
            }}
          />
          <select
            value={newCat}
            onChange={(e) => setNewCat(e.target.value as RelationCategory)}
            style={{
              width: "100%",
              padding: "11px 14px",
              borderRadius: 12,
              border: `1px solid ${C.divider}`,
              background: C.dim,
              color: C.text,
              fontFamily: "inherit",
              fontSize: 14,
              cursor: "pointer",
              marginBottom: 10,
            }}
          >
            {(Object.entries(CAT_META) as [RelationCategory, { label: string }][]).map(
              ([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ),
            )}
          </select>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={addPerson}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: 12,
                border: "none",
                background: C.teal,
                color: "#fff",
                fontFamily: "inherit",
                fontSize: 14,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Add
            </button>
            <button
              onClick={() => setAddOpen(false)}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: 12,
                border: `1px solid ${C.divider}`,
                background: "transparent",
                color: C.muted,
                fontFamily: "inherit",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </Card>
      )}

      {logT && (
        <Card style={{ border: `1.5px solid ${C.teal}30` }}>
          <SLabel>
            Log hangout — {relations.find((p) => p.id === logT)?.name}
          </SLabel>
          <input
            type="date"
            value={logDate}
            onChange={(e) => setLogDate(e.target.value)}
            style={{
              width: "100%",
              padding: "11px 14px",
              borderRadius: 12,
              border: `1px solid ${C.divider}`,
              background: C.dim,
              color: C.text,
              fontFamily: "inherit",
              fontSize: 14,
              outline: "none",
              marginBottom: 10,
            }}
          />
          <input
            value={logNote}
            onChange={(e) => setLogNote(e.target.value)}
            placeholder="What did you do?"
            style={{
              width: "100%",
              padding: "11px 14px",
              borderRadius: 12,
              border: `1px solid ${C.divider}`,
              background: C.dim,
              color: C.text,
              fontFamily: "inherit",
              fontSize: 14,
              outline: "none",
              marginBottom: 10,
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => logHangout(logT)}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: 12,
                border: "none",
                background: C.teal,
                color: "#fff",
                fontFamily: "inherit",
                fontSize: 14,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Save
            </button>
            <button
              onClick={() => setLogT(null)}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: 12,
                border: `1px solid ${C.divider}`,
                background: "transparent",
                color: C.muted,
                fontFamily: "inherit",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </Card>
      )}

      {view === "list" &&
        (filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: C.muted,
              padding: 32,
              fontSize: 14,
            }}
          >
            No people found
          </div>
        ) : (
          filtered.map((p) => {
            const sim = calcSim(p, me);
            const last = p.hangouts?.[0];
            return (
              <div
                key={p.id}
                style={{
                  background: C.card,
                  borderRadius: 18,
                  boxShadow: C.shadow,
                  overflow: "hidden",
                  marginBottom: 10,
                  borderLeft: `4px solid ${p.color}`,
                }}
              >
                <div
                  onClick={() => setSelId(p.id)}
                  style={{
                    padding: "14px 16px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Av init={p.init} color={p.color} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: C.navy,
                      }}
                    >
                      {p.name}
                    </div>
                    {p.category && (
                      <div
                        style={{
                          fontSize: 11,
                          color: CAT_META[p.category]?.color,
                          fontWeight: 500,
                        }}
                      >
                        {CAT_META[p.category]?.label}
                      </div>
                    )}
                    {last && (
                      <div
                        style={{
                          fontSize: 11,
                          color: C.muted,
                          marginTop: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Last: {fmtDate(last.date)} — {last.note}
                      </div>
                    )}
                    <div style={{ marginTop: 4 }}>
                      <CVBadge cv={p.cv} />
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color:
                          sim > 75 ? C.teal : sim > 55 ? C.amber : C.muted,
                      }}
                    >
                      {sim}%
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color:
                          sim > 75 ? C.teal : sim > 55 ? C.amber : C.muted,
                        fontWeight: 600,
                      }}
                    >
                      {sim > 75 ? "High" : sim > 55 ? "Mid" : "Low"}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    borderTop: `1px solid ${C.divider}`,
                    padding: "8px 12px",
                    display: "flex",
                    gap: 5,
                    overflowX: "auto",
                    scrollbarWidth: "none",
                  }}
                >
                  {(Object.entries(CAT_META) as [RelationCategory, { label: string; color: string }][]).map(
                    ([k, v]) => (
                      <button
                        key={k}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveCat(p.id, k);
                        }}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 20,
                          border: "none",
                          fontSize: 11,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          flexShrink: 0,
                          background:
                            p.category === k ? v.color : C.dim,
                          color:
                            p.category === k ? "#fff" : C.muted,
                          fontWeight: p.category === k ? 700 : 400,
                          boxShadow:
                            p.category === k
                              ? `0 2px 8px ${v.color}45`
                              : "none",
                          transition: "all 0.15s",
                        }}
                      >
                        {v.label}
                      </button>
                    ),
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setLogT(p.id);
                    }}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 20,
                      border: "none",
                      fontSize: 11,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      flexShrink: 0,
                      marginLeft: "auto",
                      background: C.teal,
                      color: "#fff",
                      fontWeight: 700,
                      boxShadow: `0 2px 8px ${C.teal}40`,
                    }}
                  >
                    + Log
                  </button>
                </div>
              </div>
            );
          })
        ))}

      {view === "circles" && (
        <Card sec="people">
          <SLabel sec="people">Relationship map</SLabel>
          <svg
            viewBox={`0 0 ${CV * 2} ${CV * 2}`}
            style={{ width: "100%", display: "block" }}
          >
            {RINGS.map((ring, i) => (
              <circle
                key={i}
                cx={CV}
                cy={CV}
                r={ring.r + 16}
                fill="none"
                stroke={C.divider}
                strokeWidth="1"
                strokeDasharray="4,4"
              />
            ))}
            {[
              { r: 55, l: "Family" },
              { r: 100, l: "Close" },
              { r: 148, l: "Friends" },
              { r: 192, l: "Acquaint." },
            ].map((r, i) => (
              <text
                key={i}
                x={CV + r.r + 18}
                y={CV + 4}
                fontSize="9"
                fill={C.muted}
                fontFamily="sans-serif"
              >
                {r.l}
              </text>
            ))}
            {ringPeople.map((ring) =>
              ring.people.map((p, pi) => {
                const angle =
                  (pi / ring.people.length) * 2 * Math.PI - Math.PI / 2;
                const x = CV + ring.r * Math.cos(angle);
                const y = CV + ring.r * Math.sin(angle);
                return (
                  <g
                    key={p.id}
                    onClick={() => setSelId(p.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <line
                      x1={CV}
                      y1={CV}
                      x2={x}
                      y2={y}
                      stroke={p.color}
                      strokeWidth="0.5"
                      opacity="0.2"
                    />
                    <circle cx={x} cy={y} r="16" fill={p.color} opacity="0.2" />
                    <circle
                      cx={x}
                      cy={y}
                      r="13"
                      fill={C.card}
                      stroke={p.color}
                      strokeWidth="2.5"
                    />
                    <text
                      x={x}
                      y={y + 4}
                      textAnchor="middle"
                      fontSize="7"
                      fill={p.color}
                      fontFamily="sans-serif"
                      fontWeight="800"
                    >
                      {p.init}
                    </text>
                  </g>
                );
              }),
            )}
            <circle cx={CV} cy={CV} r="24" fill={C.teal} opacity="0.18" />
            <circle
              cx={CV}
              cy={CV}
              r="18"
              fill={C.teal}
              stroke="white"
              strokeWidth="2"
            />
            <text
              x={CV}
              y={CV + 4}
              textAnchor="middle"
              fontSize="9"
              fill="white"
              fontFamily="sans-serif"
              fontWeight="800"
            >
              YOU
            </text>
          </svg>
        </Card>
      )}
    </div>
  );
}
