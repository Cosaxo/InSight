#!/usr/bin/env node
// paid-review.mjs — the paid-question review queue, for the Routine that
// settles it (D456).
//
//   node scripts/paid-review.mjs --list
//   node scripts/paid-review.mjs --verdict <bid> approve
//   node scripts/paid-review.mjs --verdict <bid> decline --reason "…"
//
// WHY THIS EXISTS. `functions/src/paid.ts` reviewed each booking with a
// model call inside the request, behind `ANTHROPIC_API_KEY`. The owner
// ruled that a key for that is not worth it when a Claude Code Routine is
// already running against this repository — the trade being that a buyer
// waits for the next firing instead of a few seconds. So the function now
// HOLDS a booking it cannot review (`ReviewDeferred`), leaving it in
// `status: "review"`, and that is the queue this reads.
//
// THE REVIEWER IS THE SESSION, NOT THIS SCRIPT. `--list` prints the
// submissions and the guidelines they are judged against; the Routine's
// own Claude reads them and calls `--verdict`. This file deliberately
// contains no judgement of its own — a heuristic here would be a second,
// weaker reviewer that the real one could not see it was disagreeing with.
//
// WHY REST AND NOT A CALLABLE. Two new operator callables would need
// deploy targets, App Check exemptions, rules and their own tests, to do
// what the deploy credential already does directly — the same reasoning
// `observe.mjs` records about D292's observer: every reading here is an
// ordinary Google API call, and treating it as needing a new surface is
// what keeps it unbuilt.
//
// Env: FIREBASE_SERVICE_ACCOUNT, FIREBASE_PROJECT_ID (default prvfire33).

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { api, serviceAccount, accessToken } from "./google-api.mjs";
import { stripComments } from "./strip-comments.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const PROJECT = process.env.FIREBASE_PROJECT_ID || "prvfire33";
const die = (m) => { console.error(`paid-review: ${m}`); process.exit(1); };

// READ, not retyped (D200/D201): the database id and the guidelines both
// live in the functions source, and a copy here would drift silently —
// the wrong database reads an empty queue and reports "nothing to do",
// which is the most convincing way to fail.
const DB_ID = (() => {
  const src = stripComments(readFileSync(join(root, "functions/src/db.ts"), "utf8"));
  // The declaration is `process.env.FIRESTORE_DB_ID || "insight"` — the
  // DEFAULT is what this wants, since a Routine runs with no such
  // variable. Matching the whole expression rather than the first quoted
  // string after the name, because the name appears in its own env lookup
  // and a looser pattern reads the wrong half.
  const m = src.match(/FIRESTORE_DB_ID\s*=\s*process\.env\.FIRESTORE_DB_ID\s*\|\|\s*"([^"]+)"/);
  return m ? m[1] : die("could not read FIRESTORE_DB_ID from functions/src/db.ts");
})();

export const GUIDELINES = (() => {
  // Stripped first, like every other read-a-source-and-match here: a
  // superseded REVIEW_GUIDELINES parked in a comment above the live one
  // is what an unstripped match would hand the reviewer, and the reviewer
  // would follow it without any sign that it had. Safe for THIS literal
  // specifically — measured rather than assumed: the guidelines contain
  // no `//` outside a `://` and no `/*`, so stripping cannot eat any of
  // the text it returns. A rule added later that carries either would
  // need this to extract from the original by position instead.
  const src = stripComments(readFileSync(join(root, "functions/src/paid.ts"), "utf8"));
  const m = src.match(/export const REVIEW_GUIDELINES = `([\s\S]*?)`;/);
  return m ? m[1] : die("could not read REVIEW_GUIDELINES from functions/src/paid.ts");
})();

const base = () => api("firestore.googleapis.com", `/v1/projects/${PROJECT}/databases/${DB_ID}/documents`);

/** Firestore's typed JSON, flattened to something readable. Only the
 *  shapes a booking actually uses — a general decoder here would be a
 *  second implementation of somebody else's format. */
export function plain(fields) {
  const one = (v) => {
    if (v.stringValue !== undefined) return v.stringValue;
    if (v.integerValue !== undefined) return Number(v.integerValue);
    if (v.doubleValue !== undefined) return v.doubleValue;
    if (v.booleanValue !== undefined) return v.booleanValue;
    if (v.nullValue !== undefined) return null;
    if (v.timestampValue !== undefined) return v.timestampValue;
    if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(one);
    if (v.mapValue !== undefined) return plain(v.mapValue.fields || {});
    return null;
  };
  return Object.fromEntries(Object.entries(fields || {}).map(([k, v]) => [k, one(v)]));
}

