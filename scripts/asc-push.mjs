#!/usr/bin/env node
// asc-push.mjs — push design/store/listing.json to App Store Connect.
//
//   node scripts/asc-push.mjs                 # report the diff, change nothing
//   node scripts/asc-push.mjs --apply         # write it
//   node scripts/asc-push.mjs --age-rating    # the IARC answers
//   node scripts/asc-push.mjs --privacy       # the nutrition label
//   node scripts/asc-push.mjs --screenshots   # what image sets exist
//   node scripts/asc-push.mjs --all           # text + age rating + privacy
//
// Every mode is dry-run without --apply.
//
// WHY THIS EXISTS. listing.json is already the reviewed copy, already held
// against both stores' character limits by check-store-listing.mjs, and
// already the single source for the screenshot captions. Retyping it into
// a web form is an hour that also introduces the one failure that file was
// created to prevent: the store saying something the repo does not.
//
// SCOPE. Text, the age rating and the privacy nutrition label. It does NOT
// upload screenshots — see --screenshots below for why that is a report
// rather than a push — and it does not touch pricing or availability.
//
// THE ATTESTATIONS, AND A REVERSAL. This file used to refuse the privacy
// questionnaire and the age rating on the grounds that "a script that
// fills in an attestation is a script that answers a legal question on
// your behalf". That reasoning confused two different things: DECIDING an
// answer and TRANSCRIBING one. The decision lives in
// design/store/app-privacy.json — committed, reviewable in a diff, with
// the why on every row, and held equal to docs/STORE-FORMS.md by
// check:store-forms. The owner approves that file. This script types it in.
//
// Typing it in by hand was never the safeguard it looked like. It is ~40
// clicks that have to agree with docs/data-inventory.md, with nothing
// checking that they do, re-done from memory every time a row changes —
// which is exactly how the "collects no email or name via Google" claim
// survived in three documents at once. A diff is a better review surface
// than a web form.
//
// What still is not automated, and deliberately: submitting for review.
// That one is irreversible and outward-facing, and it should cost a
// deliberate human click.
//
// Dry run by default. --apply is required to write anything.
//
// Auth: the same App Store Connect API key the release workflow uses
// (docs/IOS-RELEASE.md). Either export them:
//   ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY   (the .p8 contents)
// or pass --key-file path/to/AuthKey_XXXX.p8 with the two ids as env vars.
//
// Node stdlib only: the JWT is ES256, which node:crypto signs directly as
// long as the signature is asked for in the JOSE format rather than DER —
// see sign() below, which is the one non-obvious line in this file.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createSign, createHash } from "node:crypto";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes("--apply");
const SCREENSHOTS = argv.includes("--screenshots");
const ALL = argv.includes("--all");
const AGE_RATING = ALL || argv.includes("--age-rating");
const PRIVACY = ALL || argv.includes("--privacy");
// Text is the default so a bare `asc:push` keeps behaving as it always
// has. Asking for only --age-rating should not also silently rewrite the
// description, so text turns itself off once a specific mode is named.
const TEXT = ALL || !(AGE_RATING || PRIVACY);
const LOCALE = argOf("--locale") || "en-US";

// Screenshot upload knobs. PROFILE names a directory under
// design/store/screenshots/ — the same ids gen-screenshots writes.
const PROFILE = argOf("--profile") || "iphone-6.9";
// Apple's ScreenshotDisplayType. A flag rather than a constant because the
// enum gains members when new hardware ships, and because a wrong value
// fails LOUDLY — the API answers with the list of valid ones. That is the
// property that makes this safe to automate at all.
const DISPLAY_TYPE = argOf("--display-type") || "APP_IPHONE_67";
const ALLOW_DEMO = argv.includes("--allow-demo");

// The editable version is the one not yet released. Anything in a live or
// in-review state must not be edited by a script running unattended.
// Declared here rather than beside its other use because the screenshot
// path needs it too, and a const referenced above its declaration is a
// temporal-dead-zone crash rather than a warning.
const EDITABLE = new Set([
  "PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED",
  "METADATA_REJECTED", "INVALID_BINARY",
]);

