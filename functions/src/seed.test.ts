// The seed's refusal to re-key votes already cast (D58, enforcing D52).
//
// WHY THIS FILE EXISTS SEPARATELY FROM pure.test.ts. Those cases pin
// seedOptionConflict — that the predicate answers correctly. These pin the
// thing that actually protects the data: that runSeedV2 CONSULTS it, skips
// the document, and refuses to report success. The two are independent
// failures, and the second is the one that shipped: seedOptionConflict
// answering perfectly while nothing called it would look identical in
// pure.test.ts and lose every historical vote on the edited question.
//
// The db stand-in follows contention.test.ts's precedent — the real
// Firestore is not needed to prove which writes a function chooses to make.
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { logger } from "firebase-functions";
import { runSeedV2 } from "./v2";
import { V2_QUESTIONS } from "./v2content";

// A Firestore stand-in that records the batch writes it is handed.
// `storedDocs` is the pre-existing v2_questions state; anything absent
// reads as a non-existent doc, which is the create path.
function fakeDb(storedDocs: Record<string, Record<string, unknown>>) {
  const written: Record<string, Record<string, unknown>> = {};
  let commits = 0;
  const snapFor = (id: string) => ({
    id,
    exists: Object.prototype.hasOwnProperty.call(storedDocs, id),
    data: () => storedDocs[id],
    // v2_meta/app: contentRev already initialised, so `firstEver` is false
    // and these cases exercise the ordinary run rather than a first seed.
    get: (field: string) => (field === "contentRev" ? 1 : undefined),
  });
  const db = {
    collection: (name: string) => ({
      doc: (id = "app") => ({
        id: `${name}/${id}`,
        _id: id,
        get: async () => snapFor(id),
        set: async () => {},
      }),
    }),
    getAll: async (...refs: { _id: string }[]) => refs.map((r) => snapFor(r._id)),
    batch: () => ({
      set: (ref: { _id: string }, payload: Record<string, unknown>) => {
        written[ref._id] = payload;
      },
      commit: async () => { commits++; },
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { db, written, commits: () => commits };
}

// A real question from the committed bank, so the payload the seed builds
// matches something the refusal can actually be about.
const victim = V2_QUESTIONS.find((q) => Array.isArray(q.options) && q.options.length >= 2)!;

/** The stored form of a question: exactly what the seed would have written. */
function storedForm(q: typeof victim, overrides: Record<string, unknown> = {}) {
  return {
    surface: q.surface, seq: q.seq, type: q.type, domain: q.domain ?? null,
    prompt: q.prompt, options: q.options, topic: q.topic ?? null,
    axis: q.axis ?? null, test: q.test ?? null,
    // continuum range/plane copy (D114) — emit-when-set, mirroring the
    // payload, and in SEEDED_FIELDS, so the no-op test would report
    // phantom writes for the dial/field entries without these
    ...(typeof q.lo === "number" ? { lo: q.lo } : {}),
    ...(typeof q.hi === "number" ? { hi: q.hi } : {}),
    ...(typeof q.unit === "string" ? { unit: q.unit } : {}),
    ...(Array.isArray(q.ends) ? { ends: q.ends } : {}),
    ...(Array.isArray(q.ax) ? { ax: q.ax } : {}),
    ...(Array.isArray(q.ay) ? { ay: q.ay } : {}),
    ...overrides,
  };
}

/** Every question already stored exactly as the bank has it — a no-op seed. */
function allStored(overrides: Record<string, Record<string, unknown>> = {}) {
  const docs: Record<string, Record<string, unknown>> = {};
  for (const q of V2_QUESTIONS) docs[q.id] = storedForm(q as typeof victim);
  return { ...docs, ...overrides };
}

let error: ReturnType<typeof vi.spyOn>;
let info: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  error = vi.spyOn(logger, "error").mockImplementation(() => {});
  info = vi.spyOn(logger, "info").mockImplementation(() => {});
});
afterEach(() => {
  error.mockRestore();
  info.mockRestore();
});

describe("runSeedV2 refuses option-set edits to live questions (D58)", () => {
  it("writes nothing when the bank already matches — the control", async () => {
    const { db, written } = fakeDb(allStored());
    const out = await runSeedV2(db);
    expect(Object.keys(written)).toHaveLength(0);
    expect(out).toEqual({ written: 0, skipped: V2_QUESTIONS.length });
  });

  it("refuses the edited question, and does not write it", async () => {
    // The stored doc has the options REVERSED. Every vote on it is keyed by
    // index, so writing the bank's order over this would silently swap what
    // each stored answer means.
    const reversed = [...(victim.options as string[])].reverse();
    const { db, written } = fakeDb(allStored({
      [victim.id]: storedForm(victim, { options: reversed }),
    }));

    await expect(runSeedV2(db)).rejects.toThrow(/option-set edit/i);
    // The one thing that must be true whatever else happens.
    expect(written[victim.id]).toBeUndefined();
  });

  it("freezes a dial's range with its options — a changed lo is a refused edit", async () => {
    // D114: a continuum answer is a stored optionIdx into synthesized
    // bucket labels, so the labels ARE positions on the range. A stored
    // doc whose labels came from a different lo (the range the answers
    // were actually cast on) must refuse the new set exactly like any
    // option edit — otherwise every stored answer silently slides.
    const dial = V2_QUESTIONS.find((q) => q.type === "dial")!;
    const shifted = (dial.options as string[]).map((l, i) => (i === 0 ? "35–39 yrs" : l));
    const { db, written } = fakeDb(allStored({
      [dial.id]: storedForm(dial as typeof victim, { options: shifted, lo: 35 }),
    }));

    await expect(runSeedV2(db)).rejects.toThrow(/option-set edit/i);
    expect(written[dial.id]).toBeUndefined();
  });

  it("names the question, the stored set and the desired set in the error", async () => {
    // An operator has to be able to act on this without reading the logs of
    // a function they cannot rerun cheaply.
    const reversed = [...(victim.options as string[])].reverse();
    const { db } = fakeDb(allStored({
      [victim.id]: storedForm(victim, { options: reversed }),
    }));

    await expect(runSeedV2(db)).rejects.toThrow(victim.id);
    expect(error).toHaveBeenCalledTimes(1);
    const message = String(error.mock.calls[0][0]);
    expect(message).toContain(victim.id);
    expect(message).toContain(reversed[0]);
    expect(message).toContain("D52");
  });

  it("still commits the legitimate writes in the same run", async () => {
    // Per-document refusal, not per-run abort: a batch of prompt fixes must
    // not be held hostage by one bad option edit. Pick a second question and
    // give it an out-of-date PROMPT, which is an allowed edit.
    const other = V2_QUESTIONS.find((q) => q.id !== victim.id)!;
    const reversed = [...(victim.options as string[])].reverse();
    const { db, written } = fakeDb(allStored({
      [victim.id]: storedForm(victim, { options: reversed }),
      [other.id]: storedForm(other as typeof victim, { prompt: "stale prompt" }),
    }));

    await expect(runSeedV2(db)).rejects.toThrow(/option-set edit/i);
    // The allowed edit landed…
    expect(written[other.id]).toBeDefined();
    expect(written[other.id].prompt).toBe(other.prompt);
    // …and the refused one did not.
    expect(written[victim.id]).toBeUndefined();
  });

  it("does not refuse a question that does not exist yet", async () => {
    // A create cannot re-key anything. Drop the victim from storage
    // entirely and the seed must write it, options and all.
    const docs = allStored();
    delete docs[victim.id];
    const { db, written } = fakeDb(docs);

    const out = await runSeedV2(db);
    expect(written[victim.id]).toBeDefined();
    expect(written[victim.id].options).toEqual(victim.options);
    // Created docs get `active: true`; that is the create path's marker.
    expect(written[victim.id].active).toBe(true);
    expect(out.written).toBe(1);
  });

  it("does not count a refused question as skipped", async () => {
    // `skipped` means "already said what we wanted to say". A refused
    // document said something we specifically did NOT want to leave alone,
    // and folding it into skipped would make the run's own log read as
    // though nothing had happened.
    const reversed = [...(victim.options as string[])].reverse();
    const { db } = fakeDb(allStored({
      [victim.id]: storedForm(victim, { options: reversed }),
    }));

    await expect(runSeedV2(db)).rejects.toThrow();
    const line = String(info.mock.calls[0][0]);
    expect(line).toContain(`${V2_QUESTIONS.length - 1} unchanged`);
  });
});
