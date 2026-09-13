// follow-push.test.ts — the friend request's delivery (D-2026-09-12d),
// executed rather than described.
//
// `onV2FollowCreated` is the server's whole part in the friends
// handshake: the client writes the follow row itself (D101), and this
// trigger tells the other side. Two bodies, decided by one read — whether
// the target already follows the writer, which makes this create the
// acceptance. The fake is Firestore's plumbing (doc, getAll, update) and
// FCM's send, the way late-answer.test.ts fakes the answer trigger's; what
// is asserted is who is told, with which words, under which title.
import { describe, it, expect, vi, beforeEach } from "vitest";
type Doc = Record<string, unknown>;
const store = new Map<string, Doc>();
function ref(path: string) {
  return {
    path,
    id: path.split("/").pop() as string,
    async get() { return snap(this); },
    async update(data: Doc) { store.set(path, { ...(store.get(path) || {}), ...data }); },
  };
}
const snap = (r: { path: string }) => ({
  exists: store.has(r.path),
  get: (f: string) => store.get(r.path)?.[f],
});
// `collection().doc()` and a transaction, for the notice cooldown's ledger
// (`v2_ratelimits/friendping_{uid}`). The transaction is a real one only in
// the sense that matters here — a get and a set against the same store —
// because what the cases below assert is the LEDGER's arithmetic, not
// Firestore's concurrency, which no fake can stand in for.
//
// `ledgerBroken` is the fail-open case. The cooldown is an anti-abuse
// bound on a social notification and not a permission check, so a ledger
// that cannot be read must not swallow a real friend request.
let ledgerBroken = false;
const fakeDb = {
  doc: (path: string) => ref(path),
  collection: (c: string) => ({ doc: (id: string) => ref(`${c}/${id}`) }),
  async getAll(...refs: { path: string }[]) { return refs.map(snap); },
  async runTransaction<T>(f: (tx: {
    get: (r: { path: string }) => Promise<ReturnType<typeof snap>>;
    set: (r: { path: string }, d: Doc) => void;
  }) => Promise<T>): Promise<T> {
    if (ledgerBroken) throw new Error("ledger unavailable");
    return f({
      get: async (r) => snap(r),
      set: (r, d) => { store.set(r.path, d); },
    });
  },
};
const sends: Array<{ tokens: string[]; notification: { title: string; body: string }; data: Record<string, string>; android?: unknown }> = [];
vi.mock("./db", () => ({ db: () => fakeDb, FIRESTORE_DB_ID: "insight" }));
vi.mock("firebase-admin/messaging", () => ({
  getMessaging: () => ({
    sendEachForMulticast: async (m: typeof sends[number]) => {
      sends.push(m);
      return { responses: m.tokens.map(() => ({ success: true })) };
    },
  }),
}));
const { onV2FollowCreated } = await import("./v2social");
const { BRAND_NAME } = await import("./brand");
async function created(uid: string, targetUid: string) {
  await (onV2FollowCreated as unknown as { run: (e: unknown) => Promise<void> }).run({
    id: `evt-${uid}-${targetUid}`,
    params: { uid, targetUid },
    data: { exists: true, ref: ref(`v2_users/${uid}/following/${targetUid}`), get: () => undefined },
  });
}
beforeEach(() => {
  store.clear();
  sends.length = 0;
  ledgerBroken = false;
  store.set("v2_users/ada", { displayName: "Ada" });
  store.set("v2_users/bo/push/tokens", { fcmTokens: ["tok-bo-".padEnd(140, "x")] });
  store.set("v2_users/ada/push/tokens", { fcmTokens: ["tok-ada-".padEnd(140, "x")] });
});

