// LiveWalkthrough — how the app works, said once, before anything asks
// you for anything (D388).
//
// WHY A SCREEN, AND WHY THIS SHORT. The app opens on the daily card, and
// the daily is the SMALLER half of the product: the Mirror's modules
// outweigh the daily's and the feed's put together (CLAUDE.md), and
// nothing on the daily says so. A person who answers for a week without
// finding the second tab has used a poll with a streak. The five pages
// here are the five facts that make the app more than that — one
// question a day answered blind, how far it reaches, what an answer
// carries with it, the Mirror, and that answers are public — each as a
// picture, a title and a sentence or two (docs/COPY.md: visual > word >
// sentence > sentences).
//
// FOUR THINGS IT DELIBERATELY DOES NOT DO.
//
//   1. It does not block. Skippable from the first page and closable on
//      Escape: D3's "never a wall" holds for an explanation at least as
//      much as for a form.
//   2. It does not mention the Patterns tab. D265 mounts that tab on the
//      data and says what the gate looks like from below — "no third
//      button, no teaser" — and a page about a tab that is not in the bar
//      is a teaser with more words. LiveWalkthrough.test pins it.
//   3. It makes no promise the app does not keep. Its one claim about who
//      can see what — answers are public, under your name — is the
//      account panel's sentence (D183) and web/privacy.html's
//      (check:policy-claims); "sealed until tomorrow" is that page's D5
//      row. No new sentence about the data, so no page moves.
//   4. It reads nothing and writes nothing. The pages are the same for
//      every account, drawn here in the tree's own tokens; the seen flag
//      is walkthrough.tsx's, written by whoever closed this, on both
//      ways out.
//
// The first page's illustration is a QUESTION, and it is the demo deck's
// own (daily-split.jsx's s1) rather than an invented one, drawn with no
// number on it: D1 forbids a surface fabricating a reading, and a seam
// with no share printed beside it is a shape, not a reading.
import React from "react";
// The dialog contract every full-screen overlay carries (D24): role,
// aria-modal, Escape, a Tab trap, focus restored to the opener on close.
// @ts-expect-error TS7016 — untyped spec module (the LiveMirrorLenses pattern)
import { useDialog } from "../spec/primitives.jsx";

interface Page {
  id: string;
  title: string;
  body: string;
  /** The page's colour, for its illustration and its dot. */
  accent: string;
}

// Five, in the order a first day meets them: the card, its reach, what
// the answer carries, where it adds up, and who can read it. The accents
// are the surfaces' own — the daily's, World's, the profile's petrol,
// the Mirror's indigo — and the last page wears none, because the blunt
// sentence is not decorated.
const PAGES: Page[] = [
  {
    id: "daily",
    title: "One question a day",
    body: "Answer it before you see how anyone else did. Then the split opens, and a feed of more runs under it.",
    accent: "var(--c-today)",
  },
  {
    id: "reach",
    title: "How far it reaches",
    body: "World is everyone. Circle is a group you make — sealed until tomorrow, then revealed with names. 1v1 is one friend: answer, then guess theirs.",
    accent: "var(--c-around)",
  },
  {
    id: "carry",
    title: "Every answer carries you",
    body: "Each answer is filed with your city, age and field, so it counts with people like you. Some feed cards are test items — answer enough and your profile fills in by itself.",
    accent: "var(--c-likeness)",
  },
  {
    id: "mirror",
    title: "The Mirror",
    body: "What it all adds up to: seven stops from you to the world, each reading the same answers through a different crowd.",
    accent: "var(--c-world)",
  },
  {
    id: "public",
    title: "Your answers are public",
    body: "Anyone signed in can read what you answered, under your name — and you can read theirs. Connecting answers is the whole point.",
    accent: "var(--ink)",
  },
];

// The daily ruler's three stops in the daily's own accents (app-shell's
// DOCK_STOPS), and the Mirror's seven in theirs (mirror-tab's
// MIRROR_POPS): the walkthrough draws the controls it is about in the
// colours they wear, so what a page shows is what the tab shows.
const DAILY_STOPS = [
  { label: "World", accent: "var(--c-around)" },
  { label: "Circle", accent: "var(--c-likeness)" },
  { label: "1v1", accent: "var(--c-people)" },
];
const MIRROR_STOPS = [
  { label: "You", accent: "var(--c-today)" },
  { label: "Circle", accent: "var(--c-people)" },
  { label: "Groups", accent: "var(--c-groups)" },
  { label: "Near", accent: "var(--c-city)" },
  { label: "City", accent: "var(--c-world)" },
  { label: "Country", accent: "var(--c-world)" },
  { label: "World", accent: "var(--c-world)" },
];
const ANCHORS = ["city", "age", "field"];

