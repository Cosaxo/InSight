// pulse-render.mjs — pulse.json → one self-contained HTML page.
//
// Split from pulse.mjs for the reason store-render.mjs is split from its two
// generators: collection and presentation fail differently, and mixing them
// makes a rendering bug look like a data bug. pulse.mjs can run `--json` and
// `--check` without loading a byte of this file.
//
// SELF-CONTAINED IS A REQUIREMENT, not a preference. The page has to open
// from a file:// path on a laptop with no server, no network and no build
// step — that is the whole point of a console you will actually look at. So:
// no CDN, no external font, no <script src>. Everything inline.
//
// The palette is the validated default from the data-viz reference
// instance — four categorical slots (blue/orange/aqua/yellow), stepped
// separately for the dark surface rather than flipped. Validated as a set
// in both modes before it was used; aqua and yellow sit below 3:1 on the
// light surface, which is why every stacked segment carries a visible
// direct label and every chart has a table beside it. That is the relief
// rule, not decoration — do not remove the labels to tidy the layout.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

const usd = (n) =>
  n === 0 ? "$0"
    : n < 10 ? `$${n.toFixed(2)}`
      : `$${Math.round(n).toLocaleString("en-US")}`;
const int = (n) => Math.round(n).toLocaleString("en-US");

// ── the sheet ───────────────────────────────────────────────────
// Roles, not raw hex, in the body below. Dark values are declared under
// both the media query (OS setting) and the [data-theme] scope (the page's
// own toggle), so the toggle wins in both directions.
const CSS = `
:root {
  color-scheme: light;
  --surface:      #fcfcfb;
  --plane:        #f9f9f7;
  --ink:          #0b0b0b;
  --ink-2:        #52514e;
  --ink-muted:    #898781;
  --grid:         #e1e0d9;
  --axis:         #c3c2b7;
  --hairline:     rgba(11,11,11,0.10);
  --s1: #2a78d6; --s2: #eb6834; --s3: #1baf7a; --s4: #eda100;
  --s5: #7b5bd6; --s6: #c2456d; --s7: #0e8a9c;
  --good: #0ca30c; --warning: #fab219; --serious: #ec835a; --critical: #d03b3b;
  --good-text: #006300;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --surface: #1a1a19; --plane: #0d0d0d;
    --ink: #ffffff; --ink-2: #c3c2b7; --ink-muted: #898781;
    --grid: #2c2c2a; --axis: #383835; --hairline: rgba(255,255,255,0.10);
    --s1: #3987e5; --s2: #d95926; --s3: #199e70; --s4: #c98500;
    --s5: #9a7cf0; --s6: #e0688c; --s7: #2fb3c7;
    --good-text: #0ca30c;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --surface: #1a1a19; --plane: #0d0d0d;
  --ink: #ffffff; --ink-2: #c3c2b7; --ink-muted: #898781;
  --grid: #2c2c2a; --axis: #383835; --hairline: rgba(255,255,255,0.10);
  --s1: #3987e5; --s2: #d95926; --s3: #199e70; --s4: #c98500;
  --s5: #9a7cf0; --s6: #e0688c; --s7: #2fb3c7;
  --good-text: #0ca30c;
}

* { box-sizing: border-box; }
body {
  margin: 0; padding: 0 20px 72px;
  background: var(--plane); color: var(--ink);
  font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}
.wrap { max-width: 1120px; margin: 0 auto; }

header.top { padding: 40px 0 8px; }
h1 { font-size: 26px; line-height: 1.2; margin: 0 0 6px; letter-spacing: -0.01em; }
.sub { color: var(--ink-2); margin: 0; max-width: 68ch; }
.meta { color: var(--ink-muted); font-size: 13px; margin: 10px 0 0; }
.meta code { font-size: 12px; }

button.theme {
  position: fixed; top: 14px; right: 14px; z-index: 20;
  background: var(--surface); color: var(--ink-2);
  border: 1px solid var(--hairline); border-radius: 8px;
  padding: 6px 11px; font: inherit; font-size: 13px; cursor: pointer;
}
button.theme:hover { color: var(--ink); }
/* Keyboard users get the same affordance the mouse does. */
button.theme:focus-visible, a:focus-visible {
  outline: 2px solid var(--s1); outline-offset: 2px; color: var(--ink);
}

.banner {
  display: flex; gap: 10px; align-items: flex-start;
  margin: 20px 0 0; padding: 12px 14px;
  border: 1px solid var(--hairline); border-left: 3px solid var(--s4);
  border-radius: 8px; background: var(--surface); color: var(--ink-2);
  font-size: 14px;
}
.banner strong { color: var(--ink); font-weight: 600; }

section.panel {
  background: var(--surface); border: 1px solid var(--hairline);
  border-radius: 12px; padding: 22px 22px 24px; margin: 22px 0 0;
}
.panel > h2 { font-size: 18px; margin: 0 0 3px; letter-spacing: -0.01em; }
.decision {
  color: var(--ink-2); font-size: 14px; margin: 0 0 18px; max-width: 74ch;
}
.decision b { color: var(--ink); font-weight: 600; }
h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em;
     color: var(--ink-muted); margin: 26px 0 10px; font-weight: 600; }
h3:first-of-type { margin-top: 20px; }

/* stat tiles — hero numbers, no plot, so no hover layer by design */
.tiles { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.tile { border: 1px solid var(--hairline); border-radius: 10px; padding: 14px 15px; }
.tile .k { font-size: 12px; color: var(--ink-muted); text-transform: uppercase;
           letter-spacing: 0.05em; margin: 0 0 6px; }
.tile .v { font-size: 30px; line-height: 1.05; font-weight: 600; letter-spacing: -0.02em;
           display: flex; align-items: baseline; gap: 7px; }
.tile .v small { font-size: 14px; font-weight: 400; color: var(--ink-2); letter-spacing: 0; }
.tile .n { font-size: 12.5px; color: var(--ink-2); margin: 7px 0 0; }
.tile.good .v { color: var(--good-text); }
.tile.warning .v { color: var(--ink); }
.tile.critical .v { color: var(--critical); }

/* status: never colour alone — every dot ships with its label */
.status { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; white-space: nowrap; }
.status .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.status.good .dot { background: var(--good); }
.status.warning .dot { background: var(--warning); }
.status.serious .dot { background: var(--serious); }
.status.critical .dot { background: var(--critical); }
.status.off .dot { background: transparent; border: 1.5px solid var(--axis); }

table { border-collapse: collapse; width: 100%; font-size: 13.5px; }
th, td { padding: 7px 10px; text-align: right; border-bottom: 1px solid var(--grid); }
th { color: var(--ink-muted); font-weight: 600; font-size: 12px;
     text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
th:first-child, td:first-child { text-align: left; }
td { font-variant-numeric: tabular-nums; }
td.t { font-variant-numeric: normal; }
/* prose in a numeric table reads wrong right-aligned — the walls table's
   "note" column is a sentence, not a measurement. */
td.prose, th.prose { text-align: left; font-variant-numeric: normal; color: var(--ink-2); }
tbody tr:last-child td { border-bottom: none; }
tbody tr:hover td { background: var(--plane); }
.scroll { overflow-x: auto; margin: 0 -4px; padding: 0 4px; }

/* legend — present whenever 2+ series share an encoding */
.legend { display: flex; flex-wrap: wrap; gap: 14px; margin: 0 0 12px; font-size: 13px; color: var(--ink-2); }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend i { width: 11px; height: 11px; border-radius: 3px; display: inline-block; flex: none; }

/* 100% stacked bars: composition is the finding, the total rides as a
   direct label. 2px surface gaps between segments, 4px rounded data-ends. */
.stack-row { display: grid; grid-template-columns: 130px 1fr 92px; gap: 12px;
             align-items: center; margin: 0 0 7px; }
.stack-row .lab { font-size: 13px; color: var(--ink-2); }
.stack { display: flex; height: 26px; border-radius: 4px; overflow: hidden; background: var(--grid); }
.stack i { display: block; height: 100%; position: relative;
           box-shadow: 2px 0 0 0 var(--surface); }
.stack i:last-child { box-shadow: none; }
.stack i .dl { position: absolute; inset: 0; display: flex; align-items: center;
               justify-content: center; font-size: 11px; font-variant-numeric: tabular-nums;
               color: #0b0b0b; font-weight: 600; }
.stack-row .tot { font-size: 13px; color: var(--ink); font-variant-numeric: tabular-nums;
                  text-align: right; font-weight: 600; }
.stack-row .tot small { display: block; font-weight: 400; color: var(--ink-muted); font-size: 11px; }

/* single-series horizontal bars — one hue, no legend, value direct-labelled */
.bars { display: grid; gap: 6px; }
.bar-row { display: grid; grid-template-columns: 118px 1fr 46px; gap: 12px; align-items: center; }
.bar-row .lab { font-size: 13px; color: var(--ink-2); }
.bar-track { background: var(--grid); border-radius: 4px; height: 20px; }
.bar-fill { background: var(--s1); height: 100%; border-radius: 4px; min-width: 3px; }
.bar-row .val { font-size: 13px; font-variant-numeric: tabular-nums; text-align: right; }

/* runway meter — one figure, one bar, the invariant named underneath */
.runway { display: flex; gap: 22px; align-items: center; flex-wrap: wrap; }
.runway .fig { font-size: 52px; font-weight: 600; line-height: 1; letter-spacing: -0.03em; }
.runway .fig small { font-size: 15px; font-weight: 400; color: var(--ink-2); margin-left: 8px; letter-spacing: 0; }
.runway.good .fig { color: var(--good-text); }
.runway.critical .fig { color: var(--critical); }
.meter { flex: 1 1 260px; min-width: 220px; }
.meter .track { display: flex; height: 22px; border-radius: 4px; overflow: hidden; background: var(--grid); }
.meter .used { background: var(--s2); box-shadow: 2px 0 0 0 var(--surface); }
.meter .left { background: var(--s1); }
.meter .cap { display: flex; justify-content: space-between; font-size: 12px;
              color: var(--ink-muted); margin-top: 6px; }

/* the three-way population split */
.split { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
.col { border: 1px solid var(--hairline); border-radius: 10px; padding: 14px 15px; }
.col > h4 { margin: 0 0 4px; font-size: 14px; }
.col > p.h { margin: 0 0 12px; font-size: 12.5px; color: var(--ink-muted); }
.col ul { margin: 0; padding: 0; list-style: none; }
.col li { padding: 10px 0; border-top: 1px solid var(--grid); font-size: 13px; }
.col li:first-child { border-top: none; padding-top: 2px; }
.col li b { display: block; font-weight: 600; margin-bottom: 3px; }
.col li em { display: block; font-style: normal; color: var(--ink-2); margin-top: 4px; }
.col li code { font-size: 11.5px; }
.col.refuse { border-left: 3px solid var(--critical); }
.col.block { border-left: 3px solid var(--warning); }
.col.live { border-left: 3px solid var(--good); }

code, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
code { background: var(--plane); border: 1px solid var(--hairline);
       border-radius: 4px; padding: 1px 4px; font-size: 12px; }
.note { color: var(--ink-2); font-size: 13px; margin: 14px 0 0; max-width: 78ch; }
.note.tight { margin-top: 8px; }
.empty { border: 1px dashed var(--axis); border-radius: 10px; padding: 18px;
         color: var(--ink-2); font-size: 13.5px; }
.empty b { color: var(--ink); }
footer { color: var(--ink-muted); font-size: 12.5px; margin: 30px 0 0; max-width: 80ch; }

/* hover layer */
#tip { position: fixed; z-index: 40; pointer-events: none; opacity: 0;
       transition: opacity .1s; background: var(--surface); color: var(--ink);
       border: 1px solid var(--hairline); border-radius: 7px; padding: 7px 10px;
       font-size: 12.5px; box-shadow: 0 6px 22px rgba(0,0,0,.16); max-width: 260px; }
#tip b { display: block; margin-bottom: 2px; }
[data-tip] { cursor: help; }

@media (max-width: 620px) {
  .stack-row { grid-template-columns: 92px 1fr; }
  .stack-row .tot { grid-column: 2; text-align: left; }
  .bar-row { grid-template-columns: 92px 1fr 44px; }
}
@media print { button.theme, #tip { display: none; } section.panel { break-inside: avoid; } }
@media (prefers-reduced-motion: reduce) { #tip { transition: none; } }
`;

