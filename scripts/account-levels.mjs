#!/usr/bin/env node
// account-levels — who meets the current account requirements, and who does not.
//
//   node scripts/account-levels.mjs                    # the distribution
//   node scripts/account-levels.mjs --below 2          # uids under level 2
//   node scripts/account-levels.mjs --below 2 --list   # …with the uids printed
//
// WHY THIS EXISTS. D338 made the account requirement a LEVEL so the bar can
// be raised later. Raising it is one number (accountLevel.ts REQUIRED_LEVEL
// plus the matching literal in firestore.rules, held equal by
// `check:account-level`) — and the moment it deploys, every account below
// the new value stops counting toward the published aggregates.
//
// That is a large, quiet consequence, so it should never be taken blind.
// This is the instrument for taking it with eyes open: it answers "how many
// accounts, and which, would the new bar exclude" BEFORE the edit.
//
// READ THIS ALONGSIDE THE NIGHTLY COVERAGE LINE, not instead of it. This
// counts ACCOUNTS; `ledgerVelocityScan`'s `bind_coverage` counts ANSWERS
// from accounts that actually voted. They answer different questions and
// they diverge hard: a thousand dormant unbound accounts barely move the
// published numbers, while one heavy unbound voter moves them a lot. The
// aggregate question is the answers one; this is the population one.
//
// READ-ONLY. It changes nothing, sets no claims, and has no --apply.
// Raising the bar is a code edit and a deploy, deliberately — a script that
// could re-level accounts would be a way to grant the claim without the
// device check that is supposed to earn it.
import { adminAuth } from "./admin-db.mjs";

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
};
const below = flag("below") === null ? null : Number(flag("below"));
const list = argv.includes("--list");

if (below !== null && !Number.isInteger(below)) {
  console.error("account-levels: --below takes an integer level");
  process.exit(1);
}

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || "prvfire33";
const emulator = process.env.ACCOUNT_LEVELS_EMULATOR === "true";

/** Bucket a page of UserRecords by their `db` claim. Pure, so it is testable. */
export function tally(users) {
  const byLevel = new Map();
  const under = [];
  for (const u of users) {
    const raw = u.customClaims?.db;
    // Level 0 unless the claim is an ACTUAL integer, which is exactly what
    // firestore.rules accepts: `get("db", 0) >= n` errors on a string or a
    // boolean and the write is denied. A report that coerced would be
    // worse than wrong, it would be reassuring — `Number(true)` is 1, so a
    // boolean claim would have appeared as a qualifying account that
    // production refuses. Three readers of this claim (rules, the nightly
    // scan, this), one answer.
    const lvl = typeof raw === "number" && Number.isInteger(raw) ? raw : 0;
    byLevel.set(lvl, (byLevel.get(lvl) || 0) + 1);
    under.push({ uid: u.uid, level: lvl });
  }
  return { byLevel, rows: under };
}

async function main() {
  const auth = adminAuth({ projectId, emulator });
  const byLevel = new Map();
  const under = [];
  let total = 0;
  let pageToken;
  do {
    // 1000 is the SDK's maximum per page. A large project pages for a
    // while; this is an operator tool run deliberately, not a scheduled job.
    const res = await auth.listUsers(1000, pageToken);
    const t = tally(res.users);
    for (const [lvl, n] of t.byLevel) byLevel.set(lvl, (byLevel.get(lvl) || 0) + n);
    if (below !== null) for (const r of t.rows) if (r.level < below) under.push(r.uid);
    total += res.users.length;
    pageToken = res.pageToken;
  } while (pageToken);

  console.log(`account-levels: project ${projectId}, ${total} account(s)`);
  for (const lvl of [...byLevel.keys()].sort((a, b) => a - b)) {
    const n = byLevel.get(lvl);
    const share = total === 0 ? 0 : Math.round((n / total) * 1000) / 10;
    console.log(`  level ${lvl}: ${n} (${share}%)`);
  }
  if (below !== null) {
    const share = total === 0 ? 0 : Math.round((under.length / total) * 1000) / 10;
    console.log(`\n  raising the bar to ${below} would exclude ${under.length} account(s) — ${share}% of all accounts.`);
    console.log("  That is the POPULATION cost. For the cost to the published numbers, read");
    console.log("  ledgerVelocityScan's bind_coverage line, which counts answers from accounts that voted.");
    if (list) for (const uid of under) console.log(`    ${uid}`);
    else if (under.length) console.log("  (--list to print the uids)");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
