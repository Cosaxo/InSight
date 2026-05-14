// life-day.tsx — the "a day · in the round" section in LifeOverlay's
// rhythms tab. Renders the 24-hour DayClock from the user's saved
// day template + an inline editor to add / remove blocks.
//
// Storage lives on the profile (profile.dayTemplate: DayBlock[]) so
// the whole template syncs as one document. Adding a 7th block is
// one save(), not seven.

import { memo, useState } from "react";
import { Kicker } from "../shared/primitives";
import { useProfile } from "../../lib/useProfile";
import type { DayBlock } from "../../types";

// Default hue palette for the block colour-picker. Matches the
// palette used elsewhere (impressions, ledger).
const HUE_PALETTE = [
  { hue: 12, name: "sienna" },
  { hue: 38, name: "ochre" },
  { hue: 60, name: "amber" },
  { hue: 145, name: "sage" },
  { hue: 195, name: "teal" },
  { hue: 220, name: "blue" },
  { hue: 250, name: "indigo" },
  { hue: 280, name: "violet" },
  { hue: 305, name: "plum" },
];

// "06:30" → 6.5; "" → null. Used to convert <input type="time"> values
// (which return HH:MM strings) into the decimal hours the SVG needs.
function timeToDecimal(t: string): number | null {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 24 || min < 0 || min > 59) return null;
  return h + min / 60;
}

