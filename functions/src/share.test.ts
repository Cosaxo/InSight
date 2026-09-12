// The shareable results page (D379): what the page states, what it never
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

  // ── THE ERASED BUYER'S PAGE (2026-09-07) ──────────────────────────
  //
  // Two absences on this document mean deliberate choices — no name
  // (D228), no targeting — and the erasure sweep produces both by deleting
  // the fields. So the page printed a buyer's choice they never made, and
  // "asked everyone" over a sample that was one city's: a shareable page
  // headed PAID · InSight, reporting 300 answers collected only in Oslo,
  // stating it was asked of everybody.
  //
  // NEITHER SENTENCE WAS PINNED. Measured before this: replacing
  // " · asked everyone" with any other string left the functions suite at
  // 772/772, and so did changing the separator in the targeted arm.
  it("does not print an erased buyer's absences as their choices", () => {
    const { sponsor, ...rest } = QUESTION;
    void sponsor;
    const html = renderResultsPage({
      qid: "x",
      // Exactly what phase 4e leaves behind: buyer and audience deleted,
      // `sponsor` kept because the PAID band renders from its presence.
      question: { ...rest, sponsor: { erased: true } },
      agg: AGG, today: TODAY,
    }).html;
    expect(html, "the page invented a choice the buyer never made")
      .not.toContain("chose not to wear a name");
    expect(html, "a one-city sample was published as everyone's")
      .not.toContain("asked everyone");
    expect(html).toContain("Asked by a buyer who has since deleted their account");
    expect(html).toContain("audience not recorded");
  });

  // …AND THE STOPPED CAMPAIGN'S PAGE IS STILL THERE. Erasure sets
  // `active: false` on a RUNNING bought question, to take the card off
  // every surface now that the audience deciding who sees it is gone.
  // This page refused on `active` alone, so every link already shared for
  // that question went permanently dead — nothing sets `active` back on a
  // runtime paid question — and the erased byline above could only ever
  // render for a campaign that had ALREADY closed, which is the one case
  // the sweep deliberately leaves alone. The marker was written and never
  // read in the case it was written for.
  it("keeps the page for a campaign erasure stopped, and prints the erased byline on it", () => {
    const { sponsor, ...rest } = QUESTION;
    void sponsor;
    const out = renderResultsPage({
      qid: "x",
      // Exactly what phase 4e leaves on a RUNNING bought question.
      question: { ...rest, sponsor: { erased: true }, active: false },
      agg: AGG, today: TODAY,
    });
    expect(out.status, "a link already shared for this question went dead").toBe(200);
    expect(out.html).toContain("Asked by a buyer who has since deleted their account");
    expect(out.html).toContain("audience not recorded");
    // …AND THE TENSE, which is the same sentence. The window clause was
    // date-only (`q.until >= today`), so it could not see the stop the
    // sweep had just made and printed "runs 6 Sep 2026 → 4 Oct 2026" —
    // a future date, on a campaign nothing will ever restart, one line
    // after telling the reader its buyer is gone. The two clauses beside
    // it were fixed when the marker was added; this is the one that was
    // left making a false statement, on the page whose foot text is about
    // exactly that.
    expect(out.html, "the page still says a stopped campaign runs").not.toContain("runs 6 Sep 2026");
    expect(out.html, "a stopped campaign's window is not in the past tense").toContain("ran 6 Sep 2026 → 4 Oct 2026");
  });

  // THE CONTROL, and it is the one that keeps the line above from being a
  // hole: a question retired for any OTHER reason still has no page.
  it("still refuses a retired question that nobody erased", () => {
    expect(
      renderResultsPage({ qid: "x", question: { ...QUESTION, active: false }, agg: AGG, today: TODAY }).status,
      "an ordinary retired question got a page",
    ).toBe(404);
  });

  // THE TWO CONTROLS, because both sentences above are absences and an
  // absence passes when the clause is deleted outright. A real untargeted
  // purchase still says everyone; a real targeted one still names its dims.
  it("still says 'asked everyone' for a question that really was", () => {
    const { sponsor, ...rest } = QUESTION;
    const html = renderResultsPage({
      qid: "x", question: { ...rest, sponsor: { buyer: sponsor.buyer } }, agg: AGG, today: TODAY,
    }).html;
    expect(html).toContain("asked everyone");
    expect(html).not.toContain("audience not recorded");
  });

  it("still names the dims of one that was targeted", () => {
    const html = renderResultsPage({ qid: "x", question: QUESTION, agg: AGG, today: TODAY }).html;
    expect(html).toContain("asked City: Oslo, NO");
    expect(html).not.toContain("asked everyone");
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

  // D368 took the purchase funnel out of the binary, which left the door
  // reachable only by typing its address. This page is the one public
  // surface a prospective buyer already reads, so it carries the door —
  // on the 404 too, which otherwise dead-ends a shared address.
  it("offers the door on both bodies, relative so it survives a domain change", () => {
    const live = renderResultsPage({ qid: "x", question: QUESTION, agg: AGG, today: TODAY }).html;
    const gone = renderResultsPage({ qid: "nope", question: null, agg: null, today: TODAY }).html;
    for (const html of [live, gone]) {
      expect(html).toContain('href="/ask"');
      expect(html).toContain("Ask your own question");
      // Relative, not the .web.app origin: siteOrigin.ts's single edit
      // only stays single if nothing hardcodes the host behind its back.
      expect(html).not.toContain("prvfire33.web.app");
    }
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
