// device-screens-lib.mjs — the pure half of scripts/device-screens.mjs: the
// phone geometries it renders at, the in-page checks it runs on every
// captured screen, and the report it writes. No Playwright here, so
// test:scripts can pin the arithmetic without a browser (the same split as
// store-render.mjs / gen-screenshots.mjs, and for the same reason: the
// runner is a CLI that exits, and the parts worth testing are the parts
// that decide what a finding IS).
//
// WHY THESE PROFILES AND NOT PLAYWRIGHT'S DEVICE DESCRIPTORS. Playwright's
// `devices["iPhone 15 Pro"]` is 393×659 — Safari's viewport with the URL
// bar and toolbar subtracted. The app does not run in Safari: it runs in
// a Capacitor WebView that fills the screen (`StatusBar.overlaysWebView:
// true` in capacitor.config.ts), so the honest geometry is the whole
// panel. The three below are the screen the shells actually paint on,
// chosen to bracket the range: the smallest iPhone the store still sells
// to (SE, 375 wide — where a row that "fits" on a Pro wraps), a current
// iPhone, and a current Pixel at its odd 2.625 ratio. User agents are
// what those phones send, so anything the app keys on `navigator` sees a
// phone rather than a Linux desktop.

export const PROFILES = {
  "iphone-se": {
    label: "iPhone SE",
    width: 375, height: 667, scale: 2,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  },
  "iphone-15-pro": {
    label: "iPhone 15 Pro",
    width: 393, height: 852, scale: 3,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  },
  "pixel-7": {
    label: "Pixel 7",
    width: 412, height: 915, scale: 2.625,
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  },
};

/** The text the shell's ErrorBoundary renders (app-shell.jsx). Pinned here
 *  because a screen showing it is the one finding that is never a matter
 *  of taste. */
export const BOUNDARY_TEXT = "This view hit a snag.";

/** A file-safe id for a screen label: "Near" → "near", "1v1" → "1v1",
 *  "Who voted what" → "who-voted-what". */
export function slug(label) {
  return String(label).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "screen";
}

/**
 * Runs INSIDE the page (page.evaluate serialises it by source, so it may
 * reference nothing from this module). Returns the facts a screenshot
 * cannot: content wider than its box, controls poking out of the
 * viewport, broken images, a webfont that failed, the boundary's text.
 *
 * Every list here is a LEAD, not a verdict — a rail that scrolls sideways
 * on purpose clips its own content, and the reader decides. So each entry
 * carries the element and its text, the lists are capped, and nothing in
 * them fails the run on its own (classify() below says which do).
 *
 * @param {string} boundaryText  BOUNDARY_TEXT, passed in because this
 *   function runs in the browser and cannot see the module constant.
 */