// Decimal → "HH:MM" for display.
function decimalToTime(d: number): string {
  const h = Math.floor(d);
  const m = Math.round((d - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// The clock itself. Pure render — given an array of blocks, paint
// them on the dial in their hue. Sorted by `from` so wedges sit in
// chronological order (visual neatness only; overlaps still draw).
export const DayClock = memo(function DayClock({
  blocks,
}: {
  blocks: DayBlock[];
}) {
  const cx = 110;
  const cy = 110;
  const rOuter = 100;
  const rInner = 60;
  const polar = (h: number, r: number): [number, number] => {
    const a = (h / 24) * 2 * Math.PI - Math.PI / 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const arcPath = (from: number, to: number) => {
    const [x1, y1] = polar(from, rOuter);
    const [x2, y2] = polar(to, rOuter);
    const [x3, y3] = polar(to, rInner);
    const [x4, y4] = polar(from, rInner);
    const large = to - from > 12 ? 1 : 0;
    return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4} Z`;
  };
  const sorted = [...blocks].sort((a, b) => a.from - b.from);

  return (
    <svg
      viewBox="0 0 220 220"
      width="160"
      height="160"
      style={{ flexShrink: 0 }}
    >
      {Array.from({ length: 24 }, (_, h) => {
        const [x1, y1] = polar(h, rOuter + 4);
        const [x2, y2] = polar(h, rOuter + (h % 6 === 0 ? 12 : 8));
        return (
          <line
            key={h}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="var(--ink-3)"
            strokeWidth={h % 6 === 0 ? 1 : 0.5}
          />
        );
      })}
      {sorted.length === 0 && (
        <circle
          cx={cx}
          cy={cy}
          r={(rOuter + rInner) / 2}
          fill="none"
          stroke="var(--rule)"
          strokeWidth={1}
          strokeDasharray="2 4"
        />
      )}
      {sorted.map((b, i) => (
        <path
          key={i}
          d={arcPath(b.from, b.to)}
          fill={`oklch(0.62 0.11 ${b.hue})`}
          opacity={0.88}
        />
      ))}
      {[0, 6, 12, 18].map((h) => {
        const [x, y] = polar(h, rOuter + 22);
        return (
          <text
            key={h}
            x={x}
            y={y + 3}
            textAnchor="middle"
            fontFamily="var(--mono)"
            fontSize="9"
            fill="var(--ink-3)"
            letterSpacing="0.06em"
          >
            {String(h).padStart(2, "0")}
          </text>
        );
      })}
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        fontFamily="var(--serif)"
        fontStyle="italic"
        fontSize="15"
        fill="var(--ink)"
      >
        a day
      </text>
      <text
        x={cx}
        y={cy + 11}
        textAnchor="middle"
        fontFamily="var(--mono)"
        fontSize="8"
        fill="var(--ink-3)"
        letterSpacing="0.08em"
      >
        TYPICAL
      </text>
    </svg>
  );
});

// Inline editor row — one DayBlock + delete + add-new affordance.
function BlockRow({
  block,
  onRemove,
}: {
  block: DayBlock;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 0",
        borderBottom: "0.5px dashed var(--rule)",
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          background: `oklch(0.62 0.11 ${block.hue})`,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          width: 92,
          fontFamily: "var(--mono)",
          fontSize: 10,
          color: "var(--ink-3)",
          letterSpacing: "0.04em",
        }}
      >
        {decimalToTime(block.from)} → {decimalToTime(block.to)}
      </span>
      <span
        style={{
          flex: 1,
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 12.5,
          color: "var(--ink-2)",
          lineHeight: 1.2,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {block.label}
      </span>
      <button
        onClick={() => {
          if (confirm(`Remove "${block.label}"?`)) onRemove();
        }}
        aria-label="Remove block"
        style={{
          background: "transparent",
          border: "none",
          color: "var(--ink-3)",
          cursor: "pointer",
          fontFamily: "var(--mono)",
          fontSize: 12,
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

// "+ add block" inline form. Adds to the parent template via onAdd
// and resets itself on submit.
function AddBlockForm({
  onAdd,
  onCancel,
}: {
  onAdd: (b: DayBlock) => void;
  onCancel: () => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [label, setLabel] = useState("");
  const [hue, setHue] = useState<number>(38);

  const fromDec = timeToDecimal(from);
  const toDec = timeToDecimal(to);
  const canSave =
    fromDec !== null && toDec !== null && toDec > fromDec && label.trim() !== "";

  const submit = () => {
    if (!canSave || fromDec === null || toDec === null) return;
    onAdd({ from: fromDec, to: toDec, label: label.trim(), hue });
    setFrom("");
    setTo("");
    setLabel("");
  };

  const inputStyle: React.CSSProperties = {
    boxSizing: "border-box",
    padding: "6px 8px",
    background: "var(--paper)",
    border: "0.5px solid var(--rule)",
    borderRadius: 4,
    fontFamily: "var(--mono)",
    fontSize: 12,
    color: "var(--ink)",
  };

  return (
    <div
      style={{
        marginTop: 8,
        padding: 10,
        background: "var(--paper-2)",
        border: "0.5px solid var(--rule)",
        borderRadius: 6,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="time"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          style={{ ...inputStyle, width: 90 }}
        />
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            color: "var(--ink-3)",
            alignSelf: "center",
          }}
        >
          →
        </span>
        <input
          type="time"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          style={{ ...inputStyle, width: 90 }}
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="what it is"
          style={{
            ...inputStyle,
            flex: 1,
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 13,
          }}
        />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {HUE_PALETTE.map((h) => (
          <button
            key={h.hue}
            onClick={() => setHue(h.hue)}
            aria-label={h.name}
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: `oklch(0.62 0.11 ${h.hue})`,
              border:
                hue === h.hue
                  ? "1.5px solid var(--ink)"
                  : "0.5px solid var(--rule)",
              cursor: "pointer",
              padding: 0,
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            padding: "6px 10px",
            background: "transparent",
            border: "0.5px solid var(--rule)",
            borderRadius: 999,
            fontFamily: "var(--mono)",
            fontSize: 9,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--ink-3)",
            cursor: "pointer",
          }}
        >
          cancel
        </button>
        <button
          onClick={submit}
          disabled={!canSave}
          style={{
            flex: 1,
            padding: "6px 10px",
            background: canSave ? "var(--ink)" : "var(--paper-3)",
            color: canSave ? "var(--paper)" : "var(--ink-3)",
            border: "none",
            borderRadius: 999,
            fontFamily: "var(--mono)",
            fontSize: 9,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: canSave ? "pointer" : "default",
          }}
        >
          add block
        </button>
      </div>
    </div>
  );
}

// The full rhythms-tab section: kicker + clock + legend + editor.
// Reads the template off profile.dayTemplate; writes back through
// useProfile().save.
export function DayTemplateSection() {
  const { profile, save } = useProfile();
  const blocks = profile.dayTemplate ?? [];
  const sorted = [...blocks].sort((a, b) => a.from - b.from);
  const [addingNew, setAddingNew] = useState(false);

  const addBlock = (b: DayBlock) => {
    void save({ dayTemplate: [...blocks, b] });
    setAddingNew(false);
  };

  const removeBlock = (idx: number) => {
    const next = blocks.filter((_, i) => i !== idx);
    void save({ dayTemplate: next });
  };

  return (
    <>
      <Kicker>a day · in the round</Kicker>
      <div className="card" style={{ marginTop: 10, padding: 14 }}>
        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <DayClock blocks={sorted} />
          <div style={{ flex: 1, minWidth: 180 }}>
            {sorted.length === 0 ? (
              <div
                className="margin-note"
                style={{ fontSize: 12, fontStyle: "italic" }}
              >
                "Map out your typical day — sleep, work, the small
                rituals. Add blocks below and they fill in around the
                dial."
              </div>
            ) : (
              sorted.map((b, i) => (
                <BlockRow
                  key={i}
                  block={b}
                  onRemove={() =>
                    removeBlock(blocks.findIndex((x) => x === b))
                  }
                />
              ))
            )}
          </div>
        </div>

        {addingNew ? (
          <AddBlockForm
            onAdd={addBlock}
            onCancel={() => setAddingNew(false)}
          />
        ) : (
          <button
            onClick={() => setAddingNew(true)}
            style={{
              marginTop: 10,
              width: "100%",
              padding: "8px 12px",
              background: "transparent",
              border: "0.5px dashed var(--rule)",
              borderRadius: 999,
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ink-3)",
              cursor: "pointer",
            }}
          >
            + add a block
          </button>
        )}
      </div>
    </>
  );
}
