// Ported from design/spec-modules/suggestions.jsx (the historical prototype),
// re-synced 2026-08-14 from design/standalone-v24/suggestions.jsx (the §8
// board), and REBUILT 2026-08-24 from design/standalone-2026-08-24/
// suggestions.jsx (D288 §1): the community board retired, so "Ask a
// question" is the paid path alone — the upvote board, the seeded
// suggestions and the Top/New/Picked lenses went with it. The store arrives
// by IMPORT (converted with the v24 sync); SuggestOverlay stays on `window`
// because app-shell reads deferred overlays off `window` DELIBERATELY — a
// failed chunk must degrade to a blank, not a ReferenceError
// (smoke-overlays.test.jsx mutation-checks exactly that).
//
// What the door prints, it reads (D288 §3, D167): every price, tick and
// demand word comes from data/pricing.ts over the COMMITTED
// content/pricing.json — the same dated card a buyer can diff — and a
// forecast renders ONLY where the card carries a completed campaign to
// measure from. The design's mocked SG_DEMAND and expected() curves did
// not survive the port, and nothing here re-invents them.
import React from 'react';
import { useDialog } from './primitives.jsx';
import { WPAL } from './world-palette.js';
import { SUGGESTIONS } from './suggestions.js';
import { WORLD_TOPICS } from './world-feed-data.js';
import { PRICING, rate, adFlat, demandWord, fmt, subscribeCur } from '../data/pricing';
// Imported so the printed slot position cannot drift from the one the feed
// actually holds (data/sponsored.ts is the seller of record).
import { SPONSOR_AT } from '../data/sponsored';
import { CurSwitch } from '../ui/CurSwitch';

// suggestions.jsx — "Ask a question": the paid door as a page (overlay).
// Every question is bought for a place and a window, reviewed, and always
// marked PAID. The board is the rate card — the current price of each
// cohort and the demand on its one daily slot.
const { useState: useSgState } = React;

function useSuggestions() {
  const [, bump] = useSgState(0);
  React.useEffect(() => {
    // One-shot load of your real rows when the door opens (live only) —
    // the store is deferred, the query even more so (D124/D129 posture).
    SUGGESTIONS.ensureLive();
    return SUGGESTIONS.subscribe(() => bump((x) => x + 1));
  }, [bump]);
  return SUGGESTIONS;
}

// Every printed price re-renders when the currency preference changes.
function useCurTick() {
  const [, bump] = useSgState(0);
  React.useEffect(() => subscribeCur(() => bump((x) => x + 1)), [bump]);
}

const sgHueCol = (hue) => WPAL.c('oklch(0.52 0.14 ' + (hue != null ? hue : 40) + ')');
// same side-hue rotation the daily uses — the preview feels like the real thing
const sgOptCol = (tc, i, n) => WPAL.opt(tc, i, n);
const sgLabel = { fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-3)' };

const sgFmtN = (n) => n.toLocaleString('en-US').replace(/,/g, ' ');
const SG_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const sgDay = (iso) => { const d = new Date(iso + 'T00:00:00Z'); return Number.isNaN(d.getTime()) ? iso : d.getUTCDate() + ' ' + SG_MONTHS[d.getUTCMonth()]; };
// null in the card means "tomorrow is open" — build-pricing writes the
// first covered date only when tomorrow is not (so the word never staledates).
//
// …AND IT ALSO MEANS "NO OPEN DAY AT ALL", which is build-pricing's own
// warning: the stored shape is `null | YYYY-MM-DD` and has no third value,
// so a fully booked scope arrives here indistinguishable from an empty
// one. `booked` is the field that can tell them apart — all ones — and
// asking it is this function's job rather than each caller's. 3fc470c0
// guarded the rate row and left the two callers inside the COMPOSER, which
// is the screen a buyer commits from and the one place nothing else on the
// page disputes the claim.
//
// Returns null for a full scope; the callers say what that means in their
// own words, because "from tomorrow · 29 days" and "first open day" want
// different sentences.
const sgNextOpen = (scope) => {
  const c = PRICING.cohorts[scope];
  const booked = c.booked || [];
  if (booked.length && booked.every(Boolean)) return null;
  return c.nextOpen == null ? 'tomorrow' : sgDay(c.nextOpen);
};
const SG_TONE = { quiet: 'var(--ink-3)', steady: 'var(--ochre-ink)', contested: 'var(--accent-ink)' };
const sgScopeName = (SG, a) => (a === 'world' || a === 'like' ? 'Everyone' : SG.audienceLabel(a));

// read-only preview of the answer shape, tinted by the suggestion's hue
function SgPreview({ s }) {
  const col = sgHueCol(s.hue);
  if (s.type === 'scale' || s.type === 'rating') {
    const ends = s.type === 'rating' ? ['1', '10'] : ['disagree', 'agree'];
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>{ends[0]}</span>
        <span style={{ flex: 1, height: 3, borderRadius: 999, background: 'linear-gradient(to right, color-mix(in oklch, ' + col + ' 40%, var(--surface-3)), var(--surface-3))' }}></span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>{ends[1]}</span>
      </div>
    );
  }
  const opts = s.options || [];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
      {opts.map((o, i) => (
        <span key={i} style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 650, color: 'var(--ink-2)', background: 'color-mix(in oklch, ' + sgOptCol(col, i, opts.length) + ' 8%, var(--surface))', border: '0.5px solid color-mix(in oklch, ' + sgOptCol(col, i, opts.length) + ' 32%, var(--rule))', borderRadius: 999, padding: '4px 11px' }}>{o}</span>
      ))}
    </div>
  );
}

