#!/usr/bin/env node
// Test users — synthetic accounts that play the duel loop the way a real
// device does, so 1v1 and groups can be exercised from ONE browser.
//
// THE PROBLEM THIS SOLVES. docs/LOCAL-TESTING.md tells you to join your own
// duo "by invite code from a second browser profile/incognito window". That
// works for the join, and then stops being enough: a duo only reveals when
// BOTH members played (shouldReveal, functions/src/pure.ts), the Groups
// portrait is computed from reveal HISTORY (data/groupPortrait.ts), and a
// streak needs consecutive revealed days. Producing that by hand is a second
// window, a second set of votes, and a wait for the 2-hourly scan — per day
// of history you want. Nobody does it, so those surfaces get looked at least.
//
// WHAT A TEST USER IS. A real account. It signs in, writes its own profile,
// joins through the real callables, seals its duel answer at the real path,
// and is revealed by the real pipeline. Everything below goes through the
// CLIENT SDK under that account's own session:
//
//   * membership   createGroupV2 / joinGroupV2 / leaveGroupV2 (callables —
//                  invite codes, caps and pairing cannot be forged, so the
//                  harness cannot forge them either)
//   * duel answers v2_users/{uid}/answers/g_{gid}_{day}, owner-written,
//                  shape-checked by firestore.rules like any other
//   * reveals      revealDuelsNowV2, the scheduled scan's own manual lever
//
// The admin SDK is deliberately NOT used. A harness that wrote through it
// would bypass firestore.rules, and every surface it lit up would be one a
// real second phone might not reach — the exact failure the rules tests
// exist to prevent. If a test user can do it, a real user can do it.
//
// THREE THINGS THAT ARE NOT GUESSES, because getting them wrong produces a
// plausible-looking wrong screen rather than an error:
//
//   1. The day's question comes from the REAL duelQFor (src/v2/data/deck.ts),
//      imported rather than restated. Every member's client derives it
//      independently from (gid hash + UTC day + bank length), so a second
//      copy here that drifted would seal answers to a different prompt —
//      and revealQid would then publish the majority's question and stamp
//      the odd one out (D70/D71). The harness would manufacture that
//      disagreement on every run and it would read as an app bug.
//   2. Anchors come from the closed vocabularies the profile's <select>s
//      offer, and cities from the shipped catalogue via the real placeKey.
//      A value outside them still writes, and folds into NO breakdown
//      bucket (breakdownBucket, functions/src/pure.ts) — so the answer
//      would count in the totals and vanish from every cohort cut, which
//      looks like a Mirror bug.
//   3. Backfilled days are revealed OLDEST FIRST, one explicit day per
//      call. nextStreak only extends when the previous reveal was for the
//      immediately preceding day, and revealDuelsNowV2 with no day scans
//      newest-first (scanDays), so one bulk call over a backfill ends on
//      streak 1 no matter how many days it settled.
//
// EMULATOR ONLY, enforced below. Since D98 the public counts are EXACT and
// publish from the first answer — there is no floor for a fake account to
// hide under, so test users answering world questions on a real project
// would move numbers real people are shown. v2_agg_events records uid
// attribution so a discovered ring can be subtracted after the fact
// (DEPLOYMENT.md, "Correcting aggregates"); that is a cleanup path, not a
// licence to create the mess. Production also enforces App Check on every
// member callable, which a Node process cannot attest to anyway.
//
// Usage: npm run testuser -- <command>   (see usage() at the bottom)

import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";

