#!/usr/bin/env node
// build-report.mjs — the paid report builder, v1 (D229; docs/PAID-PLAN.md §2).
//
//   FIREBASE_API_KEY=<web key> npm run report -- --qid <qid> [--out reports]
//
// WHAT IT IS. The hand-run half of the report product: one invocation per
// contract, producing a self-contained report.html plus a CSV bundle
// (voters, series, edits, breakdown) under reports/<qid>/<date>/. Selling,
// invoicing and delivery stay human and off-repo — this script only turns
// public numbers into a document.
//
// THE READ-SET CONSTRAINT IS STRUCTURAL, NOT PROMISED. PAID-PLAN §2's rule
// — every figure derivable from world-readable data — is enforced by HOW
// this script authenticates: an anonymous sign-in over the public web API
// key (question-scorecard.mjs's --fetch pattern), so every read below goes
// through firestore.rules exactly as a signed-in stranger's would. There
// is no service account here and must never be one: the day this script
// holds admin credentials is the day the constraint becomes prose.
//
// WHAT IT READS, and why each is allowed to a stranger:
//   v2_questions/{qid}        prompt + options (read: any signed-in user)
//   v2_question_aggs/{qid}    the exact split, breakdown and D226 edits
//   answers (group query)     the who-voted roll — public since D98, the
//                             rules' surface-value test replicated verbatim
//   v2_users/{uid}            display names + verified logic pctile (D227)
//   v2_patterns/loadings      similarity structure, when the fit published
//
// Reads are paged from cursors, never capped-and-called-complete (the
// D101 rule); the one bound is ASSOC_VOTER_CAP on the association section,
// and the report states it when it binds. Node stdlib only.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  bucketByDay, cramersV, cosineNeighbors, csv, decodeDoc, dimRows,
  flowRows, logicBandsFor, MIN_SHARED, renderReport,
} from "./report-lib.mjs";

const args = process.argv.slice(2);
const argOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const QID = argOf("--qid");
const OUT = argOf("--out") || "reports";
if (!QID) {
  console.error("build-report: --qid <question id> is required");
  process.exit(1);
}

const PROJECT = process.env.FIREBASE_PROJECT || "prvfire33";
const DB_ID = process.env.FIRESTORE_DB_ID || "insight";
const KEY = process.env.FIREBASE_API_KEY;
if (!KEY) {
  console.error("build-report: FIREBASE_API_KEY (the public web API key) is required — the script reads as a signed-in user, which is the whole point");
  process.exit(1);
}

// Rules replicas — must match firestore.rules' answers grant and the
// client's dim vocabulary (data/cohort.ts DIM_LABEL) exactly.
const SURFACES = ["daily", "feed", "test", "learn", "pulse", "call"];
const DIM_LABELS = {
  ageBand: "Age", gender: "Gender", city: "City", country: "Country",
  education: "Education", relationship: "Relationship", heightBand: "Height",
};
// The association section reads every core question's answer for each
// voter, so it is the one section whose cost scales as voters × core
// bank. Bounded to the newest ASSOC_VOTER_CAP voters; the report prints
// the basis whenever the cap binds.
const ASSOC_VOTER_CAP = 1500;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DB_ID}/documents`;

async function authToken() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`,
    { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
  );
  if (!res.ok) {
    console.error(`build-report: anonymous sign-in failed (${res.status}) — is Anonymous auth enabled?`);
    process.exit(1);
  }
  return (await res.json()).idToken;
}

const authed = (token) => ({ authorization: `Bearer ${token}` });

