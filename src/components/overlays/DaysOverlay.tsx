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

import { useEffect, useMemo, useState } from "react";
import { useMoods, isoDateToday } from "../../lib/useMoods";
import {
  readDailyReportPhoto,
  useAllDailyReports,
  useDailyReport,
} from "../../lib/useDailyReport";
import { useDreams } from "../../lib/useDreams";
import { useMilestones } from "../../lib/useMilestones";
import { useTimeBlocks } from "../../lib/useTimeBlocks";
import { useWeighins } from "../../lib/useWeighins";
import type {
  Dream,
  Milestone,
  MoodEntry,
  RemoteDailyReport,
  TimeBlock,
} from "../../types";
import { Kicker, Pill } from "../shared/primitives";
import { Sparkline } from "../shared/charts";
import { DayClock } from "./life-day";

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
  const [tab, setTab] = useState<"portrait" | "dreams" | "time" | "life">(
    "portrait",
  );
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
          <Pill active={tab === "time"} onClick={() => setTab("time")}>
            time
          </Pill>
          <Pill active={tab === "life"} onClick={() => setTab("life")}>
            life
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
        {tab === "time" && <TimeView />}
        {tab === "life" && <LifeView />}
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

      <ArchiveGallery />
    </>
  );
}

// ─── ArchiveGallery — every past daily report, newest first ─────
//
// Reads from useAllDailyReports (subscribes to the whole
// insight_daily subcollection signed-in; falls back to localStorage
// history signed-out). Filters out today (already rendered above)
// and renders each prior day as a card. Tapping a card opens a
// read-only viewer.

function ArchiveGallery() {
  const { reports } = useAllDailyReports();
  const [openReport, setOpenReport] = useState<RemoteDailyReport | null>(null);
  const todayIso = isoDateToday();
  const past = reports.filter((r) => r.date !== todayIso);

  if (past.length === 0) {
    return (
      <div
        className="card"
        style={{
          padding: 14,
          borderLeft: "3px solid var(--ink-3)",
        }}
      >
        <Kicker>archive · empty</Kicker>
        <div
          className="margin-note"
          style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5 }}
        >
          "Past daily reports show up here once you've written one
          on a day other than today. Photos stay on the device
          they were captured on — only mood, one-line, and weather
          travel between devices."
        </div>
      </div>
    );
  }

  return (
    <>
      <Kicker>archive · {past.length} past {past.length === 1 ? "day" : "days"}</Kicker>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 10,
        }}
      >
        {past.map((r) => (
          <ArchiveCard
            key={r.date}
            report={r}
            onOpen={() => setOpenReport(r)}
          />
        ))}
      </div>
      {openReport && (
        <ArchiveDetail
          report={openReport}
          onClose={() => setOpenReport(null)}
        />
      )}
    </>
  );
}

function ArchiveCard({
  report,
  onOpen,
}: {
  report: RemoteDailyReport;
  onOpen: () => void;
}) {
  // Photo blobs only exist on the device that captured them —
  // readDailyReportPhoto returns null on second devices.
  const photo = readDailyReportPhoto(report.date);
  const score = Math.round(report.mood / 20);
  return (
    <div
      className="card"
      onClick={onOpen}
      style={{
        cursor: "pointer",
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: 12,
        borderLeft: `3px solid ${moodAccent(score)}`,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          flexShrink: 0,
          borderRadius: 6,
          background: photo ? `url(${photo}) center/cover` : "var(--paper-2)",
          border: "0.5px solid var(--rule)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink-3)",
          fontFamily: "var(--mono)",
          fontSize: 9,
        }}
      >
        {!photo && weatherLabel(report.weather).slice(0, 3)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="kicker">{report.date}</div>
        <div
          style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 14,
            marginTop: 2,
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: "var(--ink-2)",
          }}
        >
          {report.one_line ? `"${report.one_line}"` : "(no line written)"}
        </div>
        {report.moodLabel && (
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9.5,
              color: "var(--ink-3)",
              letterSpacing: "0.04em",
              marginTop: 2,
            }}
          >
            {report.moodLabel.toUpperCase()}
          </div>
        )}
      </div>
      <div className="fig-num" style={{ fontSize: 22 }}>
        <em>{score}</em>
        <span
          style={{
            fontSize: 11,
            color: "var(--ink-3)",
            marginLeft: 2,
          }}
        >
          /5
        </span>
      </div>
    </div>
  );
}