describe("onV2FollowCreated — a friend request notifies", () => {
  it("tells the person asked, by the asker's name, under the app's name", async () => {
    await created("ada", "bo");
    expect(sends).toHaveLength(1);
    expect(sends[0].tokens).toEqual(["tok-bo-".padEnd(140, "x")]);
    expect(sends[0].notification).toEqual({ title: BRAND_NAME, body: "Ada wants to compare answers with you." });
    expect(sends[0].data).toEqual({ kind: "friend", uid: "ada", mutual: "0" });
  });

  it("says yes when the row completes a pair — the target already follows the writer", async () => {
    store.set("v2_users/bo/following/ada", { to: "ada" });
    await created("ada", "bo");
    expect(sends).toHaveLength(1);
    expect(sends[0].notification.body).toBe("Ada said yes — you're comparing answers now.");
    expect(sends[0].data.mutual).toBe("1");
  });

  it("names nobody it cannot name, and never the asker themselves", async () => {
    store.delete("v2_users/ada");
    await created("ada", "bo");
    expect(sends[0].notification.body).toBe("Someone wants to compare answers with you.");
    // A row pointing at its own owner is refused by the rules; the trigger
    // refuses it too rather than pushing a person their own request.
    sends.length = 0;
    await created("ada", "ada");
    expect(sends).toHaveLength(0);
  });

  it("is silent for a target with no device, and never throws", async () => {
    store.delete("v2_users/bo/push/tokens");
    await expect(created("ada", "bo")).resolves.toBeUndefined();
    expect(sends).toHaveLength(0);
  });
});

// ── the notice rings once per pair per day ────────────────────────────
//
// The follow row is a client write: `create` is shape-checked, `update` is
// denied and `delete` is free, so create → delete → create is three legal
// writes and, before the cooldown, two pushes. Nothing counted them — no
// dedupe in the sender, no block list, and the fifty-follow ceiling this
// trigger's comment leans on is the CLIENT's. One free account could ring
// any uid it could name, as often as it liked, with text it chose.
//
// The bound is on the NOTICE and not on the row, and these cases hold that
// line: the second follow still happens, it simply does not ring.
describe("onV2FollowCreated — the notice is bounded, the follow is not", () => {
  const DAY = 24 * 3600_000;
  const ledger = () => store.get("v2_ratelimits/friendping_ada") as { pings?: Record<string, number> } | undefined;

  it("rings once for a pair, and not again inside the day", async () => {
    await created("ada", "bo");
    expect(sends).toHaveLength(1);
    // unfollow, refollow — the loop the rules permit
    store.delete("v2_users/ada/following/bo");
    await created("ada", "bo");
    expect(sends, "a refollow inside the cooldown rang the same person again").toHaveLength(1);
    expect(Object.keys(ledger()?.pings ?? {}), "the pair was not recorded").toEqual(["bo"]);
  });

  it("rings for a DIFFERENT person in the same breath", async () => {
    // The cooldown is per pair. A bound that stopped an account asking two
    // people in one sitting would break the ordinary case to fix the abuse.
    store.set("v2_users/cy/push/tokens", { fcmTokens: ["tok-cy-".padEnd(140, "x")] });
    await created("ada", "bo");
    await created("ada", "cy");
    expect(sends).toHaveLength(2);
    expect(sends[1].tokens).toEqual(["tok-cy-".padEnd(140, "x")]);
  });

  it("never swallows the YES — the acceptance is the other direction", async () => {
    // Ada asks Bo, then Bo follows back. That second row's sender is BO,
    // so it is a different pair and a different ledger: an acceptance
    // cannot be eaten by the asker's own cooldown.
    store.set("v2_users/bo", { displayName: "Bo" });
    await created("ada", "bo");
    store.set("v2_users/ada/following/bo", { to: "bo" });
    await created("bo", "ada");
    expect(sends).toHaveLength(2);
    expect(sends[1].notification.body).toBe("Bo said yes — you're comparing answers now.");
    expect(sends[1].tokens).toEqual(["tok-ada-".padEnd(140, "x")]);
  });

  it("rings again once the day has passed", async () => {
    // Written by aging the stored stamp rather than by moving a clock: the
    // ledger is what the bound reads, so this is the same statement with
    // fewer moving parts.
    await created("ada", "bo");
    store.set("v2_ratelimits/friendping_ada", { pings: { bo: Date.now() - DAY - 1000 } });
    await created("ada", "bo");
    expect(sends, "a request a day later was still treated as a repeat").toHaveLength(2);
  });

  it("rings when the ledger itself is unavailable", async () => {
    // FAILS OPEN. Losing a real friend request to an unreadable counter is
    // the worse of the two failures, and this is a bound on notification
    // volume rather than a permission check.
    ledgerBroken = true;
    await expect(created("ada", "bo")).resolves.toBeUndefined();
    expect(sends).toHaveLength(1);
  });
});