import { deleteApp, initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInAnonymously,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit as fsLimit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "firebase/functions";

// The app's own rotation and catalogue logic — imported, never restated.
// Node loads these .ts files directly under --experimental-strip-types
// (see the `testuser` script in package.json); both modules are
// dependency-free at module scope, so nothing Vite-shaped comes with them.
import { duelQFor, splitBanks, utcDayIndex } from "../src/v2/data/deck.ts";
import { parseCatalogue, placeKey } from "../src/v2/data/places.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REGION = "us-central1";
const DAY_MS = 86400000;

// How far back a duel answer may be dated, in whole days.
//
// firestore.rules accepts a duel answer while
// `timestamp.date(day) > request.time - duration.value(4, 'd')`, and the day
// key is midnight UTC — so offset -4 clears that bound only in the first
// hours of a UTC day and is refused every afternoon. -3 holds at any hour,
// which is what makes it the cap here rather than 4: a backfill that half
// works depending on the clock is worse than one that states its limit.
const MAX_BACKFILL_DAYS = 3;

const STATE_FILE = resolve(ROOT, ".test-users.json");

// ── output ──────────────────────────────────────────────────────────

const say = (...a) => console.log(...a);
const step = (s) => console.log(`\n• ${s}`);
const ok = (s) => console.log(`  ✓ ${s}`);
const info = (s) => console.log(`    ${s}`);
const warn = (s) => console.log(`  ! ${s}`);

function die(msg) {
  console.error(`\ntest-users: ${msg}\n`);
  process.exit(1);
}

// ── the target, and the guard on it ─────────────────────────────────

// Minimal KEY=VALUE reader. Not a dotenv clone: the app's own env files are
// flat, and a parser that handled more would be a parser that could disagree
// with Vite about what the project id is.
function readEnvFile(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

function loadTarget() {
  // .env is what `npm run dev` reads, so the harness and the app you are
  // testing against always agree about which project they mean.
  const env = { ...readEnvFile(resolve(ROOT, ".env.emulator")), ...readEnvFile(resolve(ROOT, ".env")) };
  if (env.VITE_USE_EMULATOR !== "true") {
    die(
      "refusing to run: VITE_USE_EMULATOR is not \"true\" in .env.\n\n" +
      "  This harness only ever points at the Local Emulator Suite. Test\n" +
      "  users answering world questions move the EXACT public counts (D98)\n" +
      "  that real people are shown, and there is no floor for them to hide\n" +
      "  under. Set up local mode first:\n\n" +
      "    cp .env.emulator .env\n" +
      "    firebase emulators:start --only auth,firestore,functions",
    );
  }
  return {
    apiKey: env.VITE_FIREBASE_API_KEY || "demo-emulator",
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "localhost",
    projectId: env.VITE_FIREBASE_PROJECT_ID || "demo-insight",
    appId: env.VITE_FIREBASE_APP_ID || "1:000000000000:web:emulator",
  };
}

// One FirebaseApp per identity. Sessions are per-app in the JS SDK, so
// sharing one app across users would mean each sign-in silently signing the
// previous user out — and the writes that followed would land under the
// wrong uid while every rule still passed.
let appSeq = 0;
function newSession(config) {
  const app = initializeApp(config, `testuser-${++appSeq}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const fns = getFunctions(app, REGION);
  connectFunctionsEmulator(fns, "127.0.0.1", 5001);
  const call = async (name, data) => (await httpsCallable(fns, name)(data)).data;
  return { app, auth, db, call, close: () => deleteApp(app).catch(() => {}) };
}

// ── local state ─────────────────────────────────────────────────────
//
// Identity is EMAIL/PASSWORD, and this is the one way a test user differs
// from a real one. Real devices are anonymous-first (D3), but an anonymous
// session cannot be re-attached in a later process: re-signing in needs the
// refresh token, and the JS SDK exposes no way to hand one back. A stored
// email/password re-signs in with the client SDK alone, no admin credential
// and no second dependency.
//
// The substitution is invisible to everything a test user touches: nothing
// in firestore.rules reads request.auth.token.firebase.sign_in_provider,
// no function branches on it, and the profile's `anon` field has no reader
// (v2social.ts only names it as an unbounded field). uid is what every gate
// keys on, and a uid is a uid.

function loadState() {
  if (!existsSync(STATE_FILE)) return { projectId: null, users: [] };
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    return { projectId: s.projectId || null, users: Array.isArray(s.users) ? s.users : [] };
  } catch {
    die(`${STATE_FILE} is not readable JSON. Delete it and re-create the test users.`);
  }
}

function saveState(state) {
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

// ── people ──────────────────────────────────────────────────────────

const FIRST = [
  "Ida", "Jonas", "Mira", "Tobias", "Nora", "Elias", "Sara", "Henrik",
  "Liv", "Kasper", "Alma", "Noah", "Vera", "Emil", "Ines", "Aksel",
];
const LAST = [
  "Bremer", "Halvorsen", "Lindqvist", "Sandvik", "Aune", "Vik", "Ferrand",
  "Novak", "Okafor", "Ruiz", "Tanaka", "Haugen", "Costa", "Ilves",
];

// The closed vocabularies, verbatim from src/v2/spec/profile-general.jsx —
// which npm run check:anchors holds equal to BREAKDOWN_DIM_VOCAB in
// functions/src/pure.ts. A value that is not in these lists still WRITES
// and then folds into no breakdown bucket at all, so a test user carrying
// one would count in the totals of every question and appear in no cohort
// cut of any of them.
const AGE_BANDS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const GENDERS = ["Woman", "Man", "Non-binary", "Prefer not to say"];
const RELATIONSHIPS = ["Single", "Dating", "Partnered", "Married", "It’s complicated"];
const EDUCATION = [
  "High school", "Vocational or trade", "Some college", "Bachelor's",
  "Master's", "Doctorate", "Self-taught",
];
// Not a breakdown dim (profession is deliberately never one — D8), so this
// list only has to be enterable in the profile, not bucketable.
const PROFESSIONS = [
  "Software & IT", "Design & creative", "Education & research", "Healthcare",
  "Business & finance", "Trades & crafts", "Student", "Service & hospitality",
];

// A handful of real catalogue cities rather than a random draw over 10,929.
// City IS a breakdown dim, so ten users in ten cities give ten cohorts of
// one — true, and useless to look at. Clustering them is what makes the
// geographic Mirror stops show a cut with more than one person in it.
const CITY_POOL = ["Oslo", "Berlin", "Lisbon", "Toronto", "Bergen", "Austin"];

let placesCache = null;
function cityKeys() {
  if (placesCache) return placesCache;
  const text = readFileSync(resolve(ROOT, "public/cities.txt"), "utf8");
  const places = parseCatalogue(text);
  // Largest match wins: "Berlin" is a German city of 3.4M and also a small
  // town in several other countries, and the catalogue holds both.
  placesCache = CITY_POOL.map((name) => {
    const hits = places.filter((p) => p.name === name);
    if (!hits.length) die(`city "${name}" is not in public/cities.txt — fix CITY_POOL.`);
    return placeKey(hits.sort((a, b) => b.popK - a.popK)[0]);
  });
  return placesCache;
}

const pick = (arr, i) => arr[i % arr.length];

function makePerson(index, nameOverride) {
  const city = pick(cityKeys(), index);
  const name = nameOverride
    || `${pick(FIRST, index)} ${pick(LAST, index * 5 + 3)}`;
  return {
    name,
    email: `testuser-${index + 1}-${randomBytes(3).toString("hex")}@insight.test`,
    // Random, and stored beside the uid: the account is only reachable with
    // it, and the file is gitignored. Losing the file means making new test
    // users, which in an emulator costs nothing.
    password: randomBytes(12).toString("hex"),
    anchors: {
      ageBand: pick(AGE_BANDS, index * 3 + 1),
      gender: pick(GENDERS, index * 2),
      city,
      // Derived from the city key exactly as anchorsFrom() does — the ISO
      // code is locale-independent, so it is never typed.
      country: city.slice(-2),
      education: pick(EDUCATION, index * 5 + 2),
      profession: pick(PROFESSIONS, index * 3),
      relationship: pick(RELATIONSHIPS, index * 4 + 1),
    },
    // How often this person votes with the crowd, and it is what makes the
    // aggregates worth reading. Uniform random answers give every question a
    // flat split and every pair of people the same likeness; a per-person
    // conformity bias produces real majorities, real outliers, and Compare
    // numbers that differ from each other.
    conform: 0.35 + ((index * 29) % 40) / 100,
    seed: randomBytes(4).toString("hex"),
  };
}

// ── deterministic choices ───────────────────────────────────────────

// A 32-bit value from a string. Stable, so the same (person, question) pair
// always answers the same way and re-running a command never rewrites
// history differently.
//
// Via SHA-256 rather than gHash's `h * 31 + c` shape, and that is the whole
// point of this comment. gHash's last round adds the final character
// straight into the accumulator, so consecutive inputs produce consecutive
// outputs — harmless for its real job (hashing one gid) and ruinous here,
// because question ids run daily-007, daily-008, daily-009. Measured with
// that hash in place: four users' conformity rolls over three consecutive
// qids came out .24/.25/.26, .41/.42/.43, .03/.04/.05 and .46/.47/.48, so
// the whole population conformed or dissented as one bloc and every single
// question published a unanimous split. A digest has the avalanche this
// needs and nothing here is hot enough to care what it costs.
function hash(s) {
  return createHash("sha256").update(s).digest().readUInt32BE(0);
}

// The option this person picks: the crowd's option `conform` of the time,
// their own idiosyncratic one otherwise.
//
// The dissenting branch draws from the options EXCLUDING the crowd's, rather
// than from all of them. Drawn freely it lands back on the majority roughly
// 1/optionCount of the time, and on a 3-option question with four members
// that was enough to make most days unanimous — a split that never splits
// leaves the reveal card, the group portrait and every Mirror cut showing
// one bar, which is precisely the thing under test.
function chooseOption(user, qid, optionCount) {
  if (optionCount < 1) return 0;
  const crowd = hash(`crowd|${qid}`) % optionCount;
  const roll = (hash(`${user.seed}|roll|${qid}`) % 100) / 100;
  if (roll < user.conform || optionCount === 1) return crowd;
  const mine = hash(`${user.seed}|${qid}`) % (optionCount - 1);
  return mine >= crowd ? mine + 1 : mine;
}

// A duo's guess about the partner. Mostly projection — people guess that
// the other person thinks what they think — which is what makes some
// reveals say "called it" and others "guessed X".
function chooseGuess(user, qid, optionCount, myPick) {
  if (optionCount < 1) return 0;
  const roll = (hash(`${user.seed}|guess|${qid}`) % 100) / 100;
  if (roll < 0.6) return myPick;
  return hash(`crowd|${qid}`) % optionCount;
}

const utcDayKey = (offset, nowMs = Date.now()) =>
  new Date(nowMs + offset * DAY_MS).toISOString().slice(0, 10);

// "today" | "yesterday" | "-2" | "2026-08-10" → a whole-day offset from now.
// Always an offset, because duelQFor needs one and the day key is derived
// from it — deriving them separately is how the two disagree.
function dayOffsetOf(spec) {
  if (spec == null || spec === "today") return 0;
  if (spec === "yesterday") return -1;
  if (/^-?\d+$/.test(spec)) return Number(spec);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(spec);
  if (!m) die(`--day: expected today|yesterday|-N|YYYY-MM-DD, got "${spec}"`);
  const target = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Math.floor(target / DAY_MS) - utcDayIndex(Date.now());
}

// ── sessions ────────────────────────────────────────────────────────

async function signIn(config, user) {
  const s = newSession(config);
  try {
    const cred = await signInWithEmailAndPassword(s.auth, user.email, user.password);
    return { ...s, uid: cred.user.uid, user };
  } catch (err) {
    // The emulator is wiped on restart while this file survives it, so a
    // stored account routinely does not exist yet. Re-creating it with the
    // same credentials brings the same person back; the uid is new, which is
    // correct — the old one's groups and answers went with the wipe.
    if (["auth/user-not-found", "auth/invalid-credential", "auth/invalid-login-credentials"].includes(err.code)) {
      const cred = await createUserWithEmailAndPassword(s.auth, user.email, user.password);
      await writeProfile(s.db, cred.user.uid, user);
      return { ...s, uid: cred.user.uid, user, fresh: true };
    }
    await s.close();
    throw err;
  }
}

// The profile the app itself writes: displayName and the anchors map, merged.
// Nothing else — `anon`, `createdAt` and `updatedAt` are permitted by the
// rules and written by no client path, and a harness that invented them
// would be describing a document shape the app does not produce.
async function writeProfile(db, uid, user) {
  await setDoc(
    doc(db, "v2_users", uid),
    { displayName: user.name, anchors: user.anchors },
    { merge: true },
  );
}

// An unpersisted anonymous session for work that belongs to no persona:
// reading the question bank and pulling the operator levers. Anonymous
// because it is genuinely throwaway — nothing should be able to mistake it
// for one of the test users.
async function opsSession(config) {
  const s = newSession(config);
  const cred = await signInAnonymously(s.auth);
  return { ...s, uid: cred.user.uid };
}

// ── the question bank ───────────────────────────────────────────────

// Exactly the app's pipeline: read the bank, sort by seq, drop inactive,
// split. Re-deriving any of those three here is how the harness ends up
// choosing a question the app will not show.
async function loadBanks(session) {
  const snap = await getDocs(query(collection(session.db, "v2_questions"), fsLimit(1500)));
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const sorted = all.slice().sort((a, b) => (a.seq || 0) - (b.seq || 0));
  const active = sorted.filter((q) => q.active !== false);
  return { ...splitBanks(active), size: all.length };
}

async function ensureSeeded(session) {
  let banks = await loadBanks(session);
  if (banks.size) return banks;
  step("question bank is empty — seeding (seedContentV2)");
  await session.call("seedContentV2", {});
  banks = await loadBanks(session);
  ok(`seeded ${banks.size} questions`);
  return banks;
}

// ── group reads ─────────────────────────────────────────────────────

// v2_groups is readable by members only, so this is run under each test
// user's own session — the same array-contains query the app's groups
// listener makes.
async function groupsOf(session) {
  const snap = await getDocs(query(
    collection(session.db, "v2_groups"),
    where("memberUids", "array-contains", session.uid),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── commands ────────────────────────────────────────────────────────

async function cmdNew(config, state, opts) {
  const count = opts.count || 1;
  const made = [];
  for (let i = 0; i < count; i++) {
    const person = makePerson(state.users.length + i, count === 1 ? opts.name : null);
    const s = await signIn(config, person);
    await writeProfile(s.db, s.uid, person);
    made.push({ ...person, uid: s.uid });
    ok(`${person.name} — uid ${s.uid}`);
    info(`${person.anchors.ageBand} · ${person.anchors.gender} · ${person.anchors.city} · ${person.anchors.education}`);
    await s.close();
  }
  state.projectId = config.projectId;
  state.users.push(...made);
  saveState(state);
  return made;
}

async function cmdJoin(config, state, code, opts) {
  if (!code) die("join needs an invite code: npm run testuser -- join ABCD1234");
  const want = opts.count || 1;
  // Reuse test users who are not already in this group before making new
  // ones — running `join` twice with the same code should be idempotent,
  // not a way to accumulate personas.
  step(`joining ${code.toUpperCase()}`);
  const fresh = [];
  const pool = state.users.slice(0, want);
  while (pool.length < want) {
    const person = makePerson(state.users.length + fresh.length, want === 1 ? opts.name : null);
    fresh.push(person);
    pool.push(person);
  }

  const joined = [];
  for (const person of pool) {
    const s = await signIn(config, person);
    try {
      const out = await s.call("joinGroupV2", { code: code.toUpperCase(), displayName: person.name });
      await writeProfile(s.db, s.uid, person);
      joined.push({ person, uid: s.uid, gid: out.gid, name: out.name });
      ok(`${person.name} joined "${out.name}" (${out.gid})`);
      if (!person.uid) person.uid = s.uid;
    } catch (err) {
      const code2 = err.code || "";
      if (code2.includes("resource-exhausted")) {
        warn(`${person.name} could not join: ${err.message}`);
        info("a duo caps at 2 members — that is the 1v1 rule, not a bug");
      } else if (code2.includes("not-found")) {
        die(`no group with code ${code.toUpperCase()}. Check the code in the app's Circle tab.`);
      } else {
        warn(`${person.name} could not join: ${err.message}`);
      }
    }
    await s.close();
  }

  state.projectId = config.projectId;
  for (const p of fresh) if (!state.users.includes(p)) state.users.push(p);
  saveState(state);
  if (joined.length) {
    say("");
    say("  next: seal their answers, then reveal");
    say("    npm run testuser -- play");
    say("    npm run testuser -- reveal");
  }
  return joined;
}

