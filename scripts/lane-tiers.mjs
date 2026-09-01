// lane-tiers.mjs — the three-tier allocation the content regulators share
// (D342): a coverage FLOOR every row reaches first, a DEMAND share above it
// that follows where the crowd answers, and LEVELLING with no ceiling when
// there is no signal to follow.
//
// WHY ONE MODULE. Three regulators — farm-budget (daily), learn-budget and
// feed-budget — each stopped at a stock level: "every topic is at the
// target", "every field is at the target", and for the daily a topic model
// that found no thin topic and wrote nothing into an empty pen. All three
// were the same premise, a bank every device was handed whole, and D316–D321
// ended it: the install fetches the boot surfaces, the core and a page per
// topic, never the bank, and "there should be no question limit" (D316's
// adoption) became a property of the read path. What replaces the stop is
// the same shape on every lane, so it lives once — three copies of one
// allocator is how the bank parser drifted into an invented figure (D197).
//
// VOCABULARY. A ROW is the unit a lane allocates into — a feed topic, a
// learn field, a daily top. Its `stock` is what the bank already holds there.
//
// THE TIERS, in strict order:
//   1. FLOOR — rows under the lane's floor are filled first, thinnest first,
//      one per row per pass, and never past their own room under it. The
//      floor is breadth's minimum (a reader who filters to a topic meets a
//      product), not a target: nothing stops at it.
//   2. DEMAND — everything the floor leaves, where the crowd answers. Weight
//      per row = popularity × depth, the daily lane's demand lane
//      (QUESTION-FARM.md § Picking topics) made computable: popularity is
//      the row's share of credited answers (the scorecard's conserved
//      shares, so a door redistributes demand and never mints it), depth is
//      answers per unit of stock against the deepest row — how hard the
//      row's stock is being used, the reading of "how far its audience goes
//      through the pool" that stays measurable while D319's volume order
//      keeps new questions at the tail (least ÷ most reads 0 for any row
//      holding one unanswered question, which is all of them). Units go out
//      D'Hondt-style — proportional over a large budget, on the leaders
//      over a small one — and no row may take more than ⌈shareCap × batch⌉,
//      the batch-mix gate's own ceiling (question-quality.mjs checkBatch),
//      so a regulator never prints a batch the pre-flight refuses.
//   3. LEVELLING — no readable signal, so the rest spreads thinnest-first
//      across every row with no ceiling: the bank grows evenly until the
//      crowd says where.
//
// TWO MODES. Unit mode (chunk = 1) allocates one question at a time and is
// what the daily and feed lanes use — breadth across topics is their
// batch-mix rule. Chunk mode (chunk > 1) is the learn lane's: a run may
// touch at most ⌊budget ÷ chunk⌋ rows and splits the budget evenly among
// them, because difficulty spread is a per-FIELD property a single card
// cannot demonstrate and a writer holding one subject writes better cards
// than one hopping twelve (D115). Rows are chosen in tier order — under the
// floor thinnest first, then by demand weight, then thinnest — one row per
// slot, so two slots are two subjects.
//
// THE SIGNAL is read off the committed scorecard, and only when it can be
// believed: past `staleDays` (the manual's staleness rule) or under
// `minAnswers` credited answers the lane is BLIND and levels. That is where
// the retired "signal dilution" argument still holds — a share measured on
// a handful of answers is noise — and it bounds what is READ, never what is
// written.
//
// Pure and import-safe: no I/O, no clock unless one is passed in. The
// lanes' own tests pin their budgets; lane-tiers.test.mjs pins the shape.

/** The batch-mix gate's per-row ceiling as a share of the batch:
 * question-quality.mjs fails a feed batch where one topic holds more than
 * ⌈0.75 × batch⌉. Spelled once so the allocation and the gate agree. */
export const BATCH_TOPIC_SHARE = 0.75;

// Thinnest first, ties on id so a run is reproducible. Re-sorted per pass so
// what a pass already wrote counts.
const byThinness = (rows) =>
  rows.slice().sort((a, b) => a.stock + a.write - (b.stock + b.write) || a.id.localeCompare(b.id));

/** popularity × depth per row, or null when nothing credited can steer.
 * `rows` is [{ id, stock, answers }]. */