async function getDoc(token, path) {
  const res = await fetch(`${BASE}/${path}`, { headers: authed(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status}): ${await res.text()}`);
  const body = await res.json();
  return decodeDoc(body.fields);
}

async function batchGet(token, paths) {
  const out = new Map();
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    const res = await fetch(`${BASE}:batchGet`, {
      method: "POST",
      headers: { ...authed(token), "content-type": "application/json" },
      body: JSON.stringify({
        documents: chunk.map((p) => `projects/${PROJECT}/databases/${DB_ID}/documents/${p}`),
      }),
    });
    if (!res.ok) throw new Error(`batchGet failed (${res.status}): ${await res.text()}`);
    for (const row of await res.json()) {
      if (row.found) {
        const rel = row.found.name.split("/documents/")[1];
        out.set(rel, decodeDoc(row.found.fields));
      }
    }
  }
  return out;
}

/** Every answer to QID, walked whole from the cursor (the D101 rule). */
async function fetchAllAnswers(token) {
  const rows = [];
  let cursor = null;
  for (;;) {
    const structuredQuery = {
      from: [{ collectionId: "answers", allDescendants: true }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            { fieldFilter: { field: { fieldPath: "qid" }, op: "EQUAL", value: { stringValue: QID } } },
            { fieldFilter: { field: { fieldPath: "surface" }, op: "IN", value: { arrayValue: { values: SURFACES.map((s) => ({ stringValue: s })) } } } },
          ],
        },
      },
      orderBy: [
        { field: { fieldPath: "answeredAt" }, direction: "DESCENDING" },
        { field: { fieldPath: "__name__" }, direction: "DESCENDING" },
      ],
      limit: 300,
    };
    if (cursor) structuredQuery.startAt = { values: cursor, before: false };
    const res = await fetch(`${BASE}:runQuery`, {
      method: "POST",
      headers: { ...authed(token), "content-type": "application/json" },
      body: JSON.stringify({ structuredQuery }),
    });
    if (!res.ok) throw new Error(`answers query failed (${res.status}): ${await res.text()}`);
    const body = await res.json();
    const docs = body.filter((r) => r.document);
    for (const r of docs) {
      const name = r.document.name;
      const uid = name.split("/v2_users/")[1]?.split("/")[0];
      const d = decodeDoc(r.document.fields);
      if (!uid || typeof d.optionIdx !== "number") continue; // catalog answers carry `entity`
      rows.push({
        uid, optionIdx: d.optionIdx,
        answeredAt: d.answeredAt || "",
        edited: d.editedAt != null,
        anchors: d.anchors && typeof d.anchors === "object" ? d.anchors : {},
      });
    }
    if (docs.length < 300) return rows;
    const last = docs[docs.length - 1].document;
    cursor = [
      last.fields.answeredAt ?? { nullValue: null },
      { referenceValue: last.name },
    ];
  }
}

const today = new Date().toISOString().slice(0, 10);
const token = await authToken();

const q = await getDoc(token, `v2_questions/${QID}`);
if (!q) {
  console.error(`build-report: no question ${QID} in v2_questions — check the id`);
  process.exit(1);
}
const options = Array.isArray(q.options) ? q.options : [];
console.error(`report: "${q.prompt}" — ${options.length} options`);

const agg = (await getDoc(token, `v2_question_aggs/${QID}`)) || {};
const counts = Array.from({ length: options.length }, (_, i) => Number(agg.counts?.[String(i)] || 0));
const total = Number(agg.total || 0);

const answers = await fetchAllAnswers(token);
console.error(`report: ${answers.length} answer(s) read`);

// Names + verified logic percentiles ride one profile read per voter —
// the same document, the same D112 argument as the app's own sheet.
const uids = [...new Set(answers.map((a) => a.uid))];
const profiles = await batchGet(token, uids.map((u) => `v2_users/${u}`));
const nameOf = (uid) => {
  const n = profiles.get(`v2_users/${uid}`)?.displayName;
  return typeof n === "string" ? n.trim().slice(0, 60) : "";
};
const logicOf = (uid) => {
  const pct = Number(profiles.get(`v2_users/${uid}`)?.testResults?.logic?.pctile);
  return Number.isFinite(pct) ? Math.max(0, Math.min(100, Math.round(pct))) : null;
};

const loadings = await getDoc(token, "v2_patterns/loadings");
const loadQ = loadings?.q && typeof loadings.q === "object" ? loadings.q : null;

let neighbors = null;
if (loadQ) {
  const near = cosineNeighbors(loadQ, QID) || [];
  if (near.length) {
    const nq = await batchGet(token, near.map((nb) => `v2_questions/${nb.qid}`));
    neighbors = near.map((nb) => ({ ...nb, prompt: nq.get(`v2_questions/${nb.qid}`)?.prompt || nb.qid }));
  }
}

// Association against the fit's own core set, over shared voters. Direct
// per-voter answer lookups (v2_users/{uid}/answers/{coreQid}) — the same
// read path a signed-in user has, batched.
let associations = null;
let capNote = "";
if (loadQ) {
  const coreQids = Object.keys(loadQ).filter((k) => k !== QID);
  const assocUids = uids.slice(0, ASSOC_VOTER_CAP);
  if (uids.length > ASSOC_VOTER_CAP) {
    capNote = `The association section read the newest ${ASSOC_VOTER_CAP} of ${uids.length} voters.`;
  }
  const assocSet = new Set(assocUids);
  const mine = new Map(answers.filter((a) => assocSet.has(a.uid)).map((a) => [a.uid, a.optionIdx]));
  const scored = [];
  let thin = 0;
  for (const core of coreQids) {
    const got = await batchGet(token, assocUids.map((u) => `v2_users/${u}/answers/${core}`));
    const theirs = new Map();
    for (const [path, d] of got) {
      // batchGet keys are documents-relative: v2_users/{uid}/answers/{qid}.
      const uid = path.split("/")[1];
      if (uid && typeof d.optionIdx === "number") theirs.set(uid, d.optionIdx);
    }
    const a = cramersV(mine, theirs);
    if (a) scored.push({ qid: core, v: a.v, n: a.n });
    else if (theirs.size) thin += 1;
  }
  scored.sort((x, y) => y.v - x.v);
  const top = scored.slice(0, 8);
  const tq = await batchGet(token, top.map((t) => `v2_questions/${t.qid}`));
  associations = {
    scored: top.map((t) => ({ ...t, prompt: tq.get(`v2_questions/${t.qid}`)?.prompt || t.qid })),
    thin,
  };
  console.error(`report: associations — ${scored.length} scored, ${thin} too thin (< ${MIN_SHARED} shared)`);
}

const logic = logicBandsFor(
  answers.map((a) => ({ optionIdx: a.optionIdx, logic: logicOf(a.uid) })),
  options.length,
);
const dims = Object.keys(DIM_LABELS).map((dim) => ({ dim, rows: dimRows(agg.by, dim, options.length) }));
const series = bucketByDay(answers.map((a) => a.answeredAt));
const flows = flowRows(agg.edits, options);

const html = renderReport({
  qid: QID, prompt: q.prompt || QID, options, generatedOn: today,
  counts, total, series, flows, dims, dimLabels: DIM_LABELS,
  logic, neighbors, associations, voterRows: answers.length, capNote,
});

const dir = resolve(OUT, QID, today);
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, "report.html"), html);
writeFileSync(resolve(dir, "voters.csv"), csv([
  ["uid", "name", "option", "answeredAt", "edited", "logicPctile",
    ...Object.keys(DIM_LABELS)],
  ...answers.map((a) => [
    a.uid, nameOf(a.uid), options[a.optionIdx] ?? a.optionIdx, a.answeredAt,
    a.edited ? "yes" : "", logicOf(a.uid) ?? "",
    ...Object.keys(DIM_LABELS).map((d) => a.anchors[d] || ""),
  ]),
]));
writeFileSync(resolve(dir, "series.csv"), csv([["day", "answers"], ...series.map((r) => [r.day, r.n])]));
writeFileSync(resolve(dir, "edits.csv"), csv([["from", "to", "moves"], ...flows.map((f) => [f.fromLabel, f.toLabel, f.n])]));
writeFileSync(resolve(dir, "breakdown.csv"), csv([
  ["dim", "bucket", "option", "count"],
  ...dims.flatMap((d) => d.rows.flatMap((r) => r.counts.map((c, i) => [d.dim, r.bucket, options[i] ?? i, c]))),
]));

console.error(`report: written to ${dir}`);
