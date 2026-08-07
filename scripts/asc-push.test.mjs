// asc-push.test.mjs — exercise scripts/asc-push.mjs against a stub API.
//
// WHY A STUB. This script's only real target is the owner's live App Store
// listing. There is no sandbox account, and the first real run would be
// against the thing it could damage — so the alternative to a stub here is
// shipping the request shapes unverified, which is how the previous version
// of this file shipped (verified once by hand, against a stub that was never
// committed, and therefore never run again).
//
// What the stub proves: the JWT is well-formed and ES256, the right version
// is chosen, fields land on the right resource, --apply gates every write,
// and the privacy report covers every declared row while writing nothing.
// What it cannot prove: that Apple accepts these shapes. That is stated in
// docs/STORE-FORMS.md rather than implied by a green test.
//
// THE STUB IS STRICT ON PURPOSE, and each strictness was bought. It used to
// answer 200 to anything, which let three separate paths ship green and fail
// in production: an `?include=` Apple rejects with a 400, a GET of a
// write-only resource it rejects with a 403, and a whole resource that does
// not exist, rejected with a 404. Each is now modelled with Apple's own
// error. A lenient stub does not test a client — it tests itself.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync, writeFileSync, rmSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(root, "scripts/asc-push.mjs");

// A real EC P-256 key, generated per run. Using a fixture would mean
// committing something shaped exactly like a credential.
const { privateKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const APP_ID = "app-1";
const VERSION_ID = "ver-1";
const DECL_ID = "decl-1";

let server, base, received;

/** Age-rating attributes the stub pretends are already set. */
let existingRating = {};
/**
 * Whether the stub is a FIRST release, which is what the owner's app
 * actually is — so this defaults to the state production is in. Apple
 * refuses `whatsNew` there: "What's New in This Version" has no meaning
 * without a previous version, and it answers 409 naming the attribute.
 */
let refuseWhatsNew = true;
/** Makes the app-info PATCH 409 too, to prove the skip is scoped. */
let failNextAppInfoPatch = false;

/**
 * The attributes Apple's 409 named, verbatim and in its order. Exactly
 * these eight rather than all twenty-two: these are what a live PATCH
 * actually complained about, and the other fourteen were in the body so
 * nothing was observed about them. Asserting more than was measured is how
 * a stub starts testing itself.
 */
const AGE_RATING_REQUIRED = [
  "ageAssurance", "userGeneratedContent", "lootBox", "messagingAndChat",
  "healthOrWellnessTopics", "parentalControls", "gunsOrOtherWeapons", "advertising",
];

function json(res, body) {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      // The screenshot PUTs carry raw PNG bytes, so the body is not always
      // JSON — parse defensively and record the byte length instead, which
      // is the property those assertions care about anyway.
      let parsed = null;
      if (body) {
        try { parsed = JSON.parse(body); } catch { parsed = { rawBytes: Buffer.byteLength(body) }; }
      }
      received.push({
        method: req.method,
        path: url.pathname,
        auth: req.headers.authorization,
        body: parsed,
      });

      if (url.pathname === "/v1/apps") {
        return json(res, { data: [{ id: APP_ID, attributes: { name: "InSight" } }] });
      }
      // Apple VALIDATES ?include= against the relationships a resource
      // actually has, and answers 400 for anything else. The stub did not,
      // which is precisely why asc-push shipped
      // `appStoreVersions?include=ageRatingDeclaration` green and died on
      // the first real call. A stub that accepts more than the real API is
      // not a lenient stub, it is a broken test.
      const VALID_INCLUDES = {
        [`/v1/apps/${APP_ID}/appStoreVersions`]: new Set(["appStoreVersionLocalizations", "build"]),
        [`/v1/apps/${APP_ID}/appInfos`]: new Set(["ageRatingDeclaration", "appInfoLocalizations"]),
      };
      const asked = url.searchParams.get("include");
      if (asked && VALID_INCLUDES[url.pathname]) {
        const bad = asked.split(",").find((n) => !VALID_INCLUDES[url.pathname].has(n.trim()));
        if (bad) {
          res.writeHead(400, { "content-type": "application/json" });
          return res.end(JSON.stringify({
            errors: [{
              title: "A parameter has an invalid value",
              detail: `'${bad}' is not a valid relationship name`,
            }],
          }));
        }
      }

      if (url.pathname === `/v1/apps/${APP_ID}/appStoreVersions`) {
        return json(res, {
          data: [
            // A live version FIRST, to prove the editable one is chosen by
            // state rather than by position.
            { id: "ver-live", attributes: { appStoreState: "READY_FOR_SALE" }, relationships: {} },
            { id: VERSION_ID, attributes: { appStoreState: "PREPARE_FOR_SUBMISSION" }, relationships: {} },
          ],
        });
      }
      if (url.pathname === `/v1/apps/${APP_ID}/appInfos`) {
        // ageRatingDeclaration lives HERE, not on the version — the split
        // Apple actually implements, and the one the 400 above taught.
        //
        // Its ATTRIBUTES ride along in `included`, which is the only way to
        // read them: the resource is write-only (see the 403 below), so a
        // diff is possible solely because this include carries them.
        return json(res, {
          data: [{
            id: "info-1",
            relationships: {
              ageRatingDeclaration: { data: { type: "ageRatingDeclarations", id: DECL_ID } },
            },
          }],
          included: [{ type: "ageRatingDeclarations", id: DECL_ID, attributes: existingRating }],
        });
      }
      if (url.pathname === "/v1/appInfos/info-1/appInfoLocalizations") {
        return json(res, {
          data: [{ id: "iloc-1", attributes: { locale: "en-US", name: "Old Name" } }],
        });
      }
      if (url.pathname === `/v1/appStoreVersions/${VERSION_ID}/appStoreVersionLocalizations`) {
        return json(res, {
          data: [{ id: "vloc-1", attributes: { locale: "en-US", description: "Old desc" } }],
        });
      }
      if (url.pathname === `/v1/ageRatingDeclarations/${DECL_ID}` && req.method === "GET") {
        // Write-only, and the stub has to say so. It used to answer 200 here,
        // which is why asc-push shipped a GET that production rejects — the
        // second time this stub's leniency hid a real 4xx.
        res.writeHead(403, { "content-type": "application/json" });
        return res.end(JSON.stringify({
          errors: [{
            title: "The given operation is not allowed",
            detail: "The resource 'ageRatingDeclarations' does not allow 'GET_INSTANCE'. Allowed operation is: UPDATE",
          }],
        }));
      }
      // App Privacy is not in the API — not under this path, not under any
      // other. The stub answers what production answers, so a rebuilt write
      // path fails here rather than passing against a helpful fiction. This
      // route used to return 200 with a row list, which is precisely why a
      // reconciliation that Apple has no endpoint for shipped green.
      if (url.pathname.includes("appDataUsage") || url.pathname.includes("appPrivacy")) {
        res.writeHead(404, { "content-type": "application/json" });
        return res.end(JSON.stringify({
          errors: [{
            title: "The URL path is not valid",
            detail: `The relationship 'appDataUsages' does not exist for the resource at '${url.pathname}'`,
          }],
        }));
      }
      // Screenshot routes. Empty set list and empty set contents, so every
      // local capture reads as "not yet uploaded".
      if (url.pathname.endsWith("/appScreenshotSets") && req.method === "GET") {
        return json(res, { data: [] });
      }
      if (url.pathname.endsWith("/appScreenshots") && req.method === "GET") {
        return json(res, { data: [] });
      }
      if (url.pathname === "/v1/appScreenshotSets" && req.method === "POST") {
        return json(res, { data: { id: "set-1", attributes: { screenshotDisplayType: "APP_IPHONE_67" } } });
      }
      if (url.pathname === "/v1/appScreenshots" && req.method === "POST") {
        // One upload operation covering the whole file, which is the common
        // shape; the script must still read offset/length rather than assume.
        return json(res, {
          data: {
            id: "shot-1",
            attributes: {
              uploadOperations: [{
                method: "PUT",
                url: `${base}/upload-sink`,
                offset: 0,
                length: JSON.parse(body || "{}").data?.attributes?.fileSize ?? 0,
                requestHeaders: [{ name: "content-type", value: "image/png" }],
              }],
            },
          },
        });
      }
      if (url.pathname === "/upload-sink") {
        res.writeHead(200); return res.end();
      }
      // A PATCH is ATOMIC, and that is the whole reason this route exists:
      // one refused attribute rejects the other five in the same body. The
      // stub accepted everything, so the split that keeps them apart could
      // not be tested — and the run that taught this printed ✓ against five
      // fields it never wrote.
      // Apple REQUIRES every one of these on the declaration and rejects the
      // whole PATCH — one error per missing attribute — if any is absent.
      // That is how eight new fields were discovered: fourteen ✓ printed
      // above a 409 that wrote nothing. The stub enforces it so the file
      // cannot silently fall behind Apple's form a second time.
      if (req.method === "PATCH" && url.pathname.startsWith("/v1/ageRatingDeclarations/")) {
        const sent = parsed?.data?.attributes || {};
        // Satisfied by the body OR by a value already on the declaration —
        // asc-push sends only the diff, and Apple has no reason to demand a
        // field it already holds. Modelled that way rather than "must be in
        // every body", which would be inventing API behaviour nothing
        // observed.
        const missing = AGE_RATING_REQUIRED.filter(
          (k) => sent[k] === undefined && existingRating[k] === undefined,
        );
        if (missing.length) {
          res.writeHead(409, { "content-type": "application/json" });
          return res.end(JSON.stringify({
            errors: missing.map((k) => ({
              title: "The provided entity is missing a required attribute",
              detail: `You must provide a value for the attribute '${k}' with this request`,
            })),
          }));
        }
      }
      if (failNextAppInfoPatch && req.method === "PATCH"
          && url.pathname.startsWith("/v1/appInfoLocalizations/")) {
        res.writeHead(409, { "content-type": "application/json" });
        return res.end(JSON.stringify({
          errors: [{
            title: "The request cannot be fulfilled because of the state of another resource.",
            detail: "Attribute 'subtitle' cannot be edited at this time",
          }],
        }));
      }
      if (refuseWhatsNew && req.method === "PATCH"
          && url.pathname.startsWith("/v1/appStoreVersionLocalizations/")
          && parsed?.data?.attributes?.whatsNew !== undefined) {
        res.writeHead(409, { "content-type": "application/json" });
        return res.end(JSON.stringify({
          errors: [{
            title: "The request cannot be fulfilled because of the state of another resource.",
            detail: "Attribute 'whatsNew' cannot be edited at this time",
          }],
        }));
      }
      // Writes: PATCH / POST / DELETE all just succeed.
      return json(res, { data: {} });
    });
  });
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => server?.close());