export function demandWeights(rows) {
  const total = rows.reduce((n, r) => n + (r.answers || 0), 0);
  if (!(total > 0)) return null;
  const density = rows.map((r) => (r.stock ? (r.answers || 0) / r.stock : 0));
  const deepest = Math.max(...density);
  if (!(deepest > 0)) return null;
  const weights = {};
  rows.forEach((r, i) => {
    weights[r.id] = +(((r.answers || 0) / total) * (density[i] / deepest)).toFixed(4);
  });
  return Object.values(weights).some((w) => w > 0) ? weights : null;
}

/** The demand signal, or the reason there is none. Says which MODE the run
 * is in out loud rather than leaving it to infer from zeros. `answersOf(id)`
 * reads a row's credited answers off the scorecard — the lanes keep them in
 * different places. `now` is injectable so the staleness rule is testable. */
export function laneSignal({ scorecard, rows, answersOf, minAnswers, staleDays, now = Date.now(), noun = "answers" }) {
  const blind = (note) => ({ mode: "blind", weights: null, note });
  if (!scorecard) return blind("no committed scorecard — levelling thinnest-first");
  const ageDays = scorecard.generatedAt
    ? Math.floor((now - Date.parse(scorecard.generatedAt)) / 86400000)
    : null;
  const dated = ageDays !== null && !Number.isNaN(ageDays);
  const age = dated ? `${ageDays} days old` : "undated";
  if (!dated || ageDays > staleDays) {
    return blind(
      `scorecard is ${age} (the demand share is not read past ${staleDays} days) — a share off a ` +
        "stale crowd steers at last month's readers; levelling thinnest-first until it is refreshed",
    );
  }
  const credited = rows.map((r) => ({ id: r.id, stock: r.stock, answers: answersOf(r.id) || 0 }));
  const total = credited.reduce((n, r) => n + r.answers, 0);
  const shown = `${+total.toFixed(1)} ${noun}`;
  if (total < minAnswers) {
    return blind(
      `scorecard credits ${shown} (${age}) — under ${minAnswers}, a share measured on that few is noise; ` +
        "levelling thinnest-first",
    );
  }
  const weights = demandWeights(credited);
  if (!weights) {
    // Answers credited only to rows with no stock (a legacy card's topic,
    // say): a crowd, but nothing it could be steering toward.
    return blind(`scorecard credits ${shown}, none to a row with stock — levelling thinnest-first`);
  }
  const sum = Object.values(weights).reduce((n, w) => n + w, 0);
  const lead = Object.entries(weights)
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([id, w]) => `${id} ${Math.round((100 * w) / sum)}%`);
  return {
    mode: "demand",
    weights,
    note:
      `scorecard credits ${shown} (${age}) — demand leads ${lead.join(", ")} ` +
      "(share of the budget above the floor; popularity × depth)",
  };
}

/** Spend `budget` over `rows` ([{ id, stock }]) through the three tiers.
 * `open` is what already sits unreviewed on the lane's PR: it is assumed to
 * cover the floor deficit first, because a checkout cannot see which rows
 * it went to. Returns the rows that got anything, floor rows first (as the
 * bank stood, thinnest first) then by what they got; the split by tier; and
 * the deficit under the floor. */
