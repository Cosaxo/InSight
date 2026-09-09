// THE TWO GATES' TAG SCANNERS RAN PAST THE TAG.
//
// Both `tagsIn` (check-touch-zoom) and `headOf` (check-tap-targets) walk
// forward from an opening tag tracking `"`, `'` and backtick as string
// delimiters, and neither knows anything about comments. A comment inside
// an opening tag is house style here, and English prose in a comment
// carries apostrophes — "the rule's", "the Mirror's", "a question's". The
// first one opens a phantom string, after which `{`, `}` and the closing
// `>` are all skipped and the scan runs on to the next straight quote.
//
// Measured on the real tree before the fix: an `<input>` whose tag is 795
// characters came back as 2331 — the field, a whole button, two spans, a
// closing div and a function signature. A button whose head is 1070 came
// back as 15713.
//
// Both were LIVE holes, not merely obstacles:
//   · a field carrying such a comment and its own small font size passed
//     check:touch-zoom, because the swallowed text reached a
//     `type="checkbox"` on the NEXT element and the no-zoom exemption
//     applied to the wrong tag — D105's shipped bug walking through the
//     gate written for it;
//   · a 20x20 control passed check:tap-targets, because another control's
//     `tap44` inside the swallowed text answered the "is it grown?"
//     question for it.
//
// Both gates now blank comments before scanning, which is what five other
// gates in this directory already do and what `strip-comments.mjs` was
// extracted for. Blanking preserves offsets, so reported line numbers stay
// correct.
import { describe, expect, it } from "vitest";
import { tagsIn } from "./check-touch-zoom.mjs";
import { headOf } from "./check-tap-targets.mjs";
import { stripComments } from "./strip-comments.mjs";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// A tag whose comment carries an ordinary apostrophe, followed by another
// element the scan must not reach.
const JSX = `
  <input
    // the user's display name
    placeholder="x"
    style={{ fontSize: 13 }}
  />
  <input type="checkbox" />
`;

describe("the field scanner stops at its own tag", () => {
  it("does not run past an apostrophe in a comment", () => {
    const [first] = tagsIn(stripComments(JSX), "input");
    expect(first, "no tag was found at all — the case is vacuous").toBeTruthy();
    expect(first.text, "the scan swallowed the following element")
      .not.toContain("checkbox");
    expect(first.text).toContain("fontSize: 13");
  });

  it("…and it really would have, unstripped", () => {
    // The control: the same source WITHOUT the strip is the old behaviour,
    // so this case fails the day the strip stops being the thing that
    // fixes it rather than silently passing for a new reason.
    const [first] = tagsIn(JSX, "input");
    expect(first.text, "unstripped, the scan should still over-read — otherwise this test proves nothing")
      .toContain("checkbox");
  });

  it("keeps the tag's own line, so failures still point at the field", () => {
    // Blanking rather than deleting is the whole reason the offsets hold.
    const stripped = stripComments(JSX);
    expect(stripped).toHaveLength(JSX.length);
    expect(tagsIn(stripped, "input")[0].index).toBe(tagsIn(JSX, "input")[0].index);
  });
});

describe("both gates actually strip before they scan", () => {
  // The cases above pin the SCANNERS, given stripped input. What connects
  // them to the gates is the call site, and nothing above would notice a
  // gate that went back to reading raw source — so that is ratcheted here,
  // the shape feed-near-tie.test.jsx and search-share.test.js use for the
  // same "do not re-fork this" property.
  const read = (f) => readFileSync(resolve(here, f), "utf8");

  it("check:touch-zoom blanks comments before walking a file", () => {
    expect(read("check-touch-zoom.mjs")).toContain("stripComments(readFileSync(file");
  });

  it("check:tap-targets blanks comments before walking a file", () => {
    expect(read("check-tap-targets.mjs")).toContain("stripComments(readFileSync(join(SRC, file)");
  });
});

describe("the control scanner stops at its own tag", () => {
  const BTN = `
  <button
    // the Mirror's You stop
    onClick={go}
    style={{ width: 20, height: 20 }}
  >x</button>
  <button className="tap44" style={{ width: 20 }}>y</button>
`;

  it("does not borrow the next control's grown hit box", () => {
    const stripped = stripComments(BTN);
    const head = headOf(stripped, stripped.indexOf("<button"), "jsx");
    expect(head, "no head was found — the case is vacuous").toBeTruthy();
    expect(head, "the scan reached the second button, whose tap44 would answer for the first")
      .not.toContain("tap44");
    expect(head).toContain("width: 20");
  });

  it("…and it really would have, unstripped", () => {
    const head = headOf(BTN, BTN.indexOf("<button"), "jsx");
    expect(head, "unstripped, the scan should still over-read — otherwise this test proves nothing")
      .toContain("tap44");
  });
});