function moodAccent(score: number): string {
  if (score >= 4) return "oklch(0.65 0.10 145)";
  if (score >= 3) return "oklch(0.70 0.06 80)";
  return "oklch(0.65 0.10 25)";
}

function ArchiveDetail({
  report,
  onClose,
}: {
  report: RemoteDailyReport;
  onClose: () => void;
}) {
  const photo = readDailyReportPhoto(report.date);
  const score = Math.round(report.mood / 20);
  return (
    <div className="overlay paper-grain" style={{ zIndex: 25 }}>
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ←
        </button>
        <div className="h-title">
          a <em>past day</em>
        </div>
        <div className="h-meta">{report.date}</div>
      </div>
      <div className="app-body">
        {photo && (
          <div
            style={{
              width: "100%",
              aspectRatio: "4 / 3",
              borderRadius: 8,
              background: `url(${photo}) center/cover`,
              marginBottom: 14,
              border: "0.5px solid var(--rule)",
            }}
          />
        )}
        <div className="kicker">
          {report.date} · {weatherLabel(report.weather)}
        </div>
        <div
          style={{
            fontFamily: "var(--serif)",
            fontSize: 22,
            fontStyle: "italic",
            marginTop: 6,
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
          }}
        >
          {report.one_line ? `"${report.one_line}"` : "(no line written)"}
        </div>

        <hr className="rule-dashed" />

        <div style={{ display: "flex", gap: 18 }}>
          <div>
            <div className="kicker">MOOD</div>
            <div className="fig-num" style={{ fontSize: 24 }}>
              <em>{score}</em>
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

        {!photo && (
          <div
            className="margin-note"
            style={{
              marginTop: 16,
              fontSize: 11,
              fontStyle: "italic",
              color: "var(--ink-3)",
            }}
          >
            (any photo from this day stays on the device that captured it
            — never syncs)
          </div>
        )}
      </div>
    </div>
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

// ─── TimeView ───────────────────────────────────────────────────
//
// Logged time-tracking blocks. Different from LifeOverlay's day
// template — these are actual sessions on actual dates, retrievable
// per day. UI: date picker + DayClock of that day's blocks + log
// list + "log a block" form.

const TIME_HUE_PALETTE = [
  { hue: 12, name: "sienna" },
  { hue: 38, name: "ochre" },
  { hue: 145, name: "sage" },
  { hue: 220, name: "blue" },
  { hue: 250, name: "indigo" },
  { hue: 305, name: "plum" },
];

function timeToDecimal(t: string): number | null {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 24 || min < 0 || min > 59) return null;
  return h + min / 60;
}
function decimalToTime(d: number): string {
  const h = Math.floor(d);
  const m = Math.round((d - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function TimeView() {
  const { items: allBlocks, add, remove } = useTimeBlocks();
  const [day, setDay] = useState(isoDateToday());
  const [logging, setLogging] = useState(false);
  const [activeTimer, setActiveTimer] = useActiveTimer();

  const dayBlocks = useMemo(
    () =>
      allBlocks
        .filter((b) => b.date === day)
        .sort((a, b) => a.from - b.from),
    [allBlocks, day],
  );

  const totalHours = dayBlocks.reduce((s, b) => s + (b.to - b.from), 0);

  // Stop the running timer → write a TimeBlock for today and clear
  // local state. If the timer was started before midnight, the
  // block ends at 23:59:59 the start day; we don't span days.
  const stopTimer = async () => {
    if (!activeTimer) return;
    const start = new Date(activeTimer.startedAt);
    const startDay = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    const fromDec = start.getHours() + start.getMinutes() / 60;
    const now = new Date();
    const sameDay =
      now.getFullYear() === start.getFullYear() &&
      now.getMonth() === start.getMonth() &&
      now.getDate() === start.getDate();
    const toDec = sameDay
      ? now.getHours() + now.getMinutes() / 60
      : 23 + 59 / 60;
    if (toDec <= fromDec) {
      // Bail safely on an absurd zero-length save; clear the
      // timer anyway so the user isn't stuck.
      setActiveTimer(null);
      return;
    }
    await add({
      date: startDay,
      from: fromDec,
      to: toDec,
      label: activeTimer.label,
      category: activeTimer.category || undefined,
      hue: activeTimer.hue,
    });
    setActiveTimer(null);
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 14, padding: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <Kicker>day</Kicker>
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            style={{
              flex: 1,
              padding: "6px 10px",
              background: "var(--paper-2)",
              border: "0.5px solid var(--rule)",
              borderRadius: 6,
              fontFamily: "var(--mono)",
              fontSize: 12,
              color: "var(--ink)",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <DayClock blocks={dayBlocks} />
          <div style={{ flex: 1, minWidth: 180 }}>
            <div className="kicker" style={{ marginBottom: 6 }}>
              {totalHours > 0
                ? `${totalHours.toFixed(1)} HOURS LOGGED`
                : "NOTHING LOGGED FOR THIS DAY"}
            </div>
            {dayBlocks.length === 0 ? (
              <div
                className="margin-note"
                style={{ fontSize: 12, fontStyle: "italic" }}
              >
                "Log how the day actually went — what you spent time
                on. The clock fills in around the dial."
              </div>
            ) : (
              dayBlocks.map((b) => (
                <div
                  key={b.id}
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
                      background: `oklch(0.62 0.11 ${b.hue})`,
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
                    {decimalToTime(b.from)} → {decimalToTime(b.to)}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: 12.5,
                      color: "var(--ink-2)",
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {b.label}
                    {b.category && (
                      <span style={{ color: "var(--ink-3)" }}> · {b.category}</span>
                    )}
                  </span>
                  <button
                    onClick={() => {
                      if (confirm(`Remove "${b.label}"?`)) {
                        void remove(b.id);
                      }
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
              ))
            )}
          </div>
        </div>
        <TimerBar
          active={activeTimer}
          onStart={setActiveTimer}
          onStop={() => void stopTimer()}
        />
        {logging ? (
          <LogTimeBlockForm
            day={day}
            onCancel={() => setLogging(false)}
            onSave={async (b) => {
              await add({ ...b, date: day });
              setLogging(false);
            }}
          />
        ) : (
          <button
            onClick={() => setLogging(true)}
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
            + log a block · retroactive
          </button>
        )}
      </div>
    </>
  );
}

function LogTimeBlockForm({
  onCancel,
  onSave,
}: {
  day: string;
  onCancel: () => void;
  onSave: (
    b: Omit<TimeBlock, "id" | "createdAt" | "date">,
  ) => Promise<void> | void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");
  const [hue, setHue] = useState(38);
  const [saving, setSaving] = useState(false);

  const fromDec = timeToDecimal(from);
  const toDec = timeToDecimal(to);
  const canSave =
    fromDec !== null && toDec !== null && toDec > fromDec && label.trim() !== "";

  const submit = async () => {
    if (!canSave || saving || fromDec === null || toDec === null) return;
    setSaving(true);
    try {
      await onSave({
        from: fromDec,
        to: toDec,
        label: label.trim(),
        category: category.trim() || undefined,
        hue,
      });
      setFrom("");
      setTo("");
      setLabel("");
      setCategory("");
    } finally {
      setSaving(false);
    }
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
        marginTop: 10,
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
          placeholder="what you did"
          style={{
            ...inputStyle,
            flex: 1,
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 13,
          }}
        />
      </div>
      <input
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="category · optional (deep work, rest, people…)"
        style={{ ...inputStyle, fontFamily: "var(--serif)", fontSize: 12 }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {TIME_HUE_PALETTE.map((h) => (
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
          disabled={!canSave || saving}
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
          {saving ? "…" : "log"}
        </button>
      </div>
    </div>
  );
}

// ─── LifeView ───────────────────────────────────────────────────
//
// Milestone timeline. A vertical list of dated events the user has
// logged, newest first, each as a row with a coloured dot + date +
// title + optional note + × delete. "Log a milestone" form pinned
// at the top.

const MILESTONE_HUE_PALETTE = [
  { hue: 12, name: "sienna" },
  { hue: 38, name: "ochre" },
  { hue: 145, name: "sage" },
  { hue: 220, name: "blue" },
  { hue: 280, name: "violet" },
  { hue: 305, name: "plum" },
];

function LifeView() {
  const { items, add, remove } = useMilestones();
  const [adding, setAdding] = useState(false);

  const sorted = [...items].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
  );

  return (
    <>
      {adding ? (
        <AddMilestoneForm
          onCancel={() => setAdding(false)}
          onSave={async (m) => {
            await add(m);
            setAdding(false);
          }}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
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
          <span style={{ fontStyle: "italic" }}>+ log a milestone</span>
        </button>
      )}

      {sorted.length > 0 ? (
        <>
          <Kicker>your timeline · newest first</Kicker>
          <div
            style={{
              marginTop: 10,
              position: "relative",
              paddingLeft: 14,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 4,
                top: 4,
                bottom: 4,
                width: 1,
                background: "var(--rule)",
              }}
            />
            {sorted.map((m) => (
              <MilestoneRow
                key={m.id}
                m={m}
                onRemove={() => void remove(m.id)}
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
            "The shape of a life starts to show up once you count it.
            Log your first milestone — a move, a meeting, a beginning."
          </div>
        </div>
      )}
    </>
  );
}

function MilestoneRow({
  m,
  onRemove,
}: {
  m: Milestone;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        position: "relative",
        padding: "8px 0 8px 12px",
        borderBottom: "0.5px dashed var(--rule)",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <span
        style={{
          position: "absolute",
          left: -10,
          top: 11,
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: `oklch(0.62 0.11 ${m.hue})`,
          border: "1px solid var(--paper)",
        }}
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          className="kicker"
          style={{ display: "block", fontSize: 9 }}
        >
          {m.date}
        </span>
        <span
          style={{
            display: "block",
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 14,
            marginTop: 2,
            lineHeight: 1.3,
          }}
        >
          {m.title}
        </span>
        {m.note && (
          <span
            style={{
              display: "block",
              fontFamily: "var(--serif)",
              fontSize: 12,
              color: "var(--ink-3)",
              marginTop: 2,
              lineHeight: 1.4,
            }}
          >
            {m.note}
          </span>
        )}
      </span>
      <button
        onClick={() => {
          if (confirm(`Remove "${m.title}"?`)) onRemove();
        }}
        aria-label="Remove milestone"
        style={{
          background: "transparent",
          border: "none",
          color: "var(--ink-3)",
          cursor: "pointer",
          fontFamily: "var(--mono)",
          fontSize: 12,
          padding: "0 2px",
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

function AddMilestoneForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (m: Omit<Milestone, "id" | "createdAt">) => Promise<void> | void;
}) {
  const [date, setDate] = useState(isoDateToday());
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [hue, setHue] = useState(38);
  const [saving, setSaving] = useState(false);
  const canSave = date.trim() !== "" && title.trim() !== "";

  const submit = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave({
        date,
        title: title.trim(),
        note: note.trim() || undefined,
        hue,
      });
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <div
      className="card"
      style={{
        marginBottom: 14,
        padding: 14,
        background: "var(--paper-2)",
      }}
    >
      <Kicker>log a milestone</Kicker>
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="what happened"
        style={{
          ...inputStyle,
          marginTop: 6,
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 14,
        }}
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="a sentence about why it mattered · optional"
        style={{
          ...inputStyle,
          marginTop: 6,
          fontFamily: "var(--serif)",
          fontSize: 13,
        }}
      />
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          marginTop: 8,
        }}
      >
        {MILESTONE_HUE_PALETTE.map((h) => (
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
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            padding: "8px 10px",
            background: "transparent",
            border: "0.5px solid var(--rule)",
            borderRadius: 999,
            fontFamily: "var(--mono)",
            fontSize: 10,
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
          disabled={!canSave || saving}
          style={{
            flex: 1,
            padding: "8px 10px",
            background: canSave ? "var(--ink)" : "var(--paper-3)",
            color: canSave ? "var(--paper)" : "var(--ink-3)",
            border: "none",
            borderRadius: 999,
            fontFamily: "var(--mono)",
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: canSave ? "pointer" : "default",
          }}
        >
          {saving ? "…" : "log"}
        </button>
      </div>
    </div>
  );
}

// ─── Live timer ─────────────────────────────────────────────────
//
// A "what am I doing right now" stopwatch. Tap start → label +
// optional category + hue → tracking. Tap stop → writes a
// TimeBlock for the start day from start to now (or until 23:59 if
// stop crosses midnight).
//
// Persisted to localStorage so a reload doesn't lose the running
// session. Synced via cross-tab "storage" events so two tabs of
// the same app see the same state.

interface ActiveTimer {
  label: string;
  category: string;
  hue: number;
  startedAt: number; // ms epoch
}

const TIMER_STORAGE = "insight.timer.v1";

function readTimer(): ActiveTimer | null {
  try {
    const raw = localStorage.getItem(TIMER_STORAGE);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveTimer;
  } catch {
    return null;
  }
}

function useActiveTimer(): [
  ActiveTimer | null,
  (t: ActiveTimer | null) => void,
] {
  const [timer, setTimerState] = useState<ActiveTimer | null>(() =>
    readTimer(),
  );

  // Cross-tab sync. When another tab starts/stops a timer, the
  // storage event fires here.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== TIMER_STORAGE) return;
      setTimerState(readTimer());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const set = (next: ActiveTimer | null) => {
    if (next) localStorage.setItem(TIMER_STORAGE, JSON.stringify(next));
    else localStorage.removeItem(TIMER_STORAGE);
    setTimerState(next);
  };
  return [timer, set];
}

// Formats elapsed ms as "12:34" or "1:23:45". Capped at three-digit
// hours — past 999h something is wrong.
function formatElapsed(ms: number): string {
  if (ms < 0) return "0:00";
  const totalS = Math.floor(ms / 1000);
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function TimerBar({
  active,
  onStart,
  onStop,
}: {
  active: ActiveTimer | null;
  onStart: (t: ActiveTimer) => void;
  onStop: () => void;
}) {
  const [starting, setStarting] = useState(false);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");
  const [hue, setHue] = useState(38);
  // Tick "now" once a second while a timer is running so the elapsed
  // counter updates. We store it in state rather than calling
  // Date.now() in render (React's purity rule). The interval is
  // also the initial-state source — first paint shows the elapsed
  // at the moment of the next tick, ≤ 1s after mount.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  if (active) {
    return (
      <div
        style={{
          marginTop: 10,
          padding: 12,
          background: `oklch(0.94 0.04 ${active.hue})`,
          border: `0.5px solid oklch(0.55 0.12 ${active.hue})`,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span
          aria-label="running"
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: `oklch(0.55 0.13 ${active.hue})`,
            flexShrink: 0,
            animation: "pulse 1.6s infinite",
            boxShadow: `0 0 6px oklch(0.55 0.13 ${active.hue})`,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 14,
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {active.label}
            {active.category && (
              <span style={{ color: "var(--ink-3)" }}>
                {" · "}
                {active.category}
              </span>
            )}
          </div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 18,
              color: `oklch(0.30 0.13 ${active.hue})`,
              marginTop: 2,
            }}
          >
            {formatElapsed(now - active.startedAt)}
          </div>
        </div>
        <button
          onClick={onStop}
          style={{
            padding: "8px 14px",
            background: `oklch(0.30 0.13 ${active.hue})`,
            color: "var(--paper)",
            border: "none",
            borderRadius: 999,
            fontFamily: "var(--mono)",
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          ■ stop
        </button>
      </div>
    );
  }

  if (!starting) {
    return (
      <button
        onClick={() => setStarting(true)}
        style={{
          marginTop: 10,
          width: "100%",
          padding: "8px 12px",
          background: "var(--ink)",
          color: "var(--paper)",
          border: "none",
          borderRadius: 999,
          fontFamily: "var(--mono)",
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        ▶ start a timer
      </button>
    );
  }

  const canStart = label.trim().length > 0;
  const start = () => {
    if (!canStart) return;
    onStart({
      label: label.trim(),
      category: category.trim(),
      hue,
      startedAt: Date.now(),
    });
    setStarting(false);
    setLabel("");
    setCategory("");
  };

  return (
    <div
      style={{
        marginTop: 10,
        padding: 10,
        background: "var(--paper-2)",
        border: "0.5px solid var(--rule)",
        borderRadius: 6,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="what you're doing"
        onKeyDown={(e) => {
          if (e.key === "Enter" && canStart) start();
        }}
        style={{
          boxSizing: "border-box",
          padding: "6px 8px",
          background: "var(--paper)",
          border: "0.5px solid var(--rule)",
          borderRadius: 4,
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 14,
          color: "var(--ink)",
        }}
      />
      <input
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="category · optional"
        style={{
          boxSizing: "border-box",
          padding: "6px 8px",
          background: "var(--paper)",
          border: "0.5px solid var(--rule)",
          borderRadius: 4,
          fontFamily: "var(--serif)",
          fontSize: 12,
          color: "var(--ink)",
        }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {TIME_HUE_PALETTE.map((h) => (
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
          onClick={() => {
            setStarting(false);
            setLabel("");
            setCategory("");
          }}
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
          onClick={start}
          disabled={!canStart}
          style={{
            flex: 1,
            padding: "6px 10px",
            background: canStart ? "var(--ink)" : "var(--paper-3)",
            color: canStart ? "var(--paper)" : "var(--ink-3)",
            border: "none",
            borderRadius: 999,
            fontFamily: "var(--mono)",
            fontSize: 9,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: canStart ? "pointer" : "default",
          }}
        >
          ▶ start
        </button>
      </div>
    </div>
  );
}
