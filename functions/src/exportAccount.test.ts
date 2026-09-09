// exportAccount.test.ts — the export walks the graph the erasure walks, and
// carries nobody else's.
//
// WHY THIS FILE EXISTS. `exportAccountV2` is the mechanism behind a promise
// `web/terms.html` has made since it was written, and the shape of the
// failure it can grow is silent: a wipe phase added to deleteAccount with no
// section here means the export says "everything" and hands over less. The
// first case reads `index.ts` and refuses a `failed` label `TWIN` does not
// name, so the two walks cannot drift apart without a red test.
//
// The seed is the erasure e2e's graph at a smaller scale, with the same
// discipline: every section has a document of the caller's AND a control of
// somebody else's, because an export that copies a collection instead of
// a uid's rows would pass every "is mine there" assertion and be a leak.
//
// WHAT THE FAKE IS AND IS NOT. Firestore's plumbing — paths, queries with
// the three operators the walk uses, subcollection listing, collection
// groups — over one Map. Not its semantics: no indexes, no transactions.
// The emulator leg (firestore-tests/e2e-delete-account.mjs) runs the real
// callable against the real database, before the erasure it twins.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { Timestamp } from "firebase-admin/firestore";

type Doc = Record<string, unknown>;
const store = new Map<string, Doc>();
const objects = new Map<string, Buffer>();

const parts = (path: string) => path.split("/");
const parentPath = (path: string) => parts(path).slice(0, -1).join("/");

function snapOf(path: string) {
  const data = store.get(path);
  return {
    id: parts(path).pop() as string,
    ref: refOf(path),
    exists: data !== undefined,
    data: () => (data ? { ...data } : undefined),
    get: (f: string) => data?.[f],
  };
}

type Filter = [string, string, unknown];
function matches(data: Doc, [f, op, v]: Filter): boolean {
  const got = data[f];
  if (op === "==") return got === v;
  if (op === "array-contains") return Array.isArray(got) && got.includes(v);
  if (op === "in") return Array.isArray(v) && v.includes(got);
  throw new Error(`fake: unsupported operator ${op}`);
}

/** A query over the store: a collection (by parent path) or a group (by collection id). */
function queryOf(
  scope: { parent: string } | { group: string },
  filters: Filter[] = [],
  limit: number | null = null,
  after: string | null = null,
) {
  const q = {
    where: (f: string, op: string, v: unknown) => queryOf(scope, [...filters, [f, op, v]], limit, after),
    orderBy: () => queryOf(scope, filters, limit, after),
    limit: (n: number) => queryOf(scope, filters, n, after),
    startAfter: (s: { ref: { path: string } }) => queryOf(scope, filters, limit, s.ref.path),
    get: async () => {
      let paths = [...store.keys()].filter((p) => (
        "parent" in scope ? parentPath(p) === scope.parent : parts(p).at(-2) === scope.group
      ));
      paths = paths.filter((p) => filters.every((fl) => matches(store.get(p) as Doc, fl))).sort();
      if (after) paths = paths.filter((p) => p > after);
      if (limit !== null) paths = paths.slice(0, limit);
      const docs = paths.map(snapOf);
      return { docs, size: docs.length, empty: docs.length === 0 };
    },
  };
  return q;
}

function colOf(path: string) {
  return {
    id: parts(path).pop() as string,
    path,
    doc: (id: string) => refOf(`${path}/${id}`),
    listDocuments: async () => [...store.keys()].filter((p) => parentPath(p) === path).sort().map(refOf),
    ...queryOf({ parent: path }),
  };
}

function refOf(path: string): {
  path: string; id: string; parent: { id: string; parent: ReturnType<typeof refOf> | null };
  get: () => Promise<ReturnType<typeof snapOf>>;
  collection: (name: string) => ReturnType<typeof colOf>;
  listCollections: () => Promise<ReturnType<typeof colOf>[]>;
} {
  const ps = parts(path);
  return {
    path,
    id: ps[ps.length - 1],
    parent: { id: ps[ps.length - 2], parent: ps.length >= 3 ? refOf(ps.slice(0, -2).join("/")) : null },
    get: async () => snapOf(path),
    collection: (name: string) => colOf(`${path}/${name}`),
    listCollections: async () => {
      const ids = new Set<string>();
      for (const p of store.keys()) {
        if (!p.startsWith(path + "/")) continue;
        const rest = p.slice(path.length + 1).split("/");
        if (rest.length >= 2) ids.add(rest[0]);
      }
      return [...ids].sort().map((id) => colOf(`${path}/${id}`));
    },
  };
}

