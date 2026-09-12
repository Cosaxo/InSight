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
    // Firestore's `create` REFUSES an existing document, with gRPC code 6
    // (ALREADY_EXISTS). That refusal is the once-per-pair bound, so the
    // fake has to reproduce it rather than behave like `set`.
    async create(data: Doc) {
      if (store.has(path)) {
        const e = new Error(`ALREADY_EXISTS: ${path}`) as Error & { code: number };
        e.code = 6;
        throw e;
      }
      store.set(path, { ...data });
    },
  };
}
const snap = (r: { path: string }) => ({
  exists: store.has(r.path),
  get: (f: string) => store.get(r.path)?.[f],
});
const fakeDb = {
  doc: (path: string) => ref(path),
  async getAll(...refs: { path: string }[]) { return refs.map(snap); },
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
  store.set("v2_users/ada", { displayName: "Ada" });
  store.set("v2_users/bo/push/tokens", { fcmTokens: ["tok-bo-".padEnd(140, "x")] });
  store.set("v2_users/ada/push/tokens", { fcmTokens: ["tok-ada-".padEnd(140, "x")] });
});

/** What an unfollow does to the store: the row goes, and NOTHING else —
 *  no push, by design, because *X isn't told* is what the remove sheet
 *  promises. The notice marker is not a row the client can reach, so it
 *  stays, which is the whole point. */
function unfollowed(uid: string, targetUid: string) {
  store.delete(`v2_users/${uid}/following/${targetUid}`);
}

describe("onV2FollowCreated — a friend request notifies", () => {
  it("tells one person ONCE, however many times the row is re-created", async () => {
    // THE AMPLIFIER. The push fires on a follow row's CREATE and a DELETE
    // fires nothing, so before the `followNotices` marker this loop was an
    // unbounded stream of notifications to any uid — carrying whatever the
    // writer had set as their display name, from an account that costs
    // nothing, because anonymous auth is the default here and uids are
    // world-readable through the voter lists and handles.
    //
    // Twenty cycles is not arbitrary: twenty is what the audit ran against
    // the unfixed trigger, and it produced twenty pushes.
    store.set("v2_users/ada", { displayName: "PAY ME AT example.invalid" });
    for (let i = 0; i < 20; i++) {
      await created("ada", "bo");
      unfollowed("ada", "bo");
    }
    expect(sends, "re-creating the follow row notified again").toHaveLength(1);
  });

  it("still tells the other direction — the marker is per pair, not per person", async () => {
    // The control, and it is the one that matters: a marker keyed too
    // broadly would silence the acceptance, which is a different pair
    // (bo → ada) and a different thing to say.
    await created("ada", "bo");
    expect(sends).toHaveLength(1);
    store.set("v2_users/bo", { displayName: "Bo" });
    store.set("v2_users/ada/following/bo", { to: "bo" });
    await created("bo", "ada");
    expect(sends, "the acceptance was swallowed by the request's marker").toHaveLength(2);
    expect(sends[1].notification.body).toBe("Bo said yes — you're comparing answers now.");
  });

  it("a marker that cannot be written stops the push rather than repeating it", async () => {
    // A transient failure costs one person one notification. Sending anyway
    // would reopen the loop, so this direction is deliberate.
    const realDoc = fakeDb.doc;
    fakeDb.doc = (path: string) => {
      const r = realDoc(path);
      if (path.includes("/followNotices/")) {
        r.create = async () => { throw Object.assign(new Error("unavailable"), { code: 14 }); };
      }
      return r;
    };
    try {
      await created("ada", "bo");
      expect(sends, "a failed marker let the push through").toHaveLength(0);
    } finally {
      fakeDb.doc = realDoc;
    }
  });

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
