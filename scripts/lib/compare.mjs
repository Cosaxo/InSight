// compare.mjs — the shape a gate has to be in to catch anything.
//
// WHY THIS FILE EXISTS. This tree's gates fall into two classes, and the
// class boundary predicts which ones have ever caught a real defect.
//
//   A COMPARISON gate reads two artifacts that must agree and diffs them.
//   check:content regenerates v2content.ts in memory and byte-compares it.
//   check:logic-sync holds the client and server copies identical.
//   check:data-inventory holds docs/data-inventory.md against
//   firestore.rules. check:anchors holds the profile's <select>s against
//   the trigger's vocabularies. Every one of these has a named kill on
//   the record.
//
//   A PRESENCE gate reads ONE artifact and asserts a pattern inside it.
//   check-policy-claims.mjs says so in its own header — "matching a
//   phrase proves the sentence is present, not that it is true" — and it
//   is right: it passed 55 green claims over a sentence the tree had
//   documented as false a fortnight earlier, and it is structurally
//   unable to notice a legally required clause that was never written at
//   all. A presence gate cannot detect an omission, because an omission
//   has nothing for it to match.
//
// Presence gates are not a mistake; some properties have only one
// artifact. But when there ARE two, writing the comparison has been
// harder than writing the grep, so the grep is what got written. This
// module is the attempt to reverse that ordering: a comparison here is
// four lines and gets its vacuity floor, its diff rendering and its exit
// code for free.
//
// THE VACUITY FLOOR IS NOT OPTIONAL, and that is the other half of the
// argument. A gate whose scan silently returns nothing reports success —
// D179, D197 and D275 are three separate instances of exactly that in
// this repository, the last one a read tripwire counting `tx.get(` after
// the code had moved to `tx.getAll(`, which counted zero and called it a
// regression-free day. Every entry point below REFUSES to return a clean
// result on an empty side unless the caller has said, in the call, that
// empty is a legitimate state and why.

/** A side of a comparison: what it is, and what it holds. */
class Vacuous extends Error {}

function itemsOf(side, what) {
  if (!side || typeof side.name !== "string" || !side.name) {
    throw new Error(`compare: the ${what} side must carry a \`name\` — the gate's output names both artifacts, and a nameless side makes a failure unreadable`);
  }
  return side;
}

/**
 * Refuse a scan that found nothing, unless the caller declared it legal.
 *
 * `emptyIsLegal` takes a REASON string rather than a boolean on purpose:
 * "0 is fine here" is a claim about the artifact, and a claim without a
 * reason is how a stale scan shape survives. The reason is printed in the
 * gate's own output, so an empty pass is visible rather than silent.
 */
export function refuseVacuous(count, { side, floor = 1, emptyIsLegal = null }) {
  if (count >= floor) return null;
  if (emptyIsLegal) return `note: ${side} matched ${count} (floor ${floor}) — allowed: ${emptyIsLegal}`;
  throw new Vacuous(
    `${side} matched ${count} items, under the floor of ${floor}.\n` +
    `      This is the D275 class: a scan that finds nothing reports success and\n` +
    `      hides the very drift it was written for. Either the artifact moved and\n` +
    `      the scan shape is stale, or the floor is wrong — fix one, do not lower\n` +
    `      the floor to make this pass.`,
  );
}

/**
 * Two sets that must hold the same members.
 *
 * `left`/`right` are `{ name, items }` where `items` is any iterable of
 * strings. Returns the two asymmetric differences, which are almost
 * always different failures with different fixes — so they are reported
 * apart rather than as one "these differ".
 */
export function compareSets(left, right, opts = {}) {
  itemsOf(left, "left");
  itemsOf(right, "right");
  const L = new Set(left.items);
  const R = new Set(right.items);
  const notes = [
    refuseVacuous(L.size, { side: left.name, floor: opts.floor ?? 1, emptyIsLegal: opts.leftMayBeEmpty ?? null }),
    refuseVacuous(R.size, { side: right.name, floor: opts.floor ?? 1, emptyIsLegal: opts.rightMayBeEmpty ?? null }),
  ].filter(Boolean);
  const onlyLeft = [...L].filter((x) => !R.has(x)).sort();
  const onlyRight = [...R].filter((x) => !L.has(x)).sort();
  return { left: left.name, right: right.name, onlyLeft, onlyRight, notes, sizes: [L.size, R.size] };
}