const fakeDb = {
  collection: (name: string) => colOf(name),
  collectionGroup: (name: string) => queryOf({ group: name }),
  doc: (path: string) => refOf(path),
  getAll: async (...refs: { path: string }[]) => refs.map((r) => snapOf(r.path)),
};

vi.mock("./db", () => ({ db: () => fakeDb, FIRESTORE_DB_ID: "insight" }));
vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    getUser: async (uid: string) => ({
      uid,
      email: `${uid}@example.com`,
      emailVerified: true,
      displayName: "Me",
      providerData: [{ providerId: "google.com", email: `${uid}@example.com`, displayName: "Me" }],
      metadata: { creationTime: "Mon, 01 Sep 2026 00:00:00 GMT", lastSignInTime: "Tue, 08 Sep 2026 00:00:00 GMT" },
    }),
  }),
}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => ({
      file: (name: string) => ({
        exists: async () => [objects.has(name)],
        download: async () => [objects.get(name)],
        getMetadata: async () => [{ contentType: "image/jpeg" }],
      }),
    }),
  }),
}));

const { buildExport, exportAccountV2, toPlain, TWIN, EXPORT_TOO_LARGE, EXPORT_MAX_BYTES } =
  await import("./exportAccount");

const ME = "u_me";
const OTHER = "u_other";
const DAY = "2026-09-08";

