// The political consent predicates (D331).
//
// WHAT THESE HOLD, and it is one property stated four ways: the political
// coordinate is published ONLY on a live, current, un-withdrawn yes.
// Every other state — never asked, declined, withdrawn, agreed to an
// older wording, or a profile shaped like nothing at all — must come back
// false, because the failure direction is not symmetric. A false negative
// costs a feature; a false positive publishes special-category data
// nobody agreed to, onto a profile any signed-in user can read.
//
// So the matrix is enumerated rather than sampled.
import { describe, expect, it } from "vitest";
import {
  hasAnsweredPoliticalAsk,
  mayPublishPolitical,
  politicalConsentRecord,
  POLITICAL_CONSENT_VERSION,
  readPoliticalConsent,
} from "./politicalConsent";

const withConsent = (political: unknown) => ({ consent: { political } });

describe("mayPublishPolitical — the gate", () => {
  it("is FALSE for every shape that is not a live current yes", () => {
    const V = POLITICAL_CONSENT_VERSION;
    for (const [what, profile] of [
      ["null profile", null],
      ["undefined profile", undefined],
      ["a string", "yes"],
      ["no consent key", { displayName: "A" }],
      ["consent but no political", { consent: {} }],
      ["political null", withConsent(null)],
      ["political true — a boolean is not a record", withConsent(true)],
      ["no version", withConsent({ at: 1 })],
      ["no timestamp", withConsent({ v: V })],
      ["version as a string", withConsent({ v: String(V), at: 1 })],
      ["withdrawn", withConsent({ v: V, at: 1, off: 2 })],
      ["declined (off === at)", withConsent({ v: V, at: 1, off: 1 })],
      ["an older ask", withConsent({ v: V - 1, at: 1 })],
    ] as Array<[string, unknown]>) {
      expect(mayPublishPolitical(profile), what).toBe(false);
    }
  });

  it("is TRUE only for a current, un-withdrawn record", () => {
    expect(mayPublishPolitical(withConsent({ v: POLITICAL_CONSENT_VERSION, at: 1 }))).toBe(true);
    // A LATER version keeps publishing: it means the record was written by
    // a newer build than this one is reading with, and refusing there would
    // blank the compass of everyone mid-rollout. Only a record BEHIND the
    // current ask is stale.
    expect(mayPublishPolitical(withConsent({ v: POLITICAL_CONSENT_VERSION + 1, at: 1 }))).toBe(true);
  });

  it("the default is OFF, which is the whole design", () => {
    // The window between install and the ask must publish nothing. A
    // default of on would make that window a smaller version of the
    // problem rather than the absence of it.
    expect(mayPublishPolitical({})).toBe(false);
  });
});

describe("hasAnsweredPoliticalAsk — a decline is an answer", () => {
  it("separates 'said no' from 'not asked', which the gate cannot", () => {
    const V = POLITICAL_CONSENT_VERSION;
    // Both refuse to publish…
    expect(mayPublishPolitical(withConsent({ v: V, at: 1, off: 1 }))).toBe(false);
    expect(mayPublishPolitical({})).toBe(false);
    // …and only one of them should be asked again. Re-asking somebody who
    // declined is how a refusal turns into a nag.
    expect(hasAnsweredPoliticalAsk(withConsent({ v: V, at: 1, off: 1 }))).toBe(true);
    expect(hasAnsweredPoliticalAsk({})).toBe(false);
  });

  it("a stale version IS re-asked, because the words changed", () => {
    expect(hasAnsweredPoliticalAsk(withConsent({ v: POLITICAL_CONSENT_VERSION - 1, at: 1 }))).toBe(false);
  });
});

describe("politicalConsentRecord", () => {
  it("stamps a yes with no off", () => {
    const r = politicalConsentRecord(true, 1234);
    expect(r).toEqual({ v: POLITICAL_CONSENT_VERSION, at: 1234 });
    expect("off" in r).toBe(false);
    expect(mayPublishPolitical(withConsent(r))).toBe(true);
  });

  it("stamps a no as an answered-then-off record, not an absence", () => {
    // The evidence matters: Art. 7(1) wants the controller able to show
    // that consent was obtained and when it ended, so a withdrawal keeps
    // the row rather than deleting it.
    const r = politicalConsentRecord(false, 1234);
    expect(r).toEqual({ v: POLITICAL_CONSENT_VERSION, at: 1234, off: 1234 });
    expect(mayPublishPolitical(withConsent(r))).toBe(false);
    expect(hasAnsweredPoliticalAsk(withConsent(r))).toBe(true);
  });

  it("round-trips through readPoliticalConsent both ways", () => {
    for (const on of [true, false]) {
      const r = politicalConsentRecord(on, 99);
      expect(readPoliticalConsent(withConsent(r))).toEqual(r);
    }
  });
});

describe("readPoliticalConsent", () => {
  it("drops a non-numeric off rather than reading it as withdrawn", () => {
    // `off` is present-or-absent, never a boolean — and a `true` here
    // would be a build that got the shape wrong. Reading it as withdrawn
    // would silently blank a consented user's compass; dropping it leaves
    // the record readable and the consent standing, which is the state the
    // numbers actually describe.
    const r = readPoliticalConsent(withConsent({ v: POLITICAL_CONSENT_VERSION, at: 5, off: true }));
    expect(r).toEqual({ v: POLITICAL_CONSENT_VERSION, at: 5 });
    expect("off" in (r as object)).toBe(false);
  });

  it("returns null rather than a half-parsed record", () => {
    expect(readPoliticalConsent(withConsent({ v: 1 }))).toBeNull();
    expect(readPoliticalConsent(withConsent([1, 2]))).toBeNull();
  });
});

// ── withdraw, then grant again ──
//
// `off` is present-or-absent by design and the reason above is a good one.
// The cost is that the record for a GRANT omits the field, and the consent
// is written with `setDoc(…, { merge: true })` onto a nested map — where a
// merge merges the map's FIELDS. Omitting `off` therefore does not remove
// it: a withdrawal followed by a re-grant left the earlier `off` on the
// server, `mayPublishPolitical` read it, and the consent could be withdrawn
// and never granted again. It looked like it worked, because live.ts's
// local copy replaces `political` wholesale — until the next hydrate read
// the stored record back.
//
// Two halves, because the hazard and its removal live in different files.
describe("re-granting after a withdrawal", () => {
  it("is exactly what a nested merge would get wrong", () => {
    const off = politicalConsentRecord(false, 1_000);
    const on = politicalConsentRecord(true, 2_000);
    // What Firestore stores when `on` is merged over `off`: field by field.
    const merged = { ...off, ...on };
    expect(merged.off, "the case no longer models the merge it is about").toBe(1_000);
    expect(mayPublishPolitical({ consent: { political: merged } }),
      "a re-grant merged over a withdrawal reads as withdrawn").toBe(false);
    // …and with the field actually removed, which is what the writer must
    // do, the same re-grant reads as granted.
    expect(mayPublishPolitical({ consent: { political: on } })).toBe(true);
  });

  // The removal itself is asserted where it can be EXECUTED rather than
  // read: vote.test.ts boots the store and replays both writes through a
  // merge, which is the step this bug lived in.
});