async function push(args) {
  received = [];
  const { stdout } = await run("node", [SCRIPT, ...args], {
    env: {
      ...process.env,
      ASC_API_BASE: base,
      ASC_KEY_ID: "ABC1234567",
      ASC_ISSUER_ID: "11111111-2222-3333-4444-555555555555",
      ASC_PRIVATE_KEY: privateKey,
    },
  });
  return stdout;
}

const writes = () => received.filter((r) => r.method !== "GET");

describe("asc-push auth", () => {
  it("signs an ES256 JWT with the key id in the header", async () => {
    await push([]);
    const token = received[0].auth.replace("Bearer ", "");
    const [h, p, sig] = token.split(".");
    const header = JSON.parse(Buffer.from(h, "base64url").toString());
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());

    expect(header).toMatchObject({ alg: "ES256", kid: "ABC1234567", typ: "JWT" });
    expect(payload.aud).toBe("appstoreconnect-v1");
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(1200); // Apple's cap

    // The bug this pins: node's default EC signature is DER, which Apple
    // rejects with an error that reads like a wrong key. JOSE wants raw
    // r||s — 64 bytes for P-256.
    expect(Buffer.from(sig, "base64url")).toHaveLength(64);
  });
});

describe("asc-push text", () => {
  it("is a dry run without --apply", async () => {
    const out = await push([]);
    expect(out).toMatch(/would be made/);
    expect(out).toMatch(/\[DRY RUN\]/);
    expect(writes()).toHaveLength(0);
  });

  it("splits app-level and version-level fields onto the right resources", async () => {
    await push(["--apply"]);
    // MERGED, not last-wins. The version resource is PATCHed twice now (see
    // the whatsNew split), and Object.fromEntries would silently keep only
    // the second body — this assertion would then be about whatsNew while
    // reading as though it were about description.
    const byPath = {};
    for (const w of writes()) byPath[w.path] = { ...byPath[w.path], ...w.body.data.attributes };

    // name belongs to the app and survives versions; description belongs to
    // the version. Sending either to the other is a 409 that reads like a
    // permissions problem.
    expect(byPath["/v1/appInfoLocalizations/iloc-1"]).toHaveProperty("name");
    expect(byPath["/v1/appInfoLocalizations/iloc-1"]).not.toHaveProperty("description");
    expect(byPath["/v1/appStoreVersionLocalizations/vloc-1"]).toHaveProperty("description");
    expect(byPath["/v1/appStoreVersionLocalizations/vloc-1"]).not.toHaveProperty("name");
  });

  it("picks the editable version, not the live one", async () => {
    await push(["--apply"]);
    expect(received.some((r) => r.path.includes("ver-live"))).toBe(false);
  });

  it("keeps whatsNew out of the body that carries the other five", async () => {
    // The failure this pins cost a real run: whatsNew rode along with
    // description, keywords, promotionalText, supportUrl and marketingUrl,
    // Apple refused the one, and the atomic PATCH dropped all six.
    await push(["--apply"]);
    const version = writes().filter((w) => w.path === "/v1/appStoreVersionLocalizations/vloc-1");
    expect(version).toHaveLength(2);
    const withNew = version.find((w) => "whatsNew" in w.body.data.attributes);
    expect(Object.keys(withNew.body.data.attributes)).toEqual(["whatsNew"]);
    const rest = version.find((w) => w !== withNew);
    expect(Object.keys(rest.body.data.attributes).sort()).toEqual([
      "description", "keywords", "marketingUrl", "promotionalText", "supportUrl",
    ]);
  });

  it("reports the whatsNew refusal as a skip and still counts the five that landed", async () => {
    refuseWhatsNew = true;
    const out = await push(["--apply"]);
    expect(out).toMatch(/skipped\. Apple refuses `whatsNew` on a first release/);
    // Ticked, because they were written — the five are in their own PATCH.
    expect(out).toMatch(/✓ version\.description/);
    // NOT ticked, because it was not.
    expect(out).not.toMatch(/✓ version\.whatsNew/);
    // And the count excludes it: 3 app-info + 5 version.
    expect(out).toMatch(/8 change\(s\) applied/);
  });

  it("ticks whatsNew once Apple allows it — the skip is conditional, not permanent", async () => {
    // Otherwise "handled" would mean "never sent again", and the first real
    // UPDATE would silently ship last release's notes.
    refuseWhatsNew = false;
    try {
      const out = await push(["--apply"]);
      expect(out).toMatch(/✓ version\.whatsNew/);
      expect(out).not.toMatch(/skipped/);
      expect(out).toMatch(/9 change\(s\) applied/);
    } finally {
      refuseWhatsNew = true;
    }
  });

  it("does not swallow a 409 on anything but whatsNew", async () => {
    // The skip is scoped to one field and one status. A blanket catch here
    // would turn every state conflict Apple has into a green run — which is
    // the leniency this file's stub notes spend three paragraphs on.
    failNextAppInfoPatch = true;
    try {
      const err = await push(["--apply"]).then(() => null, (e) => e);
      expect(err, "expected a non-zero exit").not.toBeNull();
      expect(String(err.stderr)).toMatch(/→ 409/);
      // …and nothing claimed success on the way out.
      expect(String(err.stdout)).not.toMatch(/✓ app info\./);
    } finally {
      failNextAppInfoPatch = false;
    }
  });
});