const token = await accessToken(serviceAccount("paid-review"), "paid-review");
const authed = (url, init = {}) => fetch(url, {
  ...init,
  headers: { authorization: `Bearer ${token}`, ...(init.body ? { "content-type": "application/json" } : {}) },
});

async function list() {
  // A structured query rather than a full scan: the collection holds every
  // booking ever made, and only the ones still in `review` are the queue.
  const res = await authed(
    api("firestore.googleapis.com", `/v1/projects/${PROJECT}/databases/${DB_ID}/documents:runQuery`),
    {
      method: "POST",
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "v2_paid_bookings" }],
          where: { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "review" } } },
          limit: 50,
        },
      }),
    },
  );
  if (!res.ok) die(`query failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const rows = (await res.json()).filter((r) => r.document);
  if (!rows.length) {
    console.log("paid-review: nothing in review.");
    return;
  }
  console.log(`paid-review: ${rows.length} booking(s) awaiting a verdict.\n`);
  console.log("Judge each against these guidelines, then call --verdict:\n");
  console.log(GUIDELINES);
  console.log("\n" + "=".repeat(70) + "\n");
  for (const r of rows) {
    const bid = r.document.name.split("/").pop();
    const d = plain(r.document.fields);
    console.log(`BOOKING ${bid}`);
    console.log(JSON.stringify({
      prompt: d.prompt, type: d.type, options: d.options, topic: d.topic,
      scope: d.scope, dims: d.dims, link: d.link,
      buyerName: d.buyerName, createdAt: d.createdAt,
    }, null, 2));
    console.log("");
  }
  console.log("Then, for each:");
  console.log("  node scripts/paid-review.mjs --verdict <bid> approve");
  console.log('  node scripts/paid-review.mjs --verdict <bid> decline --reason "shown to the buyer verbatim"');
}

async function verdict(bid, call, reason) {
  if (call !== "approve" && call !== "decline") die("the verdict is `approve` or `decline`");
  if (call === "decline" && !reason) die("a decline needs --reason — it is shown to the buyer verbatim");
  // READ FIRST, and refuse anything not still in review. The sweep, a
  // second Routine firing and a human could all be looking at this queue;
  // settling a booking twice would move a paid, live campaign back to
  // declined. The function's own transaction guards this server-side —
  // this is the same refusal one layer out, where the message can say so.
  const get = await authed(`${base()}/v2_paid_bookings/${encodeURIComponent(bid)}`);
  if (get.status === 404) die(`no booking ${bid}`);
  if (!get.ok) die(`read failed (${get.status})`);
  const cur = plain((await get.json()).fields);
  if (cur.status !== "review") {
    console.log(`paid-review: ${bid} is already "${cur.status}" — nothing written.`);
    return;
  }
  const fields = {
    status: { stringValue: call === "approve" ? "approved" : "declined" },
    review: {
      mapValue: {
        fields: {
          by: { stringValue: "routine" },
          model: { nullValue: null },
          at: { timestampValue: new Date().toISOString() },
        },
      },
    },
    ...(call === "decline" ? { note: { stringValue: String(reason).slice(0, 400) } } : {}),
  };
  const mask = Object.keys(fields).map((f) => `updateMask.fieldPaths=${f}`).join("&");
  const res = await authed(`${base()}/v2_paid_bookings/${encodeURIComponent(bid)}?${mask}`, {
    method: "PATCH",
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) die(`write failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  console.log(`paid-review: ${bid} → ${call === "approve" ? "approved" : "declined"}.`);
  if (call === "approve") {
    // The QUOTE is locked at approval by the function's own path, and this
    // one does not write it. Said out loud rather than left to be noticed:
    // a booking approved here is payable, and `createPaidCheckoutV2` reads
    // `quote` off the doc.
    console.log("  note: the buyer can now pay. The quote on the doc is what they are charged.");
  }
}

const i = argv.indexOf("--verdict");
if (argv.includes("--list")) await list();
else if (i >= 0) {
  const r = argv.indexOf("--reason");
  await verdict(argv[i + 1], argv[i + 2], r >= 0 ? argv[r + 1] : null);
} else {
  console.log("usage: --list | --verdict <bid> approve|decline [--reason \"…\"]");
  process.exit(1);
}
