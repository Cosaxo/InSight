// The Oracle lens (D215, redrawn 2026-09-02) — the guess in the same
// round dusk field the two maps draw into (patterns.css, the .ln-* block).
// Ported from the 2026-09-02 standalone's oracle.jsx
// (design/standalone-2026-09-02/): the two options are the two HALVES of
// the field, and the guess is a disc sealed on the seam between them. On
// your tap it travels to the half it called, and that half fills from the
// bottom to how sure it was. So:
//   confidence = the fill's HEIGHT and the disc's SIZE (and a word under it),
//   evidence   = ink density — a cold-start guess is a faint disc,
//   the call   = a POSITION, your pick = the "you" tag on its half,
//   the verdict= the disc's glyph on landing: solid when it had you,
//                broken open to a RING when you broke it — and said in
//                words below, so nothing has to be decoded.
// No percentage is printed anywhere. Press "Why?" for its working; press a
// ledger mark to recall that question.
//
// THE ONE-TIME HINTS RETIRED WITH THE REDESIGN (and their
// `insight.oracle.hints.v1` key with them — check:purge's subject set is
// derived, so the sweep simply stops having this reader): the card's own
// standing sentence says what the disc means before the tap and what the
// verdict means after it, and the record's kicker says the marks. A legend
// that is always true beats three that are shown once.
//
// The live wiring keeps every discipline the shipped lens had: the guess
// is SEALED before a half will take a tap (PATTERNS.seal, pinned in
// patterns.test.ts — a side without a seal behind it does nothing), the
// vote lands through LIVE.vote like any other answer, and the grade reads
// the store's own record. The prototype's "Start over" is not ported: a
// live answer cannot be unanswered, so the done state says what the pool
// will do instead of offering a reset that could only lie.
import React from "react";
import LIVE from "../data/live";
import PATTERNS, { type OracleRecord, type PoolItem, type Working } from "../data/patterns";
// @ts-expect-error TS7016 — untyped spec module (named export, D189)
import { WPAL } from "../spec/world-palette.js";
// @ts-expect-error TS7016 — untyped spec module (named export, convert-on-touch)
import { WORLD_TOPICS } from "../spec/world-feed-data.js";

const OR_CAP_BITS = 2.6; // a mark this surprising is full height
// The prototype's evidence mass summed per-question contributions from
// its own engine; live reads the one real equivalent — how far the sealed
// posterior sits from the question's own marginal, i.e. what the viewer's
// answers moved the guess, in encoded-answer units [0..~1.9]. Full ink at
// 0.5 ≈ a guess pushed 25 points off the crowd's base rate.
const OR_MASS_FULL = 0.5;
const OR_MASS_GAMMA = 0.62; // compresses the per-question jitter in that ramp
const OR_LAND_MS = 780; // travel + settle, when the verdict glyph resolves

interface Topic { id: string; label: string; color: string }
const orTopic = (cat: string | null | undefined): Topic | undefined =>
  (WORLD_TOPICS as Topic[]).find((t) => t.id === cat);
// topic hue as a number, worn only where it carries meaning — the same
// muted-dot recipe the Map and People lenses use. At reveal the tile that
// is NOT yours wears it (2026-08-24), so the pair reads as your accent
// against the question's own colour rather than two grey boxes.
const orHue = (c: string | undefined): number | null => {
  const m = /([-\d.]+)\s*\)\s*$/.exec(c || "");
  return m ? parseFloat(m[1]) : null;
};
const orQuiet = (): boolean => {
  try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};
const orH = (bits: number, base: number, span: number): number =>
  base + Math.min(1, bits / OR_CAP_BITS) * span;
// how a crowd leans, in words rather than a number
const orWord = (p: number): string =>
  p >= 0.78 ? "nearly always" : p >= 0.62 ? "mostly" : p >= 0.54 ? "more often than not" : "still mostly";
// how sure the oracle was, in words — the fill's height says the same thing
const orSure = (c: number): string =>
  c >= 0.82 ? "sure" : c >= 0.68 ? "fairly sure" : c >= 0.57 ? "leaning" : "guessing";

// the field: a 280 box, the seam down the middle, a seat either side
const OR_S = 280, OR_C = 140;
const orSeat = (i: number): number => (i === 0 ? OR_C - 64 : OR_C + 64);
/**
 * The called half fills from the bottom to the oracle's confidence: the
 * region of that half-disc below the water line, as one path. `conf` is a
 * fraction of the field's height, so the fill IS the number without
 * printing it.
 */
