// AskedByYouOverlay — "Asked by you": the buyer's room (PAID-PLAN §7,
// artboard B of the 2026-08-24 standalone; D288, runbook phase 2).
//
// Every purchase this account made, with live public state, the budget
// meter (answers ARE the billing unit, D164), the window hairline, and
// the report shelf. It reads the buyer's own purchase docs plus the same
// public aggregates everyone reads; there is no privileged read path,
// and the room's foot says so once.
//
// What this deliberately does NOT draw, each with its reason:
//   - the design's demo subscriptions (SUBS): PAID-PLAN §5 is unbuilt,
//     so a subscription row renders as a plain stated line, never the
//     mocked series (D167). The section arrives with §5.
//   - download chips on the report shelf: report hosting does not exist,
//     and a dead button is a promise — the shelf states milestones and
//     "delivered by the contract channel", which is true (D251 builds
//     reports per contract, by hand).
//   - a bell or an email when a report lands: "picked up here" is the
//     design's own posture — no notification path to build or promise.
import React from "react";
import LIVE from "../data/live";
import { loadMine, mine, mineFailed, subscribePurchases, type Purchase } from "../data/purchases";
// `fmtExact`, not `fmt`: every euro figure on this card is one this
// account was actually charged — the cap it paid up front, the rate its
// contract locked, an ad's flat price — and `fmt` rounds above a hundred
// to the nearest ten, which is a rate card's shape and a lie about a
// receipt. scripts/quote-copy.test.mjs pins the rule.
import { fmtExact, subscribeCur } from "../data/pricing";
import { SPONSOR_EVERY } from "../data/sponsored";
import { askWindow } from "../data/askWindow";
import { sharePcts } from "../data/pct";
// The switch lives in its own module since phase 4: the ask-a-question
// door (a different lazy chunk) renders it too, and CurSwitch.tsx's
// header says why an import between the two overlays was the wrong wire.
import { CurSwitch } from "./CurSwitch";

const SANS = "var(--sans)";
const K: React.CSSProperties = { fontFamily: SANS, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--ink-3)" };

const useCur = (): void => {
  const [, bump] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => subscribeCur(bump), []);
};

