// VerdictCard — the standard "ON-DEVICE · ..." card used wherever a
// Gemma-generated one-sentence reflection is shown. Encapsulates the
// four UI states the LLM lifecycle exposes (web / not-ready / downloading /
// ready+generating / ready+result), the day-keyed localStorage cache,
// and the regenerate affordance.
//
// Callers supply:
//   - kicker     — the small uppercase label above the verdict
//   - prompt     — the full prompt to feed Gemma. Caller assembles this
//                  from whatever data is in scope (mood history, meal
//                  log, etc.). VerdictCard never touches IS_DATA.
//   - cacheKey   — a short name (e.g. "nutrition") used to scope the
//                  cached verdict in localStorage to one-per-day-per-tab.
//   - autoStart  — if true, kicks off generation on mount when the
//                  model is ready and no cached verdict exists.

import { useEffect, useRef, useState } from "react";
import { isoDateToday } from "../../lib/useMoods";
import { useLLM } from "../../lib/useLLM";

interface VerdictCardProps {
  kicker: string;
  prompt: string;
  cacheKey: string;
  autoStart?: boolean;
}

// Trim and de-fluff small-model output so the card reads cleanly.
function cleanVerdict(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^(observation|verdict|reflection|insight|note)\s*[:\-—]\s*/i, "");
  // Collapse to first sentence — small models occasionally add a second.
  const firstStop = s.search(/[.!?]\s/);
  if (firstStop !== -1 && firstStop < s.length - 1) {
    s = s.slice(0, firstStop + 1);
  }
  s = s.replace(/^"+|"+$/g, "");
  s = s.replace(/^'+|'+$/g, "");
  return s.trim();
}

const storageKey = (cacheKey: string) =>
  `insight.verdict.${cacheKey}.${isoDateToday()}`;

export function VerdictCard({
  kicker,
  prompt,
  cacheKey,
  autoStart = true,
}: VerdictCardProps) {
  const {
    available,
    ready,
    downloading,
    downloadPct,
    error,
    ensure,
    generate,
  } = useLLM();
  const [verdict, setVerdict] = useState<string | null>(() => {
    try {
      return localStorage.getItem(storageKey(cacheKey));
    } catch {
      return null;
    }
  });
  const [generating, setGenerating] = useState(false);
  // Guard against the autoStart effect firing twice — both due to
  // React StrictMode in dev, and any parent re-render before the
  // first generate finishes.
  const startedRef = useRef(false);

  // Auto-start once: when model is ready, no cached verdict, and
  // autoStart is on. We don't depend on `prompt` so a prompt
  // re-render (e.g. a parent updates its state) doesn't refire.
  useEffect(() => {
    if (!autoStart) return;
    if (!available || !ready) return;
    if (verdict) return;
    if (startedRef.current) return;
    startedRef.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, available, ready, verdict]);

  const run = async () => {
    setGenerating(true);
    try {
      if (!ready) await ensure();
      const text = await generate(prompt);
      const cleaned = cleanVerdict(text);
      setVerdict(cleaned);
      try {
        localStorage.setItem(storageKey(cacheKey), cleaned);
      } catch {
        // Quota errors etc. — verdict still shows for this session.
      }
    } catch (err) {
      console.error(`[VerdictCard:${cacheKey}] generation failed:`, err);
    } finally {
      setGenerating(false);
    }
  };

  const regenerate = () => {
    setVerdict(null);
    startedRef.current = true;
    void run();
  };

  return (
    <div
      className="card"
      style={{
        marginTop: 14,
        borderLeft: "3px solid var(--accent)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <div className="kicker">ON-DEVICE · {kicker}</div>
        {available && ready && !generating && verdict && (
          <span
            onClick={regenerate}
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              letterSpacing: "0.1em",
              color: "var(--ink-3)",
              cursor: "pointer",
            }}
          >
            ↻ AGAIN
          </span>
        )}
      </div>

      {verdict && !generating && (
        <div
          style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 17,
            lineHeight: 1.4,
            marginTop: 8,
            color: "var(--ink)",
          }}
        >
          "{verdict}"
        </div>
      )}

      {generating && (
        <div
          style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 14,
            color: "var(--ink-3)",
            marginTop: 8,
          }}
        >
          looking at the pattern…
        </div>
      )}

      {!available && (
        <div className="margin-note" style={{ marginTop: 8, fontSize: 12 }}>
          On-device reflections only work in the iOS / Android app.
          Open it there to see this redrawn.
        </div>
      )}

      {available && !ready && !downloading && !verdict && !generating && (
        <div style={{ marginTop: 10 }}>
          <div className="margin-note" style={{ fontSize: 12, marginBottom: 10 }}>
            Reflections run entirely on your phone — nothing leaves the
            device. The first time uses ~2 GB (Gemma 4 E2B on-device);
            after that it's instant and offline.
          </div>
          <button
            type="button"
            onClick={() => void ensure()}
            style={{
              padding: "8px 14px",
              background: "var(--ink)",
              color: "var(--paper)",
              border: "none",
              borderRadius: 99,
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: "0.12em",
              cursor: "pointer",
            }}
          >
            ↓ DOWNLOAD AI · ~2 GB
          </button>
        </div>
      )}

      {downloading && (
        <div style={{ marginTop: 10 }}>
          <div className="kicker">DOWNLOADING · {downloadPct}%</div>
          <div
            style={{
              height: 4,
              background: "var(--paper-3)",
              borderRadius: 999,
              overflow: "hidden",
              marginTop: 6,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${downloadPct}%`,
                background: "var(--accent)",
                transition: "width 0.2s",
              }}
            />
          </div>
          <div className="margin-note" style={{ fontSize: 11, marginTop: 6 }}>
            WiFi is faster. You can close this; the download continues
            in the background.
          </div>
        </div>
      )}

      {error && !generating && !verdict && (
        <div
          className="margin-note"
          style={{
            fontSize: 11,
            color: "oklch(0.55 0.16 12)",
            marginTop: 8,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