const SANS = "var(--sans)";
// How far a finger has to travel sideways before it is a page turn
// rather than a wobble — the daily's own axis commits at 66 with a 0.7
// drag factor; this screen has no drag preview, so a little less.
const SWIPE_PX = 48;

/** A row of named stops, each with its colour — the shape of a ruler. */
function StopRow({ stops }: { stops: { label: string; accent: string }[] }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginTop: 16 }}>
      {stops.map((s) => (
        <span key={s.label} style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 999,
          border: "0.5px solid var(--rule)", background: "var(--surface-2)",
          fontFamily: SANS, fontSize: 12, fontWeight: 700, color: "var(--ink-2)", whiteSpace: "nowrap",
        }}>
          <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: s.accent, flexShrink: 0 }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

/** Page 1 — a card, and the split ballot it becomes. No number on it. */
function ArtDaily({ accent }: { accent: string }) {
  const side: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 8, padding: "0 13px",
    fontFamily: SANS, fontWeight: 700, fontSize: 14, color: "var(--ink)", background: "var(--surface-2)",
  };
  return (
    <div aria-hidden="true" style={{
      width: 236, boxSizing: "border-box", padding: "14px 14px 13px", borderRadius: 18,
      background: "var(--surface-2)", border: "1px solid var(--rule)", boxShadow: "var(--shadow-card)",
    }}>
      <div style={{ fontFamily: "var(--serif)", fontSize: 19, fontWeight: 500, lineHeight: 1.2, letterSpacing: "-0.01em", color: "var(--ink)" }}>
        Pineapple on pizza?
      </div>
      {/* the seam sits where the crowd split, and "you" is the dot on your side */}
      <div style={{ display: "flex", height: 46, marginTop: 12, borderRadius: 14, overflow: "hidden", border: "1px solid var(--rule)", background: "var(--rule)", gap: 2 }}>
        <div style={{ ...side, flex: "0 0 58%", background: `color-mix(in oklch, ${accent} 16%, var(--surface-2))` }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent, flexShrink: 0 }} />Yes
        </div>
        <div style={{ ...side, flex: 1 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--c-around)", flexShrink: 0 }} />No
        </div>
      </div>
    </div>
  );
}

const ring = (n: number, r: number, offset = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = ((offset + (360 / n) * i) * Math.PI) / 180;
    return { x: 60 + r * Math.cos(a), y: 60 + r * Math.sin(a) };
  });

/** Page 2 — one friend, a circle, and everyone: the same answer, three reaches. */
function ArtReach() {
  return (
    <svg viewBox="0 0 120 120" width="132" height="132" aria-hidden="true" focusable="false" fill="none" strokeLinecap="round">
      <circle cx="60" cy="60" r="52" stroke="var(--c-around)" strokeWidth="1.4" strokeDasharray="2 3.6" />
      {ring(7, 52, 12).map((p, i) => <circle key={`w${i}`} cx={p.x} cy={p.y} r="2.4" fill="var(--c-around)" />)}
      <circle cx="60" cy="60" r="29" stroke="var(--c-likeness)" strokeWidth="1.4" fill="var(--c-likeness)" fillOpacity="0.09" />
      {ring(5, 29, -90).map((p, i) => <circle key={`c${i}`} cx={p.x} cy={p.y} r="3.2" fill="var(--c-likeness)" />)}
      <circle cx="53" cy="60" r="5.5" fill="var(--c-people)" />
      <circle cx="67" cy="60" r="5.5" fill="var(--c-people)" fillOpacity="0.55" stroke="var(--c-people)" strokeWidth="1.2" />
    </svg>
  );
}

