// DaysOverlay — your daily ledger. Two views:
//
// "portrait" — today's frame from useDailyReport (mood / weather /
//   one-line / optional photo), a 12-day mood strip from useMoods,
//   and a 30-day weight sparkline from useWeighins. The previous
//   version asserted a 12-frame photo gallery built from
//   IS_DATA.portraits; the photo archive needs per-day daily-report
//   storage (currently the "today" doc is overwritten each edit) so
//   that one's still pending.
//
// "dreams" — real dream journal wired to useDreams. Add an entry,
//   read it back, delete it. The "recurring themes" bar list
//   derives from tag frequencies across logged dreams; "remembered
//   this week" + "lucid" + "avg vividness" derive from the same.

import { useMemo, useState } from "react";
import { useMoods, isoDateToday } from "../../lib/useMoods";
import { useDailyReport } from "../../lib/useDailyReport";
import { useDreams } from "../../lib/useDreams";
import { useWeighins } from "../../lib/useWeighins";
import type { Dream, MoodEntry } from "../../types";
import { Kicker, Pill } from "../shared/primitives";
import { Sparkline } from "../shared/charts";

function weatherLabel(w: string | undefined): string {
  if (!w) return "—";
  const map: Record<string, string> = {
    sun: "CLEAR",
    rain: "RAIN",
    cloud: "OVERCAST",
    snow: "SNOW",
  };
  return map[w] || w.toUpperCase();
}

// Last 12 ISO date strings (oldest → newest) so the mood strip
// reads left-to-right time order. Re-implemented locally so we
// don't add another import; this is two-liner math.
function lastTwelveDates(): string[] {
  const out: string[] = [];
  const t = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(t);
    d.setDate(t.getDate() - i);
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  }
  return out;
}

function displayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  return `${months[m - 1]} ${d}`;
}

interface DaysOverlayProps {
  onClose: () => void;
}