export function pageChecks(boundaryText) {
  const CAP = 10;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
  };
  const describe = (el) => {
    const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60);
    const cls = typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
      : "";
    const label = el.getAttribute && el.getAttribute("aria-label");
    return `<${el.tagName.toLowerCase()}${cls}>` + (label ? ` [${label}]` : "") + (text ? ` "${text}"` : "");
  };
  // An ancestor that scrolls sideways makes horizontal overflow legitimate.
  const inSideScroller = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
    }
    return false;
  };

  // A pseudo-element positioned outside its box is a hit area (.tap44 in
  // styles.css grows the pressable box with one), not content.
  const hasHitBox = (el) => ["::before", "::after"].some((p) => {
    const ps = getComputedStyle(el, p);
    return ps.content !== "none" && ps.content !== "normal" && ps.position === "absolute";
  });

  const clipped = [];    // text wider than the box it is set in
  const offscreen = [];  // a control partly outside the viewport, sideways
  for (const el of document.querySelectorAll("body *")) {
    if (clipped.length >= CAP && offscreen.length >= CAP) break;
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    // TEXT LEAVES ONLY. On a container, scrollWidth counts every absolutely
    // positioned child and every hit box, so "wider than its box" is design
    // ten times a screen (the first run flagged the map's nodes and every
    // ⓘ button). A leaf whose own text is wider than its box is the honest
    // case: an unbreakable word poking out, or a label cut off — and
    // nowrap + hidden + ellipsis is deliberate truncation, so it is skipped.
    if (clipped.length < CAP && el.children.length === 0 && el.clientWidth > 0
        && (el.textContent || "").trim() && el.scrollWidth > el.clientWidth + 2
        && (cs.overflowX === "visible" || cs.overflowX === "hidden" || cs.overflowX === "clip")
        && !(cs.textOverflow === "ellipsis" && cs.overflowX !== "visible")
        && !hasHitBox(el)) {
      // inView says whether the PNG shows it — a lead below the fold is
      // still real, but the reader should know to scroll for it.
      clipped.push({ el: describe(el), by: el.scrollWidth - el.clientWidth, overflow: cs.overflowX,
        inView: r.top < vh && r.bottom > 0 });
    }
    if (offscreen.length < CAP && el.matches("button, a, [role='tab'], input, select, textarea")
        && (r.left < -2 || r.right > vw + 2) && r.top < vh && r.bottom > 0 && !inSideScroller(el)) {
      offscreen.push({ el: describe(el), left: Math.round(r.left), right: Math.round(r.right) });
    }
  }

  const brokenImages = [...document.images]
    .filter((img) => img.complete && img.naturalWidth === 0 && img.getAttribute("src"))
    .slice(0, CAP)
    .map((img) => (img.getAttribute("src") || "").slice(0, 120));

  let fontsFailed = 0;
  try { for (const f of document.fonts) if (f.status === "error") fontsFailed++; } catch { /* no FontFaceSet */ }

  const text = (document.body.innerText || "").trim();
  return {
    vw, vh,
    textChars: text.length,
    boundary: text.includes(boundaryText),
    overflowX: document.documentElement.scrollWidth > vw + 1 || document.body.scrollWidth > vw + 1,
    clipped, offscreen, brokenImages, fontsFailed,
    fontStatus: (document.fonts && document.fonts.status) || "unknown",
  };
}

/**
 * What a captured screen's facts amount to. `hard` fails the run: the
 * screen is broken and no reader is needed to say so. `soft` is a lead the
 * reader looks at. Order inside a screen is severity, then the kinds a
 * reader can act on fastest.
 *
 * @param {object} snap  one entry of report.screens: { checks, pageErrors,
 *   consoleErrors, failedRequests, unchanged, driveError }
 */
export function classify(snap) {
  const out = [];
  const hard = (kind, detail) => out.push({ severity: "hard", kind, detail });
  const soft = (kind, detail) => out.push({ severity: "soft", kind, detail });
  const c = snap.checks || {};

  if (snap.driveError) hard("drive failed", snap.driveError);
  if (c.boundary) hard("error boundary", `the screen shows "${BOUNDARY_TEXT}"`);
  for (const e of snap.pageErrors || []) hard("page error", e);

  if (snap.unchanged) soft("unchanged", "the screen is pixel-identical to the previous capture in this scene — the tap may have done nothing");
  if (c.textChars !== undefined && c.textChars < 40 && !c.boundary) soft("looks empty", `${c.textChars} characters of text on the whole screen`);
  if (c.overflowX) soft("page overflows sideways", "the document is wider than the viewport");
  if (c.offscreen && c.offscreen.length) soft("control off-screen", c.offscreen.map((o) => `${o.el} spans ${o.left}…${o.right}px`).join("; "));
  if (c.clipped && c.clipped.length) soft("text wider than its box", c.clipped.map((o) => `${o.el} by ${o.by}px (overflow-x: ${o.overflow}${o.inView === false ? ", below the fold" : ""})`).join("; "));
  if (c.brokenImages && c.brokenImages.length) soft("broken image", c.brokenImages.join(", "));
  if (c.fontsFailed) soft("webfont failed", `${c.fontsFailed} face(s) in document.fonts report an error`);
  for (const e of snap.consoleErrors || []) soft("console.error", e);
  for (const r of snap.failedRequests || []) soft("request failed", r);
  return out;
}