/** Page 3 — an answer with the three facts filed on it. */
function ArtCarry({ accent }: { accent: string }) {
  const tags = ring(3, 40, -90);
  return (
    <svg viewBox="0 0 120 120" width="132" height="132" aria-hidden="true" focusable="false" fill="none" strokeLinecap="round">
      {tags.map((p, i) => (
        <line key={`l${i}`} x1="60" y1="60" x2={p.x} y2={p.y} stroke="var(--ink-3)" strokeWidth="1.2" strokeDasharray="2 3" />
      ))}
      <rect x="41" y="41" width="38" height="38" rx="11" fill={accent} fillOpacity="0.14" stroke={accent} strokeWidth="1.4" />
      <path d="M50 60 L57 67 L70 53" stroke={accent} strokeWidth="2" strokeLinejoin="round" />
      {tags.map((p, i) => <circle key={`t${i}`} cx={p.x} cy={p.y} r="7" fill="var(--surface-2)" stroke={accent} strokeWidth="1.4" />)}
      {tags.map((p, i) => <circle key={`d${i}`} cx={p.x} cy={p.y} r="2.4" fill={accent} />)}
    </svg>
  );
}

/** Page 4 — the tab's own glyph: you, inked; the population, still sketched. */
function ArtMirror() {
  return (
    <svg viewBox="0 0 120 120" width="132" height="132" aria-hidden="true" focusable="false" fill="none" strokeLinecap="round">
      <circle cx="46" cy="60" r="31" fill="var(--c-today)" fillOpacity="0.13" stroke="var(--ink)" strokeWidth="1.4" />
      <circle cx="74" cy="60" r="31" stroke="var(--ink)" strokeWidth="1.4" strokeDasharray="2.6 3.2" />
    </svg>
  );
}

/** Page 5 — the iris, as the header draws it (D302), at a size the ring reads. */
function ArtPublic() {
  return (
    <svg viewBox="0 0 100 100" width="104" height="104" aria-hidden="true" focusable="false">
      <path d="M50 24 L72.5 37 L72.5 63 L50 76 L27.5 63 L27.5 37 Z" fill="none" stroke="oklch(0.62 0.012 70)" strokeWidth="3.4" strokeLinejoin="round" />
      <circle cx="50" cy="24" r="10" fill="var(--c-today)" />
      <circle cx="72.5" cy="37" r="10" fill="var(--c-people)" />
      <circle cx="72.5" cy="63" r="10" fill="var(--c-groups)" />
      <circle cx="50" cy="76" r="10" fill="var(--c-world)" />
      <circle cx="27.5" cy="63" r="10" fill="var(--c-around)" />
      <circle cx="27.5" cy="37" r="10" fill="var(--c-likeness)" />
      <circle cx="50" cy="50" r="12.5" fill="var(--ink)" />
    </svg>
  );
}

function Art({ page }: { page: Page }) {
  switch (page.id) {
    case "daily": return <ArtDaily accent={page.accent} />;
    case "reach": return <><ArtReach /><StopRow stops={DAILY_STOPS} /></>;
    case "carry": return (
      <>
        <ArtCarry accent={page.accent} />
        <StopRow stops={ANCHORS.map((label) => ({ label, accent: page.accent }))} />
      </>
    );
    case "mirror": return <><ArtMirror /><StopRow stops={MIRROR_STOPS} /></>;
    default: return <ArtPublic />;
  }
}

const btnBase: React.CSSProperties = {
  borderRadius: 999, minHeight: 46, padding: "0 22px", cursor: "pointer",
  fontFamily: SANS, fontWeight: 800, fontSize: 14.5, WebkitAppearance: "none",
};

/**
 * @param again  Re-opened from the account panel rather than met on a
 *   first launch: the last button says Done rather than Start, because
 *   the app is already running behind it.
 */
