// The Answers tab's rows, in the prototype's shape (D120).
//
// Ported from spec/mirror-answers.jsx — `MARow`, `MAStack`, `MABars`,
// `MAHisto` and the chip/sort band above them — which is the design the
// repo has carried since the port and which only the DEMO Mirror ever
// rendered. Live mode grew its own row instead (a full-width 30 px stacked
// bar with the percentages written inside it, expanding into a plain
// option/count/% list), and that is what shipped on City, Country and
// World.
//
// WHAT THE PROTOTYPE'S ROW SAYS THAT THE OLD ONE DID NOT. Every collapsed
// row is three readings on one line — the headline ("62% Yes", or an
// average out of ten), the distribution as a thin stack, and YOUR answer —
// so the list scans as "what did they say / where am I in it" rather than
// as a column of bar charts. Expanding gives the options their own labelled
// bars, or a histogram when the question is a 1-10 rating, plus the
// you-versus-them sentence.
//
// WHAT IS DELIBERATELY NOT PORTED, and it is the same refusal D100 made:
// the prototype sorts by NEWEST and prints a date on every row, under
// sticky month headers. Nothing the client holds dates an answer — the
// aggregate carries no timestamp and a question's bank position is where it
// entered the bank, not when it was asked — so the date furniture is
// dropped rather than filled with a number that would be wrong about
// roughly six days in seven. The three orderings live can compute honestly
// stay.
//
// This module rides LiveCohortBody's lazy chunk (D119), so it costs the
// eager graph nothing.
import React from "react";
// Every number on a row comes from data/cohort, and none of it is
// re-derived here. pctFor especially: its own comment warns that two
// surfaces rounding differently is how a 51/49 becomes a 51/48 one screen
// over, and this row sits beside the lens bodies that already use it.
import { divisiveness, headlineFor, pctFor, standingIn } from "../data/cohort";
// @ts-expect-error TS7016 — untyped spec module (named export, convert-on-touch)
import { DAILYQ } from "../spec/daily-questions.js";

// THE ROW WEARS ITS QUESTION'S TOPIC (2026-09-02). Every drawing on a row
// was `--accent`, so a screenful of them was one colour and the reader had
// no way to see, at a glance, that two rows were about different things.
// The hue comes from the bank's own subject path (`branch`, D100) through
// the SAME table the Map and the demo daily read — importing it rather
// than copying the fourteen values, which is the documentation error this
// repo keeps re-committing. A row with no branch (a pre-D100 seed) draws
// in the neutral 250 that table already falls back to, so nothing has to
// guard the undefined.
const HUE_FALLBACK = 250;
const hueOf = (branch: string | undefined): number => {
  const m = branch ? (DAILYQ as { catMeta?: (b: string) => { hue?: number } }).catMeta?.(branch) : null;
  return typeof m?.hue === "number" ? m.hue : HUE_FALLBACK;
};
/** The topic's ink for a fill, and the deeper one that can carry text. */
const tintOf = (h: number) => `oklch(0.55 0.13 ${h})`;
const tintInkOf = (h: number) => `oklch(0.47 0.13 ${h})`;

/** One question, as this tab needs it. */
export interface AnswerRow {
  qid: string;
  text: string;
  options: string[];
  /** Dense per-option counts for this cohort. */
  counts: number[];
  /** Their sum — the cohort's answer count on this question. */
  n: number;
  /** The bank's subject path (D100); undefined for a pre-D100 seed. */
  branch?: string;
  /** The bank's question type — `rating` and `scale` read differently. */
  type?: string;
  /** The viewer's own pick, -1 when they have not answered. */
  mine: number;
}

const AR_RULE = "0.5px solid var(--rule)";

