// life-ledger.tsx — the five-card "the ledger" section that lives
// in LifeOverlay's age tab. Each card aggregates one of the
// life-history hooks (useBooks / useVisits / useHomes / useLanguages
// / useJobs) into:
//
//   - a count + headline summary line, always visible
//   - an expandable body with the recent entries (× delete) and a
//     small inline add form
//
// The shared LedgerCard component handles the toggle + frame; the
// per-entity wrappers wire it up with their own row renderer,
// form, and summary text.

import { useMemo, useState, type ReactNode } from "react";
import { Kicker } from "../shared/primitives";
import { useBooks, useHomes, useJobs, useLanguages, useVisits } from "../../lib/useLedger";
import type { Book, Home, Job, Language, Visit } from "../../types";

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  background: "var(--paper-2)",
  border: "0.5px solid var(--rule)",
  borderRadius: 6,
  fontFamily: "var(--mono)",
  fontSize: 13,
  color: "var(--ink)",
};

const serifInputStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: "var(--serif)",
  fontStyle: "italic",
  fontSize: 14,
};

// ── Shared frame ────────────────────────────────────────────────

function LedgerCard({
  glyph,
  label,
  count,
  summary,
  hue,
  children,
  onAdd,
}: {
  glyph: string;
  label: string;
  count: number;
  summary?: string;
  hue: number;
  children?: ReactNode;
  onAdd: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="card"
      style={{ padding: 0, borderLeft: `3px solid oklch(0.55 0.12 ${hue})` }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "transparent",
          border: "none",
          padding: "12px 14px",
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: "var(--ink)",
        }}
      >
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: `oklch(0.93 0.05 ${hue})`,
            border: `0.5px solid oklch(0.55 0.12 ${hue})`,
            color: `oklch(0.30 0.13 ${hue})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--serif)",
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          {glyph}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
            }}
          >
            <span className="fig-num" style={{ fontSize: 22 }}>
              <em>{count}</em>
            </span>
            <span className="kicker">{label}</span>
          </span>
          {summary && (
            <span
              style={{
                display: "block",
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 12,
                color: "var(--ink-3)",
                marginTop: 2,
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {summary}
            </span>
          )}
        </span>
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            color: "var(--ink-3)",
          }}
        >
          {open ? "↑" : "↓"}
        </span>
      </button>
      {open && (
        <div
          style={{
            padding: "0 14px 12px",
            borderTop: "0.5px dashed var(--rule)",
            paddingTop: 10,
          }}
        >
          {children}
          <button
            type="button"
            onClick={onAdd}
            style={{
              marginTop: 8,
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
            + add
          </button>
        </div>
      )}
    </div>
  );
}

function DeleteX({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={() => {
        if (confirm(`Remove ${label}?`)) onClick();
      }}
      aria-label={`Remove ${label}`}
      style={{
        background: "transparent",
        border: "none",
        color: "var(--ink-3)",
        cursor: "pointer",
        fontFamily: "var(--mono)",
        fontSize: 12,
        padding: "0 2px",
      }}
    >
      ×
    </button>
  );
}

// Modal frame matching the other AddXFlow forms — full-screen
// dark backdrop, paper card centred inside.
function FormModal({
  title,
  onClose,
  onSubmit,
  canSave,
  saving,
  children,
}: {
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  canSave: boolean;
  saving: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(20,18,14,0.92)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="app-header"
        style={{
          background: "transparent",
          borderBottom: "0.5px solid rgba(255,255,255,0.15)",
        }}
      >
        <button
          className="avatar-btn"
          onClick={onClose}
          style={{
            color: "white",
            borderColor: "rgba(255,255,255,0.3)",
          }}
        >
          ✕
        </button>
        <div className="h-title" style={{ color: "white" }}>
          {title}
        </div>
        <div style={{ width: 36 }} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
        <div
          style={{
            background: "var(--paper)",
            borderRadius: 8,
            padding: 16,
            color: "var(--ink)",
          }}
        >
          {children}
          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: "12px",
                background: "var(--paper-2)",
                border: "0.5px solid var(--rule)",
                borderRadius: 999,
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={!canSave || saving}
              style={{
                flex: 1,
                padding: "12px",
                background: canSave ? "var(--ink)" : "var(--paper-3)",
                color: canSave ? "var(--paper)" : "var(--ink-3)",
                border: "none",
                borderRadius: 999,
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 14,
                cursor: canSave ? "pointer" : "default",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "saving…" : "save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div className="kicker" style={{ marginTop: 12, marginBottom: 4 }}>
      {children}
    </div>
  );
}

// Compact log-list row used inside the expanded card body.
function LogRow({
  primary,
  secondary,
  trailing,
  onRemove,
  label,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  trailing?: ReactNode;
  onRemove: () => void;
  label: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 8,
        padding: "5px 0",
        borderBottom: "0.5px dashed var(--rule)",
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: "var(--serif)",
          fontSize: 13,
        }}
      >
        {primary}
        {secondary && (
          <span
            style={{
              display: "block",
              fontFamily: "var(--mono)",
              fontSize: 9.5,
              color: "var(--ink-3)",
              letterSpacing: "0.04em",
              marginTop: 1,
            }}
          >
            {secondary}
          </span>
        )}
      </span>
      {trailing && (
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            color: "var(--ink-3)",
          }}
        >
          {trailing}
        </span>
      )}
      <DeleteX onClick={onRemove} label={label} />
    </div>
  );
}

// ── Books ───────────────────────────────────────────────────────

function BooksCard() {
  const { items, add, remove } = useBooks();
  const [adding, setAdding] = useState(false);
  const sorted = [...items].sort((a, b) => {
    const aDate = a.date ?? "";
    const bDate = b.date ?? "";
    return bDate.localeCompare(aDate) || b.createdAt - a.createdAt;
  });
  const recent = sorted.slice(0, 5);
  const last = recent[0];
  const ratings = items.filter((b) => typeof b.rating === "number");
  const avgRating = ratings.length
    ? (
        ratings.reduce((s, b) => s + (b.rating ?? 0), 0) / ratings.length
      ).toFixed(1)
    : null;
  const thisYearCount = items.filter(
    (b) => b.date && b.date.startsWith(String(new Date().getFullYear())),
  ).length;

  const summary = last
    ? `latest: ${last.title}${avgRating ? ` · avg ${avgRating}★` : ""}${thisYearCount ? ` · ${thisYearCount} this year` : ""}`
    : "log a book you've finished — title, optional author, finish date";

  return (
    <>
      <LedgerCard
        glyph="📖"
        label="BOOKS"
        count={items.length}
        summary={summary}
        hue={38}
        onAdd={() => setAdding(true)}
      >
        {recent.length > 0 ? (
          recent.map((b) => (
            <LogRow
              key={b.id}
              primary={
                <>
                  {b.title}
                  {b.author && (
                    <span style={{ color: "var(--ink-3)" }}> · {b.author}</span>
                  )}
                </>
              }
              secondary={
                [b.date, b.rating ? `${b.rating}★` : null]
                  .filter(Boolean)
                  .join(" · ") || undefined
              }
              onRemove={() => void remove(b.id)}
              label={`"${b.title}"`}
            />
          ))
        ) : (
          <div
            className="margin-note"
            style={{ fontSize: 11, fontStyle: "italic" }}
          >
            empty.
          </div>
        )}
      </LedgerCard>
      {adding && (
        <BookForm
          onClose={() => setAdding(false)}
          onSave={async (b) => {
            await add(b);
            setAdding(false);
          }}
        />
      )}
    </>
  );
}

function BookForm({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (b: Omit<Book, "id" | "createdAt">) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [date, setDate] = useState("");
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const canSave = title.trim().length > 0;

  const submit = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        author: author.trim() || undefined,
        date: date.trim() || undefined,
        rating: rating > 0 ? rating : undefined,
        note: note.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      title="log a book"
      onClose={onClose}
      onSubmit={submit}
      canSave={canSave}
      saving={saving}
    >
      <Kicker>title</Kicker>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="what was it called?"
        style={{ ...serifInputStyle, marginTop: 6 }}
      />
      <FieldLabel>author</FieldLabel>
      <input
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="who wrote it"
        style={serifInputStyle}
      />
      <FieldLabel>date finished · optional</FieldLabel>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        style={inputStyle}
      />
      <FieldLabel>rating · {rating > 0 ? `${rating}/5 ★` : "none"}</FieldLabel>
      <div style={{ display: "flex", gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(rating === n ? 0 : n)}
            style={{
              flex: 1,
              padding: "6px 0",
              background: rating >= n ? "var(--accent)" : "var(--paper-2)",
              color: rating >= n ? "var(--paper)" : "var(--ink-3)",
              border: "0.5px solid var(--rule)",
              borderRadius: 4,
              fontFamily: "var(--mono)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            ★
          </button>
        ))}
      </div>
      <FieldLabel>note · optional</FieldLabel>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="what stayed with you"
        style={serifInputStyle}
      />
    </FormModal>
  );
}

// ── Visits ──────────────────────────────────────────────────────

function VisitsCard() {
  const { items, add, remove } = useVisits();
  const [adding, setAdding] = useState(false);
  const sorted = [...items].sort(
    (a, b) => b.start.localeCompare(a.start) || b.createdAt - a.createdAt,
  );
  const recent = sorted.slice(0, 5);
  const countries = useMemo(() => {
    const set = new Set<string>();
    items.forEach((v) => set.add(v.country.toLowerCase()));
    return set.size;
  }, [items]);
  const last = recent[0];
  const summary = last
    ? `latest: ${last.city ? `${last.city}, ` : ""}${last.country} · ${countries} ${countries === 1 ? "country" : "countries"}`
    : "log a trip — country, optional city, dates";

  return (
    <>
      <LedgerCard
        glyph="✦"
        label="VISITS"
        count={items.length}
        summary={summary}
        hue={220}
        onAdd={() => setAdding(true)}
      >
        {recent.length > 0 ? (
          recent.map((v) => (
            <LogRow
              key={v.id}
              primary={
                <>
                  {v.city ? `${v.city}, ` : ""}
                  {v.country}
                </>
              }
              secondary={
                v.end ? `${v.start} → ${v.end}` : v.start
              }
              onRemove={() => void remove(v.id)}
              label={`${v.city || v.country}`}
            />
          ))
        ) : (
          <div
            className="margin-note"
            style={{ fontSize: 11, fontStyle: "italic" }}
          >
            empty.
          </div>
        )}
      </LedgerCard>
      {adding && (
        <VisitForm
          onClose={() => setAdding(false)}
          onSave={async (v) => {
            await add(v);
            setAdding(false);
          }}
        />
      )}
    </>
  );
}

function VisitForm({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (v: Omit<Visit, "id" | "createdAt">) => Promise<void>;
}) {
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const canSave = country.trim().length > 0 && start.trim().length > 0;

  const submit = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave({
        country: country.trim(),
        city: city.trim() || undefined,
        start: start,
        end: end || undefined,
        note: note.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      title="log a trip"
      onClose={onClose}
      onSubmit={submit}
      canSave={canSave}
      saving={saving}
    >
      <Kicker>country</Kicker>
      <input
        value={country}
        onChange={(e) => setCountry(e.target.value)}
        placeholder="e.g. Japan, Norway, Portugal"
        style={{ ...serifInputStyle, marginTop: 6 }}
      />
      <FieldLabel>city · optional</FieldLabel>
      <input
        value={city}
        onChange={(e) => setCity(e.target.value)}
        placeholder="Tokyo, Oslo, Lisbon"
        style={serifInputStyle}
      />
      <FieldLabel>start</FieldLabel>
      <input
        type="date"
        value={start}
        onChange={(e) => setStart(e.target.value)}
        style={inputStyle}
      />
      <FieldLabel>end · optional</FieldLabel>
      <input
        type="date"
        value={end}
        onChange={(e) => setEnd(e.target.value)}
        style={inputStyle}
      />
      <FieldLabel>note · optional</FieldLabel>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="what you remember"
        style={serifInputStyle}
      />
    </FormModal>
  );
}

// ── Homes ───────────────────────────────────────────────────────

function HomesCard() {
  const { items, add, remove } = useHomes();
  const [adding, setAdding] = useState(false);
  const sorted = [...items].sort((a, b) => b.startYear - a.startYear);
  const current = items.find((h) => h.endYear === undefined);
  const summary = current
    ? `currently: ${current.place}`
    : items.length > 0
      ? `most recent: ${sorted[0].place}`
      : "where have you lived?";

  return (
    <>
      <LedgerCard
        glyph="⌂"
        label="HOMES"
        count={items.length}
        summary={summary}
        hue={12}
        onAdd={() => setAdding(true)}
      >
        {sorted.length > 0 ? (
          sorted.map((h) => (
            <LogRow
              key={h.id}
              primary={h.place}
              secondary={
                h.endYear === undefined
                  ? `${h.startYear} → now`
                  : `${h.startYear} → ${h.endYear}`
              }
              onRemove={() => void remove(h.id)}
              label={h.place}
            />
          ))
        ) : (
          <div
            className="margin-note"
            style={{ fontSize: 11, fontStyle: "italic" }}
          >
            empty.
          </div>
        )}
      </LedgerCard>
      {adding && (
        <HomeForm
          onClose={() => setAdding(false)}
          onSave={async (h) => {
            await add(h);
            setAdding(false);
          }}
        />
      )}
    </>
  );
}

function HomeForm({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (h: Omit<Home, "id" | "createdAt">) => Promise<void>;
}) {
  const [place, setPlace] = useState("");
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const sy = Number(startYear);
  const ey = Number(endYear);
  const canSave =
    place.trim().length > 0 &&
    Number.isInteger(sy) &&
    sy >= 1900 &&
    sy <= new Date().getFullYear();

  const submit = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave({
        place: place.trim(),
        startYear: sy,
        endYear:
          endYear.trim() === ""
            ? undefined
            : Number.isInteger(ey) && ey >= sy && ey <= new Date().getFullYear() + 1
              ? ey
              : undefined,
        note: note.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      title="log a home"
      onClose={onClose}
      onSubmit={submit}
      canSave={canSave}
      saving={saving}
    >
      <Kicker>place</Kicker>
      <input
        value={place}
        onChange={(e) => setPlace(e.target.value)}
        placeholder="city or neighbourhood"
        style={{ ...serifInputStyle, marginTop: 6 }}
      />
      <FieldLabel>start year</FieldLabel>
      <input
        type="number"
        inputMode="numeric"
        min="1900"
        max={new Date().getFullYear()}
        value={startYear}
        onChange={(e) => setStartYear(e.target.value)}
        placeholder="e.g. 2018"
        style={inputStyle}
      />
      <FieldLabel>end year · empty if still living there</FieldLabel>
      <input
        type="number"
        inputMode="numeric"
        min="1900"
        max={new Date().getFullYear() + 1}
        value={endYear}
        onChange={(e) => setEndYear(e.target.value)}
        placeholder="e.g. 2024"
        style={inputStyle}
      />
      <FieldLabel>note · optional</FieldLabel>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="what it was like"
        style={serifInputStyle}
      />
    </FormModal>
  );
}

// ── Languages ───────────────────────────────────────────────────

const PROFICIENCY_LABELS = [
  "—",
  "a few words",
  "travel basics",
  "conversational",
  "fluent",
  "native",
];

function LanguagesCard() {
  const { items, add, remove } = useLanguages();
  const [adding, setAdding] = useState(false);
  const sorted = [...items].sort((a, b) => b.proficiency - a.proficiency);
  const top = sorted[0];
  const summary = top
    ? `best: ${top.name} · ${PROFICIENCY_LABELS[top.proficiency]}`
    : "what languages do you speak?";

  return (
    <>
      <LedgerCard
        glyph="abc"
        label="LANGUAGES"
        count={items.length}
        summary={summary}
        hue={145}
        onAdd={() => setAdding(true)}
      >
        {sorted.length > 0 ? (
          sorted.map((l) => (
            <LogRow
              key={l.id}
              primary={l.name}
              secondary={PROFICIENCY_LABELS[l.proficiency]}
              trailing={`${"●".repeat(l.proficiency)}${"○".repeat(5 - l.proficiency)}`}
              onRemove={() => void remove(l.id)}
              label={l.name}
            />
          ))
        ) : (
          <div
            className="margin-note"
            style={{ fontSize: 11, fontStyle: "italic" }}
          >
            empty.
          </div>
        )}
      </LedgerCard>
      {adding && (
        <LanguageForm
          onClose={() => setAdding(false)}
          onSave={async (l) => {
            await add(l);
            setAdding(false);
          }}
        />
      )}
    </>
  );
}

function LanguageForm({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (l: Omit<Language, "id" | "createdAt">) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [proficiency, setProficiency] = useState(3);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const canSave = name.trim().length > 0;

  const submit = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        proficiency,
        note: note.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      title="log a language"
      onClose={onClose}
      onSubmit={submit}
      canSave={canSave}
      saving={saving}
    >
      <Kicker>language</Kicker>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Norwegian, French, Mandarin…"
        style={{ ...serifInputStyle, marginTop: 6 }}
      />
      <FieldLabel>
        proficiency · {PROFICIENCY_LABELS[proficiency]}
      </FieldLabel>
      <input
        type="range"
        min="1"
        max="5"
        value={proficiency}
        onChange={(e) => setProficiency(+e.target.value)}
        style={{ width: "100%", accentColor: "var(--accent)" }}
      />
      <FieldLabel>note · optional</FieldLabel>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="how you learned it, where you use it"
        style={serifInputStyle}
      />
    </FormModal>
  );
}

// ── Jobs ────────────────────────────────────────────────────────

function JobsCard() {
  const { items, add, remove } = useJobs();
  const [adding, setAdding] = useState(false);
  const sorted = [...items].sort(
    (a, b) => b.start.localeCompare(a.start) || b.createdAt - a.createdAt,
  );
  const current = items.find((j) => !j.end);
  const summary = current
    ? `currently: ${current.role}${current.org ? ` · ${current.org}` : ""}`
    : items.length > 0
      ? `most recent: ${sorted[0].role}`
      : "what work have you done?";

  return (
    <>
      <LedgerCard
        glyph="◆"
        label="JOBS"
        count={items.length}
        summary={summary}
        hue={250}
        onAdd={() => setAdding(true)}
      >
        {sorted.length > 0 ? (
          sorted.map((j) => (
            <LogRow
              key={j.id}
              primary={
                <>
                  {j.role}
                  {j.org && (
                    <span style={{ color: "var(--ink-3)" }}> · {j.org}</span>
                  )}
                </>
              }
              secondary={j.end ? `${j.start} → ${j.end}` : `${j.start} → now`}
              onRemove={() => void remove(j.id)}
              label={j.role}
            />
          ))
        ) : (
          <div
            className="margin-note"
            style={{ fontSize: 11, fontStyle: "italic" }}
          >
            empty.
          </div>
        )}
      </LedgerCard>
      {adding && (
        <JobForm
          onClose={() => setAdding(false)}
          onSave={async (j) => {
            await add(j);
            setAdding(false);
          }}
        />
      )}
    </>
  );
}

function JobForm({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (j: Omit<Job, "id" | "createdAt">) => Promise<void>;
}) {
  const [role, setRole] = useState("");
  const [org, setOrg] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const canSave = role.trim().length > 0 && start.trim().length > 0;

  const submit = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave({
        role: role.trim(),
        org: org.trim() || undefined,
        start,
        end: end || undefined,
        note: note.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      title="log a job"
      onClose={onClose}
      onSubmit={submit}
      canSave={canSave}
      saving={saving}
    >
      <Kicker>role / title</Kicker>
      <input
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="what you did"
        style={{ ...serifInputStyle, marginTop: 6 }}
      />
      <FieldLabel>organisation · optional</FieldLabel>
      <input
        value={org}
        onChange={(e) => setOrg(e.target.value)}
        placeholder="employer, project, freelance, etc."
        style={serifInputStyle}
      />
      <FieldLabel>start</FieldLabel>
      <input
        type="date"
        value={start}
        onChange={(e) => setStart(e.target.value)}
        style={inputStyle}
      />
      <FieldLabel>end · empty if still there</FieldLabel>
      <input
        type="date"
        value={end}
        onChange={(e) => setEnd(e.target.value)}
        style={inputStyle}
      />
      <FieldLabel>note · optional</FieldLabel>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="what it meant"
        style={serifInputStyle}
      />
    </FormModal>
  );
}

// ── Public composite ────────────────────────────────────────────

export function TheLedgerSection() {
  return (
    <>
      <Kicker>the ledger · what you've gathered</Kicker>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginTop: 10,
        }}
      >
        <BooksCard />
        <VisitsCard />
        <HomesCard />
        <LanguagesCard />
        <JobsCard />
      </div>
    </>
  );
}