export function DaysOverlay({ onClose }: DaysOverlayProps) {
  const [tab, setTab] = useState<"portrait" | "dreams">("portrait");
  const [openDream, setOpenDream] = useState<Dream | null>(null);
  const [adding, setAdding] = useState(false);
  const { items: dreams, add: addDream, remove: removeDream } = useDreams();

  return (
    <div className="overlay paper-grain">
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ←
        </button>
        <div className="h-title">
          the <em>days</em>
        </div>
        <div className="h-meta">
          {dreams.length}
          <br />
          {dreams.length === 1 ? "dream" : "dreams"}
        </div>
      </div>
      <div className="app-body">
        <div className="margin-note" style={{ marginBottom: 12, fontSize: 13 }}>
          a private ledger — what the day looked like, what it felt like.
        </div>

        <div
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 14,
          }}
        >
          <Pill active={tab === "portrait"} onClick={() => setTab("portrait")}>
            portrait
          </Pill>
          <Pill active={tab === "dreams"} onClick={() => setTab("dreams")}>
            dreams
          </Pill>
        </div>

        {tab === "portrait" && <PortraitView />}
        {tab === "dreams" && (
          <DreamsView
            dreams={dreams}
            onOpen={setOpenDream}
            onRemove={(id) => void removeDream(id)}
            onAdd={() => setAdding(true)}
          />
        )}
      </div>

      {openDream && (
        <DreamDetail
          d={openDream}
          onClose={() => setOpenDream(null)}
          onRemove={() => {
            const id = openDream.id;
            setOpenDream(null);
            void removeDream(id);
          }}
        />
      )}
      {adding && (
        <AddDreamFlow
          onClose={() => setAdding(false)}
          onSave={async (d) => {
            await addDream(d);
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

// ─── PortraitView ───────────────────────────────────────────────

function PortraitView() {
  const { report } = useDailyReport();
  const { moods } = useMoods();
  const { items: weighins } = useWeighins();

  // Twelve-day mood strip — real entries land where they belong,
  // unlogged days draw a faint baseline so the chart never invents
  // a value.
  const window = useMemo(() => {
    const dates = lastTwelveDates();
    const byDate = new Map<string, MoodEntry>();
    for (const m of moods) byDate.set(m.date, m);
    return dates.map((d) => ({ date: d, mood: byDate.get(d) }));
  }, [moods]);
  const todayIso = isoDateToday();

  // Weight history for the sparkline. We plot only logged entries
  // (no fake interpolation) and show min / median / max underneath.
  // Sorted oldest → newest so the line reads left-to-right in time
  // order.
  const weightSeries = useMemo(() => {
    if (weighins.length === 0) return null;
    const sorted = [...weighins].sort((a, b) => a.date.localeCompare(b.date));
    const values = sorted.map((w) => w.kg);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const median =
      values.length === 1
        ? values[0]
        : [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
    return { values, min, max, median, latest: sorted[sorted.length - 1] };
  }, [weighins]);

  return (
    <>
      {report ? (
        <div
          className="card"
          style={{ marginBottom: 14, padding: 16 }}
        >
          <div className="kicker">
            TODAY · {weatherLabel(report.weather)}
          </div>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 22,
              fontStyle: "italic",
              marginTop: 4,
              lineHeight: 1.3,
            }}
          >
            {report.one_line
              ? `"${report.one_line}"`
              : "no line written yet."}
          </div>
          <div style={{ display: "flex", gap: 18, marginTop: 14 }}>
            <div>
              <div className="kicker">MOOD</div>
              <div className="fig-num" style={{ fontSize: 22 }}>
                <em>{Math.round(report.mood / 20)}</em>
                <span
                  style={{
                    fontSize: 11,
                    marginLeft: 3,
                    color: "var(--ink-3)",
                  }}
                >
                  /5
                </span>
              </div>
            </div>
            {report.moodLabel && (
              <div>
                <div className="kicker">FEELING</div>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 16,
                    marginTop: 4,
                  }}
                >
                  {report.moodLabel}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          className="card"
          style={{ marginBottom: 14, padding: 22, textAlign: "center" }}
        >
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 36,
              fontStyle: "italic",
              color: "var(--ink-3)",
            }}
          >
            ◌
          </div>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 16,
              marginTop: 6,
            }}
          >
            no report yet today.
          </div>
          <div className="margin-note" style={{ marginTop: 8, fontSize: 12 }}>
            "Tap '◉ daily report' on the floating + menu — a line, a
            mood, a weather pick."
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 14, padding: 14 }}>
        <Kicker>Mood · twelve days</Kicker>
        <div
          style={{
            display: "flex",
            gap: 4,
            alignItems: "flex-end",
            height: 80,
            marginTop: 12,
          }}
        >
          {window.map((w, i) => {
            const m = w.mood;
            const h = m ? m.score * 14 : 4;
            const isToday = w.date === todayIso;
            return (
              <div
                key={i}
                style={{ flex: 1, textAlign: "center" }}
                title={
                  m
                    ? `${w.date} · ${m.score}/5${m.note ? ` — ${m.note}` : ""}`
                    : `${w.date} · no entry`
                }
              >
                <div
                  style={{
                    height: h,
                    background: m
                      ? m.score >= 4
                        ? "oklch(0.65 0.10 145)"
                        : m.score >= 3
                          ? "oklch(0.70 0.06 80)"
                          : "oklch(0.65 0.10 25)"
                      : "var(--rule)",
                    opacity: m ? 0.85 : 0.5,
                    borderRadius: 2,
                    outline: isToday && m ? "1px solid var(--ink)" : undefined,
                  }}
                />
              </div>
            );
          })}
        </div>
        {moods.length === 0 && (
          <div
            className="margin-note"
            style={{ marginTop: 10, fontSize: 12, fontStyle: "italic" }}
          >
            Log a daily report to start the strip.
          </div>
        )}
      </div>

      {weightSeries && (
        <div className="card" style={{ marginBottom: 14, padding: 14 }}>
          <Kicker>Weight · {weighins.length} weigh-ins</Kicker>
          <div style={{ marginTop: 8 }}>
            <Sparkline
              data={weightSeries.values}
              w={320}
              h={60}
              color="var(--sienna)"
              fill
              dots
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--ink-3)",
              letterSpacing: "0.06em",
              marginTop: 4,
            }}
          >
            <span>{weightSeries.min.toFixed(1)} kg</span>
            <span>median {weightSeries.median.toFixed(1)} kg</span>
            <span>{weightSeries.max.toFixed(1)} kg</span>
          </div>
          <div
            className="margin-note"
            style={{ marginTop: 8, fontSize: 11, fontStyle: "italic" }}
          >
            latest: {weightSeries.latest.kg} kg on {weightSeries.latest.date}
            {" · log new entries from your portrait → vital stats"}
          </div>
        </div>
      )}

      <div
        className="card"
        style={{
          padding: 14,
          borderLeft: "3px solid var(--ink-3)",
        }}
      >
        <Kicker>archive · not built</Kicker>
        <div
          className="margin-note"
          style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5 }}
        >
          "A scrolling gallery of past frames lives here once daily
          reports get per-day storage. Right now each new report
          overwrites the last one — you can read yesterday's mood
          on the strip above, but the photo and one-line only stick
          around for the day they're written."
        </div>
      </div>
    </>
  );
}