function Band({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--ink)", color: "var(--surface)", borderRadius: 999, padding: "4px 11px", minWidth: 0 }}>
      <span style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.16em", flexShrink: 0 }}>PAID</span>
      <span aria-hidden="true" style={{ width: 1, height: 12, background: "color-mix(in oklch, var(--surface) 42%, transparent)", flexShrink: 0 }}></span>
      <span style={{ fontFamily: SANS, fontSize: 11.5, fontWeight: 600, opacity: 0.72, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{children}</span>
    </span>
  );
}

function StateChip({ label, acc, hollow }: { label: string; acc?: string; hollow?: boolean }): React.ReactElement {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${hollow ? "var(--rule)" : `color-mix(in oklch, ${acc} 40%, var(--rule))`}`, borderRadius: 999, padding: "3px 9px", fontFamily: SANS, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: hollow ? "var(--ink-3)" : `color-mix(in oklch, ${acc} 82%, var(--ink))`, flexShrink: 0 }}>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: hollow ? "var(--surface-2)" : acc, border: hollow ? "1.5px solid var(--ink-3)" : "none", boxSizing: "border-box" }}></span>{label}
    </span>
  );
}

const fmtN = (n: number): string => n.toLocaleString("en-US").replace(/,/g, " ");
const DAY = 24 * 60 * 60 * 1000;
const dayMs = (s: string): number | null => {
  const t = Date.parse(`${s}T00:00:00Z`);
  return Number.isNaN(t) ? null : t;
};

/** one bought question: band + state · live public split · the budget
 * meter (answers against the cap — billing is per answer) · window
 * hairline · the report shelf as milestones */
function PurchaseCard({ p }: { p: Purchase }): React.ReactElement {
  useCur();
  const total = (p.counts || []).reduce((a, n) => a + n, 0);
  const lead = p.counts && p.counts.length
    ? p.counts.indexOf(Math.max(...p.counts))
    : -1;
  const cap = p.budget.cap || 1;
  const pct = Math.min(100, Math.round((total / cap) * 100));
  const spentEur = Math.min(p.budget.capEur, Math.round(total * p.budget.ratePerAnswer * 100) / 100);
  const t0 = dayMs(p.win.start);
  const t1 = dayMs(p.win.until);
  // captured once per mount (a lazy initializer keeps render pure): the
  // hairline is a days figure, and a card does not need to age on screen
  const [now] = React.useState(() => Date.now());
  // `askWindow` (data/askWindow.ts), not a second copy of the arithmetic.
  // `until` is an INCLUSIVE day key everywhere else — live.ts's `fresh()`
  // serves a question while `q.until >= today` — and this counted it
  // exclusive, and against wall-clock `now` rather than today's UTC
  // midnight. So the figure was one short all the way down and reached 0
  // on the contract's LAST SERVING DAY: "0 of 51 days left" with the
  // window hairline at 100%, beside a chip still saying running, while
  // the question was still being asked.
  //
  // The shared function refuses a closed window by returning null, which
  // is right for the serving ring and not for this card — a finished
  // contract still draws, with nothing left to run.
  const win = askWindow({ from: p.win.start, until: p.win.until }, new Date(now));
  const daysTotal = win
    ? win.days
    : (t0 != null && t1 != null ? Math.max(1, Math.round((t1 - t0) / DAY) + 1) : 1);
  const daysLeft = win ? win.daysLeft : 0;
  const windowLabel = `${p.place || "everyone"} · until ${p.win.until}`;
  return (
    <div className="card" style={{ marginTop: 12, padding: "13px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Band>{windowLabel}</Band>
        {p.state === "running" ? <StateChip label="running" acc="var(--accent)" /> : <StateChip label={p.state} hollow />}
      </div>
      <div style={{ marginTop: 10, fontFamily: SANS, fontSize: 16.5, fontWeight: 750, letterSpacing: "-0.02em", lineHeight: 1.2, textWrap: "pretty", color: "var(--ink)" }}>{p.prompt}</div>
      {p.dims.length > 0 && (
        <div style={{ marginTop: 6, fontFamily: SANS, fontSize: 11, fontWeight: 650, color: "var(--ink-3)" }}>{p.dims.join(" · ")}</div>
      )}
      {p.counts && total > 0 ? (
        <>
          <div style={{ display: "flex", gap: 2, height: 10, marginTop: 10 }}>
            {p.counts.map((n, i) => (
              <span key={i} aria-hidden="true" style={{ width: `${(n / total) * 100}%`, borderRadius: i === 0 ? "999px 3px 3px 999px" : i === p.counts!.length - 1 ? "3px 999px 999px 3px" : "3px", background: i === lead ? "color-mix(in oklch, var(--accent) 45%, var(--surface-3))" : "color-mix(in oklch, var(--ink) 14%, var(--surface-3))" }}></span>
            ))}
          </div>
          <div style={{ marginTop: 6, fontFamily: SANS, fontSize: 12, fontWeight: 650, color: "var(--ink-2)" }}>
            <span style={{ fontWeight: 800, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
              {/* `sharePcts`, not a hand-rolled round: this is the same
                  published counts vector the public feed card draws for
                  this question, and the feed rounds it with the app's one
                  largest-remainder rule (data/pct.ts). Two rules over one
                  vector disagree on about one cell in eleven at three to
                  four options, always by a point — so the buyer read a
                  headline share one off the one everybody else was
                  reading for the buyer's own question. The BAR widths
                  above stay exact fractions: they are a shape, not a
                  number anyone reads. */}
              {sharePcts(p.counts)[lead]}% {p.options[lead] || ""}
            </span>{" · "}
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtN(total)} {total === 1 ? "answer" : "answers"}</span>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 8, fontFamily: SANS, fontSize: 12, fontWeight: 600, color: "var(--ink-3)" }}>
          No answers yet — the split appears with the first one.
        </div>
      )}
      <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={K}>budget — answers against the cap</span>
        <span style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 700, color: "var(--ink-2)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmtExact(spentEur)} of {fmtExact(p.budget.capEur)} cap</span>
      </div>
      <div style={{ marginTop: 6, height: 8, borderRadius: 999, background: "var(--surface-3)", overflow: "hidden" }}>
        <span style={{ display: "block", width: `${pct}%`, height: "100%", borderRadius: 999, background: "var(--accent)" }}></span>
      </div>
      <div style={{ marginTop: 5, fontFamily: SANS, fontSize: 11.5, fontWeight: 650, color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>
        <span style={{ fontWeight: 800, color: "var(--ink)" }}>{fmtN(total)}</span> of {fmtN(p.budget.cap)} budget · {pct}% — bills per answer at {fmtExact(p.budget.ratePerAnswer)}, stops at the cap
      </div>
      <div style={{ marginTop: 11, display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden="true" style={{ flex: 1, height: 2, borderRadius: 99, background: "var(--surface-3)", position: "relative", overflow: "hidden" }}>
          <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(100, Math.round(((daysTotal - daysLeft) / daysTotal) * 100))}%`, background: "color-mix(in oklch, var(--ink) 30%, transparent)" }}></span>
        </span>
        <span style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{daysLeft} of {daysTotal} days left</span>
      </div>
      {p.reports.length > 0 && (
        <div style={{ marginTop: 11, borderTop: "1px solid color-mix(in oklch, var(--rule) 62%, transparent)" }}>
          {p.reports.map((r, i) => (
            <div key={r.label + i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 0", borderTop: i > 0 ? "1px solid color-mix(in oklch, var(--rule) 62%, transparent)" : "none" }}>
              <span style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: r.ready ? 700 : 650, color: r.ready ? "var(--ink)" : "var(--ink-3)" }}>{r.label}</span>
              <span style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 600, color: r.ready ? "var(--accent-ink, var(--accent))" : "var(--ink-3)", flexShrink: 0, textAlign: "right" }}>
                {r.ready ? "ready — delivered by the contract channel" : (r.note || "not yet")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** one bought AD (D315): band + state · the card's own words · the flat
 * price and the window. No split, no meter, no shelf — an ad collects
 * nothing, and the card says so instead of drawing an empty chart. */
function AdPurchaseCard({ p }: { p: Purchase }): React.ReactElement {
  useCur();
  return (
    <div className="card" style={{ marginTop: 12, padding: "13px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Band>{`ad · ${p.place || "everyone"} · until ${p.win.until}`}</Band>
        {p.state === "running" ? <StateChip label="running" acc="var(--accent)" /> : <StateChip label={p.state} hollow />}
      </div>
      <div style={{ marginTop: 10, fontFamily: SANS, fontSize: 16.5, fontWeight: 750, letterSpacing: "-0.02em", lineHeight: 1.2, textWrap: "pretty", color: "var(--ink)" }}>{p.headline}</div>
      <div style={{ marginTop: 5, fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.45, textWrap: "pretty" }}>{p.adBody}</div>
      <div style={{ marginTop: 7, fontFamily: SANS, fontSize: 11, fontWeight: 650, color: "var(--ink-3)" }}>
        {p.advertiser}{p.dims.length > 0 ? ` · ${p.dims.join(" · ")}` : ""}
      </div>
      <div style={{ marginTop: 11, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={K}>flat window — no meter</span>
        <span style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 700, color: "var(--ink-2)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmtExact(p.priceEur)} · runs {p.win.start} → {p.win.until}</span>
      </div>
      <div style={{ marginTop: 6, fontFamily: SANS, fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.45 }}>
        An ad collects nothing — no answers, no clicks, no tracking. It runs, that is all.
      </div>
    </div>
  );
}

export default function AskedByYouOverlay({ onClose }: { onClose: () => void }): React.ReactElement {
  useCur();
  const [, bump] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    if (!LIVE.enabled) return; // a demo build has no ledger to read
    const un = subscribePurchases(bump);
    // The room falls to its "couldn't read" line, and reopening retries.
    // It used to say "the empty state stands", which was not true: a throw
    // left the cache null and the spinner up for the life of the session.
    void loadMine().catch(() => { /* mineFailed() carries it; reopening retries */ });
    return un;
  }, []);
  const rows = LIVE.enabled ? mine() : [];
  const questions = (rows || []).filter((p) => p.kind === "question");
  const adRows = (rows || []).filter((p) => p.kind === "ad");
  const subsRows = (rows || []).filter((p) => p.kind === "subscription");
  return (
    <div className="overlay">
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose} aria-label="Close">✕</button>
        <div className="h-title">Asked by <em>you</em></div>
        <CurSwitch />
      </div>
      <div className="app-body" style={{ paddingBottom: 44 }}>
        <div style={{ margin: "14px 2px 0", fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.5, textWrap: "pretty" }}>
          Everything this account has bought — with its live public numbers and the report shelf. Reports are picked up here (no bells, no email — by design).
        </div>
        {rows == null ? (
          <div style={{ marginTop: 18, fontFamily: SANS, fontSize: 13, fontWeight: 600, color: "var(--ink-3)", textAlign: "center" }}>
            {mineFailed() ? "Couldn’t read your contracts. Close and reopen to try again." : "Reading your contracts…"}
          </div>
        ) : questions.length === 0 && adRows.length === 0 && subsRows.length === 0 ? (
          <div className="card" style={{ marginTop: 16, padding: "22px 18px", textAlign: "center", fontFamily: SANS, fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.5 }}>
            {`Nothing bought from this account yet. The door is “Ask a question” — one card in ${SPONSOR_EVERY} is paid.`}
          </div>
        ) : (
          <>
            {questions.map((p) => <PurchaseCard key={p.id} p={p} />)}
            {adRows.map((p) => <AdPurchaseCard key={p.id} p={p} />)}
            {subsRows.map((p) => (
              // A subscription row exists before its SURFACE does: the §5
              // series card (per-day docs, the pulse grammar) is unbuilt,
              // and drawing the design's mocked series would be the D167
              // failure. State the contract; the card arrives with §5.
              <div key={p.id} className="card" style={{ marginTop: 12, padding: "13px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={K}>subscription · {p.place || "everyone"}</span>
                  {p.state === "running" ? <StateChip label="active" acc="var(--c-city, var(--accent))" /> : <StateChip label={p.state} hollow />}
                </div>
                <div style={{ marginTop: 8, fontFamily: SANS, fontSize: 15, fontWeight: 750, letterSpacing: "-0.01em", lineHeight: 1.25, textWrap: "pretty" }}>{p.prompt}</div>
                <div style={{ marginTop: 7, fontFamily: SANS, fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.45 }}>
                  The series view lands with the score-subscription build (PAID-PLAN §5) — until then this row is the contract, stated.
                </div>
              </div>
            ))}
          </>
        )}
        <div style={{ margin: "16px 8px 24px", fontFamily: SANS, fontSize: 10.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.5, textAlign: "center", textWrap: "pretty" }}>
          Your purchase records, plus the same public numbers everyone reads — this room has no other source.
        </div>
      </div>
    </div>
  );
}
