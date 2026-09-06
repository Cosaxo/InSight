// share.ts — the shareable results page (D379; docs/SPONSORED-PLAN.md §2.5).
//
// A public page per SPONSORED question, on the open web, at the hosting
// rewrite /q/{qid}: the question, the buyer's name (or none), the split,
// the audience the buyer bought and the breakdown by those dims, the
// window, the PAID mark, and the buyer's link as its domain. Rendered
// here on the admin SDK because a public page cannot sign in and the two
// documents it reads are signed-in-readable (D98); cached five minutes
// at the CDN so a shared address that gets popular costs two document
// reads a minute rather than two a view.
//
// WHAT IT SHOWS, AND WHAT IT NEVER WILL. Exactly the numbers every
// signed-in user reads on the card and in the buyer's room — the public
// aggregate, `counts` and the bought dims' rows of `by`. Never an answer
// row, never a uid, never a name but the buyer's own chosen one. The page
// is the same fold the app draws, rendered as one screen; it is not a
// new cut and it opens no private door. Which is also why it is a
// SPONSORED question's page only: a paid question is content with a
// buyer behind it and a result the buyer paid to be able to point at,
// and the bank's own questions have no such person and no such address.
//
// onRequest, not onCall, and no App Check: this serves the open web —
// a browser with no app, no token and no account — which is the whole
// point of a shareable address. check:appcheck reads onCall sites; an
// HTTPS function is outside its list by shape, and this comment is the
// reason it should stay so. The page sets its own security headers,
// because check:web-headers holds the FILES under web/ and a rewrite
// served from here is not one.
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { FUNCTIONS_REGION } from "./ops";
import { db as firestore } from "./db";

/** How long the CDN and a browser may hold a page. Five minutes: the
 * aggregate moves on every answer, and a shared page a few answers
 * behind is a page, not a lie — the app's own card is the live one. */
export const RESULTS_CACHE_SECONDS = 300;

/** A question id as the seed and the webhook mint them — and nothing
 * that could be a path, a query or a script. */
export const QID_RE = /^[A-Za-z0-9_-]{1,80}$/;

/** The headers every response carries — the same three every page under
 * web/ carries (firebase.json), pinned here because that gate cannot see
 * a page served from a function. */