// ─── DreamsView ─────────────────────────────────────────────────

function DreamsView({
  dreams,
  onOpen,
  onRemove,
  onAdd,
}: {
  dreams: Dream[];
  onOpen: (d: Dream) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  // Last-7-day window for the "remembered" + "lucid" counters so
  // the stats reflect recent activity rather than all-time totals.
  const sevenAgo = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const todayIso = isoDateToday();
  const recent = dreams.filter((d) => d.date >= sevenAgo && d.date <= todayIso);
  const remembered = recent.length;
  const lucid = recent.filter((d) => d.lucidity >= 3).length;
  const avgViv = recent.length
    ? (recent.reduce((s, d) => s + d.vividness, 0) / recent.length).toFixed(1)
    : "—";

  // Tag frequency across all-time dreams — the "recurring themes"
  // panel. Top 6 by count.
  const themeEntries = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of dreams) {
      for (const t of d.tags) {
        const key = t.trim().toLowerCase();
        if (!key) continue;
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [dreams]);
  const maxTheme = themeEntries.length
    ? Math.max(...themeEntries.map(([, v]) => v))
    : 1;

  const sorted = [...dreams].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <div
        className="card"
        style={{
          marginBottom: 14,
          display: "flex",
          justifyContent: "space-between",
          textAlign: "center",
          padding: 14,
        }}
      >
        <div>
          <div className="fig-num" style={{ fontSize: 28 }}>
            <em>{remembered}</em>
            <span style={{ fontSize: 13, color: "var(--ink-3)" }}>/7</span>
          </div>
          <div className="kicker">REMEMBERED</div>
        </div>
        <div>
          <div className="fig-num" style={{ fontSize: 28 }}>
            <em>{lucid}</em>
          </div>
          <div className="kicker">LUCID · 7D</div>
        </div>
        <div>
          <div className="fig-num" style={{ fontSize: 28 }}>
            <em>{avgViv}</em>
          </div>
          <div className="kicker">AVG VIVIDNESS</div>
        </div>
      </div>

      {themeEntries.length > 0 && (
        <div className="card" style={{ marginBottom: 14, padding: 14 }}>
          <Kicker>Recurring · the threads you've tagged</Kicker>
          <div
            style={{
              marginTop: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {themeEntries.map(([k, v]) => (
              <div
                key={k}
                style={{ display: "flex", alignItems: "center", gap: 10 }}
              >
                <span
                  style={{
                    width: 90,
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 13,
                  }}
                >
                  {k}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 6,
                    background: "var(--paper-2)",
                    border: "0.5px solid var(--rule)",
                    borderRadius: 99,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${(v / maxTheme) * 100}%`,
                      height: "100%",
                      background: "var(--indigo)",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 9,
                    color: "var(--ink-3)",
                    width: 16,
                    textAlign: "right",
                  }}
                >
                  {v}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onAdd}
        style={{
          width: "100%",
          padding: "14px",
          background: "var(--ink)",
          color: "var(--paper)",
          border: "none",
          borderRadius: 14,
          fontFamily: "var(--serif)",
          fontSize: 15,
          marginBottom: 14,
          cursor: "pointer",
        }}
      >
        <span style={{ fontStyle: "italic" }}>+ log a dream</span>
      </button>

      {sorted.length > 0 ? (
        <>
          <Kicker>your journal · most recent first</Kicker>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 10,
            }}
          >
            {sorted.map((d) => (
              <DreamRow
                key={d.id}
                d={d}
                onClick={() => onOpen(d)}
                onRemove={() => onRemove(d.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="card" style={{ padding: 22, textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 36,
              fontStyle: "italic",
              color: "var(--ink-3)",
            }}
          >
            ◌
          </div>
          <div className="margin-note" style={{ marginTop: 10, fontSize: 13 }}>
            "Log your first dream — a title, the shape of what you
            remember, a few tags. The recurring threads emerge as
            you go."
          </div>
        </div>
      )}
    </>
  );
}

function DreamRow({
  d,
  onClick,
  onRemove,
}: {
  d: Dream;
  onClick: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="card"
      style={{
        cursor: "pointer",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: 12,
        borderLeft: "3px solid var(--indigo)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="kicker">{displayDate(d.date)}</div>
        <div
          style={{
            fontFamily: "var(--serif)",
            fontSize: 15,
            marginTop: 2,
            fontStyle: "italic",
          }}
        >
          {d.title || "untitled"}
        </div>
        {d.text && (
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 12.5,
              color: "var(--ink-2)",
              marginTop: 4,
              lineHeight: 1.4,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {d.text}
          </div>
        )}
        {d.tags.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              marginTop: 6,
            }}
          >
            {d.tags.map((t, i) => (
              <span
                key={i}
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 8.5,
                  letterSpacing: "0.06em",
                  padding: "2px 6px",
                  borderRadius: 999,
                  border: "0.5px solid var(--rule)",
                  background: "var(--paper-2)",
                  color: "var(--ink-3)",
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 9,
            color: "var(--ink-3)",
            letterSpacing: "0.06em",
          }}
        >
          V {d.vividness}/5
        </div>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 9,
            color: "var(--ink-3)",
            letterSpacing: "0.06em",
            marginTop: 2,
          }}
        >
          L {d.lucidity}/5
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`Remove "${d.title || "this dream"}"?`)) onRemove();
        }}
        aria-label="Remove dream"
        style={{
          background: "transparent",
          border: "none",
          color: "var(--ink-3)",
          cursor: "pointer",
          fontFamily: "var(--mono)",
          fontSize: 14,
          padding: "0 4px",
        }}
      >
        ×
      </button>
    </div>
  );
}

// ─── DreamDetail — full-screen read view ────────────────────────

function DreamDetail({
  d,
  onClose,
  onRemove,
}: {
  d: Dream;
  onClose: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="overlay paper-grain" style={{ zIndex: 25 }}>
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ←
        </button>
        <div className="h-title">
          a <em>dream</em>
        </div>
        <div className="h-meta">{displayDate(d.date)}</div>
      </div>
      <div className="app-body">
        <Kicker>{displayDate(d.date)}{d.mood ? ` · ${d.mood}` : ""}</Kicker>
        <div
          style={{
            fontFamily: "var(--serif)",
            fontSize: 26,
            fontStyle: "italic",
            marginTop: 6,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
          }}
        >
          {d.title || "untitled"}
        </div>

        <hr className="rule-dashed" />

        <div
          style={{
            fontFamily: "var(--serif)",
            fontSize: 15,
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {d.text || (
            <span
              style={{ color: "var(--ink-3)", fontStyle: "italic" }}
            >
              no longhand body recorded.
            </span>
          )}
        </div>

        <hr className="rule-dashed" />

        <div style={{ display: "flex", gap: 24 }}>
          <div>
            <div className="kicker">VIVIDNESS</div>
            <div className="fig-num" style={{ fontSize: 22 }}>
              <em>{d.vividness}</em>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--ink-3)",
                  marginLeft: 3,
                }}
              >
                /5
              </span>
            </div>
          </div>
          <div>
            <div className="kicker">LUCIDITY</div>
            <div className="fig-num" style={{ fontSize: 22 }}>
              <em>{d.lucidity}</em>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--ink-3)",
                  marginLeft: 3,
                }}
              >
                /5
              </span>
            </div>
          </div>
        </div>

        {d.tags.length > 0 && (
          <>
            <hr className="rule-dashed" />
            <Kicker>tags</Kicker>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 5,
                marginTop: 8,
              }}
            >
              {d.tags.map((t, i) => (
                <span
                  key={i}
                  style={{
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 13,
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "0.5px solid var(--rule)",
                    background: "var(--paper-2)",
                    color: "var(--ink-2)",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </>
        )}

        <hr className="rule-dashed" />
        <button
          onClick={() => {
            if (confirm(`Remove "${d.title || "this dream"}"?`)) onRemove();
          }}
          style={{
            width: "100%",
            padding: "12px",
            background: "transparent",
            color: "var(--ink-3)",
            border: "0.5px dashed var(--rule)",
            borderRadius: 999,
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          remove this entry
        </button>
      </div>
    </div>
  );
}

// ─── AddDreamFlow ───────────────────────────────────────────────

function AddDreamFlow({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (d: Omit<Dream, "id" | "createdAt">) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [mood, setMood] = useState("");
  const [vividness, setVividness] = useState(3);
  const [lucidity, setLucidity] = useState(0);
  const [saving, setSaving] = useState(false);

  const canSave = title.trim().length > 0 || text.trim().length > 0;

  const submit = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const tags = tagsRaw
        .split(/[,\n]/)
        .map((t) => t.trim())
        .filter(Boolean);
      await onSave({
        date: isoDateToday(),
        title: title.trim(),
        text: text.trim(),
        tags,
        mood: mood.trim() || undefined,
        vividness,
        lucidity,
      });
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    background: "var(--paper-2)",
    border: "0.5px solid var(--rule)",
    borderRadius: 6,
    fontFamily: "var(--serif)",
    fontStyle: "italic",
    fontSize: 15,
    color: "var(--ink)",
  };

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
          log a dream
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
          <Kicker>title</Kicker>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="a short name for the dream"
            style={{ ...inputStyle, marginTop: 6 }}
          />

          <div style={{ marginTop: 14 }}>
            <Kicker>what you remember</Kicker>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder="the shape of it — fragments are fine"
              style={{
                ...inputStyle,
                marginTop: 6,
                fontSize: 14,
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <Kicker>tags · comma separated</Kicker>
            <input
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="water, home, flying"
              style={{ ...inputStyle, marginTop: 6, fontSize: 13 }}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <Kicker>mood · one word</Kicker>
            <input
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              placeholder="uneasy, warm, restless…"
              style={{ ...inputStyle, marginTop: 6, fontSize: 13 }}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <Kicker>vividness · {vividness}/5</Kicker>
            <input
              type="range"
              min="0"
              max="5"
              value={vividness}
              onChange={(e) => setVividness(+e.target.value)}
              style={{ width: "100%", accentColor: "var(--indigo)" }}
            />
          </div>

          <div style={{ marginTop: 6 }}>
            <Kicker>lucidity · {lucidity}/5</Kicker>
            <input
              type="range"
              min="0"
              max="5"
              value={lucidity}
              onChange={(e) => setLucidity(+e.target.value)}
              style={{ width: "100%", accentColor: "var(--indigo)" }}
            />
          </div>

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
              onClick={submit}
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