// tiny state marks — one word each, so the room needs no legend
function SgTag({ label, col }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', lineHeight: 1, color: 'color-mix(in oklch, ' + col + ' 82%, var(--ink))', background: 'color-mix(in oklch, ' + col + ' 10%, transparent)', border: '0.5px solid color-mix(in oklch, ' + col + ' 30%, var(--rule))', borderRadius: 999, padding: '4px 8px 3px' }}>{label}</span>;
}

const SG_TYPES = [['binary', 'this or that'], ['dilemma', 'dilemma'], ['choice', 'multiple choice'], ['scale', 'scale']];

// ── your asks: status first, and a decline that states the standard it
// missed, the reason behind it, and — where one exists — the way forward.
// A LIVE row shows the review's own note as the reason (SUGGESTIONS.declineOf).
//
// Booking rows (D313) add three states the legacy pipeline never had:
// "checking" (the automated review is running — seconds, usually),
// "approved" (the pay button IS the next step, priced from the locked
// quote), and "live" (the window it is serving). The pay tap asks the
// server for a Stripe URL and opens it in the system browser — commerce
// stays on the web side; if the open is blocked, the link renders and
// the tap is the person's own.
function SgMine({ s, SG, onResend }) {
  const col = sgHueCol(s.hue);
  const d = SG.declineOf(s);
  const [payBusy, setPayBusy] = useSgState(false);
  const [payUrl, setPayUrl] = useSgState(null);
  const [payErr, setPayErr] = useSgState(null);
  const tone = s.status === 'picked' || s.status === 'live' ? 'var(--c-city)'
    : s.status === 'declined' ? 'var(--ink-3)'
      : s.status === 'approved' ? 'var(--accent-ink)' : 'var(--ochre-ink)';
  const label = s.status === 'picked' ? 'ran' : s.status === 'live' ? 'live'
    : s.status === 'declined' ? 'declined'
      : s.status === 'approved' ? 'approved' : s.booking ? 'checking' : 'in review';
  const pay = async () => {
    if (payBusy) return;
    setPayBusy(true); setPayErr(null);
    const res = await SG.payFor(s.id);
    setPayBusy(false);
    if (!res || res.ok === false) { setPayErr((res && res.message) || 'That didn\'t go through — try again.'); return; }
    const w = window.open(res.url, '_blank');
    if (!w) setPayUrl(res.url); // popup blocked — hand the link over instead
  };
  return (
    <div className="card" style={{ padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SgTag label={label} col={tone}></SgTag>
        <span style={{ flex: 1 }}></span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' }}>{s.ago === 'just now' ? 'just now' : s.ago + ' ago'}</span>
      </div>
      <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 16.5, lineHeight: 1.26, letterSpacing: '-0.32px', textWrap: 'pretty' }}>{s.prompt}</div>
      {s.kind === 'ad' && s.adBody ? (
        <div style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.45, textWrap: 'pretty' }}>{s.adBody}</div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: col }}></span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>
          {s.status === 'picked' && s.ran ? s.ran
            : s.status === 'live' && s.win ? (s.kind === 'ad' ? 'ad · ' : '') + SG.audienceLabel(s.audience) + ' · runs ' + s.win.start + ' → ' + s.win.until
              : s.kind === 'ad' ? 'ad by ' + (s.advertiser || 'you') + ' · ' + SG.audienceLabel(s.audience)
                : SG.audienceLabel(s.audience) + ' · ' + SG.cadenceLabel(s.cadence)}
        </span>
      </div>
      {s.status === 'approved' && s.quote ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '0.5px solid color-mix(in oklch, var(--rule), transparent 25%)', paddingTop: 10 }}>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.5, textWrap: 'pretty' }}>
            {s.kind === 'ad'
              ? 'Approved at ' + fmt(s.quote.flatEur) + ' flat — it runs ' + s.quote.windowDays + ' days from your scope\'s first open ad day after you pay.'
              : 'Approved at ' + fmt(s.quote.ratePerAnswer) + ' per answer, capped at ' + fmt(s.quote.capEur) + ' — it runs ' + s.quote.windowDays + ' days from the day after you pay, and the unserved part refunds at close.'}
          </span>
          <button className="press" onClick={pay} disabled={payBusy} style={{ alignSelf: 'flex-start', padding: '9px 15px', borderRadius: 999, cursor: payBusy ? 'default' : 'pointer', WebkitAppearance: 'none', border: 'none', background: 'var(--ink)', color: 'var(--surface)', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 800 }}>
            {payBusy ? 'Opening…' : 'Pay ' + fmt(s.kind === 'ad' ? s.quote.flatEur : s.quote.capEur) + ' →'}
          </button>
          {payUrl ? (
            <a href={payUrl} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, color: 'var(--accent-ink)' }}>Open the payment page →</a>
          ) : null}
          {payErr ? (
            <div role="alert" style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 650, color: 'var(--ink)', background: 'var(--surface-2)', border: '0.5px solid var(--rule)', borderRadius: 10, padding: '10px 12px', lineHeight: 1.5, textWrap: 'pretty' }}>{payErr}</div>
          ) : null}
        </div>
      ) : null}
      {d ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '0.5px solid color-mix(in oklch, var(--rule), transparent 25%)', paddingTop: 10 }}>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 800, letterSpacing: '-0.01em' }}>{d.line}</span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.5, textWrap: 'pretty' }}>{d.why}</span>
          {d.offer ? <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.5, textWrap: 'pretty' }}>{d.offer}</span> : null}
          {d.offerAudience ? (
            <button className="press" onClick={() => onResend(s, d.offerAudience)} style={{ alignSelf: 'flex-start', marginTop: 2, padding: '9px 15px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', border: 'none', background: 'var(--ink)', color: 'var(--surface)', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 800 }}>
              Send it for {SG.audienceLabel(d.offerAudience)}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ── the rate card (PAID-PLAN §6): one row per cohort, all of it read off
// the committed card — the posted line, the next 14 days as real ticks,
// the demand word from the same idx the line is priced by.
function SgRateRow({ scope, name, onPick }) {
  const booked = PRICING.cohorts[scope].booked || [];
  const nBooked = booked.filter(Boolean).length;
  const firstOpen = booked.indexOf(0);
  const word = demandWord(scope);
  return (
    <button className="card press" onClick={onPick} style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10, padding: '13px 15px 14px', cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 15.5, fontWeight: 800, letterSpacing: '-0.2px', color: 'var(--ink)' }}>{name}</span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>one paid slot a day</span>
        <span style={{ flex: 1 }}></span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 800, letterSpacing: '-0.2px', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{fmt(rate(scope))}</span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>/ answer</span>
      </div>
      <div aria-label={nBooked + ' of the next ' + booked.length + ' days booked'} style={{ display: 'flex', gap: 2.5 }}>
        {booked.map((b, i) => (
          <span key={i} aria-hidden="true" style={{ flex: 1, height: 7, borderRadius: 2, background: i === firstOpen ? 'var(--accent)' : b ? 'color-mix(in oklch, var(--ink) 72%, var(--surface-3))' : 'var(--surface-3)' }}></span>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: SG_TONE[word] }}>{word}</span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' }}>{nBooked} of {booked.length} days booked · ×{PRICING.cohorts[scope].idx}</span>
        <span style={{ flex: 1 }}></span>
        {/* ONLY WHEN THERE IS ONE. `nextOpen` cannot express a sold-out
            cohort: build-pricing writes null both for "tomorrow is open"
            and for "no day in the window is", because the stored shape has
            no third value — so a fully booked scope printed "next open
            tomorrow" beside its own "14 of 14 days booked" and beside a row
            of fourteen filled ticks. Two contradictory claims, and the
            false one is the one a buyer acts on.
            `booked` is the field that CAN say it, and firstOpen is already
            read above for the tick colour. Nothing is drawn instead: the
            count beside it already says the scope is full, and a second
            sentence saying so is the shape COPY.md deletes. */}
        {firstOpen !== -1 && (
          <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 750, color: 'var(--accent-ink)' }}>next open {sgNextOpen(scope)}</span>
        )}
      </div>
    </button>
  );
}

