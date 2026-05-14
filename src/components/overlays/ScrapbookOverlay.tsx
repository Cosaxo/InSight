// ScrapbookOverlay — field journal of things you've noticed (plants,
// birds, landmarks, …). Backed by useScrapbook; persists to
// insight_users/{uid}/insight_scrapbook/{id} when signed in,
// localStorage otherwise.
//
// What changed from the original: there's no fake AI-identifies-
// your-photo capture flow anymore — that pretended to call an ML
// model and the previous "result" was just a random pick from seed.
// Capture is now a small manual form (name, optional latin, optional
// note). Drop a real iNaturalist call into useScrapbook.add() later
// if you want the AI back, honestly.

import { useState } from "react";
import { Kicker } from "../shared/primitives";
import { useScrapbook } from "../../lib/useScrapbook";
import type { Specimen } from "../../types";

interface ScrapCat {
  id: string;
  label: string;
  glyph: string;
  hue: number;
}

// Categories are taxonomy, not user data — kept hardcoded. Drop a
// category to remove it from the picker (existing specimens with that
// id will still render under "uncategorised" via SCRAP_CATS lookup).
const SCRAP_CATS: ScrapCat[] = [
  { id: "plants", label: "plants", glyph: "❀", hue: 145 },
  { id: "insects", label: "insects", glyph: "✺", hue: 38 },
  { id: "birds", label: "birds", glyph: "⌇", hue: 220 },
  { id: "animals", label: "animals", glyph: "◑", hue: 12 },
  { id: "landmarks", label: "landmarks", glyph: "⌂", hue: 200 },
  { id: "spices", label: "spices", glyph: "✦", hue: 28 },
  { id: "fungi", label: "fungi", glyph: "☂", hue: 280 },
];

const UNCATEGORISED: ScrapCat = {
  id: "_misc",
  label: "uncategorised",
  glyph: "·",
  hue: 60,
};

function catFor(id: string): ScrapCat {
  return SCRAP_CATS.find((c) => c.id === id) ?? UNCATEGORISED;
}

