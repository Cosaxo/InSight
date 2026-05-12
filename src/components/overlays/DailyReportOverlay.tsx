import { useRef, useState } from "react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { IS_DATA } from "../../data/seedData";
import { useDailyReport } from "../../lib/useDailyReport";
import {
  dailyMoodToScore,
  isoDateToday,
  useMoods,
} from "../../lib/useMoods";
import { VerdictCard } from "../shared/VerdictCard";

// Open a native camera/photo picker when running inside Capacitor;
// otherwise click the hidden <input type="file"> so the browser shows
// the OS file picker. The result is the same in both paths: a data:
// URL the caller can stash in localStorage.
async function pickPhoto(
  inputRef: React.RefObject<HTMLInputElement | null>,
  onPick: (v: string) => void,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    inputRef.current?.click();
    return;
  }
  try {
    const photo = await Camera.getPhoto({
      // Let the OS choose between camera and library so the user picks
      // their flow. On the journal aesthetic, photos from the library
      // make as much sense as fresh captures.
      source: CameraSource.Prompt,
      resultType: CameraResultType.DataUrl,
      quality: 80,
      allowEditing: false,
      // Daily-report photo card is square-ish; downsize to keep
      // localStorage cheap.
      width: 1200,
      promptLabelHeader: "today's photo",
      promptLabelPicture: "take a photo",
      promptLabelPhoto: "from photos",
      promptLabelCancel: "cancel",
    });
    if (photo.dataUrl) onPick(photo.dataUrl);
  } catch (err) {
    // User cancelled the OS picker — silent. Anything else, log and
    // fall back to the web input so the feature still works.
    const msg = err instanceof Error ? err.message : String(err);
    if (!/cancel/i.test(msg)) {
      console.error("[DailyReport] native camera failed:", err);
      inputRef.current?.click();
    }
  }
}

const STORAGE = "insight.dailyReport.v1";
const PHOTO_STORAGE = "insight.dailyReport.photo.v1";

const MOOD_LABELS: { lo: number; hi: number; label: string }[] = [
  { lo: 0, hi: 19, label: "sunken" },
  { lo: 20, hi: 34, label: "heavy" },
  { lo: 35, hi: 49, label: "scattered" },
  { lo: 50, hi: 64, label: "even-keel" },
  { lo: 65, hi: 79, label: "lifted" },
  { lo: 80, hi: 100, label: "luminous" },
];
const labelFor = (m: number) =>
  MOOD_LABELS.find((x) => m >= x.lo && m <= x.hi)?.label || "even-keel";

const QUICK_WEATHER = [
  "fog · 6°",
  "crisp · 4°",
  "rain · 9°",
  "sun · 14°",
  "wind · 11°",
];

interface PhotoStock {
  id: string;
  bg: string;
  caption: string;
}
const PHOTO_STOCK: PhotoStock[] = [
  {
    id: "fjord",
    bg: "linear-gradient(160deg, oklch(0.78 0.06 220), oklch(0.55 0.10 245) 60%, oklch(0.34 0.08 260))",
    caption: "fjord light · morning",
  },
  {
    id: "kitchen",
    bg: "linear-gradient(180deg, oklch(0.86 0.06 60), oklch(0.72 0.09 40) 50%, oklch(0.46 0.10 30))",
    caption: "kitchen table · noon",
  },
  {
    id: "forest",
    bg: "linear-gradient(170deg, oklch(0.74 0.09 145), oklch(0.50 0.11 155) 55%, oklch(0.30 0.08 165))",
    caption: "walk in Nordmarka",
  },
  {
    id: "window",
    bg: "linear-gradient(200deg, oklch(0.92 0.03 80), oklch(0.78 0.05 60) 50%, oklch(0.58 0.07 50))",
    caption: "rain on the window",
  },
];

interface DailyReportData {
  personId: "me";
  date: "today";
  mood: number;
  moodLabel: string;
  one_line: string;
  weather: string;
  body?: AutoStats["body"];
  move?: AutoStats["move"];
  nutrition?: AutoStats["nutrition"];
  scrapbook?: AutoStats["scrapbook"];
  hasPhoto: boolean;
  photo?: string;
  shared: string[];
}

interface StoredDaily {
  mood?: number;
  one_line?: string;
  weather?: string;
  shared?: string[];
}

function loadStored(): StoredDaily | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || "null");
  } catch {
    return null;
  }
}
function loadPhoto(): string | null {
  return localStorage.getItem(PHOTO_STORAGE) || null;
}

