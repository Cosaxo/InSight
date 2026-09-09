#!/usr/bin/env node
// cost-target.mjs — prices the LOG-FIRST structure docs/SCALE-ARCHITECTURE.md
// proposes against the SHIPPED structure, at the loads the owner named on
// 2026-09-09: hundreds of answers a day, millions of users.
//
//   node scripts/cost-target.mjs          # npm run costs:target
//
// WHY A SEPARATE SCRIPT. cost-arith.mjs prices the app as built, per
// user-day, and it is right about that app: every term is linear in users
// and the bill is flat per user. What it cannot say is what happens when
// the OTHER axis moves — `B.worldAnswers` is 4, and at 100 or 300 the
// per-answer terms (a rule read, three trigger reads, three writes, a
// delete, a ledger row the nightly pass holds in memory) are the whole
// bill and the whole failure. This script moves that axis and prices two
// structures side by side, line by line, so the owner reads a decision
// rather than a conclusion. Nothing is retyped: the shipped column IS
// cost-arith's `costModel` with `B.worldAnswers` set to the load, and the
// target column is built from the same price sheet and the same
// behaviour assumptions (`B.boots`, `B.mauMultiple`, `socialTerms`).
//
// Same discipline as cost-structure.mjs: not a gate, asserts nothing, in
// no CI job. It exists so that "what would a million users answering a
// hundred times a day cost" is answered by running this, never by a
// number typed into a document. scripts/cost-target.test.mjs holds the
// arithmetic to what SCALE-ARCHITECTURE.md claims of it.
//
// PRICES OUTSIDE FIRESTORE are new to the model and are the part to
// distrust first. They were read from Google's pricing pages on
// 2026-09-09 (US list prices; europe-west1 is within a few percent) and
// they are constants with their source stated, not sums; the billing
// export LAUNCH-RUNBOOK.md 5.12 asks for is what turns them into invoice
// lines. Every assumption about BEHAVIOUR (batch size, bank size, scans a
// night) is a named constant in the block below, for the same reason
// cost-arith keeps `B`: a guess that is visible can be corrected.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  B, ROOT, costModel, totalCost, socialTerms, priceSheet, REGIONAL, LOCATION_LABEL,
  CPU_S, MEM_S, REQ, TRIG, PATTERNS_SCAN_READS_PER_MAU,
} from "./cost-arith.mjs";

const P = priceSheet(REGIONAL);

