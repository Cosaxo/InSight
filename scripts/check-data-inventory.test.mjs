// check-data-inventory.test.mjs — pins D257's rule-2 parsers.
//
// Rule 2 fails silently by construction: every way it can stop working
// takes rows OUT of the checked set and leaves the gate green. The
// READER_FLOOR in the script is one answer to that; these are the other,
// because a floor tells you coverage fell and not why.
//
// The nesting case below is not hypothetical. The first version of
// classifyReads matched `match /v2_users/{` — whose `{` is the WILDCARD
// segment's, not the block's — and compensated for the unconsumed header
// with a manual `depth++`. That balanced only while no match was nested
// inside another. firestore.rules happens to write every parent's own
// `allow read` ABOVE its subcollections, so the tree was correct and the
// parser was not; moving one read below one nested block would have
// dropped both names from rule 2 with nothing failing.
import { describe, it, expect } from "vitest";
import { classifyReads, inventoryRows, widestRead, SAYS_PUBLIC, SAYS_NOBODY } from "./check-data-inventory.mjs";

const NESTED = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /v2_parent/{pid} {
      match /v2_child/{cid} {
        allow read, write: if false;
      }
      allow read: if request.auth != null;
    }
    match /{path=**}/answers/{aid} {
      allow read: if request.auth != null;
    }
    match /v2_after/{aid} {
      allow read: if false;
    }
  }
}
`;

describe("classifyReads", () => {
  it("attributes a parent's read to the parent, not to the last nested match", () => {
    const got = classifyReads(NESTED);
    expect([...(got.get("v2_parent") || [])]).toEqual(["PUBLIC"]);
    expect([...(got.get("v2_child") || [])]).toEqual(["NOBODY"]);
    // …and the block AFTER the nested one, which is the same desync one
    // brace later.
    expect([...(got.get("v2_after") || [])]).toEqual(["NOBODY"]);
  });

  it("gives the collection-group form its own name", () => {
    // Without this the recursive-wildcard block's read lands on whatever
    // encloses it, and that collection gets a classification it never
    // wrote — which for `answers` would be a second class on `documents`.
    expect([...(classifyReads(NESTED).get("answers") || [])]).toEqual(["PUBLIC"]);
  });

  it("classifies only the two literal conditions, and OTHER for the rest", () => {
    const got = classifyReads(`
      match /a/{x} { allow read: if request.auth != null; }
      match /b/{x} { allow read: if false; }
      match /c/{x} { allow read: if request.auth != null && request.auth.uid == x; }
      match /d/{x} { allow write: if request.auth != null; }
    `);
    expect([...got.get("a")]).toEqual(["PUBLIC"]);
    expect([...got.get("b")]).toEqual(["NOBODY"]);
    expect([...got.get("c")]).toEqual(["OTHER"]);
    // A write-only block contributes nothing: rule 2 is about reads.
    expect(got.has("d")).toBe(false);
  });

  it("does not read a condition out of a comment", () => {
    // firestore.rules is more prose than rules, and several paragraphs
    // quote `allow read: if false` while describing something else.
    const got = classifyReads(`
      match /a/{x} {
        // allow read: if false;   <- what this used to be
        allow read: if request.auth != null;
      }
    `);
    expect([...got.get("a")]).toEqual(["PUBLIC"]);
  });
});

describe("inventoryRows", () => {
  const KNOWN = new Set(["v2_users", "answers", "push", "v2_groups", "reveals"]);
  const MD = [
    "| Data | Where | Readable by | Notes |",
    "|---|---|---|---|",
    "| Answers | `v2_users/{uid}/answers` | any signed-in user | — |",
    "| Learn | same subcollection, `learn-*` ids | any signed-in user | — |",
    "| Push tokens | `v2_users/{uid}/push/tokens` | **nobody** | — |",
    "| Reveals | `v2_groups/{gid}/reveals/{day}` | any signed-in user | — |",
    "| Crash reports | Sentry | Sentry project members | — |",
  ].join("\n");

  it("attributes a row to the last KNOWN collection in its path, not the document id", () => {
    const rows = inventoryRows(MD, KNOWN);
    expect(rows.map((r) => r.coll)).toEqual([
      "answers",   // not v2_users
      "answers",   // "same subcollection…" inherits
      "push",      // not `tokens`, which is a document id
      "reveals",   // not v2_groups
      null,        // Sentry is not Firestore and has no rule to be held to
    ]);
  });

  it("reads the reader column as written, bold and parentheses included", () => {
    expect(SAYS_PUBLIC.test("**any signed-in user (D98)**")).toBe(true);
    expect(SAYS_NOBODY.test("**nobody** (`allow read, write: if false`)")).toBe(true);
    // The two must not both match one cell, or a disagreement reads as
    // agreement.
    expect(SAYS_NOBODY.test("any signed-in user")).toBe(false);
    expect(SAYS_PUBLIC.test("nobody (server only)")).toBe(false);
  });
});

// The audience a row is held to, when a collection carries more than one
// `allow read`. Rule 2's failure mode is silence, so the case that matters
// is the one that took a row OUT of the checked set: a narrow
// collection-group arm added beside an open path arm, which widened
// nothing and made {PUBLIC, OTHER} stop being "exactly one classification".
describe("widestRead", () => {
  const set = (...c) => new Set(c);

  it("reads a lone classification as itself", () => {
    expect(widestRead(set("PUBLIC"))).toBe("PUBLIC");
    expect(widestRead(set("NOBODY"))).toBe("NOBODY");
    expect(widestRead(set("OTHER"))).toBe("OTHER");
  });

  it("keeps a row public when a NARROWER arm is added beside an open one", () => {
    // The follow graph and circle invitations, 2026-08-26: a
    // `{path=**}` read arm gated on `to == request.auth.uid` beside a path
    // arm open to any signed-in user. The collection did not become less
    // readable, so the row must still be held to "any signed-in user".
    expect(widestRead(set("PUBLIC", "OTHER"))).toBe("PUBLIC");
    expect(widestRead(set("PUBLIC", "NOBODY"))).toBe("PUBLIC");
    expect(widestRead(set("PUBLIC", "NOBODY", "OTHER"))).toBe("PUBLIC");
  });

  it("will not call a collection unreadable while one arm is conditional", () => {
    // `if false` beside a conditional arm means SOMEBODY can read it, so
    // holding the row to "nobody" would prove a claim that is false.
    expect(widestRead(set("NOBODY", "OTHER"))).toBe("OTHER");
  });

  it("declines a collection with no read rule at all", () => {
    expect(widestRead(new Set())).toBe("OTHER");
    expect(widestRead(undefined)).toBe("OTHER");
  });
});
