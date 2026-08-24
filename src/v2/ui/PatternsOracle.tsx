// The Oracle lens (D215) — ONE INSTRUMENT, no card. Ported from the
// 2026-08-20 standalone's oracle.jsx (design/standalone-2026-08-20/):
// the guess is an ink disc sealed on the seam between the two option
// tiles; on your tap it travels to the option it called, and each tile
// fills to the probability the oracle gave it. So:
//   confidence = a HEIGHT (the fill) and a SIZE (the sealed disc),
//   evidence   = ink density — a cold-start guess is a faint outline,
//   the call   = a POSITION, your pick = the accent edge,
//   the verdict= the disc's glyph on landing: solid when it had you,
//                broken open to a RING when you broke it.
// No percentage is printed anywhere. One line is available on demand:
// press the landed disc for its single strongest piece of evidence (a
// real crowd reading with its basis — PATTERNS.tell, D146); press a
// ledger mark to recall that question. Nothing stands.
//
// The live wiring keeps every discipline the shipped lens had: the guess
// is SEALED before the tiles will take a tap (PATTERNS.seal, pinned in
// patterns.test.ts — a tile without a seal behind it does nothing), the
// vote lands through LIVE.vote like any other answer, and the grade reads
// the store's own record. The prototype's "Start over" is not ported: a
// live answer cannot be unanswered, so the done state says what the pool
// will do instead of offering a reset that could only lie.
import React from "react";
import LIVE from "../data/live";
import PATTERNS, { type OracleRecord, type PoolItem, type TellShare } from "../data/patterns";
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

// the legends: one-time lines, each shown once and never again, so the
// instrument teaches its own grammar without ever standing there
// explaining it. Account state like any insight.* key: purgeLocalTrace
// sweeps it, and the listener drops the in-memory copy WITHOUT writing it
// back (check:purge).
const OR_HINT_LS = "insight.oracle.hints.v1";
let hintCache: Record<string, 1> | null = null;
const orHints = (): Record<string, 1> => {
  if (!hintCache) {
    try { hintCache = (JSON.parse(localStorage.getItem(OR_HINT_LS) || "{}") || {}) as Record<string, 1>; }
    catch { hintCache = {}; }
  }
  return hintCache;
};
const orSeen = (k: string): void => {
  try {
    const h = orHints();
    if (h[k]) return;
    h[k] = 1;
    localStorage.setItem(OR_HINT_LS, JSON.stringify(h));
  } catch { /* best-effort — in-memory is right */ }
};
window.addEventListener("insight:local-purge", () => { hintCache = null; });
const OR_HINT: Record<string, string> = {
  seal: "Its guess is sealed — a bigger disc means surer, a fainter one means less to go on.",
  reveal: "It moved to the side it called, and each tile filled to how sure it was. Solid disc: it had you. Ring: you broke it.",
  ledger: "Your record is below — a mark up where you broke the guess, a tick down where it had you. Press one to recall it.",
};