const READ_SERIES = [
  { key: "boot", label: "boot", css: "--s1", why: "~15 reads per app open (meta, profile, answers, 7 deck listeners, groups, reveals)" },
  { key: "topUp", label: "agg top-up", css: "--s2", why: "answered questions with no published counts yet, re-read at most once per 6h (the k-floor this used to wait out is gone — D98)" },
  { key: "reseed", label: "reseed refetch", css: "--s3", why: "the bank re-read after a contentRev bump — charged per MAU, not DAU" },
  { key: "fanOut", label: "listener fan-out", css: "--s4", why: "every publish on today's aggregate delivers to every listening client. DAU²/400 — the quadratic one" },
  { key: "reattach", label: "listener re-attach", css: "--s8", why: "DECK_DAYS reads each time the app comes back and the idle detach has dropped its listeners — the price of bounding the fan-out's tail (D124)" },
  { key: "rules", label: "rule reads", css: "--s5", why: "every get()/exists() in a security rule is a billed read — charged per ANSWER, not per open (D67)" },
  { key: "server", label: "server reads", css: "--s6", why: "the agg transaction, the nightly velocity scan walking the ledger, and the reveal pipeline (D67)" },
  { key: "social", label: "D98 surfaces", css: "--s7", why: "who-voted sheets, Kindred and Circle reading other users' answers on demand — capped per fetch, flat above VOTER_FETCH_CAP DAU (D102)" },
];

