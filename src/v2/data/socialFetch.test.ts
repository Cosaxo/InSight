// The directory writer (D239) and its delete branch (D440).
//
// `writeDirectoryRow` is the one client write to `v2_people`, and until
// D440 an empty name made it RETURN rather than write — so a person who
// cleared their display name to stop being found by it stayed found, the
// old name standing in the directory with nothing in the app able to
// change it (OWNER-LIST, 2026-09-07). The rules refuse an empty `name`,
// so unlisting is a delete and not a blank row. This pins that the empty
// branch deletes and the named branch writes, and that neither does the
// other's work. The rules half — that only the owner may delete, and that
// a delete of a row that does not exist is allowed — is
// firestore-tests/rules.test.ts's.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Firestore } from "firebase/firestore";

const h = vi.hoisted(() => ({
  sets: [] as Array<{ path: string; data: Record<string, unknown>; opts: unknown }>,
  deletes: [] as string[],
}));

vi.mock("firebase/firestore", () => ({
  // The module's static imports, present so the bindings resolve; the
  // reads they serve are not under test here.
  collection: vi.fn(),
  collectionGroup: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  setDoc: async (ref: { path: string }, data: Record<string, unknown>, opts: unknown) => {
    h.sets.push({ path: ref.path, data, opts });
  },
  deleteDoc: async (ref: { path: string }) => {
    h.deletes.push(ref.path);
  },
}));

const { writeDirectoryRow } = await import("./socialFetch");
const db = {} as Firestore;

beforeEach(() => {
  h.sets.length = 0;
  h.deletes.length = 0;
});

describe("writeDirectoryRow", () => {
  it("an empty name DELETES the row rather than skipping it (D440)", async () => {
    await writeDirectoryRow(db, "u1", "   ");
    expect(h.deletes).toEqual(["v2_people/u1"]);
    expect(h.sets).toEqual([]);
  });

  it("a name writes the row with its fold, and deletes nothing", async () => {
    await writeDirectoryRow(db, "u1", "  Ólaf T ");
    // A-Z only, because that is what the rules engine's `.lower()` folds
    // — `foldName`'s own header has the measurement.
    expect(h.sets).toEqual([{
      path: "v2_people/u1",
      data: { name: "Ólaf T", nameKey: "Ólaf t" },
      opts: { merge: true },
    }]);
    expect(h.deletes).toEqual([]);
  });
});