/**
 * Two key→value maps that must agree wherever both have a key.
 *
 * Keys present on one side only are reported as such rather than as a
 * mismatch: "you did not write this row down" and "you wrote it down
 * differently" want different fixes, and collapsing them is how a diff
 * becomes something people skim.
 */
export function compareValues(left, right, opts = {}) {
  itemsOf(left, "left");
  itemsOf(right, "right");
  const L = left.values instanceof Map ? left.values : new Map(Object.entries(left.values ?? {}));
  const R = right.values instanceof Map ? right.values : new Map(Object.entries(right.values ?? {}));
  const notes = [
    refuseVacuous(L.size, { side: left.name, floor: opts.floor ?? 1, emptyIsLegal: opts.leftMayBeEmpty ?? null }),
    refuseVacuous(R.size, { side: right.name, floor: opts.floor ?? 1, emptyIsLegal: opts.rightMayBeEmpty ?? null }),
  ].filter(Boolean);
  const same = opts.same ?? ((a, b) => a === b);
  const differ = [];
  for (const [k, lv] of L) {
    if (!R.has(k)) continue;
    const rv = R.get(k);
    if (!same(lv, rv)) differ.push({ key: k, left: lv, right: rv });
  }
  return {
    left: left.name,
    right: right.name,
    onlyLeft: [...L.keys()].filter((k) => !R.has(k)).sort(),
    onlyRight: [...R.keys()].filter((k) => !L.has(k)).sort(),
    differ: differ.sort((a, b) => (a.key < b.key ? -1 : 1)),
    notes,
    sizes: [L.size, R.size],
  };
}

/**
 * Render a comparison's findings as gate lines.
 *
 * Every line names BOTH artifacts. A gate failure that says only "missing
 * row: v2_flags" makes the reader open two files to learn which one is
 * wrong; naming both in the line is the difference between a gate people
 * fix and a gate people re-run.
 *
 * `expect` lets a gate say what each direction MEANS in its own domain —
 * "declared to Apple but not to Google" reads as a finding, "onlyLeft"
 * reads as a data structure.
 */
export function findingsOf(result, expect = {}) {
  const out = [];
  const l = result.left;
  const r = result.right;
  for (const k of result.onlyLeft) {
    out.push(`${expect.onlyLeft ?? "in %L but not in %R"}: ${k}`.replace("%L", l).replace("%R", r));
  }
  for (const k of result.onlyRight) {
    out.push(`${expect.onlyRight ?? "in %R but not in %L"}: ${k}`.replace("%L", l).replace("%R", r));
  }
  for (const d of result.differ ?? []) {
    out.push(
      `${expect.differ ?? "%L and %R disagree"} on ${d.key}: ${l} says ${JSON.stringify(d.left)}, ${r} says ${JSON.stringify(d.right)}`
        .replace("%L", l).replace("%R", r),
    );
  }
  return out;
}

/**
 * The uniform ending: print, and exit non-zero if anything was found.
 *
 * `compared` is the sentence the gate prints when it PASSES, and it is
 * required. A green gate that says only "OK" tells a reader nothing about
 * what it looked at — which is how four gates in this tree ended up
 * believed to cover things they had never read. Saying "OK — 11 Apple
 * rows against 11 Play rows" makes the coverage question answerable by
 * running the gate.
 */
export function finish(gate, findings, compared) {
  if (!compared) throw new Error(`${gate}: finish() needs the sentence naming what was compared`);
  if (findings.length) {
    console.error(`${gate} FAILED — ${compared}\n`);
    for (const f of findings) console.error(`  • ${f}`);
    console.error("");
    process.exitCode = 1;
    return false;
  }
  console.log(`${gate} OK — ${compared}`);
  return true;
}

export { Vacuous };