function SgRateBoard({ SG, onPick }) {
  useCurTick();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '0 2px' }}>
        <span style={sgLabel}>the rate card · {sgDay(PRICING.generated)}</span>
        <span style={{ flex: 1 }}></span>
        <CurSwitch></CurSwitch>
      </div>
      <SgRateRow scope="city" name={sgScopeName(SG, 'city')} onPick={() => onPick('city')}></SgRateRow>
      <SgRateRow scope="country" name={sgScopeName(SG, 'country')} onPick={() => onPick('country')}></SgRateRow>
      <SgRateRow scope="world" name="Everyone" onPick={() => onPick('world')}></SgRateRow>
      <div style={{ margin: '0 2px', fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.5, textWrap: 'pretty' }}>
        The line is {fmt(PRICING.base)} × the cohort's demand index — sold ÷ available slot-days over the trailing {PRICING.trailingDays}, floored ×{PRICING.floorX}, ceilinged ×{PRICING.ceilX}. The line you lock at booking is the line you keep; billed per answer, capped at {fmt(PRICING.capEur)}.
      </div>
    </div>
  );
}

function SgDoorChip({ on, label, onTap }) {
  return (
    <button className="press" onClick={onTap} aria-pressed={on} style={{
      padding: '6px 11px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none',
      border: on ? '0.5px solid var(--ink)' : '0.5px solid var(--rule)',
      background: on ? 'var(--ink)' : 'var(--surface)', color: on ? 'var(--surface)' : 'var(--ink-2)',
      fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
      transition: 'background .16s, color .16s, border-color .16s',
    }}>{label}</button>
  );
}