const KEY_ID = process.env.ASC_KEY_ID;
const ISSUER_ID = process.env.ASC_ISSUER_ID;
const KEY_FILE = argOf("--key-file");
const PRIVATE_KEY = KEY_FILE
  ? readFileSync(resolve(KEY_FILE), "utf8")
  : process.env.ASC_PRIVATE_KEY;

if (!KEY_ID || !ISSUER_ID || !PRIVATE_KEY) {
  console.error(
    "asc-push: needs ASC_KEY_ID, ASC_ISSUER_ID and the private key.\n"
    + "    export ASC_KEY_ID=... ASC_ISSUER_ID=... ASC_PRIVATE_KEY=\"$(cat AuthKey_XXXX.p8)\"\n"
    + "    or pass --key-file path/to/AuthKey_XXXX.p8\n"
    + "    docs/IOS-RELEASE.md § 1 says where the key comes from.",
  );
  process.exit(1);
}

const listing = JSON.parse(readFileSync(join(root, "design/store/listing.json"), "utf8"));
// --privacy-file so the attestation's source is nameable rather than
// baked in: the tests point it at fixtures to exercise the guards, and a
// second store's answers would be a second file rather than a fork.
const privacy = JSON.parse(readFileSync(
  resolve(argOf("--privacy-file") || join(root, "design/store/app-privacy.json")), "utf8",
));
const BUNDLE_ID = listing.shared.bundleId;

// ── auth ────────────────────────────────────────────────────────────
const b64u = (buf) => Buffer.from(buf).toString("base64url");

function token() {
  const header = { alg: "ES256", kid: KEY_ID, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  // Apple rejects anything longer than 20 minutes. 10 is plenty and
  // leaves room for a slow upload without re-minting mid-request.
  const payload = { iss: ISSUER_ID, iat: now, exp: now + 600, aud: "appstoreconnect-v1" };
  const signingInput = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(payload))}`;
  // dsaEncoding: "ieee-p1363" is the whole trick. Node's default for EC is
  // DER, which JWT verifiers reject with a signature error that reads like
  // a wrong key — the single most confusing way to get ASC auth wrong.
  const sig = createSign("SHA256")
    .update(signingInput)
    .sign({ key: PRIVATE_KEY, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${b64u(sig)}`;
}

// ASC_API_BASE exists so this file can be exercised against a stub. It has
// no account to run against in review and no way to be tried safely against
// a real one — the first live run would be against the owner's listing —
// so the alternative to a seam here is shipping the request shapes
// unverified. Unset in every real use.
const API = process.env.ASC_API_BASE || "https://api.appstoreconnect.apple.com";

async function call(method, path, body) {
  const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token()}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      detail = JSON.parse(text).errors?.map((e) => `${e.title}: ${e.detail}`).join("\n    ") || text;
    } catch { /* non-JSON error body — show it raw */ }
    throw new Error(`${method} ${path} → ${res.status}\n    ${detail}`);
  }
  return text ? JSON.parse(text) : null;
}

// ── locate the app and the editable version ─────────────────────────
const apps = await call("GET", `/v1/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}`);
const app = apps.data?.[0];
if (!app) {
  console.error(
    `asc-push: no app with bundle id ${BUNDLE_ID} in this account.\n`
    + "    The App Store Connect app record has to exist first — this script\n"
    + "    fills a record in, it does not create one.",
  );
  process.exit(1);
}
console.log(`asc-push: ${app.attributes.name} (${BUNDLE_ID})${APPLY ? "" : "   [DRY RUN]"}`);

