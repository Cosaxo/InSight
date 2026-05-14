// life-rivers.tsx — the "rivers · what keeps running through" section
// in LifeOverlay's rhythms tab. Reborn as a real, stacked-area
// summary of the streams that flow through the user's data.
//
// Each river is one of the live data streams (workouts / books /
// visits / weighins / moods / dreams). We bucket by year, normalise
// each stream against its own peak, and stack the resulting curves.
// A stream renders only when it has at least two years with data —
// less than that, a "river" isn't yet a river.

import { useMemo } from "react";
import { Kicker } from "../shared/primitives";
import { useBooks, useVisits } from "../../lib/useLedger";
import { useWorkouts } from "../../lib/useWorkouts";
import { useWeighins } from "../../lib/useWeighins";
import { useMoods } from "../../lib/useMoods";
import { useDreams } from "../../lib/useDreams";

interface River {
  k: string;
  label: string;
  hue: number;
  values: number[]; // length = years.length, each 0..1
}

function yearOf(iso: string | undefined): number | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})/);
  return m ? Number(m[1]) : null;
}

function normalise(counts: number[]): number[] {
  const max = Math.max(...counts);
  if (max <= 0) return counts.map(() => 0);
  return counts.map((c) => c / max);
}

export function LifeRiversSection() {
  const { items: workouts } = useWorkouts();
  const { items: books } = useBooks();
  const { items: visits } = useVisits();
  const { items: weighins } = useWeighins();
  const { moods } = useMoods();
  const { items: dreams } = useDreams();

  const rivers = useMemo<{ rivers: River[]; years: number[] }>(() => {
    // Pool all event years to find the timeline span.
    const allYears: number[] = [];
    const collect = (year: number | null) => {
      if (year !== null && year > 1900 && year < 2200) allYears.push(year);
    };
    workouts.forEach((w) => collect(yearOf(w.date)));
    books.forEach((b) => collect(yearOf(b.date)));
    visits.forEach((v) => collect(yearOf(v.start)));
    weighins.forEach((w) => collect(yearOf(w.date)));
    moods.forEach((m) => collect(yearOf(m.date)));
    dreams.forEach((d) => collect(yearOf(d.date)));

    if (allYears.length === 0) {
      return { rivers: [], years: [] };
    }
    const minY = Math.min(...allYears);
    const maxY = Math.max(...allYears, new Date().getFullYear());
    const years = Array.from(
      { length: maxY - minY + 1 },
      (_, i) => minY + i,
    );

    // Build a "counts by year" series for each stream, then keep only
    // streams that have data in at least two years.
    const buildSeries = (
      iterable: { date?: string | undefined }[],
      datePicker: (item: { date?: string | undefined }) => string | undefined,
    ): number[] => {
      const counts = new Array(years.length).fill(0);
      iterable.forEach((item) => {
        const y = yearOf(datePicker(item));
        if (y === null) return;
        const idx = years.indexOf(y);
        if (idx >= 0) counts[idx] += 1;
      });
      return counts;
    };

    const streams: River[] = [];
    const pushIf = (river: River) => {
      const yearsWithData = river.values.filter((v) => v > 0).length;
      if (yearsWithData >= 2) streams.push(river);
    };

    // 1. Moving (workouts)
    const moving = buildSeries(
      workouts as { date?: string | undefined }[],
      (w) => w.date,
    );
    pushIf({
      k: "moving",
      label: "moving",
      hue: 12,
      values: normalise(moving),
    });

    // 2. Reading (books — date is when finished)
    const reading = buildSeries(
      books as { date?: string | undefined }[],
      (b) => b.date,
    );
    pushIf({
      k: "reading",
      label: "reading",
      hue: 145,
      values: normalise(reading),
    });

    // 3. Travel (visits — count by trip start year)
    const travel = buildSeries(
      visits.map((v) => ({ date: v.start })),
      (v) => v.date,
    );
    pushIf({
      k: "travel",
      label: "travel",
      hue: 220,
      values: normalise(travel),
    });

    // 4. Tending (weigh-ins — taking note of yourself)
    const tending = buildSeries(
      weighins as { date?: string | undefined }[],
      (w) => w.date,
    );
    pushIf({
      k: "tending",
      label: "tending",
      hue: 250,
      values: normalise(tending),
    });

    // 5. Logging (mood entries)
    const logging = buildSeries(
      moods as { date?: string | undefined }[],
      (m) => m.date,
    );
    pushIf({
      k: "logging",
      label: "logging",
      hue: 38,
      values: normalise(logging),
    });

    // 6. Remembering (dreams)
    const remembering = buildSeries(
      dreams as { date?: string | undefined }[],
      (d) => d.date,
    );
    pushIf({
      k: "remembering",
      label: "remembering",
      hue: 305,
      values: normalise(remembering),
    });

    return { rivers: streams, years };
  }, [workouts, books, visits, weighins, moods, dreams]);

  return (
    <>
      <Kicker>rivers · what keeps running through</Kicker>
      <div className="card" style={{ marginTop: 10, padding: 14 }}>
        {rivers.rivers.length === 0 ? (
          <div
            className="margin-note"
            style={{ fontSize: 12, fontStyle: "italic" }}
          >
            "Your rivers fill in as you log: workouts → moving, books →
            reading, trips → travel. Each stream needs at least two
            years of data to show as its own band."
          </div>
        ) : (
          <>
            <RiverChart rivers={rivers.rivers} years={rivers.years} />
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 10,
              }}
            >
              {rivers.rivers.map((r) => (
                <span
                  key={r.k}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: `oklch(0.62 0.11 ${r.hue})`,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: 11.5,
                      color: "var(--ink-2)",
                    }}
                  >
                    {r.label}
                  </span>
                </span>
              ))}
            </div>
            <div
              className="margin-note"
              style={{ marginTop: 8, fontSize: 11, fontStyle: "italic" }}
            >
              each band is one stream of activity, normalised against its
              own peak year — heights are relative, not absolute counts.
            </div>
          </>
        )}
      </div>
    </>
  );
}