interface AutoStats {
  body: {
    hr: number;
    hrRest: number;
    hrv: number;
    sleep: number;
    sleepScore: number;
    battery: number;
    readiness: number;
    stress: number;
  } | null;
  move: {
    steps?: number;
    stepsTarget?: number;
    workout?: {
      type: string;
      dur?: string;
      dist?: string;
      hrAvg?: number;
      hue?: number;
    };
    cals?: number;
  };
  nutrition: {
    kcal: number;
    kcalTarget: number;
    water: number;
    waterTarget: number;
    topMeal?: string;
  } | null;
  scrapbook: {
    name: string;
    latin?: string;
    loc?: string;
    cat: string;
    hue: number;
    conf: number;
  }[];
}

function getTodaysAutoStats(): AutoStats {
  const D = IS_DATA;
  const body = D.body?.today || {};
  const nutr = D.insights?.nutrition || D.nutrition || {};
  const fitn = D.insights?.fitness || D.fitness || {};
  const workouts = D.body?.workouts || [];
  const todayWorkout = workouts[workouts.length - 1] || null;

  return {
    body: body.hr
      ? {
          hr: body.hr,
          hrRest: body.hrRest,
          hrv: body.hrv,
          sleep: body.sleep?.hours,
          sleepScore: body.sleep?.score,
          battery: body.bodyBattery,
          readiness: body.readiness,
          stress: body.stress,
        }
      : null,
    move: {
      steps: body.steps || fitn.steps,
      stepsTarget: body.stepsTarget || fitn.target,
      workout: todayWorkout,
      cals: body.calsActive,
    },
    nutrition: nutr.kcal
      ? {
          kcal: nutr.kcal,
          kcalTarget: nutr.target,
          water: nutr.water,
          waterTarget: nutr.target_water,
        }
      : null,
    scrapbook: [],
  };
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <span
      onClick={onClick}
      role="switch"
      aria-checked={on}
      style={{
        width: 28,
        height: 16,
        borderRadius: 999,
        position: "relative",
        background: on ? "var(--accent)" : "var(--paper-3)",
        border: "0.5px solid var(--rule)",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background 0.15s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 1,
          left: on ? 13 : 1,
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: "var(--paper)",
          transition: "left 0.15s",
          boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
        }}
      />
    </span>
  );
}

function SectionHead({
  label,
  on,
  onToggle,
  hint,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  hint?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 8,
      }}
    >
      <span className="kicker" style={{ margin: 0 }}>
        {label}
      </span>
      <span
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        {hint && (
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 8,
              color: "var(--ink-3)",
              letterSpacing: "0.08em",
            }}
          >
            {hint}
          </span>
        )}
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 8.5,
            color: "var(--ink-3)",
            letterSpacing: "0.08em",
          }}
        >
          SHARE
        </span>
        <Toggle on={on} onClick={onToggle} />
      </span>
    </div>
  );
}

function Chips({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <>
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "8px 10px",
          background: "var(--paper-2)",
          border: "0.5px solid var(--rule)",
          borderRadius: 6,
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 13,
          color: "var(--ink)",
        }}
      />
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}
      >
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            style={{
              padding: "3px 9px",
              borderRadius: 999,
              cursor: "pointer",
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 11.5,
              background: value === o ? "var(--ink)" : "var(--paper-2)",
              color: value === o ? "var(--paper)" : "var(--ink-3)",
              border: "0.5px solid var(--rule)",
            }}
          >
            {o}
          </button>
        ))}
      </div>
    </>
  );
}

