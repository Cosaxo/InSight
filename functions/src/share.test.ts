// The shareable results page (D374): what the page states, what it never
// states, and the headers a page served from a function has to carry
// itself. Rendered pure — no server, no Firestore — off the two public
// documents' shapes.
import { describe, expect, it } from "vitest";
import { QID_RE, RESULTS_HEADERS, linkDomain, qidOf, renderResultsPage, sharePcts } from "./share";

const QUESTION = {
  surface: "feed", paid: true, type: "binary",
  prompt: "Should the harbour bath stay open <all> winter?",
  options: ["Keep it open", "Close for winter"],
  sponsor: { buyer: "Harbour <Sauna>", audience: { city: "Oslo, NO" }, link: "https://www.harboursauna.no/winter?x=1" },
  from: "2026-09-06", until: "2026-10-04",
};
const AGG = {
  counts: { "0": 62, "1": 38 }, total: 100,
  by: { city: { "Oslo, NO": { "0": 62, "1": 38 } }, ageBand: { "25-34": { "0": 40, "1": 10 } } },
};
const TODAY = "2026-09-10";

describe("renderResultsPage", () => {
  it("states the question, the buyer, the split, the audience, the window, the PAID mark and the link's domain", () => {
    const { status, html } = renderResultsPage({ qid: "paidq-1", question: QUESTION, agg: AGG, today: TODAY });
    expect(status).toBe(200);
    // escaped, never raw — the prompt and the buyer are strings a buyer typed
    expect(html).toContain("Should the harbour bath stay open &lt;all&gt; winter?");
    expect(html).toContain("Harbour &lt;Sauna&gt;");
    expect(html).not.toContain("<all>");
    expect(html).toContain(">PAID<");
    expect(html).toMatch(/Keep it open[\s\S]{0,200}?62%/);
    expect(html).toMatch(/Close for winter[\s\S]{0,200}?38%/);
    expect(html).toContain("<strong>100</strong> answers");
    expect(html).toContain("asked City: Oslo, NO");
    expect(html).toContain("runs 6 Sep 2026 → 4 Oct 2026");
    // the link: the domain, the address verbatim, no referrer
    expect(html).toContain('href="https://www.harboursauna.no/winter?x=1" rel="noreferrer noopener">harboursauna.no ↗');
    // the bought dim's rows, and NOT the others: a public page states the
    // cut the buyer paid for
    expect(html).toMatch(/<h2>City<\/h2>[\s\S]*?Oslo, NO[\s\S]*?62% Keep it open · 100/);
    expect(html).not.toContain("<h2>Age</h2>");
    expect(html).not.toContain("25-34");
    for (const [k, v] of Object.entries(RESULTS_HEADERS)) expect(typeof k === "string" && v.length > 0).toBe(true);
  });

  it("says 'ran' once the window has closed, and 'answers so far' before the first answer", () => {
    const closed = renderResultsPage({ qid: "x", question: QUESTION, agg: AGG, today: "2026-11-01" }).html;
    expect(closed).toContain("ran 6 Sep 2026 → 4 Oct 2026");
    const fresh = renderResultsPage({ qid: "x", question: QUESTION, agg: null, today: TODAY }).html;
    expect(fresh).toContain("<strong>0</strong> answers so far");
    expect(fresh).toMatch(/Keep it open[\s\S]{0,120}?—/);
  });

  it("is a nameless buyer's page too, and says so without inventing a name", () => {
    const { sponsor, ...rest } = QUESTION;
    const html = renderResultsPage({ qid: "x", question: { ...rest, sponsor: { audience: sponsor.audience } }, agg: AGG, today: TODAY }).html;
    expect(html).toContain("Asked by a buyer who chose not to wear a name");
    expect(html).not.toContain("harboursauna");
  });

  it("is a SPONSORED question's page only — 404 for a bank question, a missing one, a retired one", () => {
    const { sponsor, ...bank } = QUESTION;
    void sponsor;
    expect(renderResultsPage({ qid: "f01", question: bank, agg: AGG, today: TODAY }).status).toBe(404);
    expect(renderResultsPage({ qid: "nope", question: null, agg: null, today: TODAY }).status).toBe(404);
    expect(renderResultsPage({ qid: "x", question: { ...QUESTION, active: false }, agg: AGG, today: TODAY }).status).toBe(404);
    expect(renderResultsPage({ qid: "x", question: { ...QUESTION, surface: "daily" }, agg: AGG, today: TODAY }).status).toBe(404);
    expect(renderResultsPage({ qid: "nope", question: null, agg: null, today: TODAY }).html).toContain("No results page here");
  });

  it("carries the three headers every page under web/ carries, plus nosniff spelled right", () => {
    expect(RESULTS_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(RESULTS_HEADERS["Referrer-Policy"]).toBe("no-referrer");
    expect(RESULTS_HEADERS["Content-Security-Policy"]).toMatch(/default-src 'none'/);
    expect(RESULTS_HEADERS["Content-Security-Policy"]).toMatch(/frame-ancestors 'none'/);
    expect(RESULTS_HEADERS["Content-Type"]).toMatch(/text\/html/);
  });
});

describe("qidOf — the id off the rewrite's path, the direct path, or ?qid=", () => {
  it("reads the three shapes and refuses anything that is not an id", () => {
    expect(qidOf("/q/paidq-abc_1", undefined)).toBe("paidq-abc_1");
    expect(qidOf("/resultsPageV2/q/paidq-abc", undefined)).toBe("paidq-abc");
    expect(qidOf("/", "paidq-abc")).toBe("paidq-abc");
    expect(qidOf("/q/paidq-abc/", undefined)).toBe("paidq-abc");
    expect(qidOf("/q/", undefined)).toBeNull();
    expect(qidOf("/q/..%2Fx", undefined)).toBeNull();
    expect(qidOf("/", "<script>")).toBeNull();
    expect(qidOf("/", "x".repeat(81))).toBeNull();
    expect(QID_RE.test("paidq-e2e")).toBe(true);
  });
});

describe("the copies of two client rules", () => {
  it("sharePcts is the client's largest-remainder rule — the shapes pct.ts pins", () => {
    expect(sharePcts([1, 1, 1])).toEqual([34, 33, 33]);
    expect(sharePcts([1, 1, 1, 3])).toEqual([17, 17, 16, 50]);
    expect(sharePcts([3, 3, 4, 4, 4, 4, 4, 4, 4, 4])).toEqual([8, 8, 11, 11, 11, 11, 10, 10, 10, 10]);
    expect(sharePcts([])).toEqual([]);
    expect(sharePcts([0, 0])).toEqual([0, 0]);
  });

  it("linkDomain is the client's — the bare domain, or null for anything not https", () => {
    expect(linkDomain("https://www.harboursauna.no/winter")).toBe("harboursauna.no");
    expect(linkDomain("http://harboursauna.no")).toBeNull();
    expect(linkDomain(undefined)).toBeNull();
    expect(linkDomain("not a url")).toBeNull();
  });
});