/** The erasure e2e's graph, smaller, with a control of OTHER's beside every row. */
function seed() {
  store.clear();
  objects.clear();
  const set = (path: string, data: Doc) => store.set(path, data);

  // 1b — the v2 subtree, and the one subcollection the export must skip.
  set(`v2_users/${ME}`, { displayName: "Me", anon: false, testResults: { big5: { dims: [] } } });
  set(`v2_users/${ME}/answers/daily-000`, { qid: "daily-000", optionIdx: 1, answeredAt: Timestamp.fromMillis(1_700_000_000_000) });
  set(`v2_users/${ME}/answers/learn-cell1`, { qid: "learn-cell1", surface: "learn", optionIdx: 2 });
  set(`v2_users/${ME}/patterns/state`, { v: [0, 0], n: 1, a: { "daily-000": 1 } });
  set(`v2_users/${ME}/taste/profile`, { t: { food: 3 }, n: 4 });
  set(`v2_users/${ME}/following/${OTHER}`, { to: OTHER });
  set(`v2_users/${ME}/push/tokens`, { token: "secret-push-token" });
  set(`v2_users/${OTHER}`, { displayName: "Them" });
  set(`v2_users/${OTHER}/answers/daily-000`, { qid: "daily-000", optionIdx: 0, note: "somebody else's answer" });
  set(`v2_users/${OTHER}/following/${ME}`, { to: ME });
  set(`v2_users/${OTHER}/following/u_third`, { to: "u_third" });
  // 1 — the journal-era subtree.
  set(`insight_users/${ME}`, { sharePrefs: {} });
  set(`insight_users/${ME}/insight_daily/${DAY}`, { date: DAY, mood: 60 });
  set(`insight_users/${OTHER}/insight_inbound_impressions/i1`, { senderUid: ME, traits: ["kind"] });
  set(`insight_users/${OTHER}/insight_inbound_impressions/i2`, { senderUid: "u_third", traits: ["loud"] });
  set(`insight_users/${OTHER}/relations/r1`, { linkedUid: ME });
  set(`insight_users/${OTHER}/relations/r2`, { linkedUid: "u_third" });
  // 1a, 1a′ — the ledger and the voter samples.
  set("v2_agg_events/evt_mine", { qid: "daily-000", uid: ME });
  set("v2_agg_events/evt_theirs", { qid: "daily-000", uid: OTHER });
  set("v2_patterns/sample-daily-000", { rows: { [ME]: { o: 1, d: DAY }, [OTHER]: { o: 0, d: DAY } }, n: 2 });
  set("v2_patterns/loadings", { q: {} });
  // 1b1 — the logic attempt, seed included.
  set(`v2_logic_attempts/${ME}`, { seed: 7, gv: 2, status: "scored", score: 9 });
  // 1b2 — takes, flags in every direction, the face, the cell.
  set("v2_takes/take_mine", { authorUid: ME, qid: "q1", text: "my words" });
  set("v2_takes/take_theirs", { authorUid: OTHER, qid: "q1", text: "someone else's words" });
  set(`v2_flags/take_mine_${ME}`, { takeId: "take_mine", uid: ME });
  set(`v2_flags/take_mine_${OTHER}`, { takeId: "take_mine", uid: OTHER });
  set(`v2_flags/take_theirs_${ME}`, { takeId: "take_theirs", uid: ME });
  set(`v2_flags/av_${ME}_${OTHER}`, { takeId: `av_${ME}`, target: ME, uid: OTHER });
  set(`v2_avatars/${ME}`, { token: "tok0", hidden: false });
  set(`v2_avatars/${OTHER}`, { token: "tok1", hidden: false });
  objects.set(`avatars/${ME}`, Buffer.from([0xff, 0xd8, 0xff]));
  set(`v2_presence/${ME}`, { cell: "5999_1074", until: Timestamp.fromDate(new Date("2026-09-08T12:00:00Z")) });
  set("v2_presence_room/5999_1074", { people: [{ uid: ME }, { uid: OTHER }] });
  // 1c, 1c-bis — circles in every relation the erasure distinguishes.
  set("v2_groups/g_solo", { name: "Solo", mode: "group", ownerUid: ME, memberUids: [ME], played: { r3: [ME] }, pushAt: { [ME]: 5 } });
  set(`v2_groups/g_solo/reveals/${DAY}`, { day: DAY, qid: "gq", votes: { [ME]: { optionIdx: 1 } }, names: { [ME]: "Me" }, members: [ME] });
  set("v2_groups/g_shared", {
    name: "Shared", mode: "group", ownerUid: OTHER, memberUids: [ME, OTHER],
    memberJoinedAt: { [ME]: 5, [OTHER]: 1 }, memberNames: { [ME]: "Me", [OTHER]: "Them" },
    // The role ledger (D445): one row per member. OTHER's is the only row
    // anywhere with a `hands` seat, which is what the leak case greps for.
    ledger: { [ME]: { votes: 4, seats: { engine: 3, heart: 1 } }, [OTHER]: { votes: 2, seats: { hands: 2 } } },
  });
  set(`v2_groups/g_shared/reveals/${DAY}`, {
    day: DAY, qid: "gq",
    votes: { [ME]: { optionIdx: 0 }, [OTHER]: { optionIdx: 1, pickUid: ME } },
    names: { [ME]: "Me", [OTHER]: "Them" }, members: [ME, OTHER],
  });
  set(`v2_groups/g_shared/reveals/2026-09-01`, {
    day: "2026-09-01", qid: "gq", votes: { [OTHER]: { optionIdx: 1 } }, names: { [OTHER]: "Them" }, members: [OTHER],
  });
  set("v2_groups/g_left", { name: "Left", mode: "group", ownerUid: OTHER, memberUids: [OTHER] });
  set(`v2_groups/g_left/reveals/${DAY}`, {
    day: DAY, qid: "gq", votes: { [ME]: { optionIdx: 1 }, [OTHER]: { optionIdx: 0 } },
    names: { [ME]: "Me", [OTHER]: "Them" }, members: [ME, OTHER],
  });
  set("v2_groups/g_picked", { name: "Picked", mode: "group", ownerUid: OTHER, memberUids: [OTHER] });
  set(`v2_groups/g_picked/reveals/${DAY}`, {
    day: DAY, qid: "gpick", votes: { [OTHER]: { optionIdx: 0, pickUid: ME } },
    names: { [OTHER]: "Them" }, members: [OTHER], pickedUids: [ME],
  });
  set("v2_groups/g_owned_left", { name: "OwnedLeft", mode: "group", ownerUid: ME, memberUids: [OTHER] });
  set("v2_groups/g_waited", {
    name: "Waited", mode: "group", ownerUid: OTHER, memberUids: [OTHER],
    pending: [ME, "u_third"], pendingNames: { [ME]: "Me", u_third: "Else" },
  });
  set(`v2_groups/g_shared/invites/${ME}`, { to: ME, from: OTHER, fromName: "Them", groupName: "Shared" });
  set("v2_groups/g_shared/invites/u_third", { to: "u_third", from: ME, fromName: "Me", groupName: "Shared" });
  set("v2_groups/g_shared/invites/u_fourth", { to: "u_fourth", from: OTHER, fromName: "Them", groupName: "Shared" });
  // 2, 3b, 3d — the v1 discoverable doc, the handle, the directory row.
  set(`insight_discoverable/${ME}`, { location: { geohash: "u4pru" } });
  set("v2_handles/mine", { uid: ME });
  set("v2_handles/theirs", { uid: OTHER });
  set(`v2_people/${ME}`, { name: "Me", nameKey: "me" });
  set(`v2_people/${OTHER}`, { name: "Them", nameKey: "them" });
  // 4b — the ledgers.
  set(`insight_ratelimits/${ME}`, { events: [1] });
  set(`v2_ratelimits/join_${ME}`, { events: [2] });
  set(`v2_ratelimits/suggest_${ME}`, { events: [3] });
  // 4d, 4e, 4f — suggestions, purchases with their pointers, bookings.
  set(`v2_suggestions/${ME}_s`, { uid: ME, prompt: "my suggestion" });
  set(`v2_suggestions/${OTHER}_s`, { uid: OTHER, prompt: "someone else's suggestion" });
  set(`v2_purchases/${ME}_q`, { uid: ME, kind: "question", qid: "pd_mine", state: "running" });
  set(`v2_purchases/${ME}_ad`, { uid: ME, kind: "ad", adId: "paidad-mine" });
  set(`v2_purchases/${OTHER}_q`, { uid: OTHER, kind: "question", qid: "pd_theirs" });
  set("v2_ads/paidad-mine", { sponsor: "My Shop", body: "my ad" });
  set("v2_ads/paidad-theirs", { sponsor: "Their Shop", body: "not this account's campaign" });
  set("v2_questions/pd_mine", { prompt: "My bought question", sponsor: { buyer: "Me", audience: { city: "Oslo, NO" } } });
  set("v2_questions/pd_theirs", { prompt: "Their bought question", sponsor: { buyer: "Them" } });
  set(`v2_paid_bookings/${ME}_b`, { uid: ME, prompt: "my paid ask" });
  set(`v2_paid_bookings/${OTHER}_b`, { uid: OTHER, prompt: "someone else's paid ask" });
}