describe("asc-push age rating", () => {
  it("patches only the values that differ, and strips $-commentary", async () => {
    existingRating = { violenceCartoonOrFantasy: "NONE", gambling: true };
    const out = await push(["--age-rating", "--apply"]);

    const patch = writes().find((w) => w.path === `/v1/ageRatingDeclarations/${DECL_ID}`);
    const attrs = patch.body.data.attributes;

    expect(Object.keys(attrs).some((k) => k.startsWith("$"))).toBe(false);
    // Already NONE upstream, so it is not resent.
    expect(attrs).not.toHaveProperty("violenceCartoonOrFantasy");
    // Differs upstream, so it is corrected.
    expect(attrs.gambling).toBe(false);
    expect(out).toMatch(/ageRating\.gambling/);
  });

  it("does not touch listing text when only the rating was asked for", async () => {
    existingRating = {};
    await push(["--age-rating", "--apply"]);
    expect(writes().every((w) => !w.path.includes("Localizations"))).toBe(true);
  });

  it("answers every attribute Apple requires", async () => {
    // The gap this closes: app-privacy.json answered fourteen fields while
    // Apple required twenty-two, and the eight missing ones rejected the
    // whole PATCH. The stub 409s the same way, so a field dropped from the
    // file fails here instead of on a live listing.
    existingRating = {};
    const out = await push(["--age-rating", "--apply"]);
    const patch = writes().find((w) => w.path === `/v1/ageRatingDeclarations/${DECL_ID}`);
    for (const k of AGE_RATING_REQUIRED) {
      expect(patch.body.data.attributes, `${k} missing from the PATCH`).toHaveProperty(k);
    }
    // The two that carry a real claim rather than an absence.
    expect(patch.body.data.attributes.userGeneratedContent).toBe(true);
    expect(patch.body.data.attributes.messagingAndChat).toBe(false);
    // A frequency enum, not a boolean — guessing the type here is a 400
    // that reads like a wrong value.
    expect(patch.body.data.attributes.gunsOrOtherWeapons).toBe("NONE");
    expect(out).toMatch(/✓ ageRating\.userGeneratedContent/);
  });

  it("ticks nothing when the declaration PATCH is rejected", async () => {
    // The failure that produced D74's second site: fourteen ✓ printed above
    // a 409 that wrote none of them. Driven by dropping a required field,
    // which is exactly how it happened.
    const fixture = join(tmpdir(), `agerating-${process.pid}.json`);
    const real = JSON.parse(readFileSync(join(root, "design/store/app-privacy.json"), "utf8"));
    delete real.ageRating.userGeneratedContent;
    writeFileSync(fixture, JSON.stringify(real));
    try {
      existingRating = {};
      const err = await push(["--age-rating", "--apply", "--privacy-file", fixture])
        .then(() => null, (e) => e);
      expect(err, "expected a non-zero exit").not.toBeNull();
      expect(String(err.stderr)).toMatch(/must provide a value for the attribute 'userGeneratedContent'/);
      expect(String(err.stdout)).not.toMatch(/✓ ageRating\./);
    } finally {
      rmSync(fixture, { force: true });
    }
  });
});