function orFillPath(side: number, conf: number): string {
  const R = OR_C;
  const y0 = OR_S - conf * OR_S;
  const dx = Math.sqrt(Math.max(0, R * R - (y0 - R) * (y0 - R)));
  const x1 = side === 0 ? R - dx : R + dx;
  const sweep = side === 0 ? 0 : 1;
  return `M ${R} ${y0.toFixed(1)} L ${x1.toFixed(1)} ${y0.toFixed(1)} A ${R} ${R} 0 0 ${sweep} ${R} ${2 * R} Z`;
}

// (the viewer's-side helper that stood here moved into PATTERNS.working —
// the engine resolves evidence sides now, so the UI never re-derives them)

// the record: one mark per answer, on a single baseline. Press one to
// recall it. In `group` mode (the done state) the same marks are re-laid
// by topic — most broken subject first, hue = topic — so the strip that
// IS your record is also the reading of it. One strip, never two.
function OrLedger({ log, qOf, sel, onPick, group, topIx }: {
  log: readonly OracleRecord[];
  qOf: (qid: string) => PoolItem | undefined;
  sel: number | null;
  onPick: (i: number | null) => void;
  group?: boolean;
  topIx?: number;
}): React.ReactElement {
  let items = log.map((r, i) => ({ r, i })).slice(-30);
  const gaps = new Set<number>();
  const mkH = (bits: number) => (group ? orH(bits, 13, 63) : orH(bits, 9, 31));
  if (group) {
    const cnt = new Map<string, { b: number; n: number }>();
    for (const { r } of items) {
      const q = qOf(r.qid);
      if (!q) continue;
      const k = q.q.cat ?? "";
      const c = cnt.get(k) || { b: 0, n: 0 };
      c.n++;
      if (r.pred !== r.mine) c.b++;
      cnt.set(k, c);
    }
    const key = (x: { r: OracleRecord }) => qOf(x.r.qid)?.q.cat ?? "";
    items = [...items].sort((a, b) => {
      const ka = key(a), kb = key(b);
      if (ka === kb) return a.i - b.i;
      const ca = cnt.get(ka) || { b: 0, n: 0 }, cb = cnt.get(kb) || { b: 0, n: 0 };
      return cb.b - ca.b || cb.n - ca.n || (ka < kb ? -1 : 1);
    });
    let prev: string | null = null;
    items.forEach((it, ix) => {
      const k = key(it);
      if (ix > 0 && k !== prev) gaps.add(ix);
      prev = k;
    });
  }
  return (
    <div className={"or-ledger" + (group ? " is-grouped" : "")} aria-label={group
      ? "Your record, grouped by topic — a mark up each time you broke the guess, a tick down when it had you. Press a mark to recall that question."
      : "Your record — a mark up each time you broke the guess, a tick down when it had you. Press a mark to recall that question."}>
      <span className="or-base"></span>
      {items.map(({ r, i }, ix) => {
        const broke = r.pred !== r.mine;
        const q = qOf(r.qid);
        const t = group && q ? orTopic(q.q.cat) : null;
        const isTop = group && i === topIx;
        return (
          <button key={i} className={"or-cell" + (sel === i ? " is-sel" : "") + (gaps.has(ix) ? " is-gap" : "")}
            onClick={() => onPick(sel === i ? null : i)}
            aria-label={q
              ? q.q.text + " — it called " + (q.q.options[r.pred]?.label ?? "") +
                (broke ? "; you said " + (r.mine != null ? q.q.options[r.mine]?.label ?? "" : "") : "; you agreed")
              : "answer"}>
            <i className={"or-mk" + (broke ? "" : " hit") + (isTop ? " is-top" : "")}
              style={broke ? {
                height: mkH(r.bits ?? 0),
                background: isTop || sel === i ? undefined : t ? (WPAL.c(t.color) as string) : undefined,
              } : undefined}></i>
          </button>
        );
      })}
    </div>
  );
}

