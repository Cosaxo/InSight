// check-public-copy.test.mjs — pins the D116 gate in both directions.
//
// The regression cases below are not invented. Every string in
// WAS_LIVE was real copy in this repo on 2026-08-12: the first four were
// being served by App Store Connect (pushed 08-08, LAUNCH-RUNBOOK 4.3),
// and the fifth shipped inside the binary in the privacy panel. A gate
// whose test cases are hypothetical proves the regex compiles; these
// prove it catches what actually happened.
//
// The other half matters just as much and is the easier one to break by
// tightening a pattern: D106's standing rule is that a reversal is kept
// and marked as history, so past-tense sentences about the retired model
// MUST keep passing. web/privacy.html carries two on purpose. A gate that
// punished them would push the next author into deleting the record
// instead of dating it, which is the opposite of what this repo wants.
import { describe, it, expect } from "vitest";
import { scan, scanText, RETIRED } from "./check-public-copy.mjs";
import { readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("the claims that were actually live", () => {
  // Verbatim, from git history at the commit this gate was added.
  const WAS_LIVE = [
    ["apple/play description",
      "• Your answers are owner-only. The database rules enforce it — it isn't a policy you have to take on faith."],
    ["apple/play description",
      "• Crowd numbers are floored. A split stays hidden until enough people have answered that no count can be traced back to one person."],
    ["apple/play description",
      "The counts you then see are real: nothing is shown until enough people have answered for the number to mean something."],
    ["home.html, pre-D106",
      "Answers are yours alone. Population counts are k-anonymous."],
    ["LivePrivacyPanel, post-D106",
      "Strangers' takes appear under world questions, always without a name."],
    // These two are the reason the takes pattern has three spellings. The
    // first version of it was written from the panel's wording alone;
    // running it across the tree found the same claim twice more in the
    // PUBLISHED privacy policy, phrased differently both times.
    ["privacy.html prose, post-D106",
      "posted to the world it is published to everyone <em>with no name attached</em>, one per person per question."],
    ["privacy.html who-can-see-what, post-D106",
      "<strong>Your world takes:</strong> everyone, with no name attached."],
  ];

  for (const [where, text] of WAS_LIVE) {
    it(`catches: ${text.slice(0, 52)}… (${where})`, () => {
      expect(scanText(text).length).toBeGreaterThan(0);
    });
  }

  it("names a reason for every finding, not just a match", () => {
    // The failure output is the whole value of the gate: whoever trips it
    // is usually not the person who knows what D98 changed.
    for (const [, text] of WAS_LIVE) {
      for (const hit of scanText(text)) {
        expect(hit.why).toMatch(/D98/);
        expect(hit.excerpt.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("history stays legal — the false positives that would matter", () => {
  // Both verbatim from web/privacy.html, which keeps them deliberately.
  const HISTORY = [
    "This page promised the opposite until 2026-08-11, and the change is recorded here rather than quietly made. Answers used to be readable only by their author, and counts were withheld below a minimum number of respondents; both are gone.",
    "There used to be a threshold here, below which a count was withheld, and there no longer is one. It was removed on 2026-08-11 along with the rest of the model it belonged to.",
  ];
  for (const text of HISTORY) {
    it(`allows: ${text.slice(0, 46)}…`, () => {
      expect(scanText(text)).toEqual([]);
    });
  }

  it("allows the two true uses of 'anonymous' in the privacy panel", () => {
    // D3's anonymous session and the uid-only crash reports. An earlier
    // draft of the panel test forbade the word outright and failed on
    // both of these — the reason the patterns key on the claim shape
    // ("takes are anonymous") rather than on the word.
    expect(scanText("You're on an anonymous session — it lives only on this phone.")).toEqual([]);
    expect(scanText("anonymous crash and error reports (uid only, never your answers)")).toEqual([]);
  });

  it("allows the true post-D98 copy that replaced each claim", () => {
    expect(scanText("Your answers are public. Anyone using InSight can see what you answered.")).toEqual([]);
    expect(scanText("counts are exact from the very first answer, so in a small cohort a count of 1 is visibly one person's answer")).toEqual([]);
    expect(scanText("Takes are posted under your name — on world questions as well as inside a circle.")).toEqual([]);
  });
});

describe("the live corpus", () => {
  it("passes, and reads a plausible number of surfaces", () => {
    const { problems, readErrors, surfaces } = scan();
    expect(readErrors).toEqual([]);
    expect(problems).toEqual([]);
    // Guards the silent-success failure: a collect() that stopped finding
    // files would report OK on nothing at all.
    expect(surfaces.length).toBeGreaterThan(10);
  });

  it("reads the store listing and every enumerated page", () => {
    const labels = scan().surfaces.map((s) => s.label).join("\n");
    expect(labels).toMatch(/design\/store\/listing\.json → apple\.description/);
    expect(labels).toMatch(/design\/store\/listing\.json → play\.fullDescription/);
    expect(labels).toMatch(/web\/privacy\.html/);
    expect(labels).toMatch(/web\/home\.html/);
    expect(labels).toMatch(/web\/terms\.html/);
    expect(labels).toMatch(/LivePrivacyPanel\.tsx/);
  });

  it("reads EVERY page in web/, not a hand-kept four", () => {
    // The list was hand-kept, with a comment promising that adding a page
    // means adding a line — and the note beside `join.html` claimed it
    // "was the one page in web/ this list did not name" on a day when
    // three others already existed. Two of those are where a buyer lands
    // straight out of Stripe Checkout, carrying both classes this gate
    // reads: a who-can-see-what claim and a contract claim.
    //
    // So the property is the DIRECTORY, not a number: whatever is served
    // is scanned.
    const onDisk = readdirSync(join(repoRoot, "web"))
      .filter((f) => f.endsWith(".html"))
      .sort();
    expect(onDisk.length, "web/ has no pages — this case is measuring nothing").toBeGreaterThan(3);
    const labels = scan().surfaces.map((s) => s.label).join("\n");
    for (const f of onDisk) {
      expect(labels, `web/${f} is served and this gate never reads it`).toContain(`web/${f}`);
    }
  });

  it("skips the $-prefixed operator annotations in listing.json", () => {
    // $whatsNew explains Apple's 409 to a human; asc-push ignores it and
    // so must this. It is not copy anyone reads in a store.
    expect(scan().surfaces.some((s) => s.label.includes("$whatsNew"))).toBe(false);
  });
});

describe("the pattern list itself", () => {
  it("is case-insensitive throughout", () => {
    // A store field typed in title case is the obvious way to slip one
    // past a case-sensitive list.
    for (const { re } of RETIRED) expect(re.flags).toContain("i");
    expect(scanText("YOUR ANSWERS ARE OWNER-ONLY.").length).toBe(1);
  });

  it("is stateless between calls", () => {
    // A /g regex on a shared object carries lastIndex across exec calls,
    // so the same string would match, then not match, then match. None of
    // these may be global.
    for (const { re } of RETIRED) expect(re.flags).not.toContain("g");
    const s = "Your answers are owner-only.";
    expect(scanText(s).length).toBe(scanText(s).length);
    expect(scanText(s).length).toBe(1);
  });
});