describe("asc-push screenshots", () => {
  // A fixture, NOT design/store/screenshots/. Those PNGs are gitignored —
  // build output, regenerated by the workflow — so reading them made these
  // tests pass on a machine that had run the harness and fail in CI, which
  // is exactly what happened. A test that depends on a file the repo does
  // not carry is testing the machine, not the code.
  let shotsDir;
  const PNG_1x1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );

  beforeAll(() => {
    shotsDir = mkdtempSync(join(tmpdir(), "asc-shots-"));
    const profile = join(shotsDir, "iphone-6.9");
    mkdirSync(profile, { recursive: true });
    // Padded so the reserve step's fileSize assertion is meaningful — a
    // 68-byte PNG would pass a "greater than zero" check that a truncated
    // read would also pass.
    const bytes = Buffer.concat([PNG_1x1, Buffer.alloc(4096)]);
    for (const f of ["01-daily.png", "02-reveal.png", "03-mirror.png"]) {
      writeFileSync(join(profile, f), bytes);
    }
    writeFileSync(join(shotsDir, "manifest.json"), JSON.stringify({
      mode: "demo",
      profiles: {
        "iphone-6.9": {
          shots: [
            { file: "01-daily.png", scene: "daily" },
            // The one the real manifest flags, for the same reason.
            { file: "02-reveal.png", scene: "reveal", demoOnlyAffordances: ["Comments", "Who voted what"] },
            { file: "03-mirror.png", scene: "mirror" },
          ],
        },
      },
    }));
  });
  afterAll(() => shotsDir && rmSync(shotsDir, { recursive: true, force: true }));

  const shots = (args) => push(["--screenshots", "--screenshots-dir", shotsDir, ...args]);

  // The committed manifest flags 02-reveal as showing Comments and "Who
  // voted" — controls gated on !S.live by D1, which a real user never sees
  // on a live question. Uploading it is an App Store 2.3.3 rejection that
  // arrives days later, so refusing is worth more than warning.
  it("refuses to upload a capture the manifest flags as demo-only UI", async () => {
    const err = await shots(["--apply"]).then(() => null, (e) => e);
    expect(err, "expected a non-zero exit").not.toBeNull();
    expect(String(err.stderr)).toMatch(/02-reveal\.png/);
    expect(String(err.stderr)).toMatch(/2\.3\.3/);
    // And it must not have uploaded anything else first.
    expect(writes()).toHaveLength(0);
  });

  it("--allow-demo overrides, because the refusal is a default and not a law", async () => {
    const out = await shots(["--allow-demo"]);
    expect(out).toMatch(/would upload/);
    expect(writes()).toHaveLength(0);   // still a dry run
  });

  it("is a dry run without --apply even when nothing is flagged", async () => {
    const out = await shots(["--allow-demo"]);
    expect(out).toMatch(/\+ upload 01-daily\.png/);
    expect(writes()).toHaveLength(0);
  });

  it("reserves, sends the bytes Apple asked for, then commits with a checksum", async () => {
    const out = await shots(["--allow-demo", "--apply"]);
    const w = writes();

    // The set is created once, not per image.
    expect(w.filter((x) => x.path === "/v1/appScreenshotSets")).toHaveLength(1);

    const reserves = w.filter((x) => x.path === "/v1/appScreenshots" && x.method === "POST");
    const commits = w.filter((x) => x.path.startsWith("/v1/appScreenshots/") && x.method === "PATCH");
    const puts = w.filter((x) => x.path === "/upload-sink");

    // Six captures in design/store/screenshots/iphone-6.9/.
    expect(reserves.length).toBeGreaterThan(0);
    expect(puts).toHaveLength(reserves.length);
    expect(commits).toHaveLength(reserves.length);

    // Reserve declares the real byte length, so a truncated read would show
    // up here rather than as a corrupt image in the store.
    for (const r of reserves) expect(r.body.data.attributes.fileSize).toBeGreaterThan(1000);

    // Commit carries uploaded:true AND a 32-char md5 — Apple verifies the
    // bytes against it, so an omitted checksum is an asset stuck in
    // UPLOAD_COMPLETE forever rather than an error.
    for (const c of commits) {
      expect(c.body.data.attributes.uploaded).toBe(true);
      expect(c.body.data.attributes.sourceFileChecksum).toMatch(/^[0-9a-f]{32}$/);
    }
    expect(out).toMatch(/screenshot\(s\) uploaded/);
  });

  it("names the display type it will use, so a wrong one is visible before the write", async () => {
    const out = await shots(["--allow-demo", "--display-type", "APP_IPHONE_69"]);
    expect(out).toMatch(/APP_IPHONE_69/);
  });
});