// the retrospective: the record re-laid as the reading. The strip below
// IS the per-topic breakdown (grouped, hue = topic); the sentence above
// names its tallest mark. No second axis, no rows that hold one mark.
function OrDone({ log, qOf, anyOpen }: {
  log: readonly OracleRecord[];
  qOf: (qid: string) => PoolItem | undefined;
  anyOpen: boolean;
}): React.ReactElement {
  const [sel, setSel] = React.useState<number | null>(null);
  // the record's one mark worth naming: your biggest break — or, when it
  // read you every time, the closest it came to losing you
  let topIx = -1;
  let anyBreak = false;
  for (const r of log) if (r.pred !== r.mine) anyBreak = true;
  log.forEach((r, i) => {
    if ((r.pred !== r.mine) === anyBreak && (topIx < 0 || (r.bits ?? 0) > (log[topIx].bits ?? 0))) topIx = i;
  });
  const top = topIx >= 0 ? log[topIx] : null;
  const tq = top ? qOf(top.qid) : undefined;
  const rc = sel != null ? log[sel] : null;
  const rq = rc ? qOf(rc.qid) : undefined;
  return (
    <div className="or-lens">
      <div className="or-done fade-in">
        {tq && top && (
          <div className="or-bigtx">
            <span className="pt-kick">{anyBreak ? "biggest break" : "closest call"}</span>
            <p className="or-bigq">{tq.q.text}</p>
            <p className="or-bigs">It called <b>{tq.q.options[top.pred]?.label}</b>. {anyBreak
              ? <>You said <b>{top.mine != null ? tq.q.options[top.mine]?.label : ""}</b>.</>
              : <>You did too — as you did every time.</>}</p>
          </div>
        )}
        <OrLedger log={log} qOf={qOf} sel={sel} onPick={setSel} group={true} topIx={topIx}></OrLedger>
        {log.length > 0 && (
          <div className="or-cap" aria-hidden="true">
            <i className="or-cap-up"></i><span>you broke its guess</span>
            <span className="or-cap-dot">·</span>
            <i className="or-cap-dn"></i><span>it had you</span>
            <span className="or-cap-dot">·</span>
            <span>colour = topic</span>
          </div>
        )}
        <div className="or-slot">{rc && rq && (
          <div className="or-aside">{"“" + rq.q.text + "”"} — it called <b>{rq.q.options[rc.pred]?.label}</b>. {rc.pred === rc.mine ? "You did too." : <>You said <b>{rc.mine != null ? rq.q.options[rc.mine]?.label : ""}</b>.</>}</div>
        )}</div>
      </div>
      {/* no "Start over": a live answer cannot be unanswered (D215) */}
      <div className="or-foot">
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", textAlign: "center", lineHeight: 1.45 }}>
          {anyOpen
            ? "The open questions here need more answers behind them — the nightly fit widens as the crowd does."
            : "New questions join as the crowd answers them."}
        </span>
      </div>
    </div>
  );
}