export const RESULTS_HEADERS: Record<string, string> = {
  "Content-Type": "text/html; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

/**
 * Integer percentages that sum to exactly 100, largest remainder first —
 * BYTE-FOR-BYTE the client's rule (src/v2/data/pct.ts, which carries the
 * reasoning and the 840,000-vector measurement). A second copy because a
 * Cloud Function cannot import a client module, and the same rule
 * because a page that printed 51/48 under a card that printed 51/49
 * would be the drift pct.ts exists to end. share.test.ts pins the shapes
 * pct.ts's own test does.
 */
export function sharePcts(counts: readonly number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return counts.map(() => 0);
  const scaled = counts.map((c) => c * 100);
  const out = scaled.map((s) => Math.floor(s / total));
  const remainder = scaled.map((s, i) => s - out[i] * total);
  let rest = 100 - out.reduce((a, b) => a + b, 0);
  const order = remainder.map((r, i) => ({ r, i })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (let k = 0; k < order.length && rest > 0; k++, rest--) out[order[k].i] += 1;
  return out;
}

/** The display names the app's band prints (src/v2/data/cohort.ts
 * DIM_LABEL), for the audience line and the breakdown headings. */
const DIM_LABEL: Record<string, string> = {
  ageBand: "Age", gender: "Gender", city: "City", country: "Country",
  education: "Education", relationship: "Relationship", heightBand: "Height", jobField: "Field",
};

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** The bare domain a link prints as — the client's linkDomain, one
 * rule (src/v2/data/sponsored.ts). Null for anything not https. */
export function linkDomain(link: unknown): string | null {
  if (typeof link !== "string" || !link) return null;
  try {
    const u = new URL(link);
    if (u.protocol !== "https:") return null;
    return u.hostname.replace(/^www\./i, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayLabel = (iso: unknown): string | null => {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const fmtN = (n: number): string => n.toLocaleString("en-US").replace(/,/g, " ");

export interface ResultsInput {
  qid: string;
  /** v2_questions/{qid}, or null when it does not exist */
  question: Record<string, unknown> | null;
  /** v2_question_aggs/{qid}, or null before the first answer */
  agg: Record<string, unknown> | null;
  /** the day the page is rendered for, YYYY-MM-DD (UTC) */
  today: string;
}

const STYLE = `
    :root { --paper:#f7f1e8; --paper-2:#efe8dc; --paper-3:#e6dccb; --ink:#2a2419; --ink-2:#4d4538; --ink-3:#7d705a; --rule:#cfc6b3; --accent:oklch(0.55 0.13 38); --serif:"Fraunces",Georgia,serif; --sans:-apple-system,"Inter",system-ui,sans-serif; --mono:"JetBrains Mono",ui-monospace,monospace; }
    * { box-sizing:border-box; }
    body { margin:0 auto; padding:40px 20px 80px; background:var(--paper); color:var(--ink); font-family:var(--serif); font-size:16px; line-height:1.5; max-width:640px; }
    .kicker { font-family:var(--mono); font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-3); display:flex; gap:10px; align-items:center; }
    .paid { background:var(--ink); color:var(--paper); border-radius:999px; padding:3px 10px; font-weight:800; letter-spacing:.16em; }
    h1 { font-size:30px; font-style:italic; letter-spacing:-.01em; line-height:1.15; margin:14px 0 6px; text-wrap:balance; }
    .by { font-family:var(--sans); font-size:13px; color:var(--ink-2); margin:0 0 22px; }
    .opt { display:grid; grid-template-columns:1fr auto; gap:4px 12px; align-items:baseline; margin:10px 0; font-family:var(--sans); }
    .opt .l { font-weight:700; font-size:15px; }
    .opt .p { font-variant-numeric:tabular-nums; font-weight:800; font-size:15px; }
    .opt .n { grid-column:2; font-size:11.5px; color:var(--ink-3); font-variant-numeric:tabular-nums; text-align:right; }
    .bar { grid-column:1 / -1; height:9px; border-radius:999px; background:var(--paper-3); overflow:hidden; }
    .bar > span { display:block; height:100%; background:var(--ink); border-radius:999px; }
    .bar.lead > span { background:var(--accent); }
    .total { font-family:var(--sans); font-size:12.5px; color:var(--ink-2); margin:14px 0 0; }
    h2 { font-family:var(--sans); font-size:11px; letter-spacing:.09em; text-transform:uppercase; color:var(--ink-3); margin:30px 0 8px; border-bottom:.5px solid var(--rule); padding-bottom:6px; font-weight:700; }
    .row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:2px 12px; align-items:baseline; font-family:var(--sans); font-size:13px; padding:7px 0; border-bottom:.5px solid color-mix(in oklch, var(--rule), transparent 40%); }
    .row .b { font-weight:700; }
    .row .s { font-variant-numeric:tabular-nums; color:var(--ink-2); text-align:right; }
    .foot { font-family:var(--sans); font-size:12px; color:var(--ink-3); margin-top:34px; line-height:1.55; }
    .foot a, .link a { color:var(--accent); }
    .link { font-family:var(--sans); font-size:13.5px; font-weight:700; margin-top:18px; }
    .empty { font-family:var(--sans); font-size:13px; color:var(--ink-3); }
`;

function page(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex" />
  <title>${esc(title)}</title>
  <style>${STYLE}</style>
</head>
<body>
${body}
</body>
</html>
`;
}

/** The 404 body: says what a page here IS rather than nothing, because
 * the address was shared by somebody and the reader deserves a sentence. */
function notFound(): string {
  return page("No such page · InSight", `
  <div class="kicker"><span>InSight</span></div>
  <h1>No results page here.</h1>
  <p class="by">A results page exists for a question somebody paid to ask on InSight, while it is live and after. This address is not one.</p>
`);
}

/**
 * Pure: the page for one question, off the two public documents, or the
 * 404 page. Exported so the test renders it without a server.
 */
export function renderResultsPage(input: ResultsInput): { status: number; html: string } {
  const q = input.question;
  const sponsor = q && q.sponsor && typeof q.sponsor === "object" ? (q.sponsor as Record<string, unknown>) : null;
  if (!q || q.surface !== "feed" || !sponsor || q.active === false) return { status: 404, html: notFound() };
  const prompt = String(q.prompt ?? "");
  const options = Array.isArray(q.options) ? (q.options as unknown[]).map((o) => String(o ?? "")) : [];
  const counts = options.map((_, i) => {
    const c = input.agg && input.agg.counts && typeof input.agg.counts === "object" ? (input.agg.counts as Record<string, unknown>)[String(i)] : 0;
    return typeof c === "number" && Number.isFinite(c) && c > 0 ? Math.floor(c) : 0;
  });
  const total = counts.reduce((a, b) => a + b, 0);
  const pcts = sharePcts(counts);
  const lead = total ? counts.indexOf(Math.max(...counts)) : -1;
  const buyer = typeof sponsor.buyer === "string" && sponsor.buyer.trim() ? sponsor.buyer.trim() : null;
  const audience = sponsor.audience && typeof sponsor.audience === "object" ? (sponsor.audience as Record<string, unknown>) : {};
  const audLine = Object.entries(audience).map(([d, b]) => `${DIM_LABEL[d] ?? d}: ${String(b)}`);
  const from = dayLabel(q.from);
  const until = dayLabel(q.until);
  const live = typeof q.until === "string" && q.until >= input.today;
  const domain = linkDomain(sponsor.link);

  const split = options.length
    ? options.map((o, i) => `
  <div class="opt">
    <span class="l">${esc(o)}</span>
    <span class="p">${total ? `${pcts[i]}%` : "—"}</span>
    <span class="bar${i === lead ? " lead" : ""}"><span style="width:${total ? pcts[i] : 0}%"></span></span>
    <span class="n">${fmtN(counts[i])} ${counts[i] === 1 ? "answer" : "answers"}</span>
  </div>`).join("")
    : `<p class="empty">This question has no options to count.</p>`;

  // The breakdown by the dims the buyer bought (the plan's §2.5) — the
  // same rows of `by` the app draws, and only those dims: a public page
  // states the cut the buyer paid for, and the wider breakdown stays
  // where it is read signed in.
  const by = input.agg && input.agg.by && typeof input.agg.by === "object" ? (input.agg.by as Record<string, unknown>) : {};
  const breakdown = Object.keys(audience).map((dim) => {
    const buckets = by[dim] && typeof by[dim] === "object" ? (by[dim] as Record<string, unknown>) : {};
    const rows = Object.entries(buckets).map(([bucket, cells]) => {
      const c = cells && typeof cells === "object" ? (cells as Record<string, unknown>) : {};
      const vec = options.map((_, i) => { const v = c[String(i)]; return typeof v === "number" && v > 0 ? Math.floor(v) : 0; });
      const n = vec.reduce((a, b) => a + b, 0);
      return { bucket, n, vec };
    }).filter((r) => r.n > 0).sort((a, b) => b.n - a.n);
    if (!rows.length) return "";
    return `
  <h2>${esc(DIM_LABEL[dim] ?? dim)}</h2>
  ${rows.map((r) => {
    const p = sharePcts(r.vec);
    const top = r.vec.indexOf(Math.max(...r.vec));
    return `<div class="row"><span class="b">${esc(r.bucket)}</span><span class="s">${p[top]}% ${esc(options[top] ?? "")} · ${fmtN(r.n)}</span></div>`;
  }).join("\n  ")}`;
  }).join("");

  const body = `
  <div class="kicker"><span class="paid">PAID</span><span>InSight · a question somebody paid to ask</span></div>
  <h1>${esc(prompt)}</h1>
  <p class="by">${buyer ? `Asked by <strong>${esc(buyer)}</strong>` : "Asked by a buyer who chose not to wear a name"}${audLine.length ? ` · asked ${esc(audLine.join(" · "))}` : " · asked everyone"}${from && until ? ` · ${live ? "runs" : "ran"} ${esc(from)} → ${esc(until)}` : ""}</p>
  ${split}
  <p class="total"><strong>${fmtN(total)}</strong> ${total === 1 ? "answer" : "answers"}${total ? "" : " so far — the split appears with the first one"}</p>
  ${breakdown}
  ${domain && typeof sponsor.link === "string" ? `<p class="link"><a href="${esc(sponsor.link)}" rel="noreferrer noopener">${esc(domain)} ↗</a> · the buyer's page</p>` : ""}
  <p class="foot">These are the same public numbers everyone reads in the app — there is no private cut, and nobody who answered is named here. The buyer paid for the place and the window, never for the review. <a href="/privacy.html" rel="noreferrer">How InSight handles data</a>.</p>
`;
  return { status: 200, html: page(`${prompt} · InSight`, body) };
}

/** The qid off the request: the rewrite's path (/q/{qid}), the function's
 * own path when called directly (…/resultsPageV2/q/{qid}), or ?qid= for a
 * tool. Null for anything that is not a question id. */
export function qidOf(path: string, query: unknown): string | null {
  const m = /\/q\/([^/?#]+)\/?$/.exec(path || "");
  const raw = m ? m[1] : typeof query === "string" ? query : "";
  let s: string;
  try { s = decodeURIComponent(raw).trim(); } catch { return null; }
  return QID_RE.test(s) ? s : null;
}

export const resultsPageV2 = onRequest(
  { region: FUNCTIONS_REGION, memory: "256MiB", timeoutSeconds: 30 },
  async (req, res) => {
    for (const [k, v] of Object.entries(RESULTS_HEADERS)) res.setHeader(k, v);
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.status(405).send("GET only");
      return;
    }
    const qid = qidOf(req.path, req.query.qid);
    const today = new Date().toISOString().slice(0, 10);
    if (!qid) {
      res.setHeader("Cache-Control", `public, max-age=${RESULTS_CACHE_SECONDS}`);
      res.status(404).send(notFound());
      return;
    }
    let out: { status: number; html: string };
    try {
      const db = firestore();
      const [qSnap, aSnap] = await db.getAll(
        db.collection("v2_questions").doc(qid),
        db.collection("v2_question_aggs").doc(qid),
      );
      out = renderResultsPage({
        qid,
        question: qSnap.exists ? (qSnap.data() as Record<string, unknown>) : null,
        agg: aSnap.exists ? (aSnap.data() as Record<string, unknown>) : null,
        today,
      });
    } catch (err) {
      logger.error("[share] results page failed", { qid, message: String((err as Error)?.message ?? err), metric: "share_page_failed" });
      res.setHeader("Cache-Control", "no-store");
      res.status(500).send(page("InSight", "<p class=\"empty\">Could not read this page just now. Try again in a minute.</p>"));
      return;
    }
    // Cached either way: a 404 for an address that never was is as stable
    // as a page for one that is.
    res.setHeader("Cache-Control", `public, max-age=${RESULTS_CACHE_SECONDS}, s-maxage=${RESULTS_CACHE_SECONDS}`);
    res.status(out.status).send(out.html);
  },
);