// The three orderings, and the one that is missing on purpose — see the
// header. Labels unchanged from D100: they name what they do, and
// "Divisive" alone reads as a claim about the questions rather than a
// control.
const SORTS = [
  { id: "answers", label: "Most answers" },
  { id: "divisive", label: "Most divisive" },
  { id: "agreed", label: "Most agreed" },
] as const;
export type SortId = (typeof SORTS)[number]["id"];

const topIdx = (d: number[]) => d.reduce((t, v, i) => (v > d[t] ? i : t), 0);

// The words for cohort's two readings. The arithmetic is a pure fold with
// its own tests; what a row SAYS about it is a UI decision and lives here.
function headText(row: AnswerRow): { big: string; unit: string; sub: string } | null {
  const h = headlineFor(row.counts, row.type);
  if (!h) return null;
  if (h.kind === "average") return { big: h.mean.toFixed(1), unit: `/${h.max}`, sub: "average" };
  if (h.kind === "agree") return { big: `${h.pct}%`, unit: "", sub: "agree" };
  return { big: `${h.pct}%`, unit: "", sub: row.options[h.optionIdx] ?? "" };
}

function standText(row: AnswerRow, whom: string): string {
  const st = standingIn(row.counts, row.mine, row.type);
  // ONE NULL, TWO FACTS (D244). `standingIn` refuses for two different
  // reasons — the cohort has said nothing, or you have not answered — and
  // this rendered both as the second one. That put "You have not answered
  // this one." under a chip naming your own pick two lines above it: the
  // row contradicting itself on a single screen.
  //
  // Reachable from the Near room, and not only for a beat: `loadRoom` is
  // session-cached per cell, so a vote cast after the fold shows your chip
  // against zero counts until you walk to another block.
  if (!st) {
    // Which reason, asked in the same terms `standingIn` refuses on.
    if (row.mine < 0 || row.mine >= row.counts.length) return "You have not answered this one.";
    // You answered, and the cohort's cell is still empty. Not "nobody has
    // answered" — you did, and you are in this cohort — so the honest line
    // explains the zeros rather than denying the chip.
    return "Your answer is not in this count yet.";
  }
  // A share of ONE answer is not a share (D170): with n=1 the arithmetic
  // can only ever say 0% or 100%, so "100% of Oslo are with you" reports
  // the sample size wearing a percentage. The release showed exactly that
  // on a city with a single answer. This is arithmetic rather than a
  // thin-data threshold — n=2 is thin too, and still says something.
  const n = row.counts.reduce((a, b) => a + b, 0);
  if (n === 1) return `One answer from ${whom} so far.`;
  if (st.kind === "with") return `${st.pct}% of ${whom} are with you.`;
  return st.kind === "below"
    ? `Further along than ${st.pct}% of ${whom}.`
    : `Less far along than ${st.pct}% of ${whom}.`;
}

// ── collapsed: one thin bar, your segment in accent ───────────────────
function ArStack({ pct, mine, tint }: { pct: number[]; mine: number; tint: string }) {
  const lead = topIdx(pct);
  // notched segments rather than one welded bar (2026-09-02): a rounded
  // end per side reads as "the options", where a single pill read as one
  // quantity cut into pieces
  return (
    <div style={{ display: "flex", height: 12, gap: 3 }}>
      {pct.map((v, i) => {
        const isMine = mine === i;
        return (
          <span key={i} style={{
            // minWidth on your own segment only: a 1% answer of yours must
            // still be findable, and giving every thin segment a floor
            // would make the bar lie about the shape.
            flexGrow: v, minWidth: isMine ? 10 : 3, borderRadius: 999,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: isMine ? "var(--accent)"
              : i === lead ? `color-mix(in oklch, ${tint} 62%, var(--surface-3))`
                : `color-mix(in oklch, ${tint} 15%, var(--surface-3))`,
          }}>{isMine && <span style={{ width: 4.5, height: 4.5, borderRadius: "50%", background: "var(--surface)" }}></span>}</span>
        );
      })}
    </div>
  );
}