function CatTile({
  c,
  count,
  onOpen,
}: {
  c: ScrapCat;
  count: number;
  onOpen: (id: string) => void;
}) {
  return (
    <div
      onClick={() => onOpen(c.id)}
      className="card"
      style={{ cursor: "pointer", padding: 14 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: `oklch(0.94 0.04 ${c.hue})`,
            border: `0.5px solid oklch(0.78 0.08 ${c.hue})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            color: `oklch(0.40 0.13 ${c.hue})`,
          }}
        >
          {c.glyph}
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 17,
              fontStyle: "italic",
            }}
          >
            {c.label}
          </div>
          <div className="kicker" style={{ marginTop: 2 }}>
            {count === 0
              ? "none yet"
              : `${count} ${count === 1 ? "specimen" : "specimens"}`}
          </div>
        </div>
        <div
          style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 22,
            color: count > 0 ? `oklch(0.45 0.13 ${c.hue})` : "var(--ink-3)",
          }}
        >
          {count > 0 ? count : "·"}
        </div>
      </div>
    </div>
  );
}

function SpecimenCard({
  s,
  c,
  onRemove,
}: {
  s: Specimen;
  c: ScrapCat;
  onRemove?: (id: string) => void;
}) {
  return (
    <div className="card" style={{ padding: 12, position: "relative" }}>
      <div style={{ display: "flex", gap: 12 }}>
        <div
          style={{
            width: 64,
            height: 64,
            flexShrink: 0,
            background: `linear-gradient(135deg, oklch(0.88 0.08 ${c.hue}) 0%, oklch(0.72 0.10 ${c.hue}) 100%)`,
            border: "0.5px solid var(--rule)",
            position: "relative",
            boxShadow: "1px 2px 3px rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 24,
            opacity: 0.8,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: -3,
              left: "50%",
              transform: "translateX(-50%)",
              width: 6,
              height: 6,
              background: "var(--ink)",
              borderRadius: "50%",
              boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
            }}
          />
          {c.glyph}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 15,
              fontWeight: 500,
            }}
          >
            {s.name}
          </div>
          {s.latin && (
            <div
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 12,
                color: "var(--ink-2)",
                marginTop: 1,
              }}
            >
              {s.latin}
            </div>
          )}
          {(s.date || s.loc) && (
            <div className="kicker" style={{ marginTop: 6 }}>
              {[s.date, s.loc].filter(Boolean).join(" · ")}
            </div>
          )}
          {s.note && (
            <div className="margin-note" style={{ fontSize: 12, marginTop: 4 }}>
              "{s.note}"
            </div>
          )}
        </div>
        {onRemove && (
          <button
            onClick={() => {
              if (confirm(`Remove “${s.name}”?`)) onRemove(s.id);
            }}
            aria-label={`Remove ${s.name}`}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--ink-3)",
              cursor: "pointer",
              fontFamily: "var(--mono)",
              fontSize: 12,
              padding: "0 4px",
              alignSelf: "flex-start",
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function AddSpecimenForm({
  cat,
  onCancel,
  onSubmit,
}: {
  cat: ScrapCat;
  onCancel: () => void;
  onSubmit: (s: Omit<Specimen, "id" | "createdAt">) => void;
}) {
  const [name, setName] = useState("");
  const [latin, setLatin] = useState("");
  const [loc, setLoc] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayLabel());

  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    border: "0.5px solid var(--rule)",
    borderRadius: 6,
    background: "var(--paper)",
    fontFamily: "var(--serif)",
    fontSize: 13,
    outline: "none",
  } as const;

  const submit = () => {
    const n = name.trim();
    if (!n) return;
    onSubmit({
      category: cat.id,
      name: n,
      latin: latin.trim() || undefined,
      date: date.trim() || todayLabel(),
      loc: loc.trim() || undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <div
      className="card"
      style={{
        marginBottom: 14,
        borderStyle: "dashed",
        background: `oklch(0.97 0.02 ${cat.hue})`,
      }}
    >
      <Kicker>Add a {cat.label.replace(/s$/, "")}</Kicker>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginTop: 10,
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="common name"
          autoFocus
          style={inputStyle}
        />
        <input
          value={latin}
          onChange={(e) => setLatin(e.target.value)}
          placeholder="latin name (optional)"
          style={{ ...inputStyle, fontStyle: "italic" }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder="date"
            style={{ ...inputStyle, flex: 1 }}
          />
          <input
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
            placeholder="where"
            style={{ ...inputStyle, flex: 1 }}
          />
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="a small note (optional)"
          rows={2}
          style={{ ...inputStyle, fontStyle: "italic", resize: "vertical" }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button
            onClick={submit}
            style={{
              flex: 1,
              padding: "10px 12px",
              border: "0.5px solid var(--ink)",
              borderRadius: 999,
              background: "var(--ink)",
              color: "var(--paper)",
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Pin it
          </button>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "10px 12px",
              border: "0.5px solid var(--rule)",
              borderRadius: 999,
              background: "transparent",
              color: "var(--ink-2)",
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface ScrapbookOverlayProps {
  onClose: () => void;
}

export function ScrapbookOverlay({ onClose }: ScrapbookOverlayProps) {
  const { items, add, remove } = useScrapbook();
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const countsByCat = new Map<string, number>();
  for (const s of items) {
    countsByCat.set(s.category, (countsByCat.get(s.category) ?? 0) + 1);
  }
  const totalCount = items.length;

  // Anything with a category id not in SCRAP_CATS rolls up under
  // "uncategorised" so a category rename never orphans an entry.
  const knownIds = new Set(SCRAP_CATS.map((c) => c.id));
  const miscCount = items.filter((s) => !knownIds.has(s.category)).length;

  const sortedByRecent = [...items].sort(
    (a, b) => b.createdAt - a.createdAt,
  );

  if (openCat) {
    const cat = catFor(openCat);
    const inCat = sortedByRecent.filter((s) =>
      cat.id === UNCATEGORISED.id
        ? !knownIds.has(s.category)
        : s.category === cat.id,
    );
    return (
      <div className="overlay paper-grain">
        <div className="app-header">
          <button
            className="avatar-btn"
            onClick={() => {
              setOpenCat(null);
              setAdding(false);
            }}
          >
            ‹
          </button>
          <div className="h-title">{cat.label}</div>
          <div className="h-meta">{inCat.length}</div>
        </div>
        <div className="app-body">
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: 22,
                fontStyle: "italic",
                color: `oklch(0.40 0.13 ${cat.hue})`,
              }}
            >
              {cat.glyph} {cat.label}
            </div>
            <div className="kicker">
              {inCat.length === 0
                ? "empty"
                : `${inCat.length} ${inCat.length === 1 ? "specimen" : "specimens"}`}
            </div>
          </div>

          {adding ? (
            <AddSpecimenForm
              cat={cat}
              onCancel={() => setAdding(false)}
              onSubmit={async (s) => {
                await add(s);
                setAdding(false);
              }}
            />
          ) : (
            cat.id !== UNCATEGORISED.id && (
              <button
                onClick={() => setAdding(true)}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: `oklch(0.94 0.04 ${cat.hue})`,
                  border: `0.5px dashed oklch(0.60 0.13 ${cat.hue})`,
                  borderRadius: 6,
                  marginBottom: 14,
                  cursor: "pointer",
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  fontSize: 15,
                  color: `oklch(0.35 0.15 ${cat.hue})`,
                }}
              >
                + add a {cat.label.replace(/s$/, "")}
              </button>
            )
          )}

          {inCat.length === 0 ? (
            <div
              className="margin-note"
              style={{
                marginTop: 10,
                fontSize: 13,
                fontStyle: "italic",
                textAlign: "center",
              }}
            >
              Nothing pinned in {cat.label} yet.
            </div>
          ) : (
            <>
              <Kicker>Pinned · most recent first</Kicker>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginTop: 10,
                }}
              >
                {inCat.map((s) => (
                  <SpecimenCard
                    key={s.id}
                    s={s}
                    c={catFor(s.category)}
                    onRemove={(id) => void remove(id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="overlay paper-grain">
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ✕
        </button>
        <div className="h-title">
          the <em>scrapbook</em>
        </div>
        <div className="h-meta">
          {totalCount}
          <br />
          {totalCount === 1 ? "specimen" : "specimens"}
        </div>
      </div>
      <div className="app-body">
        <div
          className="card"
          style={{ marginBottom: 14, textAlign: "center", padding: 18 }}
        >
          <div className="kicker">field journal</div>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 32,
              fontStyle: "italic",
              marginTop: 6,
              letterSpacing: "-0.01em",
            }}
          >
            {totalCount}
          </div>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 13,
              color: "var(--ink-2)",
              marginTop: 2,
            }}
          >
            {totalCount === 0
              ? "nothing pinned yet"
              : `${totalCount === 1 ? "specimen" : "specimens"} pinned`}
          </div>
          <div className="margin-note" style={{ marginTop: 10, fontSize: 12 }}>
            "Notice a thing, give it a name, pin it here."
          </div>
        </div>

        <Kicker>Categories</Kicker>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginTop: 10,
          }}
        >
          {SCRAP_CATS.map((c) => (
            <CatTile
              key={c.id}
              c={c}
              count={countsByCat.get(c.id) ?? 0}
              onOpen={setOpenCat}
            />
          ))}
          {miscCount > 0 && (
            <CatTile
              c={UNCATEGORISED}
              count={miscCount}
              onOpen={setOpenCat}
            />
          )}
        </div>

        {sortedByRecent.length > 0 && (
          <>
            <hr className="rule-dashed" />
            <Kicker>Recent finds · across categories</Kicker>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 10,
              }}
            >
              {sortedByRecent.slice(0, 4).map((s) => {
                const c = catFor(s.category);
                return (
                  <div
                    key={s.id}
                    onClick={() => setOpenCat(c.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <SpecimenCard s={s} c={c} />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