async function cmdHost(config, state, name, opts) {
  const groupName = name || (opts.mode === "duo" ? "Test duo" : "Test crew");
  const mode = opts.mode === "duo" ? "duo" : "group";
  const [person] = state.users.length
    ? [state.users[0]]
    : await cmdNew(config, state, { count: 1 });
  const s = await signIn(config, person);
  await writeProfile(s.db, s.uid, person);
  const out = await s.call("createGroupV2", { name: groupName, mode, displayName: person.name });
  if (!person.uid) {
    person.uid = s.uid;
    saveState(state);
  }
  await s.close();
  step(`${person.name} created ${mode} "${groupName}"`);
  ok(`invite code  ${out.inviteCode}`);
  info(`gid ${out.gid}`);
  say("");
  say(`  Join it from the app (Circle tab → join by code), answer today's`);
  say(`  question, then:`);
  say("    npm run testuser -- play");
  say("    npm run testuser -- reveal");
  return out;
}

// Seal one day's duel answer for every test user, in every group they are in.
async function cmdPlay(config, state, opts) {
  if (!state.users.length) die("no test users yet: npm run testuser -- join <CODE>");
  const offset = dayOffsetOf(opts.day);
  const day = utcDayKey(offset);
  const ops = await opsSession(config);
  const banks = await ensureSeeded(ops);
  await ops.close();

  step(`sealing answers for ${day}${offset === 0 ? " (today)" : ""}`);
  let sealed = 0;
  for (const person of state.users) {
    const s = await signIn(config, person);
    if (person.uid !== s.uid) { person.uid = s.uid; saveState(state); }
    const groups = await groupsOf(s);
    const targets = opts.gid ? groups.filter((g) => g.id === opts.gid) : groups;
    if (!targets.length) info(`${person.name}: in no group${opts.gid ? " matching --gid" : ""} yet`);
    for (const g of targets) {
      const q = duelQFor(g, banks.duel, utcDayIndex(Date.now()), offset);
      if (!q) { warn(`${g.name}: no question in the ${g.mode || "group"} bank`); continue; }
      const aid = `g_${g.id}_${day}`;
      const existing = await getDoc(doc(s.db, "v2_users", s.uid, "answers", aid));
      if (existing.exists()) { info(`${person.name} → ${g.name}: already sealed`); continue; }
      const optionCount = q.options.length;
      const optionIdx = chooseOption(person, q.id, optionCount);
      const duo = (g.mode || "group") === "duo";
      const payload = {
        qid: q.id,
        surface: duo ? "duo" : "group",
        optionIdx,
        gid: g.id,
        day,
        answeredAt: serverTimestamp(),
        anchors: person.anchors,
      };
      // Only duos guess, matching the panel: LiveDuelPanel asks "what did
      // they pick?" and requires it before it will seal.
      if (duo) payload.guessIdx = chooseGuess(person, q.id, optionCount, optionIdx);
      try {
        await setDoc(doc(s.db, "v2_users", s.uid, "answers", aid), payload);
        sealed++;
        ok(`${person.name} → ${g.name}: "${q.options[optionIdx]}"${duo ? ` (guessed "${q.options[payload.guessIdx]}")` : ""}`);
        info(`Q ${q.id} — ${q.prompt}`);
      } catch (err) {
        // The two refusals worth naming, because both look like a broken
        // harness and neither is: a revealed day is closed to new answers
        // (firestore.rules gates the create on the reveal not existing),
        // and a day outside the 4d/2d window is refused by date.
        warn(`${person.name} → ${g.name}: refused (${err.code || err.message})`);
        info(`${day} is either already revealed or outside the answer window`);
      }
    }
    await s.close();
  }
  if (sealed) {
    say("");
    say(`  next: npm run testuser -- reveal${opts.day ? ` --day ${day}` : ""}`);
  }
  return sealed;
}