// The privacy label is a REPORT. Apple's API has no App Privacy resource —
// see the --privacy block in asc-push.mjs for the three ways that was
// established — so what these pin is that the script writes nothing, and
// that what it prints is the whole form rather than a convenient subset.
describe("asc-push privacy label", () => {
  it("writes nothing, even with --apply, because there is no endpoint to write to", async () => {
    // The regression that matters. A reconciliation against `appDataUsages`
    // shipped three times and failed in production three times (400, 403,
    // 404); if one comes back, the stub's 404 makes this red rather than
    // letting it pass against a helpful fiction.
    await push(["--privacy", "--apply"]);
    expect(writes()).toHaveLength(0);
  });

  it("prints exactly the rows app-privacy.json lists, and never Precise Location", async () => {
    // A whole-set assertion rather than spot checks: under-declaring is the
    // direction that gets an app pulled, so "these seven and no others" is
    // the property worth pinning — and it is the same property whether the
    // rows go over the wire or onto someone's screen.
    const out = await push(["--privacy"]);
    const declared = JSON.parse(
      readFileSync(join(root, "design/store/app-privacy.json"), "utf8"),
    );
    for (const row of declared.collected) {
      // "IDENTIFIERS" → "Identifiers", "USER_ID" → "User Id".
      const label = (s) => s.toLowerCase().split("_")
        .map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
      expect(out, `${row.category}.${row.type} missing from the form`)
        .toContain(`${label(row.category)} › ${label(row.type)}`);
    }
    expect(out).not.toMatch(/Precise Location/);
    // The tracking answer gates the whole form, so it is printed first and
    // by name rather than left for the reader to infer from the rows.
    expect(out).toMatch(/Tracking: No/);
    expect(out).toMatch(/linked to identity: Yes/);
  });

  it("warns rather than printing a form that omits the tracking question", async () => {
    // The rows this prints carry no per-row tracking answer, because the
    // file models tracking as uniformly off. Flip that and the form asks
    // something the report does not cover — silence there would be the
    // under-declaration app-privacy.json spends a paragraph warning about.
    //
    // It used to exit 1 here. That was right while this pushed; a report
    // that refuses to print is just a report nobody can read.
    const fixture = join(tmpdir(), `privacy-tracking-${process.pid}.json`);
    const real = JSON.parse(readFileSync(join(root, "design/store/app-privacy.json"), "utf8"));
    writeFileSync(fixture, JSON.stringify({ ...real, tracking: { used: true } }));
    try {
      const out = await push(["--privacy", "--privacy-file", fixture]);
      expect(out).toMatch(/Tracking: YES/);
      expect(out).toMatch(/PER ROW/);
      expect(out).not.toMatch(/used for tracking:\s+No/);
    } finally {
      rmSync(fixture, { force: true });
    }
  });

  it("does not request a privacy path at all, under any name", async () => {
    // Not just "makes no writes" — makes no REQUEST. The 404 that ended
    // this was on a GET, and a reader-only version of the old block would
    // have passed a writes-only assertion while still dying in production.
    await push(["--privacy", "--apply"]);
    expect(received.filter((r) => /appDataUsage|appPrivacy/i.test(r.path))).toEqual([]);
  });

  it("never reports 'nothing to do' while a hand-entered form is outstanding", async () => {
    // With only --privacy selected the write count is zero by construction.
    // The closing line used to read "nothing to do — App Store Connect
    // already matches the repo", which is a false statement about a form
    // that has not been touched.
    const out = await push(["--privacy"]);
    expect(out).not.toMatch(/nothing to do/);
    expect(out).toMatch(/Still yours:.*privacy label/);
  });
});