function tiles(items) {
  return `<div class="tiles">${items.map((t) => `
    <div class="tile${t.status ? ` ${t.status}` : ""}">
      <p class="k">${esc(t.k)}</p>
      <div class="v">${t.v}${t.unit ? `<small>${esc(t.unit)}</small>` : ""}</div>
      ${t.n ? `<p class="n">${t.n}</p>` : ""}
    </div>`).join("")}</div>`;
}

const statusChip = (s, label) =>
  `<span class="status ${s}"><span class="dot"></span>${esc(label)}</span>`;

// ── panel 1 · cost ──────────────────────────────────────────────

function panelCost(p) {
  const c = p.cost;
  const traction = c.scenarios[2];
  const firstWall = c.walls
    .filter((w) => w.bindsAtDau != null)
    .sort((a, b) => a.bindsAtDau - b.bindsAtDau)[0];

  const rows = c.scenarios.map((s) => `
    <tr>
      <td class="t">${esc(s.label)}</td>
      <td>${int(s.dau)}</td>
      <td>${int(s.readsPerDay)}</td>
      <td>${int(s.writesPerDay)}</td>
      <td>${usd(s.firestoreUsd)}</td>
      <td>${usd(s.functionsUsd)}</td>
      <td><b>${usd(s.totalUsd)}</b></td>
      <td>${usd(s.withReadFixesUsd)}</td>
      <td>${s.savingUsd > 0.005 ? usd(s.savingUsd) : "—"}</td>
      <td class="t">${statusChip(
        s.contended ? "critical" : "good", `${s.writesPerSec.toFixed(2)}/s`)}</td>
    </tr>`).join("");

  const stacks = c.scenarios.map((s) => {
    const total = Object.values(s.readsPerUser).reduce((a, b) => a + b, 0);
    const segs = READ_SERIES.map((ser) => {
      const v = s.readsPerUser[ser.key];
      const pct = total > 0 ? (v / total) * 100 : 0;
      // Direct label only where the segment can actually hold one. This is
      // the relief the validator's contrast WARN requires; the table above
      // carries every value the labels cannot.
      const label = pct >= 9 ? `<span class="dl">${Math.round(pct)}%</span>` : "";
      return `<i style="width:${pct.toFixed(2)}%;background:var(${ser.css})"
        data-tip="${esc(ser.label)}|${v} reads/user/day · ${Math.round(pct)}% — ${esc(ser.why)}">${label}</i>`;
    }).join("");
    return `<div class="stack-row">
      <span class="lab">${esc(s.label)}</span>
      <div class="stack">${segs}</div>
      <span class="tot">${int(total)}<small>reads/user/day</small></span>
    </div>`;
  }).join("");

  const walls = c.walls.map((w) => `
    <tr>
      <td class="t">${esc(w.name)}</td>
      <td>${w.bindsAtDau == null ? "—" : int(w.bindsAtDau)}</td>
      <td class="t">${esc(w.kind)}</td>
      <td class="t">${w.instrumented
        ? statusChip("good", "instrumented")
        : statusChip("warning", "no instrument")}</td>
      <td class="prose">${esc(w.note)}</td>
    </tr>`).join("");

  return `<section class="panel">
    <h2>Cost — and which wall binds first</h2>
    <p class="decision"><b>The decision:</b> is it time to build either recorded read fix,
      and which ceiling arrives before the bill matters? Every figure here is
      <b>modelled</b>, not measured — there is no invoice yet. Prices are ${esc(c.region)};
      the assumptions are named below the table because they are guesses about humans,
      not facts about the code.</p>

    ${tiles([
      { k: "Burn at 5,000 DAU", v: usd(p.money.breakEven[2].burnUsd), unit: "/mo",
        n: `${usd(traction.totalUsd)} infra + ${usd(p.money.fixedUsdPerMonth)} fixed` },
      { k: "Cost per user", v: `$${p.money.breakEven[2].usdPerDauMonth.toFixed(4)}`, unit: "/DAU/mo",
        n: "at 5,000 DAU — the unit economic" },
      { k: "First wall", v: int(firstWall.bindsAtDau), unit: "DAU",
        status: "warning", n: esc(firstWall.kind === "technical" ? "technical, not cost" : "cost") },
      { k: "Seeded bank", v: int(c.seededBankDocs), unit: "docs",
        n: "counted from v2content.ts — the cold-boot read cost" },
    ])}

    <h3>The bill, at five sizes</h3>
    <div class="scroll"><table>
      <thead><tr>
        <th>Scenario</th><th>DAU</th><th>Reads/day</th><th>Writes/day</th>
        <th>Firestore</th><th>Functions</th><th>Total /mo</th>
        <th>With read fixes</th><th>Saving</th><th>D7 write rate</th>
      </tr></thead><tbody>${rows}</tbody>
    </table></div>
    <p class="note tight">The last two columns are the decision. The baseline already
      includes D34 — the seed writes only changed documents and the client pages the
      delta, so a promotion costs ${esc(c.assumptions.changedPerReseed)} reads per device
      rather than the whole bank. What is still <b>recorded and deliberately unbuilt</b>
      is the other pair: serve the bank as a static asset off Hosting, and poll today's
      aggregate instead of streaming it. Build them when the saving column stops being
      rounding error — not before, because the write-contention wall binds ~3.5× earlier
      than the read fan-out does.</p>

    <h3>Where the reads actually go</h3>
    <div class="legend">${READ_SERIES.map((s) =>
      `<span><i style="background:var(${s.css})"></i>${esc(s.label)}</span>`).join("")}</div>
    ${stacks}
    <p class="note">Composition, with the absolute total beside it. The totals are
      unremarkable; the decomposition is the finding. Reads are ~97% of the bill at
      every size, so this chart is the bill. Every value is also in the table above —
      two of these four hues sit below 3:1 on a light surface, so the numbers never
      live in the colour alone.</p>

    <h3>The walls, in the order they are hit</h3>
    <div class="scroll"><table>
      <thead><tr><th>Wall</th><th>Binds at DAU</th><th>Kind</th><th>Instrument</th><th class="prose">Note</th></tr></thead>
      <tbody>${walls}</tbody>
    </table></div>
    <p class="note">The good ordering is a technical wall before a cost wall: the app
      breaks at a size where the bill is still tens of dollars, so no surprise invoice
      can arrive before a surprise outage does. Worth keeping true.</p>

    <p class="note">Behaviour assumptions —
      ${Object.entries(c.assumptions).map(([k, v]) => `<code>${esc(k)}=${esc(v)}</code>`).join(" ")}.
      Change them in <code>scripts/cost-arith.mjs</code>; <code>npm run costs</code> prints
      the same model as a table.</p>
  </section>`;
}