async function cmdReveal(config, state, opts) {
  const offset = dayOffsetOf(opts.day);
  const day = utcDayKey(offset);
  const ops = await opsSession(config);
  step(`revealing ${day}`);
  const out = await ops.call("revealDuelsNowV2", { day });
  ok(`revealed ${out.revealed} of ${out.scanned} groups scanned`);
  await ops.close();

  // Read the reveal back through a member's session — the read rule gates on
  // the reveal's own `members` snapshot, so this also proves the document is
  // readable by the people in it rather than merely written.
  //
  // `--gid` narrows this REPORT only. revealDuelsNowV2 settles every group it
  // scans and takes no gid, so a run that claimed to have revealed one group
  // would be describing a scan it did not perform.
  for (const person of state.users) {
    const s = await signIn(config, person);
    const seen = await groupsOf(s);
    for (const g of (opts.gid ? seen.filter((x) => x.id === opts.gid) : seen)) {
      const snap = await getDoc(doc(s.db, "v2_groups", g.id, "reveals", day));
      if (!snap.exists()) {
        const duo = (g.mode || "group") === "duo";
        warn(`${g.name}: no reveal for ${day}`);
        info(duo
          ? "a duo is both-or-nothing (shouldReveal) — did you answer in the app too?"
          : "a group needs at least one answer for that day");
        continue;
      }
      const r = snap.data();
      const votes = r.votes || {};
      ok(`${g.name} — ${day} · streak ${(await getDoc(doc(s.db, "v2_groups", g.id))).data()?.streak ?? "?"}`);
      const q = r.qid;
      info(`Q ${q}`);
      for (const [uid, v] of Object.entries(votes)) {
        const who = (r.names || {})[uid] || uid.slice(0, 8);
        const guess = typeof v.guessIdx === "number" ? ` · guessed #${v.guessIdx}` : "";
        info(`  ${who}: #${v.optionIdx}${guess}${uid === s.uid ? "  (test user)" : ""}`);
      }
    }
    await s.close();
    break; // one member's view is enough to confirm; the rest read the same doc
  }
  return out;
}

