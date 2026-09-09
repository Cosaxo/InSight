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
import { scan, scanText, scanVoice, RETIRED, VOICE, DUEL_SURFACES } from "./check-public-copy.mjs";
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

    // ── D414's five, verbatim from the tree on 2026-09-07 ────────────
    //
    // Every one of these was live AFTER the account wall merged, and every
    // one passed this gate as it then stood. The listing pair is the
    // serious one: it was hours from going to App Store Connect beside a
    // build that opens on a wall, which is the same failure this file's
    // header records for "answers are owner-only" — same file, same
    // consequence, thirteen months apart.
    ["apple/play description, post-D414",
      "• No sign-up wall. Open it and start: no email, no phone number. Linking a Google account later is optional and keeps everything you already have."],
    ["join.html, post-D414",
      "No account or email needed — the app works anonymously from the first tap."],
    ["privacy.html Children, post-D414",
      "There is little to collect: no account is required and no personal details are requested."],
    // Not a page — an aria-label, which is copy a screen reader speaks and
    // nothing else in the tree scans.
    ["LiveDuelPanel invite button, post-D414",
      "Copy invite link — no account needed"],
    ["STORE-FORMS 4.8 reply, post-D414",
      "the primary path is anonymous, no account is required to use the app, and Google is an optional upgrade rather than a login wall"],
  ];

  for (const [where, text] of WAS_LIVE) {
    it(`catches: ${text.slice(0, 52)}… (${where})`, () => {
      expect(scanText(text).length).toBeGreaterThan(0);
    });
  }

  it("names a reason for every finding, not just a match", () => {
    // The failure output is the whole value of the gate: whoever trips it
    // is usually not the person who knows what changed. The reason must
    // therefore cite the decision that retired the claim — and there are
    // now TWO retired models in this list (D98's privacy vocabulary,
    // D414's anonymous-first one), so the assertion is that a decision is
    // named, not that it is the first one.
    for (const [, text] of WAS_LIVE) {
      for (const hit of scanText(text)) {
        expect(hit.why, `no decision cited for: ${text.slice(0, 40)}`).toMatch(/\bD\d+\b/);
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
    // D414 retired the CLAIM that the app is usable without an account,
    // not the word. The app still signs every session in anonymously (D3,
    // untouched) and the attention tally is genuinely unlinkable, so both
    // must keep being describable.
    expect(scanText("The app signs you in anonymously at first launch, then the account attaches to that same session.")).toEqual([]);
    expect(scanText("The tally carries no account, no name and no device id, so it cannot be linked back to you.")).toEqual([]);
    expect(scanText("Until 2026-09-07 no account was required; that stopped being true when signing in became a requirement.")).toEqual([]);
  });

  it("allows the true post-D98 copy that replaced each claim", () => {
    expect(scanText("Your answers are public. Anyone using InSight can see what you answered.")).toEqual([]);
    expect(scanText("counts are exact from the very first answer, so in a small cohort a count of 1 is visibly one person's answer")).toEqual([]);
    expect(scanText("Takes are posted under your name — on world questions as well as inside a circle.")).toEqual([]);
  });
});

describe("the duel surfaces' voice (D435)", () => {
  // Verbatim from the tree on 2026-09-09, before step E of
  // VISION-2026-09-09 — every one shipped green under every gate.
  const WAS_LIVE = [
    ["LiveGroupsMirrorBody, the head", "aligned with you · 3 of 4 days"],
    ["LiveGroupsMirrorBody, the Answers tab", "Reading the days…"],
    ["LiveGroupsMirrorBody, the cross-group line", "runs most like you — with it on 2 of the 3 days you played."],
    ["LiveRolesPanel, the floor", "No 1v1 has 3 days you both guessed yet"],
    ["LiveRolesPanel, the floor", "No group has 2 revealed days you played yet"],
    ["the design's own removed list", "crowned by the majority"],
    ["the design's own removed list", "the one in charge"],
    ["LiveDuelPanel, pre-D435", "sealed until tomorrow"],
    ["a template literal", "${n} days revealed"],
  ];
  for (const [where, text] of WAS_LIVE) {
    it(`catches: ${text.slice(0, 52)} (${where})`, () => {
      expect(scanVoice(text).length).toBeGreaterThan(0);
    });
  }

  it("leaves a date, a round, an hour and an identifier alone", () => {
    expect(scanVoice("3 days ago")).toEqual([]);
    expect(scanVoice("Yesterday")).toEqual([]);
    expect(scanVoice("round 4 · reveals in 47 hours")).toEqual([]);
    expect(scanVoice("const majorityIdx = counts.indexOf(maxN); r.withMajority")).toEqual([]);
    expect(scanVoice("The room named you 3 of 9 votes")).toEqual([]);
    expect(scanVoice("Every fourth round asks what the other is to you")).toEqual([]);
  });

  it("names a decision for every finding", () => {
    for (const { why } of VOICE) expect(why).toMatch(/\bD\d+\b/);
  });

  it("guards the files it names, and only those", () => {
    const { surfaces } = scan();
    for (const f of DUEL_SURFACES) expect(surfaces.some((s) => s.label === f), `${f} not collected`).toBe(true);
    // the privacy page may say "days" — the voice is the duel surfaces'
    expect(DUEL_SURFACES.some((f) => f.startsWith("web/"))).toBe(false);
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
    // AN EXPLICIT BUDGET, because this case reads the tree from disk and
    // vitest's default is 5 s. It came in at 5,423 ms once on a cold
    // cache and failed — in `test:scripts`, which runs in CI's LINT job,
    // where a timeout reads as a copy violation rather than as a slow
    // disk. 60 s is the same budget check-figures.test.mjs gives its own
    // tree copy, and it is a ceiling rather than an expectation: the run
    // takes about a second warm, and a case that genuinely started taking
    // a minute would be a finding of its own.
  }, 60_000);

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