if (SCREENSHOTS) {
  // This was read-only until 2026-08-07, on the reasoning that the
  // display-type enum "should not be guessed at from a machine with no
  // account to test against". The account now exists, so the objection is
  // gone — and the guess is avoidable anyway: --display-type is a flag, and
  // a wrong one is a 4xx from Apple naming the valid values, not a silent
  // wrong upload. That is a better failure than ten minutes of dragging.
  const versions = await call("GET", `/v1/apps/${app.id}/appStoreVersions?limit=10`);
  const version = versions.data?.find((v) => EDITABLE.has(v.attributes.appStoreState));
  if (!version) {
    console.error(
      "asc-push: no editable App Store version to attach screenshots to.\n"
      + `    States found: ${(versions.data || []).map((v) => v.attributes.appStoreState).join(", ") || "none"}`,
    );
    process.exit(1);
  }
  const locs = await call("GET", `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
  const loc = locs.data.find((l) => l.attributes.locale === LOCALE);
  if (!loc) {
    console.error(`asc-push: no ${LOCALE} localization. Add it in App Store Connect, or pass --locale.`);
    process.exit(1);
  }

  const dir = join(root, `design/store/screenshots/${PROFILE}`);
  if (!existsSync(dir)) {
    console.error(`asc-push: no captures at design/store/screenshots/${PROFILE}/ — run npm run build:screenshots.`);
    process.exit(1);
  }
  const files = readdirSync(dir).filter((f) => f.endsWith(".png")).sort();

  // THE 2.3.3 GATE, and the reason this refuses rather than warns.
  // gen-screenshots records per-capture `demoOnlyAffordances`: controls that
  // exist only when !S.live (D1) — Comments and "Who voted" on the reveal.
  // A real user never sees them on a live question, so uploading that image
  // advertises a feature the shipped app does not have, which is what
  // guideline 2.3.3 is about. It is also the most expensive kind of
  // mistake here: it costs a full review cycle, days after the upload.
  const manifestPath = join(root, "design/store/screenshots/manifest.json");
  const manifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, "utf8"))
    : null;
  const shotMeta = new Map(
    (manifest?.profiles?.[PROFILE]?.shots || []).map((s) => [s.file, s]),
  );
  const unsafe = files.filter((f) => (shotMeta.get(f)?.demoOnlyAffordances || []).length);
  if (unsafe.length && !ALLOW_DEMO) {
    console.error(
      `asc-push: ${unsafe.length} capture(s) show demo-only UI and will not be uploaded:\n`
      + unsafe.map((f) => `      ${f} — ${shotMeta.get(f).demoOnlyAffordances.join(", ")}`).join("\n")
      + "\n    Those controls are gated on !S.live (D1), so a live user never sees"
      + "\n    them and App Store 2.3.3 wants screenshots that reflect the app."
      + "\n    Recapture in live mode (the bank is seeded, so live captures are"
      + "\n    now possible) — or pass --allow-demo if you have decided otherwise,"
      + "\n    which is a decision worth writing down rather than a flag to reach for.",
    );
    process.exit(1);
  }
  if (manifest && manifest.mode !== "live") {
    console.log(`  note: these captures were taken in ${String(manifest.mode).toUpperCase()} mode.`);
  }

  // Find or create the set for this display type. Sets are per
  // (localization, displayType); Apple rejects an unknown type by NAMING the
  // valid ones, which is why guessing is survivable here and silent
  // mis-sizing is not — gen-screenshots already asserts pixel dimensions.
  const sets = await call("GET", `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets`);
  let set = sets.data.find((s) => s.attributes.screenshotDisplayType === DISPLAY_TYPE);
  console.log(
    `  ${loc.attributes.locale} / ${DISPLAY_TYPE}: `
    + `${set ? "existing set" : "no set yet"}, ${files.length} local capture(s)`,
  );

  const existingNames = new Set();
  if (set) {
    const have = await call("GET", `/v1/appScreenshotSets/${set.id}/appScreenshots`);
    for (const s of have.data) {
      if (s.attributes.assetDeliveryState?.state === "COMPLETE") {
        existingNames.add(s.attributes.fileName);
      }
    }
  }
  const todo = files.filter((f) => !existingNames.has(f));
  if (!todo.length) {
    console.log(`  = screenshots: all ${files.length} already uploaded.`);
  } else {
    for (const f of todo) console.log(`  ${APPLY ? "✓" : "+"} upload ${f}`);
    if (!APPLY) {
      console.log(`\nasc-push: ${todo.length} screenshot(s) would upload. Re-run with --apply.`);
      process.exit(0);
    }

    if (!set) {
      set = (await call("POST", "/v1/appScreenshotSets", {
        data: {
          type: "appScreenshotSets",
          attributes: { screenshotDisplayType: DISPLAY_TYPE },
          relationships: {
            appStoreVersionLocalization: {
              data: { type: "appStoreVersionLocalizations", id: loc.id },
            },
          },
        },
      })).data;
    }

    for (const f of todo) {
      const bytes = readFileSync(join(dir, f));
      // 1 — reserve. Apple answers with the exact PUTs to make.
      const reserved = (await call("POST", "/v1/appScreenshots", {
        data: {
          type: "appScreenshots",
          attributes: { fileSize: bytes.length, fileName: f },
          relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: set.id } } },
        },
      })).data;
      // 2 — send the bytes exactly as instructed. offset/length are Apple's,
      // not ours: a large asset comes back as several operations, and
      // assuming one whole-file PUT is how this breaks on a bigger image.
      for (const op of reserved.attributes.uploadOperations || []) {
        const slice = bytes.subarray(op.offset, op.offset + op.length);
        const headers = Object.fromEntries((op.requestHeaders || []).map((h) => [h.name, h.value]));
        const put = await fetch(op.url, { method: op.method || "PUT", headers, body: slice });
        if (!put.ok) {
          console.error(`asc-push: upload of ${f} failed at ${op.url} → ${put.status}`);
          process.exit(1);
        }
      }
      // 3 — commit, with the checksum Apple verifies the bytes against. MD5
      // here is Apple's choice of integrity check, not a security decision.
      await call("PATCH", `/v1/appScreenshots/${reserved.id}`, {
        data: {
          type: "appScreenshots",
          id: reserved.id,
          attributes: { uploaded: true, sourceFileChecksum: createHash("md5").update(bytes).digest("hex") },
        },
      });
      console.log(`    uploaded ${f} (${(bytes.length / 1024).toFixed(0)} KiB)`);
    }
    console.log(`\nasc-push: ${todo.length} screenshot(s) uploaded.`);
  }
  process.exit(0);
}

// EDITABLE is declared near the top of this file — the screenshot path
// needs it before this point, and a const used above its declaration is a
// temporal-dead-zone crash rather than a warning.
//
// `include=ageRatingDeclaration` so the declaration's id arrives with the
// version rather than costing a second round trip — and so its absence is
// distinguishable from "not asked for".
const versions = await call(
  "GET", `/v1/apps/${app.id}/appStoreVersions?limit=10&include=ageRatingDeclaration`,
);
const version = versions.data?.find((v) => EDITABLE.has(v.attributes.appStoreState));
if (!version) {
  console.error(
    "asc-push: no editable App Store version.\n"
    + `    States found: ${versions.data.map((v) => v.attributes.appStoreState).join(", ") || "none"}\n`
    + "    Create a new version in App Store Connect first. This script will not\n"
    + "    edit one that is live or in review.",
  );
  process.exit(1);
}

// ── the two places the text lives ───────────────────────────────────
// Apple splits it: name/subtitle/privacy URL belong to the APP (they
// survive versions), while description/keywords/what's-new belong to the
// VERSION. Sending a field to the wrong one is a 409 that reads like a
// permissions problem.
const infos = await call("GET", `/v1/apps/${app.id}/appInfos`);
const info = infos.data[0];
const infoLocs = await call("GET", `/v1/appInfos/${info.id}/appInfoLocalizations`);
const infoLoc = infoLocs.data.find((l) => l.attributes.locale === LOCALE);

const verLocs = await call("GET", `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
const verLoc = verLocs.data.find((l) => l.attributes.locale === LOCALE);

// Only the text push needs a localization. Gating this on TEXT matters:
// --age-rating and --privacy are app-level and locale-free, and failing
// them on a missing en-US localization would be a wrong answer to a
// question they never asked.
if (TEXT && (!infoLoc || !verLoc)) {
  console.error(`asc-push: no ${LOCALE} localization. Add it in App Store Connect, or pass --locale.`);
  process.exit(1);
}

const a = listing.apple;
const s = listing.shared;

const plan = [
  { id: infoLoc.id, kind: "appInfoLocalizations", label: "app info", fields: {
    name: a.name,
    subtitle: a.subtitle,
    privacyPolicyUrl: s.privacyPolicyUrl,
  } },
  { id: verLoc.id, kind: "appStoreVersionLocalizations", label: "version", fields: {
    description: a.description,
    keywords: a.keywords,
    promotionalText: a.promotionalText,
    whatsNew: a.whatsNew,
    supportUrl: s.supportUrl,
    marketingUrl: s.supportUrl,
  } },
];

let changes = 0;
if (TEXT) {
  for (const group of plan) {
    const current = group.kind === "appInfoLocalizations" ? infoLoc.attributes : verLoc.attributes;
    const diff = {};
    for (const [k, v] of Object.entries(group.fields)) {
      if ((current[k] ?? "") !== v) diff[k] = v;
    }
    const keys = Object.keys(diff);
    if (!keys.length) { console.log(`  = ${group.label}: already matches listing.json`); continue; }
    changes += keys.length;
    for (const k of keys) {
      const was = current[k] ?? "";
      const short = (t) => (t.length > 60 ? `${t.slice(0, 57)}…` : t).replace(/\n/g, "⏎");
      console.log(`  ${APPLY ? "✓" : "+"} ${group.label}.${k}: "${short(was)}" → "${short(diff[k])}"`);
    }
    if (APPLY) {
      await call("PATCH", `/v1/${group.kind}/${group.id}`, {
        data: { type: group.kind, id: group.id, attributes: diff },
      });
    }
  }
}

// ── the age rating ──────────────────────────────────────────────────
// One PATCH against the version's own ageRatingDeclaration. The
// declaration always exists — Apple creates it with the version — so this
// is an update and never a create, and the id has to be read rather than
// guessed.
//
// The `$`-prefixed keys in app-privacy.json are commentary for whoever
// reviews the file, not fields. Filtering them here rather than stripping
// them from the file keeps the reasoning next to the value it explains,
// which is the whole reason that file is readable at all.
if (AGE_RATING) {
  const decl = version.relationships?.ageRatingDeclaration?.data;
  if (!decl) {
    console.error(
      "asc-push: this App Store version has no ageRatingDeclaration.\n"
      + "    Apple creates one with the version, so its absence means the version\n"
      + "    fetch did not include relationships — not that the rating is unset.",
    );
    process.exit(1);
  }
  const want = Object.fromEntries(
    Object.entries(privacy.ageRating).filter(([k]) => !k.startsWith("$")),
  );
  const current = (await call("GET", `/v1/ageRatingDeclarations/${decl.id}`)).data.attributes || {};
  const diff = {};
  for (const [k, v] of Object.entries(want)) {
    if (current[k] !== v) diff[k] = v;
  }
  const keys = Object.keys(diff);
  if (!keys.length) {
    console.log("  = age rating: already matches app-privacy.json");
  } else {
    changes += keys.length;
    for (const k of keys) {
      console.log(`  ${APPLY ? "✓" : "+"} ageRating.${k}: ${JSON.stringify(current[k])} → ${JSON.stringify(diff[k])}`);
    }
    if (APPLY) {
      await call("PATCH", `/v1/ageRatingDeclarations/${decl.id}`, {
        data: { type: "ageRatingDeclarations", id: decl.id, attributes: diff },
      });
    }
  }
}

// ── the privacy nutrition label ─────────────────────────────────────
// Modelled as a SET rather than a record: each declared (category, type,
// linked, purpose) combination is its own appDataUsage row, and "not
// collected" is the absence of a row rather than a row saying no. So the
// reconciliation is add-missing / delete-extra, and the delete half is the
// one that matters — a row Apple has that this file does not is an
// over-declaration nobody would notice, because the form shows what is
// there and never what should not be.
//
// DATA_NOT_COLLECTED is Apple's one explicit row, used when the whole
// label is empty. This app collects seven things, so it never applies
// here; it is named because its absence looks like an oversight.
if (PRIVACY) {
  if (privacy.tracking.used !== false) {
    console.error(
      "asc-push: app-privacy.json says tracking.used is not false.\n"
      + "    Tracking gates every other row on this form and changing it is a\n"
      + "    decision with an ATT prompt attached. This script will not push it —\n"
      + "    make that change deliberately in App Store Connect.",
    );
    process.exit(1);
  }

  const existing = await call(
    "GET", `/v1/apps/${app.id}/appDataUsages?limit=200&include=category,dataProtections,purposes`,
  );

  // The key has to describe the whole row, because two rows can share a
  // category and type and differ only in purpose — and deleting the wrong
  // one silently under-declares.
  const keyOf = (cat, type, prot, purp) => `${cat}|${type}|${prot}|${purp ?? ""}`;
  const wanted = new Map();
  for (const row of privacy.collected) {
    const prot = row.linked ? "DATA_LINKED_TO_YOU" : "DATA_NOT_LINKED_TO_YOU";
    for (const purpose of row.purposes) {
      wanted.set(keyOf(row.category, row.type, prot, purpose), { row, prot, purpose });
    }
    // Tracking is uniformly off (asserted above), and Apple models that as
    // a protection row rather than a flag on the type.
    wanted.set(keyOf(row.category, row.type, "DATA_NOT_USED_TO_TRACK_YOU", null), {
      row, prot: "DATA_NOT_USED_TO_TRACK_YOU", purpose: null,
    });
  }

  const have = new Map();
  for (const u of existing.data || []) {
    const rel = u.relationships || {};
    const cat = rel.category?.data?.id;
    const prot = rel.dataProtections?.data?.[0]?.id;
    const purp = rel.purposes?.data?.[0]?.id ?? null;
    // Apple's category ids are dotted enums ("IDENTIFIERS.USER_ID"); the
    // file names the two halves separately because that is how the form
    // reads.
    const [category, type] = String(cat || "").split(".");
    have.set(keyOf(category, type, prot, purp), u.id);
  }

  const toAdd = [...wanted.keys()].filter((k) => !have.has(k));
  const toDelete = [...have.keys()].filter((k) => !wanted.has(k));

  if (!toAdd.length && !toDelete.length) {
    console.log(`  = privacy label: already matches app-privacy.json (${wanted.size} row(s))`);
  } else {
    changes += toAdd.length + toDelete.length;
    for (const k of toAdd) console.log(`  ${APPLY ? "✓" : "+"} privacy row ADD    ${k}`);
    for (const k of toDelete) console.log(`  ${APPLY ? "✓" : "-"} privacy row REMOVE ${k}`);
    if (APPLY) {
      for (const k of toDelete) await call("DELETE", `/v1/appDataUsages/${have.get(k)}`);
      for (const k of toAdd) {
        const { row, prot, purpose } = wanted.get(k);
        await call("POST", "/v1/appDataUsages", {
          data: {
            type: "appDataUsages",
            relationships: {
              app: { data: { type: "apps", id: app.id } },
              category: { data: { type: "appDataUsageCategories", id: `${row.category}.${row.type}` } },
              dataProtections: { data: [{ type: "appDataUsageDataProtections", id: prot }] },
              ...(purpose
                ? { purposes: { data: [{ type: "appDataUsagePurposes", id: purpose }] } }
                : {}),
            },
          },
        });
      }
    }
  }
}

const still = [
  !SCREENSHOTS && "screenshots (--screenshots to see what is there)",
  "submitting for review — deliberately manual, it is the irreversible one",
].filter(Boolean).join("; ");

console.log(
  !changes
    ? "\nasc-push: nothing to do — App Store Connect already matches the repo."
    : APPLY
      ? `\nasc-push: ${changes} change(s) applied. Still yours: ${still}.`
      : `\nasc-push: ${changes} change(s) would be made. Re-run with --apply.`,
);