// Backfill N past days of sealed answers and settle each one, oldest first.
async function cmdHistory(config, state, opts) {
  const days = Math.min(opts.days || MAX_BACKFILL_DAYS, MAX_BACKFILL_DAYS);
  if ((opts.days || 0) > MAX_BACKFILL_DAYS) {
    warn(`capped at ${MAX_BACKFILL_DAYS} days — firestore.rules refuses a duel answer dated more than 4 days back, and the day key is midnight UTC, so -4 only lands in the small hours`);
  }
  // Run this BEFORE revealing today, not after. lastRevealDay and streak are
  // written by whichever reveal commits last, so settling today first and
  // then backfilling leaves a group whose newest reveal is today and whose
  // lastRevealDay says the day before yesterday. Nothing is broken — the
  // reveals are all there and readable — but the streak counts the backfill
  // rather than the run up to today, which reads as a bug and is not one.
  step(`backfilling ${days} day${days > 1 ? "s" : ""} — do this before revealing today`);
  // Oldest first, and one explicit day per reveal call: nextStreak extends
  // only from the immediately preceding revealed day, so any other order
  // finishes on streak 1.
  for (let i = days; i >= 1; i--) {
    await cmdPlay(config, state, { ...opts, day: String(-i) });
    await cmdReveal(config, state, { gid: opts.gid, day: String(-i) });
  }
  say("");
  say("  The Groups stop reads reveal history — open mirror → Groups.");
  return days;
}