beforeEach(seed);

const ids = (rows: unknown) => (rows as { id: string }[]).map((r) => r.id);

describe("exportAccountV2 · the read-only twin of deleteAccount", () => {
  // THE CONTRACT. deleteAccount names every wipe phase by the label it
  // pushes onto `failed`; a label TWIN does not know is a phase the export
  // has not been told about. Read from the source rather than re-typed, so
  // the list here cannot be the stale copy.
  it("names an export section for every wipe phase in index.ts", async () => {
    const src = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    const labels = [...src.matchAll(/failed\.push\("(\w+)"\)/g)].map((m) => m[1]);
    expect(labels.length, "no `failed.push` labels found — the scan is broken, not the tree").toBeGreaterThan(15);
    const untwinned = labels.filter((l) => !(l in TWIN));
    expect(untwinned, "a wipe phase with no export section — add it to TWIN and to buildExport").toEqual([]);
    // …and every section TWIN names is a real key on the bundle, so the
    // map cannot satisfy the rule with a name nothing writes.
    const bundle = await buildExport(ME);
    const phantom = Object.values(TWIN).filter((section) => !(section in bundle));
    expect(phantom, "TWIN names a section buildExport never writes").toEqual([]);
  });

  it("carries every phase's documents of the caller's", async () => {
    const b = await buildExport(ME) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(b.format).toBe("insight-export/1");
    expect(b.uid).toBe(ME);
    expect(b.account).toMatchObject({ email: `${ME}@example.com`, providers: [{ providerId: "google.com" }] });
    // 1b — the profile and its subtree, timestamps readable.
    expect(b.profile).toMatchObject({ displayName: "Me" });
    expect(ids(b.collections.answers)).toEqual(["daily-000", "learn-cell1"]);
    expect(b.collections.answers[0].answeredAt).toBe("2023-11-14T22:13:20.000Z");
    expect(ids(b.collections.patterns)).toEqual(["state"]);
    expect(ids(b.collections.taste)).toEqual(["profile"]);
    expect(ids(b.collections.following)).toEqual([OTHER]);
    // 1 — the legacy subtree.
    expect(b.legacy.profile).toEqual({ sharePrefs: {} });
    expect(ids(b.legacy.collections.insight_daily)).toEqual([DAY]);
    // 1a, 1a′.
    expect(ids(b.answerLedger)).toEqual(["evt_mine"]);
    expect(b.voterSamples).toEqual({ "daily-000": { o: 1, d: DAY } });
    // 1b1 — scored, and without the key.
    expect(b.logicAttempt).toEqual({ gv: 2, status: "scored", score: 9 });
    // 1b2 — takes, the flags cast, the two counts, the face, the cell.
    expect(ids(b.takes)).toEqual(["take_mine"]);
    expect(ids(b.flags.cast).sort()).toEqual([`take_mine_${ME}`, `take_theirs_${ME}`]);
    expect(b.flags.receivedOnTakes).toBe(1);
    expect(b.flags.receivedOnPhoto).toBe(1);
    expect(b.avatar).toEqual({ token: "tok0", hidden: false });
    // The square is reported as HELD, never as a place: the cell is the
    // fourth closed thing, and this file is built to travel.
    expect(b.presence).toEqual({ held: true, at: null, until: "2026-09-08T12:00:00.000Z" });
    expect(JSON.stringify(b)).not.toContain("5999_1074");
    expect(b.photo).toEqual({ contentType: "image/jpeg", bytes: 3, base64: "/9j/" });
    // 1c — the two circles the account is in, with what the document says about it.
    expect(b.groups.map((g: { gid: string }) => g.gid).sort()).toEqual(["g_shared", "g_solo"]);
    const solo = b.groups.find((g: { gid: string }) => g.gid === "g_solo");
    expect(solo).toMatchObject({ owner: true, members: 1, sealedRounds: ["r3"], turnStamp: 5, ledger: null });
    const shared = b.groups.find((g: { gid: string }) => g.gid === "g_shared");
    expect(shared).toMatchObject({
      owner: false, members: 2, joinedAt: 5, memberName: "Me", sealedRounds: [], turnStamp: null,
      // …and the role ledger's row for this member (D445), the way the
      // erasure's phase 1c drops it — this row, never the map.
      ledger: { votes: 4, seats: { engine: 3, heart: 1 } },
    });
    expect(b.ownedGroups).toEqual([{ gid: "g_owned_left", name: "OwnedLeft", mode: "group" }]);
    // 1c + 1c-bis — four reveals name the account: its own circles, the
    // one it left, and the one that names it only through a pick.
    const reveals = (b.reveals as { gid: string; picked: number; vote: unknown; name: unknown }[])
      .sort((x, y) => x.gid.localeCompare(y.gid));
    expect(reveals.map((r) => r.gid)).toEqual(["g_left", "g_picked", "g_shared", "g_solo"]);
    expect(reveals.find((r) => r.gid === "g_shared")).toMatchObject({ vote: { optionIdx: 0 }, name: "Me", picked: 1 });
    expect(reveals.find((r) => r.gid === "g_picked")).toMatchObject({ vote: null, name: null, picked: 1 });
    expect(reveals.find((r) => r.gid === "g_left")).toMatchObject({ vote: { optionIdx: 1 }, name: "Me", picked: 0 });
    // 2, 3, 3b, 3c, 3d, 4, 4b, 4d, 4e, 4f.
    expect(b.discoverable).toEqual({ location: { geohash: "u4pru" } });
    expect(b.impressionsSent).toEqual([{ to: OTHER, id: "i1", senderUid: ME, traits: ["kind"] }]);
    expect(b.followers).toBe(1);
    expect(b.handle).toBe("mine");
    expect(b.pendingJoins).toEqual([{ gid: "g_waited", name: "Waited", asName: "Me" }]);
    expect(b.directory).toEqual({ name: "Me", nameKey: "me" });
    expect(ids(b.invitesReceived)).toEqual([ME]);
    expect(b.invitesReceived[0]).toMatchObject({ gid: "g_shared", from: OTHER });
    expect(ids(b.invitesSent)).toEqual(["u_third"]);
    expect(b.relationsToYou).toBe(1);
    expect(b.rateLimits).toEqual({ insight: { events: [1] }, join: { events: [2] }, invite: null, suggest: { events: [3] }, paidbook: null });
    expect(ids(b.suggestions)).toEqual([`${ME}_s`]);
    expect(ids(b.purchases.rows).sort()).toEqual([`${ME}_ad`, `${ME}_q`]);
    expect(ids(b.purchases.ads)).toEqual(["paidad-mine"]);
    expect(b.purchases.sponsoredQuestions).toEqual([{ qid: "pd_mine", sponsor: { buyer: "Me", audience: { city: "Oslo, NO" } } }]);
    expect(ids(b.paidBookings)).toEqual([`${ME}_b`]);
    expect(b.bytes).toBeGreaterThan(1000);
    expect(b.bytes).toBeLessThan(EXPORT_MAX_BYTES);
  });

  // THE OTHER HALF, and the reason every seed above has a control: a walk
  // that took a collection instead of a uid's rows passes the case above
  // and is a leak. Asserted on the serialised file, since that is what
  // leaves the server.
  it("carries nothing of another user's", async () => {
    const text = JSON.stringify(await buildExport(ME));
    for (const theirs of [
      "somebody else's answer", "someone else's words", "someone else's suggestion",
      "someone else's paid ask", "not this account's campaign", "Their bought question",
      "evt_theirs", "u_fourth", "tok1", "pd_theirs", "paidad-theirs", '"theirs"',
      // OTHER's role-ledger row on the shared circle — the one `hands` seat seeded.
      '"hands"',
    ]) {
      expect(text, `the export carries someone else's data: ${theirs}`).not.toContain(theirs);
    }
    // A third party's uid appears in one place only: on the invitation
    // THIS account sent them, which is this account's own record. Nowhere
    // else — not as OTHER's follow of them, not as OTHER's v1 relation.
    expect(text).toContain('"invitesSent":[{"gid":"g_shared","id":"u_third","to":"u_third"');
    const bundle = JSON.parse(text) as Record<string, unknown>;
    delete bundle.invitesSent;
    expect(JSON.stringify(bundle)).not.toContain("u_third");
    // The one place OTHER's uid may appear is where THIS account wrote it:
    // its own follow, and the invitation OTHER sent it. Never as a voter
    // in a reveal, a follower, or a reporter.
    const b = await buildExport(ME) as Record<string, unknown>;
    for (const r of b.reveals as Record<string, unknown>[]) {
      expect(r, "a reveal row carries the other members' votes").not.toHaveProperty("votes");
      expect(r).not.toHaveProperty("members");
    }
    expect(JSON.stringify(b.flags)).not.toContain(OTHER);
    expect(typeof b.followers).toBe("number");
  });

  // The four things the rules keep closed to everyone — the PR template's
  // list, and CLAUDE.md's three denies plus the credential — each one a line.
  it("leaves out the logic seed, who reported you, the presence cell and the push token", async () => {
    const b = await buildExport(ME) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const text = JSON.stringify(b);
    expect(b.logicAttempt.seed).toBeUndefined();
    expect(text).not.toContain("secret-push-token");
    expect(Object.keys(b.collections)).not.toContain("push");
    expect(b.flags.cast.every((f: { uid: string }) => f.uid === ME)).toBe(true);
    expect(text).not.toContain("5999_1074");
    // …and the file says so, rather than leaving the absence to be inferred.
    const omitted = (b.omitted as { what: string }[]).map((o) => o.what);
    expect(omitted).toEqual(expect.arrayContaining([
      "collections.push", "logicAttempt.seed", "flags.received*", "presence.cell", "followers",
    ]));
  });

  it("refuses past the byte bound with the plain message, before reading the rest", async () => {
    store.set("v2_takes/take_huge", { authorUid: ME, qid: "q9", text: "x".repeat(EXPORT_MAX_BYTES + 1) });
    let err: unknown;
    try { await buildExport(ME); } catch (e) { err = e; }
    expect(err).toBeTruthy();
    expect((err as { code: string }).code).toBe("resource-exhausted");
    expect((err as Error).message).toBe(EXPORT_TOO_LARGE);
    expect(EXPORT_TOO_LARGE).toMatch(/8 MB/);
  });

  it("is a callable that refuses an anonymous caller and echoes the owner's uid", async () => {
    const run = (r: unknown) =>
      (exportAccountV2 as unknown as { run: (r: unknown) => Promise<unknown> }).run(r);
    await expect(run({ data: {} })).rejects.toMatchObject({ code: "unauthenticated" });
    const res = await run({ auth: { uid: ME }, data: {} }) as Record<string, unknown>;
    expect(res.ok).toBe(true);
    expect(res.uid).toBe(ME);
    expect(res.handle).toBe("mine");
  });
});

describe("toPlain · Firestore values as JSON a person can read", () => {
  it("renders timestamps as ISO strings and drops what JSON cannot carry", () => {
    expect(toPlain(Timestamp.fromMillis(0))).toBe("1970-01-01T00:00:00.000Z");
    expect(toPlain({ at: new Date(0), n: 1, s: "x", ok: true, nil: undefined, nan: NaN, fn: () => 1 }))
      .toEqual({ at: "1970-01-01T00:00:00.000Z", n: 1, s: "x", ok: true, nil: null, nan: null });
    expect(toPlain([1, [2, null]])).toEqual([1, [2, null]]);
    expect(toPlain(Buffer.from([1, 2, 3]))).toBe("AQID");
  });
});