function Stat({
  value,
  unit,
  label,
  hue = 38,
}: {
  value: string | number;
  unit?: string;
  label: string;
  hue?: number;
}) {
  return (
    <div
      style={{
        padding: 10,
        background: "var(--paper)",
        border: "0.5px solid var(--rule)",
        borderRadius: 6,
        borderLeft: `3px solid oklch(0.55 0.13 ${hue})`,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span className="fig-num" style={{ fontSize: 22, lineHeight: 1 }}>
          <em>{value}</em>
        </span>
        {unit && (
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--ink-3)",
              letterSpacing: "0.06em",
            }}
          >
            {unit}
          </span>
        )}
      </div>
      <div className="kicker" style={{ marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

function PhotoSlot({
  photo,
  onPick,
}: {
  photo: string | null;
  onPick: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  if (photo) {
    const stock = PHOTO_STOCK.find((p) => p.id === photo);
    return (
      <div
        onClick={() => void pickPhoto(inputRef, onPick)}
        style={{
          position: "relative",
          height: 180,
          borderRadius: 8,
          overflow: "hidden",
          cursor: "pointer",
          border: "0.5px solid var(--rule)",
          background: stock
            ? stock.bg
            : `url(${photo}) center/cover no-repeat`,
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "20px 14px 12px",
            background: "linear-gradient(0deg, rgba(0,0,0,0.45), transparent)",
            color: "rgba(255,255,255,0.92)",
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 14,
          }}
        >
          {stock?.caption || "today"}
        </div>
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            fontFamily: "var(--mono)",
            fontSize: 8.5,
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.86)",
            background: "rgba(0,0,0,0.32)",
            padding: "3px 7px",
            borderRadius: 3,
          }}
        >
          TAP TO CHANGE
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              const r = new FileReader();
              r.onload = () => onPick(String(r.result));
              r.readAsDataURL(f);
            }
          }}
        />
      </div>
    );
  }
  return (
    <div>
      <div
        onClick={() => void pickPhoto(inputRef, onPick)}
        style={{
          height: 96,
          borderRadius: 8,
          cursor: "pointer",
          border: "0.5px dashed var(--accent)",
          background: "color-mix(in oklch, var(--accent) 6%, var(--paper))",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        <span
          style={{
            fontFamily: "var(--serif)",
            fontSize: 22,
            color: "var(--accent)",
          }}
        >
          ◉
        </span>
        <span
          style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 13,
            color: "var(--accent)",
          }}
        >
          add the photo of the day
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            const r = new FileReader();
            r.onload = () => onPick(String(r.result));
            r.readAsDataURL(f);
          }
        }}
      />
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        {PHOTO_STOCK.map((p) => (
          <div
            key={p.id}
            onClick={() => onPick(p.id)}
            title={p.caption}
            style={{
              flex: 1,
              height: 40,
              borderRadius: 4,
              cursor: "pointer",
              background: p.bg,
              border: "0.5px solid var(--rule)",
            }}
          />
        ))}
      </div>
      <div className="kicker" style={{ marginTop: 4, textAlign: "center" }}>
        OR PICK ONE OF THE PAINTED SKIES
      </div>
    </div>
  );
}

interface DailyReportOverlayProps {
  onClose: () => void;
  onSaved?: (data: DailyReportData) => void;
}