export default function PatternsOracle({ items }: {
  items: PoolItem[];
  version: number;
}): React.ReactElement {
  const [rec, setRec] = React.useState<OracleRecord | null>(null); // the reveal, held until you move on
  const [landed, setLanded] = React.useState(false); // the verdict has resolved
  const [why, setWhy] = React.useState(false);
  const [sel, setSel] = React.useState<number | null>(null); // a recalled ledger mark
  const [work, setWork] = React.useState<Working | null | "pending">(null);

  const qOf = React.useCallback(
    (qid: string) => items.find((p) => p.q.id === qid),
    [items],
  );
  const curItem = rec ? qOf(rec.qid) : PATTERNS.nextAsk() ?? undefined;
  const curId = curItem?.q.id ?? null;
  const log = PATTERNS.meter().records;

  // the sealed reading, taken once per question so the disc does not
  // resize under you at the reveal — and the gate on every tap below:
  // no seal, no tappable tile (the patterns.test.ts discipline).
  const pre = React.useMemo(
    () => (curId ? PATTERNS.seal(curId) : null),
    [curId],
  );

  React.useEffect(() => {
    if (!rec) { setLanded(false); return; }
    const t = setTimeout(() => setLanded(true), orQuiet() ? 60 : OR_LAND_MS);
    return () => clearTimeout(t);
  }, [rec]);

  // the working, on demand (2026-08-26): every evidence answer the grade
  // named, each with the crowd split it contributed — bounded (≤3 tells,
  // rows shared with say()'s cache), and honest row by row: a tell that
  // cannot clear the 12-in-both-samples floor is absence, not a bar
  React.useEffect(() => {
    if (!why || !rec || !curItem) { setWork(null); return; }
    let on = true;
    setWork("pending");
    void PATTERNS.working(rec.qid)
      .then((w) => { if (on) setWork(w); })
      .catch(() => { if (on) setWork({ rows: [], hadEv: (rec.ev ?? []).length > 0 }); });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rec names the sealed record
  }, [why, rec?.qid]);

  const next = () => {
    setRec(null);
    setWhy(false);
    setSel(null);
    setWork(null);
  };

  if (!curItem) {
    const anyOpen = items.some((p) => p.mine == null);
    if (!log.length) {
      // nothing asked yet and nothing askable — the shipped honest state
      return (
        <div className="pt-done">
          <div>{anyOpen ? "Nothing to guess yet" : "Nothing left to guess"}</div>
          <p>{anyOpen
            ? "The open questions here don’t have enough answers behind them for an honest guess. The nightly fit widens as the crowd does."
            : "You’ve answered every question on the map. New ones join as the crowd answers them."}</p>
        </div>
      );
    }
    return <OrDone log={log} qOf={qOf} anyOpen={anyOpen} />;
  }

  const q = curItem.q;
  const t = orTopic(q.cat);
  const tint = t ? (WPAL.c(t.color) as string) : null;
  const th = t ? orHue(t.color) : null; // the working's bars wear the topic
  const brokeIt = rec != null && rec.mine != null && rec.pred !== rec.mine;
  const conf = rec
    ? (rec.pred === 0 ? rec.p0 : 1 - rec.p0)
    : pre ? (pre.pred === 0 ? pre.p0 : 1 - pre.p0) : 0.5;
  const p0 = rec ? rec.p0 : pre ? pre.p0 : 0.5;
  // evidence mass: how far the viewer's answers moved the guess off the
  // question's own base rate (see OR_MASS_FULL above)
  const mass = Math.abs(2 * p0 - 1 - curItem.marginal);
  const sol = Math.min(1, Math.pow(Math.max(0, mass) / OR_MASS_FULL, OR_MASS_GAMMA));
  // the disc: 15–26 by confidence, its ink 0.35–1 by evidence. Both are
  // public before the tap — only the SIDE is sealed, so nothing leaks.
  const dR = 15 + Math.min(1, Math.max(0, (conf - 0.5) / 0.45)) * 11;
  const discX = rec ? orSeat(rec.pred) : OR_C;
  const discY = OR_C + 18;
  const discOp = 0.35 + 0.65 * sol;
  const rc = sel != null ? log[sel] : null;
  const rq = rc ? qOf(rc.qid) : undefined;
  const two = q.options.length === 2;

  const answer = (i: number) => {
    if (!pre) return; // no seal, no tap — the guess must exist first
    LIVE.vote(q.id, q.options[i]?.id ?? String(i));
    const g = PATTERNS.grade(q.id);
    if (g && g.mine != null) setRec(g);
  };

  return (
    <div className="or-lens">
      <div key={q.id} className="card ln-card fade-in"
        style={{ padding: "14px 16px 12px", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {t && <span className="pt-cat" style={{ background: WPAL.wash(tint, 16) as string, color: WPAL.ink(t.color) as string }}>{t.label}</span>}
          <span className="pt-kick">Question {log.length + 1}</span>
          {rec ? (
            <button onClick={next} className="tap44"
              style={{ marginLeft: "auto", border: "none", background: "var(--ink)", color: "var(--surface)", borderRadius: 999, padding: "6px 14px", cursor: "pointer", fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 700, letterSpacing: "-0.01em", WebkitAppearance: "none" }}>
              Next →
            </button>
          ) : <span className="or-sealed" style={{ marginLeft: "auto" }}>sealed</span>}
        </div>
        <p style={{ margin: "8px 0 0", fontFamily: "var(--serif)", fontSize: 21, fontWeight: 500, lineHeight: 1.2, letterSpacing: "-0.01em", color: "var(--ink)", textWrap: "pretty" }}>{q.text}</p>
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", marginTop: 10 }}>
          <div className="ln-field" style={{ flex: "1 1 0px", width: "auto", minHeight: 190, maxHeight: 300, maxWidth: "100%", aspectRatio: "1 / 1" }}>
            {/* the prototype advanced on a tap anywhere in the field; that
                was a clickable <div> a keyboard can never reach (the a11y
                ratchet's exact case, D215), and "Next →" already does the
                job — so the field is a labelled group and only real
                controls take input. Pre-vote the two halves ARE controls:
                each is a <button> wrapping its half-disc hit path. */}
            <svg className="ln-svg" viewBox={`0 0 ${OR_S} ${OR_S}`} role="group"
              aria-label={rec
                ? "It called " + (q.options[rec.pred]?.label ?? "") + "; you said " + (rec.mine != null ? q.options[rec.mine]?.label ?? "" : "")
                : "Its guess is sealed — pick a side"}>
              {rec && <path key={"f" + rec.qid} className="or2-fill" d={orFillPath(rec.pred, conf)} fill="var(--ln-beacon)"></path>}
              <line x1={OR_C} y1="22" x2={OR_C} y2={OR_S - 22} stroke="var(--ln-ring)" strokeWidth="1" strokeDasharray="3 4"></line>
              {two && q.options.map((op, i) => {
                const cx = orSeat(i);
                const mine = rec != null && rec.mine === i;
                const called = rec != null && rec.pred === i;
                const half = i === 0
                  ? "M 140 0 A 140 140 0 0 0 140 280 Z"
                  : "M 140 0 A 140 140 0 0 1 140 280 Z";
                const inner = (
                  <>
                    <path d={half} fill="transparent"></path>
                    {/* uppercased by CSS, not by String.toUpperCase: the
                        accessible name and the DOM text stay the option's
                        real label, so a screen reader reads the word the
                        bank wrote and no locale gets its casing mangled */}
                    <text x={cx} y="70" fill={called || !rec ? "var(--ln-ink)" : "var(--ln-sub)"} textAnchor="middle"
                      style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase" }}>{op.label}</text>
                    {!rec && <text x={cx} y="88" fill="var(--ln-sub)" textAnchor="middle" style={{ fontSize: 10.5, fontWeight: 600 }}>tap to pick</text>}
                    {mine && (
                      <g>
                        <rect x={cx - 16} y="80" width="32" height="16" rx="8" fill="var(--ln-beacon)"></rect>
                        <text x={cx} y="88" fill="var(--ln-halo)" textAnchor="middle" dominantBaseline="central"
                          style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".08em" }}>YOU</text>
                      </g>
                    )}
                  </>
                );
                return rec ? <g key={op.id}>{inner}</g> : (
                  <g key={op.id} className="or2-half" role="button" tabIndex={0}
                    aria-label={op.label} aria-disabled={!pre}
                    onClick={() => answer(i)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); answer(i); } }}>
                    {inner}
                  </g>
                );
              })}
              {rec && (
                <g style={{ pointerEvents: "none" }}>
                  <circle cx={OR_C} cy={discY} r={dR} fill="none" stroke="var(--ln-ring)" strokeWidth="1.2" strokeDasharray="3 4"></circle>
                  <text x={OR_C} y={discY + dR + 16} fill="var(--ln-sub)" textAnchor="middle" style={{ fontSize: 10.5, fontWeight: 700 }}>sealed here</text>
                </g>
              )}
              <g className="or2-disc" style={{ transform: `translate(${discX}px, ${discY}px)`, pointerEvents: "none" }}>
                {!rec && <circle className="ln-pulse" cx="0" cy="0" r={dR} fill="none" stroke="var(--ln-beacon)" strokeWidth="1.5"></circle>}
                <circle cx="0" cy="0" r={dR + 10} fill="var(--ln-beacon)" opacity={rec ? 0.18 : 0.1}></circle>
                {landed && brokeIt ? (
                  <circle cx="0" cy="0" r={dR - 3} fill="none" stroke="var(--ln-beacon)" strokeWidth={Math.max(4, dR * 0.34)} opacity={discOp}></circle>
                ) : (
                  <circle cx="0" cy="0" r={dR} fill="var(--ln-beacon)" opacity={discOp}></circle>
                )}
                <text x="0" y={dR + 26} fill="var(--ln-ink)" textAnchor="middle" style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".1em" }}>
                  {rec ? "ITS GUESS" : "SEALED GUESS"}
                </text>
                <text x="0" y={dR + 40} fill="var(--ln-sub)" textAnchor="middle" style={{ fontSize: 10.5, fontWeight: 600 }}>
                  {sol < 0.15 ? "nothing to go on" : orSure(conf)}
                </text>
              </g>
            </svg>
          </div>
        </div>
        {/* a pool question with more than two options cannot be two halves
            of a disc: it falls back to the Map's own option buttons rather
            than a field that could only point at two of them */}
        {!two && !rec && (
          <div className="qm-opts" style={{ gridTemplateColumns: "1fr" }}>
            {q.options.map((op, i) => (
              <button key={op.id} className="qm-opt" disabled={!pre} onClick={() => answer(i)}>{op.label}</button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 12 }}>
          {rec ? (
            <p className="or2-verdict" style={{ flex: 1, margin: 0 }}>
              It called <b>{q.options[rec.pred]?.label}</b>, {orSure(conf)}. You said {rec.mine != null ? q.options[rec.mine]?.label : ""}.{" "}
              {landed ? (brokeIt ? <b>You broke it.</b> : <b>It had you.</b>) : "…"}
              {landed && <span style={{ color: "var(--ink-3)" }}> {brokeIt ? "A broken ring means you surprised it." : "A solid disc means it had you."}</span>}
            </p>
          ) : (
            <p className="or2-verdict" style={{ flex: 1, margin: 0 }}>
              It guessed your side before you answer, sealed until you tap a half.{" "}
              <span style={{ color: "var(--ink-3)" }}>A bigger disc means it is surer; a fainter one has little to go on.</span>
            </p>
          )}
          {rec && (
            <button className="tap44" onClick={() => { setSel(null); setWhy(!why); }}
              aria-label={why ? "Hide the evidence" : "Why it called " + (q.options[rec.pred]?.label ?? "")}
              style={{ flex: "none", border: "none", background: "none", padding: "2px 0", cursor: "pointer", fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 700, color: "var(--accent-ink)", WebkitAppearance: "none" }}>
              {why ? "Hide" : "Why? →"}
            </button>
          )}
        </div>
        {rc && rq && (
          <div className="or-aside" style={{ marginTop: 10 }}>{"“" + rq.q.text + "”"} — it called <b>{rq.q.options[rc.pred]?.label}</b>. {rc.pred === rc.mine ? "You did too." : <>You said <b>{rc.mine != null ? rq.q.options[rc.mine]?.label : ""}</b>.</>}</div>
        )}
        {why && !rc && rec && (
          // the working (2026-08-26): the sealed call rebuilt in the open —
          // one row per evidence answer, its bar the crowd split it
          // contributed, the hairline the coin, ink weighted by its pull.
          // Three empty states, each its own truth: still fetching; a call
          // your answers never moved (the prototype says "guessed at the
          // coin" — live the call falls back to the crowd's own lean, so
          // that is what the line says); and evidence real but below the
          // 12-in-both-samples floor, which is thinness, not absence.
          <div className="or-proof" style={{ marginTop: 10 }}>
            <span className="or-proof-kick">its working</span>
            {work === "pending" ? (
              <span className="or-ev-none">Reading the crowd…</span>
            ) : work && work.rows.length ? work.rows.map((r, k) => {
              const evq = qOf(r.evId);
              if (!evq) return null;
              const wmax = work.rows[0].w || 1;
              const evFill = th != null ? `oklch(0.78 0.07 ${th})` : "color-mix(in oklab, var(--ink), var(--surface-2) 35%)";
              return (
                <div className="or-ev" key={r.evId} style={{ animationDelay: `${k * 80}ms` }}>
                  <span className="or-ev-q">You said <b>{evq.q.options[r.side]?.label}</b>{" — "}{"“" + evq.q.text + "”"}</span>
                  <span className="or-ev-row">
                    <span className="or-ev-bar"><i style={{ width: `${Math.round(r.share * 100)}%`, background: evFill, opacity: 0.55 + 0.45 * Math.min(1, r.w / wmax) }}></i><em></em></span>
                    <span className="or-ev-word">{orWord(r.share)} pick <b>{q.options[rec.pred]?.label}</b> · {r.n} in both samples</span>
                  </span>
                </div>
              );
            }) : work && !work.hadEv ? (
              <span className="or-ev-none">Nothing in your answers pointed either way here — the call is the crowd’s own lean, and the faint ink says so.</span>
            ) : (
              <span className="or-ev-none">The answers that moved it don’t have enough shared voters to count in the open — under 12 in both samples.</span>
            )}
            <span className="or-proof-base">sealed before your tap · counted only from answers you’d already given · the mark is the coin</span>
          </div>
        )}
        {/* the record, with its key in the kicker — the standing legend the
            one-time hints used to teach (2026-09-02) */}
        <div style={{ flex: "none", marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--rule)" }}>
          <div className="pt-kick">
            Your record · {log.length} answer{log.length === 1 ? "" : "s"} ·{" "}
            <span style={{ fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>up = you broke it, tick = it had you</span>
          </div>
          <OrLedger log={log} qOf={qOf} sel={sel} onPick={(k) => { setSel(k); setWhy(false); }}></OrLedger>
        </div>
      </div>
    </div>
  );
}