// --all is the workflow's default selection, and it had no test until now.
// Every one of the three production failures that shaped this file happened
// in --all: the `include=` 400, the write-only 403 and the appDataUsages 404.
// Each was reachable from the bench the day it was written; nothing here
// looked. One case covering the composite mode is the cheapest guard against
// a fourth, because the strict stub already models all three refusals.
describe("asc-push --all", () => {
  it("writes the text and the age rating, prints the privacy form, and asks Apple for nothing that does not exist", async () => {
    existingRating = {};
    const out = await push(["--all", "--apply"]);

    const paths = writes().map((w) => w.path);
    expect(paths).toContain("/v1/appInfoLocalizations/iloc-1");
    expect(paths).toContain(`/v1/appStoreVersionLocalizations/vloc-1`);
    expect(paths).toContain(`/v1/ageRatingDeclarations/${DECL_ID}`);

    // The whole point of the strict stub: any request to a resource Apple
    // does not have would have 404'd above and failed this before reaching
    // the assertion.
    expect(received.filter((r) => /appDataUsage|appPrivacy/i.test(r.path))).toEqual([]);

    // All three halves reported in one run.
    expect(out).toMatch(/ageRating\./);
    expect(out).toMatch(/App Privacy — App Store Connect/);
    expect(out).toMatch(/change\(s\) applied/);
    // …and the closing line still names what a green --all leaves undone.
    expect(out).toMatch(/Still yours:.*privacy label/);
  });
});