function LiveWalkthrough({ onDone, again = false }: { onDone: () => void; again?: boolean }) {
  const [page, setPage] = React.useState(0);
  const cur = PAGES[page];
  const last = page === PAGES.length - 1;
  const dlg = useDialog(onDone, "How InSight works");

  const next = () => { if (last) onDone(); else setPage(page + 1); };
  const back = () => setPage(Math.max(0, page - 1));

  // Sideways, the way the daily's modes move — and a swipe never
  // finishes the walkthrough: a gesture is not a commit, so the last
  // page waits for its button.
  const touch = React.useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const from = touch.current;
    touch.current = null;
    const t = e.changedTouches[0];
    if (!from || !t) return;
    const dx = t.clientX - from.x;
    const dy = t.clientY - from.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) { if (!last) setPage(page + 1); } else back();
  };
  // The dialog's own keys first (Escape closes, Tab stays inside), then
  // the arrows page — same rule as the swipe: the last page does not
  // finish on a keypress.
  //
  // Composed INTO the hook's props rather than written on the element.
  // jsx-a11y's no-noninteractive-element-interactions reads `dialog` as
  // the HTML element, not the role, so a key handler written out on a
  // div with role="dialog" is a finding — which is why every overlay
  // takes the hook's own onKeyDown through the spread. This keeps that
  // shape, and the touch handlers below are not in the rule's list.
  const rootProps = {
    ...dlg,
    onKeyDown: (e: React.KeyboardEvent) => {
      dlg.onKeyDown(e);
      if (e.key === "ArrowRight" && !last) setPage(page + 1);
      else if (e.key === "ArrowLeft") back();
    },
  };

  return (
    <div {...rootProps} role="dialog" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{
      position: "fixed", inset: 0, zIndex: 39, background: "var(--surface-2)", color: "var(--ink)",
      overflowY: "auto", display: "flex", flexDirection: "column", outline: "none",
      paddingTop: "calc(env(safe-area-inset-top) + 22px)",
      paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)",
    }}>
      <div style={{ width: "100%", maxWidth: 420, margin: "0 auto", padding: "0 22px", boxSizing: "border-box", flex: 1, display: "flex", flexDirection: "column" }}>
        <div className="kicker" style={{ marginBottom: 0 }}>How InSight works</div>

        {/* Keyed by page so each one rises in (the paid door's own
            entrance, styles.css .sg-rise, which reduced motion turns
            off). The art box has a floor so the title does not jump
            between a tall picture and a short one. */}
        <div key={cur.id} className="sg-rise" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingBottom: 12 }}>
          <div style={{ minHeight: 214, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <Art page={cur} />
          </div>
          {/* A floor for the words too — the title plus five lines of body,
              which is the longest page on the narrowest phone — so a
              two-line page and a four-line page put the title in the same
              place. Measured in Chromium: without it the title moved 13px
              between the first two pages, and with a four-line floor the
              third page still sat 7px higher than the rest. */}
          <div style={{ minHeight: 176 }}>
            <h2 style={{ fontFamily: SANS, fontWeight: 800, fontSize: 26, letterSpacing: "-0.03em", lineHeight: 1.1, margin: "18px 0 0", textWrap: "pretty" }}>
              {cur.title}
            </h2>
            <p style={{ fontFamily: SANS, fontSize: 15, fontWeight: 500, lineHeight: 1.55, color: "var(--ink-2)", margin: "10px 0 0", textWrap: "pretty" }}>
              {cur.body}
            </p>
          </div>
        </div>

        {/* Where you are: a dot per page, the current one long and in the
            page's colour, and the same fact in words for a screen reader. */}
        <div aria-hidden="true" style={{ display: "flex", gap: 7, justifyContent: "center", marginBottom: 18 }}>
          {PAGES.map((p, i) => (
            <span key={p.id} style={{
              width: i === page ? 20 : 7, height: 7, borderRadius: 999,
              background: i === page ? cur.accent : "var(--rule)",
              transition: "width 0.26s var(--ease-spring), background 0.2s ease",
            }} />
          ))}
        </div>
        <span role="status" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
          {page + 1} of {PAGES.length}
        </span>

        <div style={{ display: "flex", gap: 10 }}>
          {page > 0 && (
            <button className="press" onClick={back} style={{ ...btnBase, border: "1px solid var(--rule)", background: "var(--surface-2)", color: "var(--ink)" }}>
              Back
            </button>
          )}
          <button className="press" onClick={next} style={{ ...btnBase, flex: 1, border: "none", background: "var(--ink)", color: "var(--surface)" }}>
            {last ? (again ? "Done" : "Start") : "Next"}
          </button>
        </div>
        {/* Hidden rather than removed on the last page, so the button row
            above stays where the thumb found it; disabled keeps it out of
            the Tab cycle while it is invisible. */}
        <button className="press" onClick={onDone} disabled={last} aria-hidden={last} style={{
          border: "none", background: "none", minHeight: 44, padding: "6px 0", marginTop: 6, cursor: "pointer",
          fontFamily: SANS, fontWeight: 700, fontSize: 13, color: "var(--ink-3)", WebkitAppearance: "none",
          visibility: last ? "hidden" : "visible",
        }}>
          Skip
        </button>
      </div>
    </div>
  );
}

export default LiveWalkthrough;