// World answers, so a test user is not a ghost everywhere outside the duel.
async function cmdWorld(config, state, opts) {
  if (!state.users.length) die("no test users yet: npm run testuser -- new");
  const n = opts.n || 25;
  const ops = await opsSession(config);
  const banks = await ensureSeeded(ops);
  await ops.close();
  // daily + feed (which carries the `test` surface too). A spread rather
  // than only the 7-day deck window: nothing bounds a world answer by date
  // (isWorldAnswer has no day test), so a spread is exactly what an account
  // with a long feed history looks like — and it is what puts numbers in the
  // aggregates the Mirror reads.
  const pool = [...banks.daily, ...banks.feed];
  if (!pool.length) die("no daily/feed questions in the bank");
  step(`answering up to ${n} world questions each`);
  for (const person of state.users) {
    const s = await signIn(config, person);
    if (person.uid !== s.uid) { person.uid = s.uid; saveState(state); }
    let wrote = 0;
    let had = 0;
    for (const q of pool.slice(0, n)) {
      const ref = doc(s.db, "v2_users", s.uid, "answers", q.id);
      if ((await getDoc(ref)).exists()) { had++; continue; }
      try {
        await setDoc(ref, {
          qid: q.id,
          surface: q.surface,
          optionIdx: chooseOption(person, q.id, q.options.length),
          answeredAt: serverTimestamp(),
          anchors: person.anchors,
        });
        wrote++;
      } catch (err) {
        warn(`${person.name} → ${q.id}: ${err.code || err.message}`);
        break;
      }
    }
    ok(`${person.name}: ${wrote} new${had ? `, ${had} already answered` : ""}`);
    await s.close();
  }
  say("");
  say("  The aggregate trigger folds these — counts are exact from the first");
  say("  answer (D98), so the daily payoff and the who-voted sheet fill in.");
}

