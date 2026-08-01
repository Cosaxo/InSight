// Unit tests for the extracted seed loop (seedCore.ts) against a stub
// Firestore. The two properties that must survive any refactor: `active`
// is written ONLY on first create (the ops kill switch — a reseed that
// re-enabled a disabled question would undo an operator's intervention
// silently), and the 450-op batching actually splits (a 500+-question
// bank in one batch would throw in production and nowhere else).
import { describe, expect, it } from "vitest";
import { seedQuestions, type SeedQuestion } from "./seedCore";

function stubDb(existingIds: string[]) {
  const writes: Array<{ path: string; data: Record<string, unknown> }> = [];
  const commits: number[] = [];
  let pending = 0;
  const db = {
    collection: (col: string) => ({
      doc: (id: string) => ({
        _path: `${col}/${id}`,
        set: async (data: Record<string, unknown>) => {
          writes.push({ path: `${col}/${id}`, data });
        },
      }),
    }),
    getAll: async (...refs: Array<{ _path: string }>) =>
      refs.map((r) => ({
        id: r._path.split("/").pop() as string,
        exists: existingIds.includes(r._path.split("/").pop() as string),
      })),
    batch: () => ({
      set: (ref: { _path: string }, data: Record<string, unknown>) => {
        writes.push({ path: ref._path, data });
        pending++;
      },
      commit: async () => {
        commits.push(pending);
        pending = 0;
      },
    }),
  };
  return { db: db as never, writes, commits };
}

const q = (id: string): SeedQuestion => ({
  id,
  surface: "daily",
  seq: 0,
  type: "binary",
  domain: null,
  prompt: "Prompt " + id,
  options: ["a", "b"],
  topic: null,
  axis: null,
  test: null,
});

describe("seedQuestions", () => {
  it("writes active:true only on first create — never on a reseed", async () => {
    const { db, writes } = stubDb(["old-1"]);
    const res = await seedQuestions(db, [q("old-1"), q("new-1")]);
    const oldWrite = writes.find((w) => w.path === "v2_questions/old-1");
    const newWrite = writes.find((w) => w.path === "v2_questions/new-1");
    expect(oldWrite && "active" in oldWrite.data).toBe(false);
    expect(newWrite?.data.active).toBe(true);
    expect(res).toEqual({ written: 2, created: 1 });
  });

  it("bumps contentRev exactly once, after the bank", async () => {
    const { db, writes } = stubDb([]);
    await seedQuestions(db, [q("a")]);
    const meta = writes.filter((w) => w.path === "v2_meta/app");
    expect(meta).toHaveLength(1);
    expect(writes[writes.length - 1].path).toBe("v2_meta/app");
  });

  it("splits batches at 450 ops", async () => {
    const many = Array.from({ length: 1000 }, (_, i) => q("q" + i));
    const { db, commits } = stubDb([]);
    await seedQuestions(db, many);
    expect(commits).toEqual([450, 450, 100]);
  });
});