export function DailyReportOverlay({
  onClose,
  onSaved,
}: DailyReportOverlayProps) {
  const existing = loadStored();
  const auto = getTodaysAutoStats();
  const { save: saveDaily } = useDailyReport();
  const { moods: priorMoods, upsert: upsertMoodEntry } = useMoods();

  const [photo, setPhoto] = useState<string | null>(loadPhoto());
  const [mood, setMood] = useState<number>(existing?.mood ?? 62);
  const [oneLine, setOneLine] = useState<string>(existing?.one_line ?? "");
  const [weather, setWeather] = useState<string>(existing?.weather ?? "");

  const defaultShare: Record<string, boolean> = {
    photo: true,
    mood: true,
    one_line: true,
    body: true,
    movement: true,
    nutrition: true,
    scrapbook: true,
    weather: true,
  };
  const [share, setShare] = useState<Record<string, boolean>>(
    existing?.shared
      ? {
          ...defaultShare,
          ...Object.fromEntries(
            Object.keys(defaultShare).map((k) => [k, existing.shared!.includes(k)]),
          ),
        }
      : defaultShare,
  );
  const [savedFlash, setSavedFlash] = useState(false);

  const toggleShare = (k: string) =>
    setShare((s) => ({ ...s, [k]: !s[k] }));

  // Build the prompt that lets Gemma observe a pattern instead of just
  // narrating the day. Computed every render — VerdictCard captures it
  // on mount (and again on regenerate) so re-renders here are cheap.
  const recent = priorMoods
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);
  const recentLines = recent
    .map((m) => `${m.date}: mood ${m.score}/5${m.note ? ` — "${m.note}"` : ""}`)
    .join("\n");
  const todayScore = dailyMoodToScore(mood);
  const verdictPrompt = [
    "You are a quiet journal companion. The user has just logged today's daily report.",
    "Look at the recent pattern, then write ONE short sentence (under 18 words) noticing something — a shape, a contrast, a thread — without giving advice or being cheerful. Be honest, observational, slightly literary.",
    "",
    `Today (${isoDateToday()}): mood ${todayScore}/5${oneLine ? ` — "${oneLine}"` : ""}`,
    recentLines ? `Recent days:\n${recentLines}` : "",
    "",
    "Your one-sentence observation:",
  ]
    .filter(Boolean)
    .join("\n");

  const save = async () => {
    const shared = Object.keys(share).filter((k) => share[k]);
    const data: DailyReportData = {
      personId: "me",
      date: "today",
      mood,
      moodLabel: labelFor(mood),
      one_line: oneLine,
      weather,
      body: auto.body,
      move: auto.move,
      nutrition: auto.nutrition,
      scrapbook: auto.scrapbook,
      hasPhoto: !!photo,
      shared,
    };
    // Route through useDailyReport — writes localStorage always, plus
    // Firestore when signed in. Photo stays local; we record whether
    // one exists + the stock key (if it's a preset) for sync.
    const isStockPhoto =
      photo != null &&
      PHOTO_STOCK.some((p) => p.id === photo);
    await saveDaily({
      date: "today",
      mood,
      moodLabel: labelFor(mood),
      one_line: oneLine,
      weather,
      hasPhoto: !!photo,
      photoId: isStockPhoto ? photo! : undefined,
      shared,
      photo,
    });
    // Also record today's mood as a MoodEntry so the Insights mood
    // charts have real history to draw. The slider is 0..100; the
    // MoodEntry schema is 1..5.
    await upsertMoodEntry({
      date: isoDateToday(),
      score: dailyMoodToScore(mood),
      note: oneLine || undefined,
    });
    setSavedFlash(true);

    if (onSaved) onSaved(data);
  };

  const sharedCount = Object.values(share).filter(Boolean).length;
  const totalFields = Object.keys(share).length;

  return (
    <div className="overlay paper-grain">
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ✕
        </button>
        <div className="h-title">
          your <em>daily</em>
        </div>
        <div className="h-meta">
          today
          <br />
          {new Date()
            .toLocaleDateString("en", { month: "short", day: "numeric" })
            .toLowerCase()}
        </div>
      </div>

      <div className="app-body">
        <div
          className="margin-note"
          style={{ fontSize: 12, marginBottom: 12 }}
        >
          "One place to log it. Everything you've already tracked today is
          here — turn off whatever you don't want to share."
        </div>

        <div className="card" style={{ padding: 14 }}>
          <SectionHead
            label="photo of the day"
            on={share.photo}
            onToggle={() => toggleShare("photo")}
          />
          <PhotoSlot photo={photo} onPick={setPhoto} />
          {photo && (
            <button
              onClick={() => setPhoto(null)}
              style={{
                marginTop: 8,
                padding: "4px 10px",
                background: "transparent",
                border: "0.5px solid var(--rule)",
                borderRadius: 999,
                fontFamily: "var(--mono)",
                fontSize: 8.5,
                letterSpacing: "0.1em",
                color: "var(--ink-3)",
                cursor: "pointer",
              }}
            >
              REMOVE
            </button>
          )}
        </div>

        <div className="card" style={{ padding: 14, marginTop: 10 }}>
          <SectionHead
            label="how do you feel"
            on={share.mood}
            onToggle={() => toggleShare("mood")}
          />
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div className="fig-num" style={{ fontSize: 44, lineHeight: 1 }}>
              <em>{mood}</em>
            </div>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 16,
                color: "var(--accent)",
              }}
            >
              {labelFor(mood)}
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={mood}
            onChange={(e) => setMood(+e.target.value)}
            style={{
              width: "100%",
              marginTop: 8,
              accentColor: "var(--accent)",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: "var(--mono)",
              fontSize: 8.5,
              color: "var(--ink-3)",
              letterSpacing: "0.06em",
            }}
          >
            <span>sunken</span>
            <span>even</span>
            <span>luminous</span>
          </div>
        </div>

        <div className="card" style={{ padding: 14, marginTop: 10 }}>
          <SectionHead
            label="a line · what kind of day"
            on={share.one_line}
            onToggle={() => toggleShare("one_line")}
          />
          <textarea
            value={oneLine}
            onChange={(e) => setOneLine(e.target.value)}
            rows={2}
            placeholder="one sentence is enough"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "8px 10px",
              resize: "none",
              background: "var(--paper-2)",
              border: "0.5px solid var(--rule)",
              borderRadius: 6,
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 13,
              color: "var(--ink)",
            }}
          />
        </div>

        <div className="card" style={{ padding: 14, marginTop: 10 }}>
          <SectionHead
            label="weather · today's sky"
            on={share.weather}
            onToggle={() => toggleShare("weather")}
          />
          <Chips
            value={weather}
            onChange={setWeather}
            options={QUICK_WEATHER}
            placeholder="rain · 9° · grey"
          />
        </div>

        {auto.body && (
          <div className="card" style={{ padding: 14, marginTop: 10 }}>
            <SectionHead
              label="body · today"
              on={share.body}
              onToggle={() => toggleShare("body")}
              hint="FROM GARMIN"
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 6,
              }}
            >
              <Stat value={auto.body.hr} unit="bpm" label="resting" hue={12} />
              <Stat value={auto.body.hrv} unit="ms" label="hrv" hue={145} />
              <Stat
                value={auto.body.sleepScore}
                unit="/100"
                label="sleep"
                hue={220}
              />
              <Stat
                value={auto.body.battery}
                unit="%"
                label="battery"
                hue={38}
              />
              <Stat
                value={auto.body.readiness}
                unit="/100"
                label="ready"
                hue={250}
              />
              <Stat
                value={auto.body.stress}
                unit=""
                label="stress"
                hue={60}
              />
            </div>
            <div
              style={{
                marginTop: 8,
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 12,
                color: "var(--ink-3)",
              }}
            >
              slept {auto.body.sleep}h · last sync 12 min ago
            </div>
          </div>
        )}

        {auto.move.steps && (
          <div className="card" style={{ padding: 14, marginTop: 10 }}>
            <SectionHead
              label="movement · today"
              on={share.movement}
              onToggle={() => toggleShare("movement")}
              hint="FROM YOUR WATCH"
            />
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <div
                className="fig-num"
                style={{ fontSize: 30, lineHeight: 1 }}
              >
                <em>{auto.move.steps?.toLocaleString()}</em>
              </div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  color: "var(--ink-3)",
                  letterSpacing: "0.06em",
                }}
              >
                STEPS ·{" "}
                {Math.round(
                  ((auto.move.steps ?? 0) / (auto.move.stepsTarget ?? 1)) * 100,
                )}
                % OF {auto.move.stepsTarget?.toLocaleString()}
              </div>
            </div>
            <div
              style={{
                height: 6,
                background: "var(--paper-3)",
                borderRadius: 999,
                overflow: "hidden",
                border: "0.5px solid var(--rule)",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, ((auto.move.steps ?? 0) / (auto.move.stepsTarget ?? 1)) * 100)}%`,
                  background: "oklch(0.62 0.11 38)",
                }}
              />
            </div>
          </div>
        )}

        {auto.nutrition && (
          <div className="card" style={{ padding: 14, marginTop: 10 }}>
            <SectionHead
              label="nutrition · today"
              on={share.nutrition}
              onToggle={() => toggleShare("nutrition")}
              hint="FROM YOUR MEAL LOG"
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 6,
              }}
            >
              <Stat
                value={auto.nutrition.kcal?.toLocaleString()}
                unit={`/ ${auto.nutrition.kcalTarget}`}
                label="kcal"
                hue={38}
              />
              <Stat
                value={auto.nutrition.water}
                unit={`/ ${auto.nutrition.waterTarget} glasses`}
                label="water"
                hue={220}
              />
            </div>
          </div>
        )}

        {/* On-device verdict — only rendered once the user has saved.
            VerdictCard handles the download / generating / result /
            regenerate states and caches the verdict per-day. */}
        {savedFlash && (
          <VerdictCard
            kicker="YOUR PORTRAIT, REDRAWN"
            cacheKey="daily-report"
            prompt={verdictPrompt}
          />
        )}

        <hr className="rule-dashed" />
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 9,
            letterSpacing: "0.08em",
            color: "var(--ink-3)",
            textAlign: "center",
            marginBottom: 10,
          }}
        >
          {sharedCount} OF {totalFields} FIELDS WILL BE SHARED
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: 12,
              background: "var(--paper-2)",
              border: "0.5px solid var(--rule)",
              borderRadius: 999,
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {savedFlash ? "close" : "cancel"}
          </button>
          <button
            onClick={save}
            style={{
              flex: 2,
              padding: 12,
              background: savedFlash ? "var(--accent)" : "var(--ink)",
              color: "var(--paper)",
              border: "none",
              borderRadius: 999,
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {savedFlash ? "saved." : "post to your circle"}
          </button>
        </div>

      </div>
    </div>
  );
}