async function cmdList(config, state) {
  const ops = await opsSession(config);
  const banks = await loadBanks(ops);
  await ops.close();
  say(`target      emulator · project ${config.projectId}`);
  say(`bank        ${banks.size} questions · duel ${banks.duel.length} (group ${banks.duel.filter((q) => q.surface === "group").length} · duo ${banks.duel.filter((q) => q.surface === "duo").length})`);
  say(`test users  ${state.users.length}${state.users.length ? "" : "  — make one: npm run testuser -- join <CODE>"}`);
  if (!banks.size) say("            (empty — any command seeds it automatically)");

  for (const person of state.users) {
    const s = await signIn(config, person);
    say("");
    say(`  ${person.name}   uid ${s.uid}${s.fresh ? "  (re-created — emulator was wiped)" : ""}`);
    say(`    ${person.anchors.ageBand} · ${person.anchors.gender} · ${person.anchors.city} · ${person.anchors.education} · conform ${Math.round(person.conform * 100)}%`);
    const groups = await groupsOf(s);
    if (!groups.length) say("    groups: none");
    for (const g of groups) {
      const mode = g.mode || "group";
      const q = banks.duel.length ? duelQFor(g, banks.duel, utcDayIndex(Date.now()), 0) : null;
      const today = utcDayKey(0);
      const mine = await getDoc(doc(s.db, "v2_users", s.uid, "answers", `g_${g.id}_${today}`));
      const revealed = await getDoc(doc(s.db, "v2_groups", g.id, "reveals", today));
      say(`    ${g.name}  [${mode}]  code ${g.inviteCode}  streak ${g.streak || 0}  members ${(g.memberUids || []).length}`);
      say(`      ${today}  ${mine.exists() ? "sealed ✓" : "not sealed"}${revealed.exists() ? "  · revealed ✓" : ""}`);
      if (q) say(`      Q ${q.id} — ${q.prompt}`);
      say(`      last reveal ${g.lastRevealDay || "—"}`);
    }
    await s.close();
  }
  say("");
  say("  Your own sealed answer is not shown above and cannot be: a duel");
  say("  answer is readable only by its owner until the reveal. Check the app.");
}