export function allocateTiers({ rows, budget, floor, demand = null, open = 0, chunk = 1, shareCap = BATCH_TOPIC_SHARE }) {
  // `seq` remembers the order rows were first written in, so the printed
  // allocation reads in tier order (thinnest, then leaders) rather than by id.
  let seq = 0;
  const out = rows.map((r) => ({ id: r.id, stock: r.stock, write: 0, floor: 0, demand: 0, level: 0, seq: Infinity }));
  const give = (r, tier) => {
    if (!r.write) r.seq = seq++;
    r.write++;
    r[tier]++;
  };
  const deficit = out.reduce((s, r) => s + Math.max(0, floor - r.stock), 0);
  let left = out.length ? Math.max(0, Math.floor(budget)) : 0;
  const weighted = (r) => (demand?.[r.id] ?? 0) > 0;
  const floorUnits = Math.max(0, deficit - open);

  if (chunk > 1) {
    // Chunk mode: choose the rows first, one per slot in tier order, then
    // split the budget evenly among them (a row may pass the floor — there
    // is no ceiling — and every chosen row gets at least `chunk` whenever
    // the budget allows a full chunk each).
    const slots = Math.max(1, Math.floor(left / chunk));
    const order = [];
    const seen = new Set();
    const push = (r, tier) => {
      if (seen.has(r.id)) return;
      seen.add(r.id);
      order.push({ r, tier });
    };
    const under = byThinness(out).filter((r) => r.stock < floor);
    under.slice(0, Math.ceil(floorUnits / chunk)).forEach((r) => push(r, "floor"));
    if (demand) {
      out
        .filter(weighted)
        .sort((a, b) => demand[b.id] - demand[a.id] || a.id.localeCompare(b.id))
        .forEach((r) => push(r, "demand"));
    }
    byThinness(out).forEach((r) => push(r, "level"));
    const chosen = order.slice(0, slots);
    while (left > 0 && chosen.length) {
      for (const { r, tier } of chosen) {
        if (!left) break;
        give(r, tier);
        left--;
      }
    }
  } else {
    // 1. The floor — one per under-floor row per pass, thinnest first, never
    //    past a row's own room.
    let floorLeft = Math.min(left, floorUnits);
    while (floorLeft > 0) {
      const under = byThinness(out).filter((r) => r.stock + r.write < floor);
      if (!under.length) break;
      for (const r of under) {
        if (!floorLeft) break;
        give(r, "floor");
        floorLeft--;
        left--;
      }
    }
    // 2. Demand — D'Hondt: each unit to the row with the highest
    //    weight ÷ (already given + 1); ties to the heavier weight, then id.
    const ws = demand ? out.filter(weighted) : [];
    if (left > 0 && ws.length) {
      const cap = Math.ceil(budget * shareCap);
      while (left > 0) {
        const eligible = ws.filter((r) => r.write < cap);
        if (!eligible.length) break;
        let pick = null;
        let best = -1;
        for (const r of eligible) {
          const score = demand[r.id] / (r.demand + 1);
          if (!pick || score > best) {
            best = score;
            pick = r;
          } else if (score === best) {
            const w = demand[r.id];
            const pw = demand[pick.id];
            if (w > pw || (w === pw && r.id < pick.id)) pick = r;
          }
        }
        give(pick, "demand");
        left--;
      }
    }
    // 3. Levelling — thinnest first across every row, no ceiling.
    while (left > 0) {
      for (const r of byThinness(out)) {
        if (!left) break;
        give(r, "level");
        left--;
      }
    }
  }

  const split = out.reduce(
    (s, r) => ({ floor: s.floor + r.floor, demand: s.demand + r.demand, level: s.level + r.level }),
    { floor: 0, demand: 0, level: 0 },
  );
  const strip = (r) => ({ id: r.id, stock: r.stock, write: r.write, floor: r.floor, demand: r.demand, level: r.level });
  const allocation = [
    ...out.filter((r) => r.floor > 0).sort((a, b) => a.stock - b.stock || a.id.localeCompare(b.id)),
    ...out.filter((r) => r.floor === 0 && r.write > 0).sort((a, b) => b.write - a.write || a.seq - b.seq),
  ].map(strip);
  return { allocation, split, deficit, spent: out.length ? Math.floor(budget) - left : 0 };
}

/** The reason line every lane prints, from the split. */
export function tierReason({ split, deficit, open = 0, floor, cap, unit = "questions", group = "topic" }) {
  const parts = [];
  if (split.floor) {
    parts.push(
      `${split.floor} to the ${floor}/${group} floor (${deficit} ${unit} short` +
        `${open ? `, ${open} of them on the open PR` : ""}, thinnest first)`,
    );
  }
  if (split.demand) parts.push(`${split.demand} by demand share`);
  if (split.level) parts.push(`${split.level} levelling thinnest-first above the floor (no demand signal)`);
  return `${parts.join(" · ")} — capped at ${cap}/run${open ? `, less the ${open} unreviewed on the open PR` : ""}`;
}

/** The label beside an allocation row. */
export function tierLabel(row, { floor, weights = null, unit = "" }) {
  if (row.floor) return `floor — at ${row.stock} of ${floor}`;
  if (row.demand) return `demand — at ${row.stock}${weights ? `, weight ${weights[row.id]}` : ""}`;
  return `levelling — at ${row.stock}${unit ? ` ${unit}` : ""}`;
}