function RiverChart({
  rivers,
  years,
}: {
  rivers: River[];
  years: number[];
}) {
  const W = 320;
  const H = 140;
  const pad = 8;
  const N = years.length;
  if (N === 0 || rivers.length === 0) return null;
  const stepX = N > 1 ? (W - pad * 2) / (N - 1) : 0;
  // 22 px max per river — caps total height regardless of stream count.
  const maxStreamHeight = 22;

  // For each x-index, walk through rivers stacking bottom-up.
  const stacks: { k: string; hue: number; top: number; bot: number }[][] = [];
  for (let i = 0; i < N; i++) {
    let y = H - pad;
    const col: { k: string; hue: number; top: number; bot: number }[] = [];
    rivers.forEach((r) => {
      const segH = r.values[i] * maxStreamHeight;
      col.push({ k: r.k, hue: r.hue, top: y - segH, bot: y });
      y -= segH;
    });
    stacks.push(col);
  }
  const paths = rivers.map((r, li) => {
    const tops = stacks
      .map((c, i) => `${pad + i * stepX},${c[li].top}`)
      .join(" L ");
    const bots = stacks
      .map((c, i) => `${pad + i * stepX},${c[li].bot}`)
      .reverse()
      .join(" L ");
    return { hue: r.hue, k: r.k, d: `M ${tops} L ${bots} Z` };
  });

  // X-axis tick years: first, last, and ~3 in between if span > 4.
  const tickIdxs: number[] = [];
  if (N <= 5) {
    for (let i = 0; i < N; i++) tickIdxs.push(i);
  } else {
    tickIdxs.push(0);
    tickIdxs.push(Math.floor(N / 4));
    tickIdxs.push(Math.floor(N / 2));
    tickIdxs.push(Math.floor((3 * N) / 4));
    tickIdxs.push(N - 1);
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: "block" }}
    >
      {paths.map((p) => (
        <path
          key={p.k}
          d={p.d}
          fill={`oklch(0.62 0.11 ${p.hue})`}
          opacity={0.82}
        />
      ))}
      {tickIdxs.map((i) => {
        const x = pad + i * stepX;
        return (
          <text
            key={i}
            x={x}
            y={H - 1}
            textAnchor="middle"
            fontFamily="var(--mono)"
            fontSize="8"
            fill="var(--ink-3)"
            letterSpacing="0.06em"
          >
            {years[i]}
          </text>
        );
      })}
    </svg>
  );
}