// ── expanded: one labelled bar per option ────────────────────────────
function ArBars({ row, pct, tint, tintInk }: { row: AnswerRow; pct: number[]; tint: string; tintInk: string }) {
  const lead = topIdx(pct);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
      {row.options.map((o, i) => {
        const isMine = i === row.mine;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{
              width: 104, flexShrink: 0, textAlign: "right",
              fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: isMine ? 800 : 500,
              color: isMine ? "var(--ink)" : "var(--ink-2)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{o}</span>
            <div style={{ flex: 1, height: 10, background: `color-mix(in oklch, ${tint} 9%, var(--surface-3))`, borderRadius: 999, overflow: "hidden" }}>
              <div style={{
                width: `${Math.max(pct[i], 1)}%`, height: "100%", borderRadius: 999,
                background: isMine ? "var(--accent)" : i === lead ? tint : `color-mix(in oklch, ${tint} 34%, var(--surface-3))`,
              }} />
            </div>
            {/* The prototype prints a percentage only on your row and the
                leader. Live adds the raw COUNT to every row: these are
                exact populations since D98, and "40%" of nine people is a
                different fact from "40%" of nine thousand. Each number is
                its own element rather than one interpolated string — a
                share and a headcount are two readings, and a test that
                wants one should not have to match around the other. */}
            <span style={{ width: 62, flexShrink: 0, textAlign: "right", fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>
              {(isMine || (row.mine < 0 && i === lead)) && (
                <><span style={{ color: isMine ? "var(--accent-ink)" : tintInk }}>{pct[i]}%</span>{" · "}</>
              )}
              <span>{row.counts[i].toLocaleString()}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── expanded: the 1-10 histogram ─────────────────────────────────────
function ArHisto({ row, pct, tint }: { row: AnswerRow; pct: number[]; tint: string }) {
  const max = Math.max(...pct, 1);
  const H = 48;
  const last = pct.length - 1;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: H }}>
        {pct.map((v, i) => (
          <div key={i} style={{
            flex: 1, height: Math.max(3, (v / max) * H), borderRadius: 3,
            background: i === row.mine ? "var(--accent)" : `color-mix(in oklch, ${tint} 55%, var(--surface-3))`,
          }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
        {pct.map((_, i) => (
          <div key={i} style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            {i === row.mine
              ? <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)" }}></span>
              : (i === 0 || i === last)
                ? <span style={{ fontFamily: "var(--sans)", fontSize: 10, fontWeight: 700, color: "var(--ink-3)" }}>{row.options[i] ?? i + 1}</span>
                : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── one question ─────────────────────────────────────────────────────
function ArRow({ row, open, onToggle, whom }: {
  row: AnswerRow; open: boolean; onToggle: () => void; whom: string;
}) {
  const pct = pctFor(row.counts);
  const head = headText(row);
  const mineLabel = row.mine >= 0 ? row.options[row.mine] : null;
  const hue = hueOf(row.branch);
  const tint = tintOf(hue);
  const tintInk = tintInkOf(hue);
  return (
    <div style={{ padding: "14px 0" }}>
      {/* The whole row is the control. A separate chevron would put a 28px
          target beside a full-width one that does the same thing. */}
      <button onClick={onToggle} aria-expanded={open} className="press" style={{
        display: "block", width: "100%", background: "none", border: "none", padding: 0,
        textAlign: "left", cursor: "pointer", color: "inherit", WebkitAppearance: "none",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--sans)", fontSize: 15, fontWeight: 700, letterSpacing: "-0.015em", color: "var(--ink)", lineHeight: 1.32 }}>{row.text}</span>
          {/* Where the prototype prints a date. The count is what live can
              say truthfully about a row at a glance, and it is the number
              that decides how much the percentages are worth. */}
          <span style={{ flexShrink: 0, fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>
            {row.n.toLocaleString()}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 9 }}>
          {head && (
            <span style={{ flexShrink: 0, maxWidth: "46%", fontFamily: "var(--sans)", fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <span style={{ fontWeight: 800, fontSize: 13.5, color: tintInk }}>{head.big}{head.unit}</span>
              <span style={{ fontWeight: 600, color: "var(--ink-2)" }}> {head.sub}</span>
            </span>
          )}
          <div style={{ flex: 1, minWidth: 44 }}><ArStack pct={pct} mine={row.mine} tint={tint} /></div>
          {mineLabel && (
            <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--sans)", fontSize: 11, fontWeight: 600, color: "var(--ink-2)", maxWidth: "32%" }}>
              <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--surface)" }}></span></span>
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mineLabel}</span>
            </span>
          )}
        </div>
      </button>
      {open && (
        <div className="fade-in">
          {row.type === "rating"
            ? <ArHisto row={row} pct={pct} tint={tint} />
            : <ArBars row={row} pct={pct} tint={tint} tintInk={tintInk} />}
          {/* your standing, as a chip rather than a loose line: it is a
              claim about YOU on a row full of claims about everyone else */}
          <div style={{
            marginTop: 12, display: "inline-flex", alignItems: "flex-start", gap: 7,
            padding: "7px 11px 7px 9px", borderRadius: 10,
            background: "color-mix(in oklch, var(--accent) 8%, var(--surface-2))",
            fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--accent-ink)", lineHeight: 1.4,
          }}>
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2.5 }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--surface)" }}></span>
            </span>
            {/* Said either way. "You have not answered this one" is a fact
                about the row worth as much as the comparison it replaces —
                and dropping the line entirely made an unanswered row look
                like an answered one whose sentence failed to render. */}
            <span>{standText(row, whom)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// How many rows before the list asks. The prototype's number, and it
// holds for the same reason: the archive grows with the bank (D97), and
// seven is about a screen.
const LIMIT = 7;

function LiveAnswerRows({ rows, whom, emptyNote }: {
  rows: AnswerRow[];
  /** The cohort, as a noun this tab can put in a sentence. */
  whom: string;
  /** Shown in place of the list when nothing survives the filter. */
  emptyNote: React.ReactNode;
}) {
  const [branch, setBranch] = React.useState("");
  const [sort, setSort] = React.useState<SortId>("answers");
  // One row open at a time: two expanded distributions push the second off
  // the screen anyway. The sentinel opens the first row of whatever list is
  // showing, which is the prototype's behaviour — a tab that opens on a
  // closed list reads as a table of contents.
  // "\u0000first", not a raw NUL: the sentinel must not collide with a real
  // qid, and a literal NUL byte in the file made grep treat the whole module
  // as binary and skip it (D137). The escape is the same string at runtime.
  const FIRST = "\u0000first";
  const [open, setOpen] = React.useState<string>(FIRST);
  const [all, setAll] = React.useState(false);

  const branchN: Record<string, number> = {};
  for (const r of rows) if (r.branch) branchN[r.branch] = (branchN[r.branch] || 0) + 1;
  const branches = Object.keys(branchN).sort((a, b) => branchN[b] - branchN[a] || a.localeCompare(b));
  const picked = branches.includes(branch) ? branch : "";

  // divisiveness once per row, not once per comparison — inside the
  // comparator it re-runs O(n log n) times per render, and this panel
  // re-renders on every store notify (the measurement is in D100's note).
  const dOf = new Map(rows.map((r) => [r.qid, divisiveness(r.counts)]));
  const list = rows
    .filter((r) => !picked || r.branch === picked)
    .sort((a, b) => (
      sort === "answers" ? b.n - a.n
        // Most divisive: the SAME tie-break, for the same reason, and it
        // was missing. Divisiveness is normalised, so a 1-against-1 cell
        // and a 500-against-500 cell are both exactly 1.0 — the maximum —
        // and the thin one led the list on input order alone. It is the
        // mirror image of the case the comment below describes, and the
        // arm below is the only one that had the clause.
        : sort === "divisive" ? dOf.get(b.qid)! - dOf.get(a.qid)! || b.n - a.n
          // Most agreed: least divisive first, but a question with a single
          // answer is 0 on this scale and would head the list saying
          // nothing. Ties break toward the bigger room.
          : dOf.get(a.qid)! - dOf.get(b.qid)! || b.n - a.n
    ));
  const shown = all ? list : list.slice(0, LIMIT);
  const anyMine = shown.some((r) => r.mine >= 0);

  return (
    <div>
      {/* Two bands, not one — the prototype's note, and it is a measured
          one: the chips overflowed into the sort row and clipped it. */}
      {branches.length > 1 && (
        <div className="subnav--scroll" style={{ display: "flex", gap: 7, overflowX: "auto", padding: "2px 4px", margin: "0 -4px 8px" }}>
          {["", ...branches].map((b) => {
            const on = picked === b;
            return (
              <button key={b || "all"} className="pill press" aria-pressed={on}
                onClick={() => { setBranch(b); setAll(false); setOpen(FIRST); }}
                style={{
                  flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6,
                  background: on ? "var(--accent)" : "var(--surface)",
                  color: on ? "var(--surface)" : "var(--ink-2)",
                  borderColor: on ? "var(--accent)" : "var(--rule)",
                  fontWeight: on ? 700 : 500,
                }}>{b ? `${b} ${branchN[b]}` : `All ${rows.length}`}</button>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        {/* Names the accent mark ONCE, instead of a "you ·" prefix on every
            row. */}
        {anyMine && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, fontFamily: "var(--sans)", fontSize: 11, fontWeight: 600, color: "var(--ink-3)" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><span style={{ width: 3.5, height: 3.5, borderRadius: "50%", background: "var(--surface)" }}></span></span>
            you
          </span>
        )}
        <span style={{ flex: 1 }}></span>
        {rows.length > 1 && SORTS.map((s) => {
          const on = sort === s.id;
          return (
            <button key={s.id} className="press" aria-pressed={on}
              onClick={() => { setSort(s.id); setAll(false); setOpen(FIRST); }}
              style={{
                background: "none", border: "none", padding: "2px 0", cursor: "pointer", flexShrink: 0,
                fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: on ? 750 : 500,
                color: on ? "var(--ink)" : "var(--ink-3)", WebkitAppearance: "none",
                borderBottom: on ? "1.5px solid var(--accent)" : "1.5px solid transparent",
              }}>{s.label}</button>
          );
        })}
      </div>

      {!shown.length ? emptyNote : (
        <div className="card" style={{ marginBottom: 14, paddingTop: 3, paddingBottom: 3 }}>
          {shown.map((r, i) => {
            const isOpen = open === FIRST ? i === 0 : open === r.qid;
            return (
              <div key={r.qid} style={{ borderTop: i === 0 ? "none" : AR_RULE }}>
                {/* isOpen, not `open === r.qid`: while the sentinel is
                    standing, the first row is OPEN and its id is not in
                    `open` — so comparing against the id makes the first tap
                    on the first row set the state it was already showing,
                    and the row cannot be closed at all. Caught by
                    smoke-live's expander case, which collapses before it
                    expands for exactly this reason. */}
                <ArRow row={r} whom={whom} open={isOpen}
                  onToggle={() => setOpen(isOpen ? "" : r.qid)} />
              </div>
            );
          })}
          {list.length > LIMIT && !all && (
            <button className="press" onClick={() => setAll(true)} style={{
              width: "100%", padding: "11px 0 13px", cursor: "pointer", background: "none",
              border: "none", borderTop: AR_RULE, WebkitAppearance: "none",
              fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)",
            }}>Show {list.length - LIMIT} more</button>
          )}
        </div>
      )}
    </div>
  );
}

export default LiveAnswerRows;