/** Totals over a report: how many hard and soft findings, over how many
 *  screens — the line the night shift reads before anything else. */
export function summarize(report) {
  let hard = report.fatal ? 1 : 0, soft = 0, screens = 0;
  for (const s of report.screens) {
    screens++;
    for (const f of classify(s)) (f.severity === "hard" ? hard++ : soft++);
  }
  return { hard, soft, screens, skipped: (report.skipped || []).length };
}

/**
 * The markdown a reader opens first. Findings on top, most severe first,
 * each naming its PNG; then every screen per profile so a reader can see
 * what WAS covered; then what was skipped and why. Plain markdown, no
 * numbers the reader has to compute — the whole point is that a night
 * shift with ninety minutes reads this and then opens the PNGs it names.
 */
export function renderReport(report) {
  const t = summarize(report);
  const lines = [];
  lines.push(`# Device screens — ${report.capturedAt}`);
  lines.push("");
  lines.push(`Mode: **${String(report.mode || "unknown").toUpperCase()}** · source: ${report.source} · ` +
    `${t.screens} screens across ${Object.keys(report.profiles).length} profile(s) · ` +
    `**${t.hard} hard** / ${t.soft} soft finding(s)` + (t.skipped ? ` · ${t.skipped} skipped` : ""));
  if (report.target) lines.push("", `Target: ${report.target}`);
  lines.push("");

  lines.push("## Findings — read these first", "");
  if (report.fatal) lines.push(`- **[hard] the run ended early** — ${report.fatal.split("\n")[0]}; every screen below is what landed before that`);
  const findings = [];
  for (const s of report.screens) for (const f of classify(s)) findings.push({ s, f });
  findings.sort((a, b) => (a.f.severity === b.f.severity ? 0 : a.f.severity === "hard" ? -1 : 1));
  if (!findings.length) lines.push("None from the automatic checks. Look at the screens anyway — the checks see overflow and errors, not taste.");
  for (const { s, f } of findings) {
    lines.push(`- **[${f.severity}] ${s.profile} / ${s.id}** — ${f.kind}: ${f.detail} → \`${s.file}\``);
  }
  lines.push("");

  lines.push("## Screens", "");
  for (const [profileId, p] of Object.entries(report.profiles)) {
    lines.push(`### ${p.label} (${p.width}×${p.height} @${p.scale})`, "");
    lines.push("| # | screen | file | findings |", "| --- | --- | --- | --- |");
    for (const s of report.screens.filter((x) => x.profile === profileId)) {
      const fs = classify(s);
      const mark = fs.length ? fs.map((f) => (f.severity === "hard" ? "✗ " : "△ ") + f.kind).join(", ") : "✓";
      lines.push(`| ${s.n} | ${s.id} | \`${s.file}\` | ${mark} |`);
    }
    lines.push("");
  }

  if (report.skipped && report.skipped.length) {
    lines.push("## Skipped", "");
    for (const k of report.skipped) lines.push(`- **${k.id}** — ${k.reason}`);
    lines.push("");
  }

  lines.push("## What the checks mean", "");
  lines.push("- **hard** — the screen is broken on its own evidence: the error boundary's text, an uncaught page error, or a drive step that could not find the control it was told to tap. The run exits 1.");
  lines.push("- **soft** — a lead: text wider than the box it is set in, a control partly outside the viewport, a screen that did not change after a tap, a broken image, a failed webfont, a `console.error`, a failed request. A label cut on purpose reads the same as one cut by accident; a reader decides.");
  lines.push("- Not checked, by design: overlap, contrast, alignment, whether the screen makes sense — that is what the PNGs are for.");
  lines.push("");
  return lines.join("\n");
}