// ── panel 2 · money ─────────────────────────────────────────────

function panelMoney(p) {
  const m = p.money;
  const rows = m.breakEven.map((b) => `
    <tr>
      <td class="t">${esc(b.label)}</td>
      <td>${int(b.dau)}</td>
      <td>${usd(b.infraUsd)}</td>
      <td>${usd(b.fixedUsd)}</td>
      <td><b>${usd(b.burnUsd)}</b></td>
      <td>$${b.usdPerDauMonth.toFixed(4)}</td>
      ${m.paths.map((path) => {
        const n = b.unitsToBreakEven[path.id];
        return `<td>${n == null ? '<span style="color:var(--ink-muted)">unpriced</span>' : int(n)}</td>`;
      }).join("")}
    </tr>`).join("");

  const pathRows = m.paths.map((path) => `
    <tr>
      <td class="t"><b>${esc(path.name)}</b></td>
      <td class="prose">${esc(path.state)}</td>
      <td class="prose">${esc(path.unit)}</td>
      <td>${path.assumedUsdPerUnit > 0 ? usd(path.assumedUsdPerUnit) : "—"}</td>
      <td>${path.assumedUnits || "—"}</td>
      <td>${path.monthlyUsd > 0 ? usd(path.monthlyUsd) : "—"}</td>
    </tr>`).join("");

  return `<section class="panel">
    <h2>Money — the break-even surface</h2>
    <p class="decision"><b>The decision:</b> what would you have to charge, and to how
      many, to cover the bill at each size? Revenue today is
      <b>${usd(m.revenueUsdPerMonth)}</b> and this panel does not pretend otherwise —
      what it computes instead is the shape a price would have to have. That question
      needs no revenue data, which is why it is answerable now and the rest is not.</p>

    ${tiles([
      { k: "Fixed cost", v: usd(m.fixedUsdPerMonth), unit: "/mo",
        n: "Apple, Play, and the question farm's subscription" },
      { k: "Revenue modelled", v: usd(m.revenueUsdPerMonth), unit: "/mo",
        n: m.priced ? "from the rate card's assumed prices" : "no path priced — edit monitoring/rates.json" },
      { k: "Break-even at 5,000 DAU", v: usd(m.breakEven[2].burnUsd), unit: "/mo",
        n: "one contract at this price clears the whole burn" },
      { k: "Break-even at 50,000 DAU", v: usd(m.breakEven[3].burnUsd), unit: "/mo",
        n: "where the read fan-out starts costing real money" },
    ])}

    ${m.addressable ? `<p class="note tight">The units column below is measured against a
      real ceiling: <b>${int(m.addressable.places)} places in
      ${int(m.addressable.countries)} countries</b> are in the shipped catalogue, which is
      what makes "per city per month" a definable unit rather than a hypothetical one.
      Read from <code>${esc(m.addressable.source)}</code>.</p>` : ""}

    <h3>What it costs to stand still, and what covers it</h3>
    <div class="scroll"><table>
      <thead><tr>
        <th>Scenario</th><th>DAU</th><th>Infra</th><th>Fixed</th><th>Burn /mo</th>
        <th>$/DAU/mo</th>
        ${m.paths.map((path) => `<th>${esc(path.name)}<br><span style="font-weight:400;text-transform:none;letter-spacing:0">units to cover</span></th>`).join("")}
      </tr></thead><tbody>${rows}</tbody>
    </table></div>
    <p class="note tight">The right-hand columns answer "how many of these would it take".
      They read <b>unpriced</b> until you put a number in
      <code>monitoring/rates.json</code> — an unpriced path is a question, not a zero,
      and the default rate card deliberately refuses to guess on your behalf.</p>

    <h3>The paths, and what is actually built</h3>
    <div class="scroll"><table>
      <thead><tr><th>Path</th><th class="prose">State</th><th class="prose">Unit</th><th>Assumed price</th><th>Assumed units</th><th>Modelled /mo</th></tr></thead>
      <tbody>${pathRows}</tbody>
    </table></div>

    <div class="banner" style="border-left-color:var(--s1)">
      <div><strong>The constraint that keeps this panel small.</strong>
      ${esc(m.constraint)}</div>
    </div>
  </section>`;
}