// ── read from source, never remembered ──────────────────────────
const src = (rel) => readFileSync(join(ROOT, rel), "utf8");
const grab = (rel, re, what) => {
  const m = re.exec(src(rel));
  if (!m) throw new Error(`cost-target: could not read ${what} from ${rel}`);
  return Number(m[1].replace(/_/g, ""));
};
/** The nightly pass's memory (functions/src/ops.ts NIGHTLY), in MiB. */
export const NIGHTLY_MIB = grab("functions/src/ops.ts", /export const NIGHTLY = \{ memory: "(\d+)GiB"/, "NIGHTLY.memory") * 1024;
/** The breakdown dims an answer lands in (functions/src/pure.ts) — one
 * counter increment per dim per answer, plus the option itself. */
export const BREAKDOWN_DIMS = (() => {
  const m = /export const BREAKDOWN_DIMS = \[([^\]]*)\]/.exec(src("functions/src/pure.ts"));
  if (!m) throw new Error("cost-target: could not read BREAKDOWN_DIMS from functions/src/pure.ts");
  // the string literals, not the commas: the list carries a comment with
  // commas in it, and counting those said ten dims where the tree has eight
  return (m[1].match(/"[^"]+"/g) || []).length;
})();
/** ALS sweeps a night (functions/src/patternsAls.ts), as cost-arith already
 * derives it: the streamed scan reads the people 1 + sweeps times. */
export const ALS_SWEEPS = PATTERNS_SCAN_READS_PER_MAU - 1;

// ── the load ────────────────────────────────────────────────────
/** (DAU, world answers per user per day, label). The first row is the
 * shipped model's own "Scale" scenario at a heavy answer rate, so the two
 * tables meet; the rest are the owner's target. */
export const LOADS = [
  [50_000, 100, "Scale, a hundred a day"],
  [1_000_000, 100, "A million, a hundred"],
  [1_000_000, 300, "A million, three hundred"],
  [10_000_000, 100, "Ten million, a hundred"],
  [10_000_000, 300, "Ten million, three hundred"],
];

// ── behaviour assumptions of the target structure ───────────────
export const T = {
  // The client writes answers in BATCHES to one document per user-day
  // (SCALE-ARCHITECTURE.md §3.1): a merge every BATCH_MINUTES while the
  // person is answering, and a flush when the app leaves the foreground.
  // Fifteen answers a batch is three a minute for five minutes — the
  // dial the owner holds, priced at §6's sensitivity line.
  answersPerBatch: 15,
  // The bank hundreds of answers a day needs (SCALE-PLAN.md: the feed is
  // unbounded, the core stays bounded). A hundred thousand questions is
  // where the counters' keyspace and the compactor's dirty set are sized.
  bankQuestions: 100_000,
  // How often the compactor publishes a dirty question's document — the
  // same cadence the card already re-reads at (AGG_POLL_MS is 60 s), so
  // nothing a user sees moves (§4).
  compactSeconds: 60,
  // A row of the BigQuery answers table: uid, qid, option, from, at, the
  // eight frozen chips. The stamp (name, scores) is NOT on the row — it is
  // one row per person in a profiles table the samples join against.
  rowBytes: 120,
  // What the streaming API phase A ships on (functions/src/log.ts,
  // `table.insert` — tabledata.insertAll) bills a row AS: a 1 KB minimum
  // per row, and the row above is an eighth of that. Runbook A.8 moves
  // the append to the Storage Write API, whose figure is printed beside
  // this line as the fact `ingestWriteApiMo` so the step's worth is read
  // rather than guessed.
  rowMinBilledBytes: 1024,
  // The log's retention: nothing drops a row — outliving the ledger's
  // 90-day TTL is what the log is for — so an erasure pass reads the
  // year, and the twelfth month's storage line below is a year's rows.
  logRetentionDays: 365,
  // Erasure: ONE DELETE statement a night over every account the day
  // deleted (log.ts's batch). BigQuery bills a DELETE for every column of
  // every partition it touches, and an account whose answers span the
  // year touches every partition, so a statement costs the table's size
  // however many accounts it names — which is why it is one a night and
  // not one an account. Runbook A.9 is the shape that scans less.
  erasurePassesPerNight: 1,
  // How many times a night the day's partition is scanned: the digest, the
  // world samples, the city samples, the velocity signals, the taste fold,
  // the rank. Each is one SELECT over one day.
  nightlyScans: 6,
  // The people table a sweep reads: a person's latent vector and compacted
  // answer map, ~2 KB, MAU rows, read once for the statistics and once per
  // ALS sweep — bytes scanned, not documents read, which is what makes
  // runbook 4.3b's whole problem disappear.
  peopleRowBytes: 2_048,
  // A batch trigger does more than an answer trigger: N rows appended, ten
  // N increments pipelined. Wall time per invocation, seconds.
  triggerSec: 0.3,
  // Redis: one instance shard sustains this many pipelined INCRs a second
  // with headroom (Memorystore quotes far more for plain GETs), holds this
  // many GiB, and the feed's answers peak at this multiple of the daily
  // average (the daily question's own peak is B.peakWindowMin's).
  redisOpsPerSecPerShard: 50_000,
  redisGiBPerShard: 5,
  peakFactor: 3,
  // The counters' keyspace: per question, the option totals and the
  // breakdown cells (dims × ≤24 buckets × options ≈ 2,400 leaves, the
  // same shape BYTES.aggDoc prices), ~16 bytes a leaf in a Redis hash,
  // ×1.5 for overhead.
  leavesPerQuestion: 2_400,
  bytesPerLeaf: 16,
  redisOverhead: 1.5,
  // One always-on compactor instance drains this many dirty questions a
  // minute (a hash read and one document write each, pipelined).
  dirtyPerInstanceMinute: 20_000,
  // The CDN variant of publishing (§3.3): counts served as pages of fifty
  // questions, ~2 KB, ten pages a user-day, regenerated every compaction
  // for the pages that changed, cached at the edge for the same interval.
  questionsPerPage: 50,
  pageBytes: 2_048,
  pagesPerUserDay: 10,
  cdnEdges: 10,
  // Per-user Firestore documents a boot reads under the target — the
  // profile, meta, the three rank docs, taste, the engagement state, the
  // day document, the map, the patterns state. The deck and the feed's
  // counts arrive as published documents or pages, charged separately.
  bootDocs: 10,
  // Per-user documents the nightly writer job rewrites: the patterns
  // state, the engagement state, the rollup's mark.
  nightlyWrites: 3,
  // Memory a ledger entry takes in the shipped nightly pass, measured
  // 2026-09-09 on node 22 (a stamped entry with eight chips): the number
  // that says where the shipped pass dies.
  entryBytes: 470,
  // Firestore's guidance for writes to an index on a monotonically
  // increasing field (answeredAt, the ledger's at), per second.
  sequentialIndexWritesPerSec: 500,
};

// ── prices outside Firestore (USD, list, read 2026-09-09) ───────
export const PRICES = {
  // BigQuery: Storage Write API $0.025/GiB after 2 TiB a month free;
  // the legacy streaming API (insertAll, what phase A ships on) $0.01 per
  // 200 MB — $0.05/GiB — with a 1 KB minimum a row and no free allowance;
  // logical storage $0.02/GiB-month active, $0.01 after 90 untouched days;
  // on-demand queries $6.25/TiB scanned, DML included (the first TiB a
  // month is free and is not netted here — conservative, like the query
  // line).
  bqWritePerGiB: 0.025,
  bqWriteFreeGiBMo: 2_048,
  bqStreamPerGiB: 0.05,
  bqStoreActivePerGiBMo: 0.02,
  bqStoreLongPerGiBMo: 0.01,
  bqQueryPerTiB: 6.25,
  // Memorystore for Redis, Standard tier (replicated), per GiB-hour —
  // $0.046 quoted for a 20 GB M2 instance in us-central1, rounded up for
  // the EU.
  redisPerGiBHour: 0.05,
  // Eventarc delivery of a Firestore event to a 2nd-gen function, per
  // million; the function's own request and compute are cost-arith's
  // REQ, CPU_S and MEM_S.
  eventarcPerM: 0.40,
  // Cloud CDN cache egress, EU, per GiB.
  cdnEgressPerGiB: 0.08,
};

const HOURS_MO = 730;
const GIB = 1024 ** 3;
const TIB = 1024 ** 4;

/** The shipped structure at a load: cost-arith's own model with the answer
 * rate moved, and where it stops working. `B` is mutated and restored so a
 * caller that imports both sees the shipped model untouched. */
export function shipped(dau, answers) {
  const was = B.worldAnswers;
  B.worldAnswers = answers;
  try {
    const { model } = costModel({ regional: REGIONAL });
    const out = model(dau, true);
    return {
      readsPerDay: out.reads,
      writesPerDay: out.writes,
      perMonth: totalCost(out.cost),
      // The nightly pass holds the day's entries: 70 % of its memory for
      // the entries, the rest for the folds' own maps and V8's headroom.
      passDiesAtDau: Math.floor((NIGHTLY_MIB * 1024 * 1024 * 0.7) / T.entryBytes / answers),
      // The index wall on answeredAt / at: the morning peak at peakFactor
      // times the day's average rate.
      indexWallDau: Math.floor((T.sequentialIndexWritesPerSec * 86_400) / (answers * T.peakFactor)),
    };
  } finally {
    B.worldAnswers = was;
  }
}

/** The target structure at a load, per month, one line per thing billed. */
export function target(dau, answers) {
  const rowsPerDay = dau * answers;
  const batches = Math.max(1, answers / T.answersPerBatch);
  const mau = dau * B.mauMultiple;
  const social = Object.values(socialTerms(dau, true)).reduce((a, b) => a + b, 0);

  // A question is dirty in a compaction interval if it got an answer in
  // it; Poisson on the per-question rate says how many are.
  const intervalsPerDay = 86_400 / T.compactSeconds;
  const perQuestionPerInterval = rowsPerDay / T.bankQuestions / intervalsPerDay;
  const dirtyPerInterval = T.bankQuestions * (1 - Math.exp(-perQuestionPerInterval));
  const dirtyPerMinute = dirtyPerInterval * (60 / T.compactSeconds);

  // Firestore, per day.
  const userWrites = dau * (2 * batches + T.nightlyWrites); // the day doc, the map merge, the nightly states
  const userReads = dau * (T.bootDocs * B.boots + social + 1); // per-user docs, the D98 surfaces, today's card
  const userDeletes = dau * 1; // the rollup's TTL
  const publishWritesFs = dirtyPerInterval * intervalsPerDay;

  // Triggers: one per batch. Eventarc delivers, Cloud Run bills the
  // request and the compute (cost-arith's shape, with a longer body).
  const invocations = dau * batches;
  const perInvocation = PRICES.eventarcPerM / 1e6 + REQ + (T.triggerSec * (TRIG.cpu * CPU_S + TRIG.mem * MEM_S)) / TRIG.conc;

  // The compactor: always-on instances, one vCPU and one GiB each.
  const compactorInstances = Math.max(1, Math.ceil(dirtyPerMinute / T.dirtyPerInstanceMinute));
  const instanceMo = HOURS_MO * 3600 * (CPU_S + MEM_S);

  // BigQuery.
  const ingestGiBMo = (rowsPerDay * T.rowBytes * 30) / GIB;
  // …billed by the streaming API at the row minimum (phase A as shipped).
  const ingestBilledGiBMo = (rowsPerDay * Math.max(T.rowBytes, T.rowMinBilledBytes) * 30) / GIB;
  const ingestWriteApiMo = Math.max(0, ingestGiBMo - PRICES.bqWriteFreeGiBMo) * PRICES.bqWritePerGiB;
  const storeGiBMo = ingestGiBMo; // what a month adds; year-end storage is twelve of them
  const scanBytesDay = rowsPerDay * T.rowBytes * T.nightlyScans + mau * T.peopleRowBytes * (1 + ALS_SWEEPS);
  // Erasure: a pass over the year's table per statement, one a night.
  const erasureBytesPass = rowsPerDay * T.rowBytes * T.logRetentionDays;

  // Redis: sized for the peak and for the keyspace, whichever is larger.
  const opsPerSecPeak = ((rowsPerDay * (1 + BREAKDOWN_DIMS + 1)) / 86_400) * T.peakFactor;
  const shards = Math.max(1, Math.ceil(opsPerSecPeak / T.redisOpsPerSecPerShard));
  const keyspaceGiB = (T.bankQuestions * T.leavesPerQuestion * T.bytesPerLeaf * T.redisOverhead) / GIB;
  const redisGiB = Math.max(shards * T.redisGiBPerShard, keyspaceGiB);

  // The CDN variant of publishing: pages regenerated per interval for the
  // pages that changed (at these loads, all of them), served from the
  // edge; the origin sees one request per page per edge per interval.
  const pages = T.bankQuestions / T.questionsPerPage;
  const originRequestsDay = pages * intervalsPerDay * T.cdnEdges;
  const egressGiBMo = (dau * T.pagesPerUserDay * T.pageBytes * 30) / GIB;

  const lines = {
    "Firestore — per-user writes (the day document, the map merge, the nightly states)": userWrites * 30 * P.write,
    "Firestore — per-user reads (boot documents, the D98 surfaces, today's card)": userReads * 30 * P.read,
    "Firestore — deletes (the rollups' TTL)": userDeletes * 30 * P.del,
    "Triggers — one per batch (Eventarc + Cloud Run request + compute)": invocations * 30 * perInvocation,
    "Compactor — always-on instances": compactorInstances * instanceMo,
    "Publish — the cheaper of Firestore documents and CDN pages": Math.min(
      publishWritesFs * 30 * P.write,
      originRequestsDay * 30 * REQ + egressGiBMo * PRICES.cdnEgressPerGiB + instanceMo,
    ),
    "BigQuery — ingest (the streaming API phase A ships on: 1 KB minimum a row; A.8 is the Storage Write API)": ingestBilledGiBMo * PRICES.bqStreamPerGiB,
    "BigQuery — storage, the twelfth month (nine long-term, three active)": storeGiBMo * (9 * PRICES.bqStoreLongPerGiBMo + 3 * PRICES.bqStoreActivePerGiBMo),
    "BigQuery — the nightly queries (six day scans, the people table per sweep)": (scanBytesDay / TIB) * PRICES.bqQueryPerTiB * 30,
    "BigQuery — erasures (one DELETE a night over the year's table for the day's deleted accounts)": (erasureBytesPass / TIB) * PRICES.bqQueryPerTiB * 30 * T.erasurePassesPerNight,
    "Redis — live counters (sized for the peak and the keyspace)": redisGiB * HOURS_MO * PRICES.redisPerGiBHour,
  };
  const perMonth = Object.values(lines).reduce((a, b) => a + b, 0);
  return {
    lines, perMonth,
    facts: {
      batchesPerUserDay: batches,
      firestoreWritesPerDay: userWrites + userDeletes + publishWritesFs,
      firestoreReadsPerDay: userReads,
      invocationsPerDay: invocations,
      dirtyPerMinute, compactorInstances,
      ingestGiBMo, ingestBilledGiBMo, ingestWriteApiMo, scanTiBDay: scanBytesDay / TIB,
      erasureTiBPass: erasureBytesPass / TIB,
      redisShards: shards, redisGiB, opsPerSecPeak,
      publishFsWritesPerDay: publishWritesFs,
      cdnOriginRequestsDay: originRequestsDay, egressGiBMo,
      answersPerSecPeak: (rowsPerDay / 86_400) * T.peakFactor,
    },
  };
}

// ── the printer ─────────────────────────────────────────────────
const money = (n) => "$" + (n < 10 ? n.toFixed(2) : Math.round(n).toLocaleString("en-US"));
const big = (n) => (n >= 1e9 ? (n / 1e9).toFixed(1) + " G" : n >= 1e6 ? (n / 1e6).toFixed(1) + " M" : n >= 1e3 ? Math.round(n / 1e3) + " K" : String(Math.round(n)));
const pad = (s, n) => String(s).padStart(n);

if (process.argv[1] && /cost-target\.mjs$/.test(process.argv[1])) {
  console.log(`\nInSight at hundreds of answers a day — ${LOCATION_LABEL} prices, no Firestore free allowance (the named database has none)`);
  console.log(`bank assumed ${T.bankQuestions.toLocaleString("en-US")} questions · ${T.answersPerBatch} answers a batch · compaction every ${T.compactSeconds} s · ${BREAKDOWN_DIMS} breakdown dims · ${ALS_SWEEPS} ALS sweeps\n`);

  const cols = LOADS.map(([dau, answers]) => ({ dau, answers, s: shipped(dau, answers), t: target(dau, answers) }));
  const head = "load".padEnd(30) + cols.map((c) => pad(`${big(c.dau)} × ${c.answers}/day`, 16)).join("");
  console.log(head);
  console.log("-".repeat(head.length));
  console.log("SHIPPED structure, $/month".padEnd(30) + cols.map((c) => pad(money(c.s.perMonth), 16)).join(""));
  console.log("  reads/day".padEnd(30) + cols.map((c) => pad(big(c.s.readsPerDay), 16)).join(""));
  console.log("  writes/day".padEnd(30) + cols.map((c) => pad(big(c.s.writesPerDay), 16)).join(""));
  console.log("  the nightly pass dies at".padEnd(30) + cols.map((c) => pad(big(c.s.passDiesAtDau) + " DAU", 16)).join(""));
  console.log("  the index wall arrives at".padEnd(30) + cols.map((c) => pad(big(c.s.indexWallDau) + " DAU", 16)).join(""));
  console.log("");
  console.log("TARGET structure, $/month".padEnd(30) + cols.map((c) => pad(money(c.t.perMonth), 16)).join(""));
  for (const key of Object.keys(cols[0].t.lines)) {
    console.log(("  " + key).padEnd(30).slice(0, 84).padEnd(30) + cols.map((c) => pad(money(c.t.lines[key]), 16)).join(""));
  }
  console.log("  Firestore writes/day".padEnd(30) + cols.map((c) => pad(big(c.t.facts.firestoreWritesPerDay), 16)).join(""));
  console.log("  Firestore reads/day".padEnd(30) + cols.map((c) => pad(big(c.t.facts.firestoreReadsPerDay), 16)).join(""));
  console.log("  trigger invocations/day".padEnd(30) + cols.map((c) => pad(big(c.t.facts.invocationsPerDay), 16)).join(""));
  console.log("  answers/s at the peak".padEnd(30) + cols.map((c) => pad(big(c.t.facts.answersPerSecPeak), 16)).join(""));
  console.log("  Redis shards · GiB".padEnd(30) + cols.map((c) => pad(`${c.t.facts.redisShards} · ${c.t.facts.redisGiB.toFixed(0)}`, 16)).join(""));
  console.log("  dirty questions/minute".padEnd(30) + cols.map((c) => pad(big(c.t.facts.dirtyPerMinute), 16)).join(""));
  console.log("  BigQuery GiB ingested/month".padEnd(30) + cols.map((c) => pad(big(c.t.facts.ingestGiBMo), 16)).join(""));
  console.log("   …billed by the streaming API".padEnd(30) + cols.map((c) => pad(big(c.t.facts.ingestBilledGiBMo) + " GiB", 16)).join(""));
  console.log("   …on the Storage Write API (A.8)".padEnd(30) + cols.map((c) => pad(money(c.t.facts.ingestWriteApiMo) + "/mo", 16)).join(""));
  console.log("  BigQuery TiB scanned/night".padEnd(30) + cols.map((c) => pad(c.t.facts.scanTiBDay.toFixed(2), 16)).join(""));
  console.log("  BigQuery TiB an erasure pass reads".padEnd(30) + cols.map((c) => pad(c.t.facts.erasureTiBPass.toFixed(2), 16)).join(""));
  console.log("");
  console.log("shipped ÷ target".padEnd(30) + cols.map((c) => pad((c.s.perMonth / c.t.perMonth).toFixed(1) + "×", 16)).join(""));

  // The dial the owner holds: the batch window. Circle freshness is the
  // window; the batch lines scale with 1/answersPerBatch.
  console.log("\nthe batch dial, at a million users answering a hundred a day (Circle sees a friend's answer within the window):");
  const was = T.answersPerBatch;
  for (const [minutes, per] of [[1, 3], [5, 15], [15, 45]]) {
    T.answersPerBatch = per;
    const t = target(1_000_000, 100);
    console.log(`  ${pad(minutes, 3)} min window · ${pad(per, 3)} answers a batch → ${pad(money(t.perMonth), 9)}/month, ${big(t.facts.invocationsPerDay)} triggers/day`);
  }
  T.answersPerBatch = was;
  console.log("");
}