async function cmdReset(config, state, opts) {
  if (!state.users.length) { say("no test users to remove"); return; }
  if (opts.purge) {
    // Through the real deleteAccount callable, not by hand: it is the same
    // erasure path a real user gets, and running it here exercises it.
    for (const person of state.users) {
      const s = await signIn(config, person);
      try {
        await s.call("deleteAccount", {});
        ok(`${person.name}: account deleted`);
      } catch (err) {
        warn(`${person.name}: ${err.code || err.message}`);
      }
      await s.close();
    }
    // Said out loud because the alternative is reading a stale total as a
    // harness bug: deleteAccount deliberately leaves the tallies a deleted
    // account fed and erases the uid ledger that could attribute them
    // (functions/src/index.ts, phase 1b). Purged test users therefore stay
    // in every count they voted in. Restart the emulator for a clean slate.
    info("their votes stay in the aggregates — deleteAccount erases the");
    info("attribution, not the anonymous tally. Restart the emulator to zero it.");
  } else {
    say(`forgetting ${state.users.length} test users (their accounts stay in the emulator)`);
    say("  use --purge to delete them through the real deleteAccount callable");
  }
  rmSync(STATE_FILE, { force: true });
  ok(`removed ${STATE_FILE.replace(`${ROOT}/`, "")}`);
}

async function cmdSeed(config) {
  const ops = await opsSession(config);
  const before = (await loadBanks(ops)).size;
  await ops.call("seedContentV2", {});
  const after = (await loadBanks(ops)).size;
  ok(`v2_questions: ${before} → ${after}`);
  await ops.close();
}

// ── CLI ─────────────────────────────────────────────────────────────

function usage() {
  say(`
Test users — real accounts that play the duel loop, so 1v1 and groups can be
tested from one browser. Emulator only.

  npm run testuser -- <command> [options]

  list                        test users, their groups, today's question, seals
  new [--count N] [--name X]  create test users (no group yet)
  join <CODE> [--count N]     join your group or duo by its invite code
  host [NAME] [--mode duo]    a test user creates the group; you join from the app
  play [--day D] [--gid G]    seal a day's duel answer in every group they are in
  reveal [--day D]            run the reveal for that day (revealDuelsNowV2)
  history [--days N]          backfill N past days of answers + reveals (max ${MAX_BACKFILL_DAYS})
  world [--n N]               answer N world questions each (feeds the aggregates)
  seed                        seed the question bank (seedContentV2)
  reset [--purge]             forget the test users; --purge deletes the accounts

  --day accepts today | yesterday | -N | YYYY-MM-DD   (default: today)

The 1v1 loop, end to end:

  1  in the app: Circle tab → create a duo → copy the invite code
  2  npm run testuser -- join <CODE>
  3  in the app: answer today's duel question
  4  npm run testuser -- play
  5  npm run testuser -- reveal
  6  the reveal card is on the daily tab; the portrait is on mirror → Groups
`);
}

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { opts._.push(a); continue; }
    const key = a.slice(2);
    if (key === "purge") { opts.purge = true; continue; }
    const value = argv[++i];
    if (value == null) die(`--${key} needs a value`);
    if (["count", "n", "days"].includes(key)) {
      const num = Number(value);
      if (!Number.isInteger(num) || num < 1) die(`--${key} must be a positive integer`);
      opts[key] = num;
    } else {
      opts[key] = value;
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const [command, arg] = opts._;
  if (!command || command === "help" || command === "--help") { usage(); return; }

  const config = loadTarget();
  const state = loadState();
  if (state.projectId && state.projectId !== config.projectId) {
    die(
      `${STATE_FILE.replace(`${ROOT}/`, "")} holds test users for project "${state.projectId}" ` +
      `but .env now points at "${config.projectId}".\n  Run \`npm run testuser -- reset\` first.`,
    );
  }

  switch (command) {
    case "list": await cmdList(config, state); break;
    case "new": await cmdNew(config, state, opts); break;
    case "join": await cmdJoin(config, state, arg, opts); break;
    case "host": await cmdHost(config, state, arg, opts); break;
    case "play": await cmdPlay(config, state, opts); break;
    case "reveal": await cmdReveal(config, state, opts); break;
    case "history": await cmdHistory(config, state, opts); break;
    case "world": await cmdWorld(config, state, opts); break;
    case "seed": await cmdSeed(config); break;
    case "reset": await cmdReset(config, state, opts); break;
    default: die(`unknown command "${command}". Run with no arguments for usage.`);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    // The one failure worth translating: nothing is listening on the
    // emulator ports, which the SDK reports as an opaque "unavailable".
    if (String(err?.message || "").match(/unavailable|ECONNREFUSED|fetch failed/i)) {
      die(
        "could not reach the emulators on 127.0.0.1:9099/8080/5001.\n\n" +
        "    firebase emulators:start --only auth,firestore,functions",
      );
    }
    console.error(err);
    process.exit(1);
  },
);