/** The viewer's option index on an item, from the encoded ±1. */
const mineIdx = (p: PoolItem | undefined): 0 | 1 | null =>
  !p || p.mine == null ? null : p.mine === 1 ? 0 : 1;

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
  const [hints, setHints] = React.useState<Record<string, 1>>(() => ({ ...orHints() }));
  const [tell, setTell] = React.useState<{ ev: PoolItem; share: TellShare } | null | "none">(null);

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

  // the on-demand evidence line: the strongest real crowd reading among
  // the sealed record's evidence questions — bounded (≤2 tells, rows
  // shared with say()'s cache), and honest when nothing qualifies
  React.useEffect(() => {
    if (!why || !rec || !curItem) { setTell(null); return; }
    let on = true;
    void (async () => {
      for (const evId of rec.ev ?? []) {
        const ev = qOf(evId);
        const side = mineIdx(ev);
        if (!ev || side == null) continue;
        const share = await PATTERNS.tell(rec.qid, evId, side).catch(() => null);
        if (!on) return;
        if (share && share.shares[rec.pred] >= 0.54) { setTell({ ev, share }); return; }
      }
      if (on) setTell("none");
    })();
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rec names the sealed record; qOf follows items
  }, [why, rec?.qid]);

  const next = () => {
    if (hintKey) { orSeen(hintKey); setHints({ ...orHints() }); }
    setRec(null);
    setWhy(false);
    setSel(null);
    setTell(null);
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
  const th = t ? orHue(t.color) : null; // the un-picked tile wears this at reveal
  // the disc rides to the centre of the tile it called — exact, gap included
  const seat = (i: number) =>
    i === 0 ? "calc((100% - var(--or-gap)) / 4)" : "calc(100% - (100% - var(--or-gap)) / 4)";
  const brokeIt = rec != null && rec.mine != null && rec.pred !== rec.mine;
  const conf = rec
    ? (rec.pred === 0 ? rec.p0 : 1 - rec.p0)
    : pre ? (pre.pred === 0 ? pre.p0 : 1 - pre.p0) : 0.5;
  const p0 = rec ? rec.p0 : pre ? pre.p0 : 0.5;
  // evidence mass: how far the viewer's answers moved the guess off the
  // question's own base rate (see OR_MASS_FULL above)
  const mass = Math.abs(2 * p0 - 1 - curItem.marginal);
  const sol = Math.min(1, Math.pow(Math.max(0, mass) / OR_MASS_FULL, OR_MASS_GAMMA));
  const dsty: React.CSSProperties & Record<string, string> = {
    "--d": Math.round(21 + Math.min(1, Math.max(0, (conf - 0.5) / 0.45)) * 25) + "px",
    "--or-ink": "color-mix(in oklab, var(--ink), var(--surface-2) " + Math.round((1 - sol) * 88) + "%)",
    "--or-edge": "color-mix(in oklab, var(--ink), var(--surface-2) " + Math.round((1 - sol) * 38) + "%)",
  };
  if (rec) dsty.left = seat(rec.pred);
  const rc = sel != null ? log[sel] : null;
  const rq = rc ? qOf(rc.qid) : undefined;
  // one legend at a time, in the same slot as the on-demand lines, and
  // only until it has been read once
  const hintKey = !rec ? (hints.seal ? null : "seal") : !hints.reveal ? "reveal" : !hints.ledger ? "ledger" : null;
  const hint = hintKey && !rc && !why ? OR_HINT[hintKey] : null;

  const answer = (i: number) => {
    if (!pre) return; // no seal, no tap — the guess must exist first
    LIVE.vote(q.id, q.options[i]?.id ?? String(i));
    const g = PATTERNS.grade(q.id);
    if (g && g.mine != null) {
      if (!hints.seal) { orSeen("seal"); setHints({ ...orHints() }); }
      setRec(g);
    }
  };

  return (
    <div className="or-lens">
      <div key={q.id} className="or-head fade-in">
        {t && <span className="pt-cat or-tag" style={{ background: WPAL.wash(tint, 16) as string, color: WPAL.ink(t.color) as string }}>{t.label}</span>}
        <p className="or-prompt">{q.text}</p>
      </div>
      {/* the prototype advanced on a tap anywhere here; that was a
          clickable <div> a keyboard can never reach (the a11y ratchet's
          exact case), and Next already does the job — so the instrument
          is a labeled group and only real controls take input */}
      <div key={q.id + "-inst"} className={"or-inst" + (rec ? " is-live" : "")} role="group"
        aria-label={rec
          ? "It called " + (q.options[rec.pred]?.label ?? "") + "; you said " + (rec.mine != null ? q.options[rec.mine]?.label ?? "" : "")
          : "Its guess is sealed — pick a side"}>
        {q.options.map((op, i) => rec ? (
          <div key={op.id} className={"or-tile" + (i === rec.mine ? " is-mine" : "")}
            style={i !== rec.mine && th != null
              ? { "--or-fill": `oklch(0.92 0.04 ${th})`, "--or-edge": `oklch(0.56 0.09 ${th})` } as React.CSSProperties
              : undefined}>
            <span className="or-fill" style={{ "--p": Math.round((i === rec.pred ? conf : 1 - conf) * 100) + "%" } as React.CSSProperties}></span>
            <span className="or-lab">{op.label}</span>
          </div>
        ) : (
          <button key={op.id} className="or-tile" disabled={!pre} onClick={() => answer(i)}>
            <span className="or-lab">{op.label}</span>
          </button>
        ))}
        {rec ? (
          <button className={"or-disc is-out" + (landed && brokeIt ? " is-ring" : "") + (why ? " is-asked" : "") + (landed && !hints.why ? " is-hint" : "")} style={dsty}
            onClick={(e) => {
              e.stopPropagation();
              setSel(null);
              setWhy(!why);
              if (!hints.why) { orSeen("why"); setHints({ ...orHints() }); }
            }}
            aria-label={why ? "Hide the evidence" : "Why it called " + (q.options[rec.pred]?.label ?? "")}></button>
        ) : <span className="or-disc" style={dsty} aria-hidden="true"></span>}
      </div>
      {rc && rq && (
        <div className="or-aside">{"“" + rq.q.text + "”"} — it called <b>{rq.q.options[rc.pred]?.label}</b>. {rc.pred === rc.mine ? "You did too." : <>You said <b>{rc.mine != null ? rq.q.options[rc.mine]?.label : ""}</b>.</>}</div>
      )}
      {why && !rc && rec && (
        <div className="or-aside">{tell && tell !== "none"
          ? <>People who picked <b>{tell.ev.q.options[mineIdx(tell.ev) ?? 0]?.label}</b> on {"“" + tell.ev.q.text + "”"} {orWord(tell.share.shares[rec.pred])} pick <b>{q.options[rec.pred]?.label}</b> — {tell.share.n} in both samples.</>
          : tell === "none"
            ? <>Nothing in your answers pointed either way here.</>
            : <>Reading the crowd…</>}</div>
      )}
      {hint && <div className="or-aside is-hint">{hint}</div>}
      <OrLedger log={log} qOf={qOf} sel={sel} onPick={(k) => { setSel(k); setWhy(false); }}></OrLedger>
      <div className="or-foot">
        {rec
          ? <button className="or-next" onClick={next}>Next</button>
          : <span className="or-sealed">sealed</span>}
      </div>
    </div>
  );
}