// the scope ruler — city · country · world as the app's graduated-tick
// instrument, price riding the same axis: picking scope IS reading the price
function SgScopeRuler({ SG, value, onPick }) {
  const stops = [['city', sgScopeName(SG, 'city'), 9, 9], ['country', sgScopeName(SG, 'country'), 50, 12], ['world', 'Everyone', 91, 15]];
  const active = value === 'city' || value === 'country' ? value : 'world';
  const minor = Array.from({ length: 25 }, (_, i) => ({ x: 9 + i * (82 / 24), h: 4 }));
  return (
    <div style={{ position: 'relative', height: 62, marginTop: 8 }}>
      <div aria-hidden="true" style={{ position: 'absolute', left: 4, right: 4, top: 20, height: 1, background: 'var(--rule)' }}></div>
      {minor.map((t, i) => <span key={i} aria-hidden="true" style={{ position: 'absolute', left: t.x + '%', top: 20 - t.h, width: 1, height: t.h, borderRadius: 99, background: 'color-mix(in oklch, var(--ink-3), transparent 60%)' }}></span>)}
      {stops.map(([id, label, x, h]) => {
        const on = id === active;
        const th = on ? 14 : 10;
        return (
          <button key={id} className="press" onClick={() => onPick(id)} aria-pressed={on} style={{ position: 'absolute', left: x + '%', top: 0, transform: 'translateX(-50%)', width: 64, height: 62, border: 'none', background: 'none', padding: 0, cursor: 'pointer', WebkitAppearance: 'none' }}>
            <span aria-hidden="true" style={{ position: 'absolute', left: '50%', top: 20 - (on ? th : h), transform: 'translateX(-50%)', width: on ? 3 : 1.5, height: on ? th : h, borderRadius: 99, background: on ? 'var(--accent)' : 'color-mix(in oklch, var(--ink-3), transparent 40%)' }}></span>
            <span style={{ position: 'absolute', left: '50%', top: 26, transform: 'translateX(-50%)', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: on ? 800 : 600, letterSpacing: '-0.01em', color: on ? 'var(--ink)' : 'var(--ink-3)', whiteSpace: 'nowrap' }}>{label}</span>
            <span style={{ position: 'absolute', left: '50%', top: 43, transform: 'translateX(-50%)', fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: on ? 800 : 650, color: on ? 'var(--accent-ink)' : 'var(--ink-3)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(rate(id))}</span>
          </button>
        );
      })}
    </div>
  );
}

const sgInput = {
  width: '100%', boxSizing: 'border-box', fontFamily: 'var(--sans)', fontSize: 'var(--field-size)', fontWeight: 600, color: 'var(--ink)',
  background: 'var(--surface)', border: '0.5px solid var(--rule)', borderRadius: 12, padding: '12px 13px', outline: 'none',
};

// ── the composer IS the paid flow: question → shape → place & window →
// price → book. Money buys the place and the window, never the review
// and never the frame (docs/PAID-PLAN.md; D288 §3). Since D313 the flow
// is machinery end to end: booking → automated review → Stripe checkout
// on the web → live — and the sheet states exactly that, because the
// old "human contract today" sentence stopped being true the day the
// loop stopped needing one.
function SgForm({ SG, initialAudience, onDone, onCancel }) {
  const [prompt, setPrompt] = useSgState('');
  const [type, setType] = useSgState('binary');
  const [opts, setOpts] = useSgState(['', '']);
  const [topicId, setTopicId] = useSgState(null);
  // The ad lane (D315): same door, same review, same checkout — a
  // different product behind the switch. Text-only, link-free, always
  // named, flat-priced; the composer's question apparatus (type, options,
  // topic) simply is not it.
  const [adMode, setAdMode] = useSgState(false);
  const [advertiser, setAdvertiser] = useSgState('');
  const [headline, setHeadline] = useSgState('');
  const [adBody, setAdBody] = useSgState('');
  const [audience, setAudience] = useSgState(initialAudience || 'world');
  const [wearName, setWearName] = useSgState(true);
  const [ageDim, setAgeDim] = useSgState(false);
  const [paidStep, setPaidStep] = useSgState('form');
  const [sending, setSending] = useSgState(false);
  // the server's refusal, shown verbatim — the messages are written to be
  // shown (the budget, a form bound)
  const [refusal, setRefusal] = useSgState(null);
  useCurTick();
  const topics = WORLD_TOPICS;
  const topic = topics.find((t) => t.id === topicId) || null;
  const hue = topic ? parseFloat((topic.color.match(/([\d.]+)\)/) || [])[1]) : 282;
  const topicCol = topic ? topic.color : sgHueCol(hue);
  const needOpts = type === 'binary' || type === 'choice' || type === 'dilemma';
  const chooseType = (t) => { setType(t); const n = t === 'binary' ? 2 : t === 'dilemma' ? 3 : 4; setOpts(Array.from({ length: n }, (_, i) => opts[i] || '')); };
  const setOpt = (i, v) => setOpts((o) => o.map((x, j) => (j === i ? v : x)));
  const filled = opts.filter((o) => o.trim());
  const valid = adMode
    ? advertiser.trim() && headline.trim() && adBody.trim()
    : prompt.trim() && (!needOpts || filled.length >= 2);

  const scopeKey = audience === 'city' || audience === 'country' ? audience : 'world';
  const scopeName = sgScopeName(SG, audience);
  const band = SG.ageBand();
  const parentLabel = scopeKey === 'city' ? sgScopeName(SG, 'country') : 'everyone';
  // Only dims the SERVING can match (sponsored.ts reads the anchors) —
  // topic left this list with D313: it is content, the match never reads
  // it, and a band printing an audience the device cannot verify would be
  // the disclosure design lying about itself.
  //
  // An ad wears AT MOST ONE tag (D197 rule 4), and a place scope IS one —
  // so the age chip only exists for a world-scoped ad, and the flag is
  // ignored where a place already fills the quota.
  const ageDimOn = ageDim && band && (!adMode || audience === 'world');
  const dims = [];
  if (audience === 'city') dims.push('City: ' + SG.audienceLabel('city'));
  if (audience === 'country') dims.push('Country: ' + SG.audienceLabel('country'));
  if (ageDimOn) dims.push('Age: ' + band);
  const extraDims = ageDimOn ? 1 : 0;
  const buyer = wearName ? SG.meName() : 'The buyer';
  const whyLine = dims.length
    ? buyer + ' asked for ' + dims.map((d) => d.slice(d.indexOf(': ') + 2)).join(' · ') + ', and your profile says that.'
    : buyer + ' asked everyone — nothing about you decided this.';

  // A forecast renders only where the committed card carries one — a
  // cohort with no completed campaign prints the floor RULE, never an
  // invented per-day figure (D288 §3, the withheld-estimates half).
  const est = PRICING.estimates[scopeKey];
  const floorRule = scopeKey === 'world' && !extraDims ? null
    : 'under ' + PRICING.floorWeek + ' answers a week it runs as ' + parentLabel + ', your dims still printed';
  const underFloor = est && !extraDims && est.perDay * 7 < PRICING.floorWeek;
  const floorLine = (() => {
    if (!est) return ['No completed campaign here yet — no forecast', floorRule].filter(Boolean).join('; ') + '.';
    const head = '≈ ' + sgFmtN(est.perDay) + ' answers a day for all of ' + scopeName + ' · from ' + est.campaigns + ' campaign' + (est.campaigns === 1 ? '' : 's');
    if (extraDims) return head + ' — your cut is smaller; ' + floorRule + '.';
    if (underFloor) return head + ' — ' + (floorRule || 'under the ' + PRICING.floorWeek + '-a-week floor') + '.';
    return head + ' — clears the ' + PRICING.floorWeek + '-a-week floor.';
  })();

  const submit = async () => {
    if (!valid || sending) return;
    setSending(true); setRefusal(null);
    // The audience the server books is RAW buckets (SG.audienceBucket) —
    // the labels on the chips are display, and sponsored.ts matches the
    // stored anchor values with exact equality. Topic is content, not an
    // audience dim: nothing in the serving can match on it, and a band
    // printing a dim the match never reads would be a disclosure that lies.
    const dims = {};
    if (audience === 'city') { const b = SG.audienceBucket('city'); if (b) dims.city = b; }
    if (audience === 'country') { const b = SG.audienceBucket('country'); if (b) dims.country = b; }
    if (ageDimOn) { const b = SG.audienceBucket('ageBand'); if (b) dims.ageBand = b; }
    const res = await SG.submitPaid(adMode
      ? { kind: 'ad', advertiser, headline, body: adBody, scope: scopeKey, dims }
      : {
        kind: 'question', prompt, type, options: needOpts ? opts : [],
        topic: topic ? topic.id : null,
        scope: scopeKey, dims, wearName,
      });
    setSending(false);
    if (res && res.ok === false) { setRefusal(res.message); return; }
    onDone();
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 7 }}>
        <div style={sgLabel}>{adMode ? 'your ad' : 'your question'}</div>
        <span style={{ flex: 1 }}></span>
        <button onClick={onCancel} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', WebkitAppearance: 'none', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>Cancel</button>
      </div>
      {/* the product switch (D315): a question collects answers and bills
          per answer; an ad is text with a flat window. Same review, same
          checkout, different object — the form says which it is building. */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <SgDoorChip on={!adMode} label="a question" onTap={() => setAdMode(false)}></SgDoorChip>
        <SgDoorChip on={adMode} label="an ad — text only, no link" onTap={() => setAdMode(true)}></SgDoorChip>
      </div>
      {adMode ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <input value={advertiser} onChange={(e) => setAdvertiser(e.target.value)} placeholder="Advertiser — the name on the card" autoComplete="organization" maxLength={40} style={sgInput}></input>
          <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Headline" autoComplete="off" autoCapitalize="sentences" maxLength={70} style={sgInput}></input>
          <input value={adBody} onChange={(e) => setAdBody(e.target.value)} placeholder="One line of text — no links, nothing tappable" autoComplete="off" autoCapitalize="sentences" enterKeyHint="done" maxLength={140} style={{ ...sgInput, padding: '10px 13px' }}></input>
        </div>
      ) : (
      <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. Sunrise or sunset?" autoFocus autoComplete="off" autoCapitalize="sentences" enterKeyHint="done" style={sgInput}></input>
      )}

      {adMode ? null : <>
      <div style={{ ...sgLabel, margin: '14px 0 7px' }}>hints · the review decides</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {SG_TYPES.map(([id, lab]) => {
          const on = type === id;
          return (
            <button key={id} onClick={() => chooseType(id)} aria-pressed={on} style={{
              flex: '1 1 auto', padding: '8px 10px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none',
              border: on ? '0.5px solid var(--ink)' : '0.5px solid var(--rule)',
              background: on ? 'var(--ink)' : 'var(--surface)', color: on ? 'var(--surface)' : 'var(--ink-2)',
              fontFamily: 'var(--sans)', fontSize: 12, fontWeight: on ? 750 : 600, whiteSpace: 'nowrap',
              transition: 'background .16s, color .16s, border-color .16s',
            }}>{lab}</button>
          );
        })}
      </div>

      {needOpts ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
          {opts.map((o, i) => (
            <input key={i} value={o} onChange={(e) => setOpt(i, e.target.value)} placeholder={'Option ' + (i + 1) + (i > 1 ? ' (optional)' : '')} style={{ ...sgInput, padding: '10px 13px' }}></input>
          ))}
        </div>
      ) : null}

      <div style={{ ...sgLabel, margin: '14px 0 7px' }}>topic · optional</div>
      <div className="h-scroll" style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', overflowX: 'auto', margin: '0 -16px', padding: '2px 16px' }}>
        {topics.map((t) => {
          const on = topicId === t.id;
          return (
            <button key={t.id} onClick={() => setTopicId(on ? null : t.id)} aria-pressed={on} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              WebkitAppearance: 'none', appearance: 'none', fontFamily: 'var(--sans)', fontSize: 12, fontWeight: on ? 750 : 600,
              border: '0.5px solid ' + (on ? 'color-mix(in oklch, ' + t.color + ' 55%, var(--rule))' : 'var(--rule)'),
              background: on ? 'color-mix(in oklch, ' + t.color + ' 10%, var(--surface))' : 'var(--surface)',
              color: on ? 'color-mix(in oklch, ' + t.color + ' 75%, var(--ink))' : 'var(--ink-3)',
              transition: 'background .16s, color .16s, border-color .16s',
            }}>
              <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: t.color, opacity: on ? 1 : 0.55 }}></span>
              {t.label.toLowerCase()}
            </button>
          );
        })}
      </div>
      </>}

      {adMode && headline.trim() ? (
        <div style={{ marginTop: 14 }}>
          <div style={{ ...sgLabel, marginBottom: 7 }}>preview</div>
          <div style={{ border: '1px solid var(--rule)', borderRadius: 16, background: 'var(--surface)', padding: '14px 14px 13px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--ink)', color: 'var(--surface)', borderRadius: 999, padding: '4px 11px', maxWidth: '100%', boxSizing: 'border-box' }}>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.16em', flexShrink: 0 }}>PAID</span>
              <span aria-hidden="true" style={{ width: 1, height: 12, background: 'color-mix(in oklch, var(--surface) 42%, transparent)', flexShrink: 0 }}></span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{advertiser.trim() || 'Advertiser'}</span>
            </div>
            <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 19, lineHeight: 1.15, letterSpacing: '-0.4px', textWrap: 'pretty', margin: '10px 0 6px' }}>{headline}</div>
            {adBody.trim() ? <div style={{ fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.45, textWrap: 'pretty' }}>{adBody}</div> : null}
          </div>
        </div>
      ) : null}

      {!adMode && prompt.trim() ? (
        <div style={{ marginTop: 14 }}>
          <div style={{ ...sgLabel, marginBottom: 7 }}>preview</div>
          <div style={{ border: '1px solid color-mix(in oklch, ' + topicCol + ' 26%, var(--rule))', borderRadius: 16, background: 'var(--surface)', padding: '14px 14px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: topicCol, flexShrink: 0 }}></span>
              <span style={sgLabel}>today{topic ? ' · ' + topic.label : ''}</span>
            </div>
            <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 21, lineHeight: 1.12, letterSpacing: '-0.5px', textWrap: 'pretty', margin: '9px 0 11px' }}>{prompt}</div>
            {needOpts ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(filled.length ? filled : ['Option 1', 'Option 2']).map((o, i, arr) => {
                  const oc = sgOptCol(topicCol, i, arr.length);
                  return (
                    <div key={i} style={{ background: 'color-mix(in oklch, ' + oc + ' 12%, var(--surface))', border: '1.5px solid color-mix(in oklch, ' + oc + ' 55%, var(--rule))', borderRadius: 14, padding: '12px 14px', display: 'flex', gap: 11, alignItems: 'center', opacity: filled.length ? 1 : 0.45 }}>
                      <span style={{ width: 11, height: 11, borderRadius: '50%', flexShrink: 0, background: oc }}></span>
                      <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{o}</span>
                    </div>
                  );
                })}
              </div>
            ) : <SgPreview s={{ type, hue }}></SgPreview>}
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 16, borderTop: '0.5px solid color-mix(in oklch, var(--rule), transparent 25%)', paddingTop: 13 }}>
        {paidStep === 'contract' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ border: '0.5px solid var(--rule)', borderRadius: 12, background: 'var(--surface-2)', padding: '2px 12px' }}>
              {(adMode ? [
                ['Scope', scopeName],
                // An ad's window queues behind the scope's running ad
                // (D315) — its day-exclusivity is what the flat price
                // buys, so the start is "first open ad day", not a date
                // the sheet could go stale holding.
                ['Window', 'first open ad day after you pay · 29 days'],
                ['Audience', dims.join(' · ') || 'everyone — untagged'],
                ['Price', fmt(adFlat(scopeKey)) + ' flat · ×' + PRICING.cohorts[scopeKey].idx + ' · locked at approval'],
              ] : [
                ['Scope', scopeName],
                // The functional window (D313): serving starts the day
                // after payment lands — never a pre-picked day that goes
                // stale while the checkout sits open.
                ['Window', 'from the day after you pay · 29 days'],
                ['Audience', dims.join(' · ') || 'everyone — untagged'],
                ['Rate', fmt(rate(scopeKey)) + ' per answer · ×' + PRICING.cohorts[scopeKey].idx + ' · locked at approval'],
                ...(est ? [['Estimate', '≈ ' + sgFmtN(est.perDay * 29) + ' answers · from ' + est.campaigns + ' campaign' + (est.campaigns === 1 ? '' : 's')]] : []),
                ['Your cap', fmt(PRICING.capEur) + ' up front · unserved answers refund at close'],
              ]).map((r, i, arr) => (
                <div key={r[0]} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, padding: '7px 0', borderBottom: i < arr.length - 1 ? '0.5px solid color-mix(in oklch, var(--rule), transparent 25%)' : 'none' }}>
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' }}>{r[0]}</span>
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 750, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{r[1]}</span>
                </div>
              ))}
            </div>
            {/* "Arranged directly for now — no self-serve yet" stood here
                until D313 made it false: the loop is machinery now, and
                the sheet says what the machinery actually does. The old
                estimate line promised a free window extension nothing was
                built to grant — the refund is the promise the closer
                actually keeps. */}
            <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.5, textWrap: 'pretty' }}>
              {adMode
                ? 'Flat price, no meter — an ad collects no answers, no clicks and no tracking. Other ads never overlap yours; a paid question in your scope shares the slot day-for-day.'
                : 'Locked rate · billed per answer · what the window doesn\'t deliver refunds automatically at close.'}
            </span>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 750, color: 'var(--ink)' }}>Checked automatically before anything is charged.</span>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.45 }}>
              {adMode
                ? 'Approved ads unlock payment; the card runs from your scope\'s first open ad day and retires itself at window end.'
                : 'Approved asks unlock payment; the card runs from the day after you pay, and every answer lands where you can watch it.'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="press" onClick={submit} disabled={!valid || sending} style={{ flex: 1, minHeight: 44, borderRadius: 999, cursor: valid && !sending ? 'pointer' : 'default', WebkitAppearance: 'none', border: 'none', background: valid ? 'var(--ink)' : 'var(--surface-3)', color: valid ? 'var(--surface)' : 'var(--ink-3)', fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 800 }}>{sending ? 'Booking…' : 'Book it →'}</button>
              <button className="press" onClick={() => setPaidStep('form')} style={{ border: 'none', background: 'none', cursor: 'pointer', WebkitAppearance: 'none', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>Keep the draft</button>
            </div>
            {refusal ? (
              <div role="alert" style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 650, color: 'var(--ink)', background: 'var(--surface-2)', border: '0.5px solid var(--rule)', borderRadius: 10, padding: '10px 12px', lineHeight: 1.5, textWrap: 'pretty' }}>{refusal}</div>
            ) : null}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <span style={sgLabel}>{adMode ? 'scope — who sees it' : 'scope — who gets asked'}</span>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>{adMode ? 'flat per window' : 'posted per answer'} · card of {sgDay(PRICING.generated)}</span>
              </div>
              <SgScopeRuler SG={SG} value={audience} onPick={setAudience}></SgScopeRuler>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={sgLabel}>{adMode ? 'audience · one tag' : 'audience · combine freely'}</span>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>every dim is printed on the card</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
                <SgDoorChip on={audience === 'city'} label={'City: ' + SG.audienceLabel('city')} onTap={() => setAudience(audience === 'city' ? 'world' : 'city')}></SgDoorChip>
                <SgDoorChip on={audience === 'country'} label={'Country: ' + SG.audienceLabel('country')} onTap={() => setAudience(audience === 'country' ? 'world' : 'country')}></SgDoorChip>
                {band && (!adMode || audience === 'world') ? <SgDoorChip on={ageDimOn} label={'Age: ' + band} onTap={() => setAgeDim(!ageDim)}></SgDoorChip> : null}
              </div>
              {/* the floor line forecasts ANSWERS, which an ad does not
                  collect — in ad mode the sentence would be about the
                  wrong product, so it is absent rather than reworded */}
              {adMode ? null : (
              <div style={{ marginTop: 7, fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 650, color: underFloor ? 'var(--accent-ink)' : 'var(--ink-3)', lineHeight: 1.45, textWrap: 'pretty' }}>
                {floorLine}
              </div>
              )}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={sgLabel}>window</span>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>first open day: {sgNextOpen(scopeKey) || 'none in the next 14'}</span>
              </div>
              {/* "ask it daily" left with D313: the over-time lane is the
                  pulse machinery (PAID-PLAN §8) and it is not wired to
                  self-serve — a chip that books nothing different would be
                  a control that lies. It returns when that lane does. */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
                <SgDoorChip on={true} label="29 days" onTap={() => {}}></SgDoorChip>
                {adMode
                  ? <SgDoorChip on={true} label={'named: ' + (advertiser.trim() || 'the advertiser')} onTap={() => {}}></SgDoorChip>
                  : <SgDoorChip on={wearName} label="wear your name" onTap={() => setWearName(!wearName)}></SgDoorChip>}
              </div>
            </div>
            <div style={{ border: '1px solid color-mix(in oklch, var(--ink) 22%, var(--rule))', borderRadius: 14, background: 'var(--surface-2)', padding: '11px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={sgLabel}>what everyone sees</span>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>position {SPONSOR_AT} · rotates by day</span>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--ink)', color: 'var(--surface)', borderRadius: 999, padding: '4px 11px', marginTop: 9, maxWidth: '100%', boxSizing: 'border-box' }}>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.16em', flexShrink: 0 }}>PAID</span>
                {(adMode || wearName) ? <span aria-hidden="true" style={{ width: 1, height: 12, background: 'color-mix(in oklch, var(--surface) 42%, transparent)', flexShrink: 0 }}></span> : null}
                {adMode
                  ? <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{advertiser.trim() || 'Advertiser'}</span>
                  : wearName ? <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{SG.meName()}</span> : null}
                <span aria-hidden="true" style={{ width: 1, height: 12, background: 'color-mix(in oklch, var(--surface) 42%, transparent)', flexShrink: 0 }}></span>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, opacity: 0.72, whiteSpace: 'nowrap', flexShrink: 0 }}>29 days</span>
              </div>
              <div style={{ marginTop: 7, fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.45 }}>{whyLine}</div>
              {/* "counts and cuts — never names" was the pre-D98 promise, false
                  since answers went public: the buyer reads what any signed-in
                  user reads. SponsorMark.tsx says the honest version on the
                  card and its test pins the old words out; this door says the
                  same. */}
              <div style={{ marginTop: 3, fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 650, color: 'var(--ink-2)', lineHeight: 1.45 }}>
                {adMode ? 'Text only, nothing tappable, nothing tracked — the card is the whole ad.' : 'They get the same public numbers you do. There is no private cut.'}
              </div>
              {adMode && headline.trim() ? <div style={{ marginTop: 8, fontFamily: 'var(--sans)', fontSize: 15.5, fontWeight: 750, letterSpacing: '-0.02em', lineHeight: 1.2, textWrap: 'pretty' }}>{headline}</div> : null}
              {adMode && adBody.trim() ? <div style={{ marginTop: 5, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.45, textWrap: 'pretty' }}>{adBody}</div> : null}
              {!adMode && prompt.trim() ? <div style={{ marginTop: 8, fontFamily: 'var(--sans)', fontSize: 15.5, fontWeight: 750, letterSpacing: '-0.02em', lineHeight: 1.2, textWrap: 'pretty' }}>{prompt}</div> : null}
              {!adMode && prompt.trim() && needOpts ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {(filled.length ? filled : ['Option 1', 'Option 2']).map((o, i, arr) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '0.5px solid var(--rule)', borderRadius: 999, padding: '4px 11px', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 650, color: 'var(--ink-2)', opacity: filled.length ? 1 : 0.45 }}>
                      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: sgOptCol(topicCol, i, arr.length) }}></span>{o}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{adMode ? fmt(adFlat(scopeKey)) + ' / window' : fmt(rate(scopeKey)) + ' / answer'}</span>
                  <span style={{ display: 'block', fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 600, color: 'var(--ink-3)' }}>×{PRICING.cohorts[scopeKey].idx} · locked at booking</span>
                </span>
                <span style={{ flex: 1 }}></span>
                <CurSwitch></CurSwitch>
              </div>
              <button className="press" onClick={() => { if (valid) setPaidStep('contract'); }} disabled={!valid} style={{ width: '100%', boxSizing: 'border-box', marginTop: 10, minHeight: 44, padding: '0 16px', borderRadius: 999, cursor: valid ? 'pointer' : 'default', WebkitAppearance: 'none', border: '1px solid var(--ink)', background: valid ? 'var(--surface)' : 'var(--surface-3)', color: valid ? 'var(--ink)' : 'var(--ink-3)', fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 800, whiteSpace: 'nowrap' }}>
                Price it for {scopeName} →
              </button>
            </div>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.5, textWrap: 'pretty', marginTop: -4 }}>You get the same public numbers everyone reads — there is no private cut. Money buys the place and the window, never the review. The card always says PAID.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SuggestOverlay({ onClose }) {
  const dlg = useDialog(onClose, 'Ask a question');
  const SG = useSuggestions();
  const [formOpen, setFormOpen] = useSgState(false);
  const [formAud, setFormAud] = useSgState('world');
  const c = SG.counts();
  const mine = SG.mine();
  // While a booking sits in "checking", poll its row: the automated
  // review settles in seconds and the verdict should land on the open
  // sheet, not behind a reopen. Bounded (every 4s, ~2 minutes) rather
  // than a listener — the door is opened, not watched (D124/D129), and
  // past the burst the sweep's cadence is slower than anyone waits.
  const checking = mine.some((s) => s.booking && s.status === 'review');
  React.useEffect(() => {
    if (!checking) return undefined;
    let ticks = 0;
    const t = setInterval(() => {
      ticks += 1;
      if (ticks > 30) { clearInterval(t); return; }
      SG.refreshBookings();
    }, 4000);
    return () => clearInterval(t);
  }, [checking, SG]);
  return (
    <div className="overlay" {...dlg}>
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>✕</button>
        <div className="h-title">ask a <em>question</em></div>
        <span style={{ width: 32, flexShrink: 0 }}></span>
      </div>
      <div className="app-body" style={{ paddingBottom: 44 }}>
        {formOpen ? (
          <SgForm SG={SG} initialAudience={formAud} onDone={() => setFormOpen(false)} onCancel={() => setFormOpen(false)}></SgForm>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <button className="press" onClick={() => { setFormAud('world'); setFormOpen(true); }} style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '15px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none',
                background: 'var(--accent)', border: 'none', boxShadow: 'var(--shadow-card)',
                color: '#fff', fontFamily: 'var(--sans)', fontSize: 15.5, fontWeight: 800, letterSpacing: '-0.2px',
              }}>+ Ask a question</button>
              <div style={{ marginTop: 9, textAlign: 'center', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>
                One paid slot a day, each place — reviewed, and the card always says PAID.
              </div>
            </div>
            <SgRateBoard SG={SG} onPick={(scope) => { setFormAud(scope); setFormOpen(true); }}></SgRateBoard>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ ...sgLabel, margin: '0 2px' }}>yours{c.mine ? ' · ' + c.mine : ''}</div>
              {mine.map((x) => (
                <SgMine key={x.id} s={x} SG={SG} onResend={(s, aud) => { SG.submit({ prompt: s.prompt, type: s.type, options: s.options || [], hue: s.hue, cadence: s.cadence, audience: aud }); }}></SgMine>
              ))}
              {mine.length === 0 && (
                <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center', padding: '18px 0' }}>
                  Nothing from you yet — ask one above.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// The one deliberate global this module keeps: app-shell reads deferred
// overlays off `window` so a failed chunk degrades to a blank instead of a
// ReferenceError (smoke-overlays.test.jsx mutation-checks it). Everything
// else this file used to publish is gone with the conversion.
Object.assign(window, { SuggestOverlay });
