// RatingRidge — a 1..k ordinal distribution as a small ridge of columns:
// the Map card's mmt-ridge figure (map-bottom-card.jsx) in component
// form, so the daily's result, the who-voted sheet and the Map keep
// drawing the same shape for the same kind of number.
//
// Born for D305: a ten-step rating rendered as ten stacked option rows
// filled more than a screen, on the answer card and again on every sheet
// that redrew it. A rating's reading is a POSITION on a scale plus a
// spread around it — one figure, not ten rows.
//
// Pure presentation: counts in, columns out. The caller owns the headline
// (the average, "you said 7") — this draws the spread and marks yours.

export default function RatingRidge({ counts, mine = -1, color = "var(--accent, var(--ink))", height = 56 }: {
  /** Dense per-step counts, index 0 = the scale's 1. */
  counts: readonly number[];
  /** The viewer's own step, 0-based, or -1. */
  mine?: number;
  /** The hue the columns fill with — the card's topic, usually. */
  color?: string;
  height?: number;
}) {
  const max = Math.max(1, ...counts);
  const total = counts.reduce((a, b) => a + b, 0);
  const mode = counts.reduce((m, c, i) => (c > counts[m] ? i : m), 0);
  return (
    <div>
      <div
        // The figure in one sentence for a reader who cannot see it; the
        // columns themselves are decoration over these numbers.
        role="img"
        aria-label={
          `Spread across ${counts.length} steps` +
          (mine >= 0 ? `, you at ${mine + 1}` : "") +
          (total && mode !== mine ? `, most at ${mode + 1}` : "")
        }
        style={{ display: "flex", alignItems: "flex-end", gap: 3, height }}
      >
        {counts.map((c, i) => (
          <span key={i} title={`${i + 1}: ${c}`} style={{ flex: 1, display: "flex", alignItems: "flex-end", height: "100%" }}>
            <span style={{
              width: "100%",
              // A floor rather than zero-height: an empty step still shows
              // its place on the scale, the way the Map's ridge does.
              height: `${total ? Math.max(7, (c / max) * 100) : 7}%`,
              borderRadius: 4,
              background: i === mine
                ? color
                : `color-mix(in oklch, ${color} ${c ? 34 : 12}%, var(--surface-3))`,
              boxShadow: i === mine ? "0 0 0 1.5px var(--ink)" : "none",
            }}></span>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)" }}>
        <span>1</span>
        {total > 0 && mode !== mine && <span>most chose {mode + 1}</span>}
        <span>{counts.length}</span>
      </div>
    </div>
  );
}