// ── panel 3 · the question pipeline ─────────────────────────────

function panelPipeline(p, trail) {
  const { deck, banks, scorecard, totalQuestions, archive } = p.pipeline;
  const span = Math.max(deck.dailyBank, deck.daysElapsed);
  const usedPct = Math.min(100, (deck.daysElapsed / span) * 100);
  const maxBank = Math.max(...banks.map((b) => b.count));

  const barRows = banks.map((b) => `
    <div class="bar-row">
      <span class="lab">${esc(b.surface)}</span>
      <div class="bar-track" data-tip="${esc(b.surface)}|${b.count} questions · ${esc(b.source)}">
        <div class="bar-fill" style="width:${((b.count / maxBank) * 100).toFixed(1)}%"></div>
      </div>
      <span class="val">${int(b.count)}</span>
    </div>`).join("");

  const scoreBlock = scorecard.present
    ? scorecardBlock(scorecard)
    : `<div class="empty"><b>No scorecard yet.</b> ${esc(scorecard.note)}<br><br>
        Once it exists, this fills with the draw and evenness distribution across every
        question that has cleared the k-floor — the farm's only view of what worked, and
        the only place in this console where real user behaviour appears at all.</div>`;

  return `<section class="panel">
    <h2>The question pipeline</h2>
    <p class="decision"><b>The decision:</b> do you need to write questions this week?
      This is the most live panel — nearly all of it computes from committed files today,
      pre-launch, with no credentials. It also holds the one number here whose neglect
      causes a <b>user-visible failure</b> rather than a bad estimate.</p>

    <h3>Deck runway — D30's no-wrap invariant</h3>
    <div class="runway ${esc(deck.status)}">
      <div>
        <div class="fig">${int(deck.runwayDays)}<small>days</small></div>
      </div>
      <div class="meter">
        <div class="track">
          <div class="used" style="width:${usedPct.toFixed(1)}%"
            data-tip="Consumed|${deck.daysElapsed} days since DECK_EPOCH ${deck.epoch} (${esc(deck.wrapsOn)} is the wrap date at today's bank size)"></div>
          <div class="left" style="width:${(100 - usedPct).toFixed(1)}%"
            data-tip="Remaining|${deck.runwayDays} days of unserved daily questions"></div>
        </div>
        <div class="cap">
          <span>${deck.daysElapsed} served since epoch</span>
          <span>${deck.dailyBank} in the daily bank</span>
        </div>
      </div>
    </div>
    <p class="note">While the bank holds at least as many questions as days elapsed,
      <code>computeDeckIds</code> never wraps and appending questions moves no served
      day's mapping. Past zero the wrap returns and the next reseed <b>silently remaps
      every user's answered history once</b>. Promotion at
      ${deck.promotionNeededPerWeek}/week holds the invariant against
      ${deck.consumedPerWeek} consumed; the farm's budget cap allows
      ${deck.farmBudgetPerWeek}. Nothing else in the tree can notice this —
      <code>deck.test.ts</code> pins the property, but a unit test cannot know today's
      date relative to the shipped bank. <code>npm run pulse -- --check</code> fails
      below ${21} days.</p>

    ${sparkline(trail, "runwayDays", "Deck runway over time")}

    <h3>Promotion backlog</h3>
    ${tiles([
      { k: "Archive entries", v: int(archive.archiveEntries),
        n: "browsable questions in the spec-layer archive" },
      { k: "Written, not promoted", v: int(archive.unpromoted),
        status: archive.unpromoted > 0 ? "good" : undefined,
        n: archive.unpromoted > 0
          ? "already written — a promotion PR, not a writing session"
          : "nothing waiting; more runway means writing new ones" },
      { k: "Orphans", v: int(archive.orphans),
        status: archive.orphans > 0 ? "critical" : "good",
        n: archive.orphans > 0
          ? `live questions with no archive match: ${archive.orphanIds.map(esc).join(", ")}`
          : "every live question joins its archive entry" },
    ])}
    <p class="note tight">This is the half of "do I need to write questions this week"
      that the runway cannot answer. A short runway with a full archive is a promotion
      PR; a short runway with an empty one is an afternoon of writing. Joined by prompt
      string — the same join <code>liveSync</code> does at runtime, and the same one
      D30's promotion step copies byte-for-byte to preserve, so a non-zero orphan count
      means the client is already warning.</p>

    <h3>Bank inventory — ${int(totalQuestions)} questions across seven surfaces</h3>
    <div class="bars">${barRows}</div>
    <p class="note tight">Counted from <code>content/*.json</code>, the source of truth the
      seed generator flattens. Only the daily bank is consumed by the calendar; the
      others rotate without a runway.
      ${totalQuestions === p.cost.seededBankDocs
        ? `This total equals the ${int(p.cost.seededBankDocs)} documents counted independently
           out of <code>functions/src/v2content.ts</code> for the cold-boot read cost — two
           paths, same number, which is <code>check:content</code>'s guarantee showing its work.`
        : `<b>These ${int(totalQuestions)} do not match the ${int(p.cost.seededBankDocs)} documents
           in <code>functions/src/v2content.ts</code></b> — run <code>npm run build:content</code>.`}</p>

    <h3>What the crowd did with them</h3>
    ${scoreBlock}
  </section>`;
}

// A trail of one reading is not a trend, and drawing a flat line through a
// single point would imply a stability nobody has observed. So this renders
// the honest empty state until there are two — and says how to get them,
// because "run it again tomorrow" is the actual answer.
function sparkline(trail, key, title) {
  const pts = trail.filter((r) => typeof r[key] === "number");
  if (pts.length < 2) {
    return `<h3>${esc(title)}</h3>
      <div class="empty"><b>One reading so far.</b> The trail
      (<code>monitoring/pulse-trail.jsonl</code>) keeps one row per day and is
      append-only, so this becomes a line as soon as <code>npm run pulse</code> runs on a
      second day. A snapshot that overwrites itself cannot show a direction, and
      direction is most of what a decision needs.</div>`;
  }
  // PAD.b carries two things under the plot: the gap rule and the date
  // labels. 22 put the rule on top of the text — measured, not guessed.
  const W = 720, H = 124, PAD = { t: 12, r: 12, b: 32, l: 42 };
  const vals = pts.map((r) => r[key]);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || 1;

  // X IS TIME, NOT POSITION IN THE ARRAY. The first version spaced points
  // evenly by index, which draws a fortnight-long gap exactly like a
  // one-day step — and this trail WILL have gaps: GitHub disables a
  // schedule after 60 days of repository quiet, and the whole argument for
  // keeping history is that direction is worth more than a snapshot. A
  // chart that hides when it stopped looking is worse than no chart.
  const dayOf = (r) => Math.round(Date.parse(`${r.on}T00:00:00Z`) / 86400000);
  const d0 = dayOf(pts[0]);
  const days = dayOf(pts[pts.length - 1]) - d0 || 1;
  const x = (r) => PAD.l + ((dayOf(r) - d0) / days) * (W - PAD.l - PAD.r);
  const y = (v) => PAD.t + (1 - (v - lo) / span) * (H - PAD.t - PAD.b);
  const d = pts.map((r, i) => `${i ? "L" : "M"}${x(r).toFixed(1)},${y(r[key]).toFixed(1)}`).join("");

  // A run of days with no reading gets a hairline over the stretch it
  // covers, so the gap is marked rather than merely implied by spacing —
  // the line still crosses it, and a straight segment across two weeks
  // would otherwise read as two weeks of steady change that nobody saw.
  const gaps = pts.slice(1).map((r, i) => {
    const prev = pts[i];
    const missed = dayOf(r) - dayOf(prev) - 1;
    if (missed < 2) return "";
    return `<line x1="${x(prev).toFixed(1)}" y1="${H - PAD.b + 6}"
      x2="${x(r).toFixed(1)}" y2="${H - PAD.b + 6}"
      stroke="var(--serious)" stroke-width="2" stroke-linecap="round"
      data-tip="No readings|${missed} days between ${esc(prev.on)} and ${esc(r.on)}"/>`;
  }).join("");
  const missedTotal = pts.slice(1).reduce(
    (a, r, i) => a + Math.max(0, dayOf(r) - dayOf(pts[i]) - 1), 0);

  // Markers at >=8px hit size, but drawn small: the line carries the shape,
  // the endpoints carry the numbers.
  const dots = pts.map((r) =>
    `<circle cx="${x(r).toFixed(1)}" cy="${y(r[key]).toFixed(1)}" r="4"
      fill="var(--s1)" stroke="var(--surface)" stroke-width="2"
      data-tip="${esc(r.on)}|${esc(title)}: ${r[key]}"><title>${esc(r.on)}: ${r[key]}</title></circle>`).join("");
  const last = pts[pts.length - 1], first = pts[0];
  const delta = last[key] - first[key];

  return `<h3>${esc(title)}</h3>
    <div class="scroll"><svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}"
      role="img" aria-label="${esc(title)}: ${first[key]} on ${esc(first.on)} to ${last[key]} on ${esc(last.on)}">
      <line x1="${PAD.l}" y1="${y(hi)}" x2="${W - PAD.r}" y2="${y(hi)}" stroke="var(--grid)" stroke-width="1"/>
      <line x1="${PAD.l}" y1="${y(lo)}" x2="${W - PAD.r}" y2="${y(lo)}" stroke="var(--grid)" stroke-width="1"/>
      <text x="${PAD.l - 8}" y="${y(hi) + 4}" text-anchor="end" font-size="11" fill="var(--ink-muted)">${int(hi)}</text>
      <text x="${PAD.l - 8}" y="${y(lo) + 4}" text-anchor="end" font-size="11" fill="var(--ink-muted)">${int(lo)}</text>
      <path d="${d}" fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${gaps}
      ${dots}
      <text x="${PAD.l}" y="${H - 6}" font-size="11" fill="var(--ink-muted)">${esc(first.on)}</text>
      <text x="${W - PAD.r}" y="${H - 6}" text-anchor="end" font-size="11" fill="var(--ink-muted)">${esc(last.on)}</text>
    </svg></div>
    <p class="note tight">${pts.length} readings over ${days} day${days === 1 ? "" : "s"} ·
      ${delta === 0 ? "unchanged" : `${delta > 0 ? "+" : ""}${int(delta)} over the window`}${
        missedTotal > 0
          ? ` · <b style="color:var(--serious)">${missedTotal} day${missedTotal === 1 ? "" : "s"} with no reading</b>`
          : ""}.
      From <code>monitoring/pulse-trail.jsonl</code>, one row per day, append-only.</p>`;
}

function scorecardBlock(sc) {
  const max = Math.max(1, ...sc.evennessBuckets.map((b) => b.count));
  const staleStatus = { fresh: "good", advisory: "warning", expired: "critical", unknown: "warning" }[sc.staleness];
  const bars = sc.evennessBuckets.map((b) => `
    <div class="bar-row">
      <span class="lab">${esc(b.label)}</span>
      <div class="bar-track" data-tip="${esc(b.label)}|${b.count} questions">
        <div class="bar-fill" style="width:${((b.count / max) * 100).toFixed(1)}%"></div>
      </div>
      <span class="val">${int(b.count)}</span>
    </div>`).join("");

  const nothingScored = sc.scoredQuestions === 0;

  return `${tiles([
    { k: "Questions scored", v: int(sc.scoredQuestions),
      n: `of ${int(sc.questionsTracked)} tracked — cleared the k-floor of 5` },
    { k: "Answers counted", v: int(sc.totalAnswers), n: "a floor — under-floor questions publish nothing" },
    { k: "Never served", v: int(sc.unserved),
      n: "written, but the deck has not reached them yet" },
    { k: "Scorecard age", v: sc.ageDays == null ? "?" : int(sc.ageDays), unit: "days",
      status: staleStatus, n: `${sc.staleness} — QUESTION-FARM.md's staleness rule` },
  ])}

  ${nothingScored ? `<div class="empty" style="margin-top:16px"><b>A scorecard exists, and
    nothing has cleared the floor yet.</b> ${int(sc.questionsTracked)} questions are
    tracked and ${int(sc.unserved)} have never been served; ${int(sc.belowFloor)} are
    served but not yet answered. Both readings are what a bank that has
    not met a crowd looks like — the instrument is working, the population has not
    arrived. The evenness distribution below fills in as questions cross the floor.</div>`
    : ""}

  <h3>Evenness — "splits, not landslides", as a distribution</h3>
  <div class="bars">${bars}</div>
  <p class="note tight">A mean would hide the shape, and the shape is the product's own
    bar. <b>Do not optimise toward the right-hand bars.</b> The farm doc's guardrail
    outranks this chart: if evenness and warmth conflict, warmth wins.
    ${sc.learnCards ? `The learn lane is scored separately —
      ${int(sc.learnScored)} of ${int(sc.learnCards)} cards have cleared the floor.` : ""}</p>`;
}

// ── panel 4 · population ────────────────────────────────────────

function panelPopulation(p) {
  const pop = p.population;
  const li = (items, render) => `<ul>${items.map(render).join("")}</ul>`;

  return `<section class="panel">
    <h2>Population — and what this product refuses to know</h2>
    <p class="decision"><b>The decision:</b> is anyone here, and can you say so honestly?
      This panel mostly refuses. "User analysis" in the ordinary sense — funnels, cohort
      retention, session analytics — does not exist here and cannot be added without
      reversing a decision record. The three columns are the honest split: what is
      derivable, what is merely unbuilt, and what is off the table.</p>

    <div class="banner">
      <div><strong>State: ${esc(pop.state)}.</strong> ${pop.state === "pre-launch"
        ? "No answers have cleared the k-floor, so every live figure below is null. That is the correct reading of a product that has not launched — not a broken pipeline."
        : "Live figures come from the k-floored public mirror only."}</div>
    </div>

    <div class="split" style="margin-top:18px">
      <div class="col live">
        <h4>Derivable today</h4>
        <p class="h">From the k-floored public mirror. No credentials beyond the web API key.</p>
        ${li(pop.live, (x) => `<li>
          <b>${esc(x.metric)}${x.value == null ? "" : ` — ${int(x.value)}`}</b>
          <code>${esc(x.source)}</code>
          <em>${esc(x.caveat)}</em></li>`)}
      </div>
      <div class="col block">
        <h4>Unbuilt, not forbidden</h4>
        <p class="h">Each could be built without reversing anything. Each has a real cost.</p>
        ${li(pop.blocked, (x) => `<li>
          <b>${esc(x.metric)}</b>
          <em>Unblocked by: ${esc(x.unblockedBy)} — ${esc(x.cost)}.</em>
          <em style="color:var(--serious)">The catch: ${esc(x.catch)}</em></li>`)}
      </div>
      <div class="col refuse">
        <h4>Off the table</h4>
        <p class="h">Each names the record it would reverse. "We decided not to" is only useful with the decision attached.</p>
        ${li(pop.refused, (x) => `<li>
          <b>${esc(x.metric)}</b>
          <code>${esc(x.record)}</code>
          <em>${esc(x.why)}</em></li>`)}
      </div>
    </div>

    <p class="note">The middle column is where the honest wins are. The largest —
      real DAU and retention — needs <b>no new collection</b>: <code>v2_agg_events</code>
      already holds (qid, uid, at) with a 90-day TTL, erased with the account. But it was
      justified as fake-account attribution, and counting distinct users per day is a new
      purpose for existing data. That is a decision record, not a script — which is
      exactly the sort of thing this console exists to make visible rather than to
      quietly do.</p>
  </section>`;
}

// ── panel 5 · instrumentation ───────────────────────────────────

function panelInstrumentation(p) {
  const ins = p.instrumentation;
  const rows = ins.functions.map((f) => `
    <tr>
      <td class="t"><code>${esc(f.name)}</code></td>
      <td class="t">${esc(f.kind)}</td>
      <td class="t"><span style="color:var(--ink-muted)">${esc(f.file)}</span></td>
      <td class="t">${f.alerted
        ? statusChip("good", "alert policy")
        : statusChip("off", "none")}</td>
    </tr>`).join("");

  const policies = ins.policies.map((pol) => `
    <tr>
      <td class="t"><b>${esc(pol.displayName)}</b></td>
      <td class="t"><code>${esc(pol.file)}</code></td>
      <td class="t">${esc(pol.watches)}</td>
      <td class="t">${pol.enabled ? statusChip("good", "enabled") : statusChip("warning", "disabled")}</td>
      <td class="t">${statusChip("warning", "manual apply")}</td>
    </tr>`).join("");

  return `<section class="panel">
    <h2>Instrumentation — am I flying blind?</h2>
    <p class="decision"><b>The decision:</b> which of these functions would fail silently?
      Scanned from the tree rather than listed by hand, so a new function or a new policy
      shows up here without anyone remembering to add it — that omission being the exact
      failure this console exists to reduce.</p>

    ${tiles([
      { k: "Functions with an alert", v: `${ins.alertedCount}/${ins.functionCount}`,
        status: ins.alertedCount < ins.functionCount ? "warning" : "good",
        n: "one trigger is covered; the callables are not" },
      { k: "Log-based metrics", v: int(ins.logMetrics.length),
        n: ins.logMetrics.map((m) => m.name).join(", ") || "none" },
      { k: "Alert policies", v: int(ins.policies.length),
        n: "committed JSON — `npm run monitoring:apply` puts them live" },
    ])}

    <h3>Alert policies</h3>
    <div class="scroll"><table>
      <thead><tr><th>Policy</th><th>File</th><th>Watches</th><th>State</th><th>Deployment</th></tr></thead>
      <tbody>${policies}</tbody>
    </table></div>
    <p class="note tight">${esc(ins.note)}</p>

    <h3>Deployed functions</h3>
    <div class="scroll"><table>
      <thead><tr><th>Function</th><th>Kind</th><th>File</th><th>Alerting</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p class="note">The uncovered ones are mostly callables, which fail loudly to the
      caller — a user sees an error, and there is a person to notice. <code>onV2AnswerCreated</code>
      is alerted precisely because it does <em>not</em> do that: it runs with
      <code>retry:true</code>, so a crash accumulates for ~7 days while the app looks
      healthy and the Mirror quietly stops moving. Coverage is a judgement, not a
      percentage to maximise.</p>
  </section>`;
}

// ── page ────────────────────────────────────────────────────────

export function renderPulse(p, trail = []) {
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>InSight pulse — ${esc(p.generatedOn)}</title>
<style>${CSS}</style>
<button class="theme" id="themeBtn" type="button">Theme</button>
<div id="tip" role="status" aria-live="polite"></div>
<div class="wrap">
  <header class="top">
    <h1>InSight pulse</h1>
    <p class="sub">Cost, money, the question pipeline, and reach — on one page, so the
      decisions between them stop being made from memory. Every figure is either
      computed from a committed file or modelled from stated assumptions; none of it
      reads a user.</p>
    <p class="meta">Generated ${esc(p.generatedOn)} by <code>npm run pulse</code> ·
      prices ${esc(p.cost.region)} · data <code>monitoring/pulse.json</code> ·
      the argument behind every panel is in <code>docs/MONITORING.md</code></p>
  </header>

  ${panelPipeline(p, trail)}
  ${panelCost(p)}
  ${panelMoney(p)}
  ${panelPopulation(p)}
  ${panelInstrumentation(p)}

  <footer>
    Regenerate with <code>npm run pulse</code>. This page and
    <code>monitoring/pulse.json</code> are both derived and neither is committed —
    <code>monitoring/pulse-trail.jsonl</code> is, because it is the only output holding
    something the tree does not already know: what these numbers were on days nobody is
    looking at any more. <code>npm run pulse -- --check</code> is the operator gate. It
    runs daily on a schedule rather than on pull requests, because the conditions it
    catches shorten by one every midnight — which is not something a pull request
    can fix.
  </footer>
</div>
<script>
(function () {
  var root = document.documentElement, btn = document.getElementById("themeBtn");
  btn.addEventListener("click", function () {
    var dark = getComputedStyle(root).getPropertyValue("color-scheme").trim() === "dark";
    root.setAttribute("data-theme", dark ? "light" : "dark");
  });
  // One delegated listener rather than per-mark handlers: the marks are
  // generated and there can be a lot of them.
  var tip = document.getElementById("tip");
  document.addEventListener("mouseover", function (e) {
    var el = e.target.closest("[data-tip]");
    if (!el) return;
    var parts = el.getAttribute("data-tip").split("|");
    tip.innerHTML = "<b></b><span></span>";
    tip.firstChild.textContent = parts[0];
    tip.lastChild.textContent = parts.slice(1).join("|");
    tip.style.opacity = "1";
  });
  document.addEventListener("mousemove", function (e) {
    if (tip.style.opacity !== "1") return;
    var x = e.clientX + 14, y = e.clientY + 16;
    var r = tip.getBoundingClientRect();
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14;
    if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 16;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  });
  document.addEventListener("mouseout", function (e) {
    if (e.target.closest("[data-tip]")) tip.style.opacity = "0";
  });
})();
</script>
`;
}
