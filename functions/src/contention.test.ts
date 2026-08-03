// D7's write ceiling is only observable if the trigger counts its own
// transaction attempts — Firestore retries an ABORTED transaction inside
// runTransaction, so nothing else in the system can see it happen.
//
// What these pin is the reporting rule, not Firestore's retry contract:
// the threshold (silent at 1 and 2, loud at 3), that the log line carries
// the qid an operator needs to act on, and that a failing body still
// throws. That last one is the regression worth guarding — wrapping a
// transaction in a counter is exactly the shape of change that swallows an
// error by accident, and a silently-swallowed fold is an answer that never
// reaches the aggregate.
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { logger } from "firebase-functions";
import { runAggTransaction } from "./v2";

// A Firestore stand-in whose runTransaction invokes the callback `times`
// times, the way the real one does when it hits contention and retries.
function dbRunning(times: number) {
  return {
    runTransaction: async (cb: (tx: unknown) => Promise<void>) => {
      let last: unknown;
      for (let i = 0; i < times; i++) last = await cb({} as unknown);
      return last;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
});

describe("runAggTransaction contention reporting", () => {
  it("says nothing on the uncontended path", async () => {
    await runAggTransaction(dbRunning(1), "daily-000", async () => {});
    expect(warn).not.toHaveBeenCalled();
  });

  it("still says nothing at two attempts — one retry is ordinary interleaving", async () => {
    await runAggTransaction(dbRunning(2), "daily-000", async () => {});
    expect(warn).not.toHaveBeenCalled();
  });

  it("logs at three attempts, with the qid and the count", async () => {
    await runAggTransaction(dbRunning(3), "daily-007", async () => {});
    expect(warn).toHaveBeenCalledTimes(1);
    const [message, fields] = warn.mock.calls[0];
    expect(message).toContain("daily-007");
    // The structured half is what the log-based metric filters on
    // (monitoring/onV2AnswerCreated-contention.json). A message-only log
    // would satisfy a human reading the console and match no metric.
    expect(fields).toMatchObject({ metric: "agg_contention", qid: "daily-007", attempts: 3 });
  });

  it("keeps counting past the threshold rather than reporting a flat 3", async () => {
    await runAggTransaction(dbRunning(9), "daily-007", async () => {});
    expect(warn.mock.calls[0][1]).toMatchObject({ attempts: 9 });
  });

  it("runs the body once per attempt", async () => {
    const body = vi.fn(async () => {});
    await runAggTransaction(dbRunning(4), "daily-000", body);
    expect(body).toHaveBeenCalledTimes(4);
  });

  it("propagates a failing body instead of swallowing it", async () => {
    await expect(
      runAggTransaction(dbRunning(1), "daily-000", async () => {
        throw new Error("fold failed");
      }),
    ).rejects.toThrow("fold failed");
    // …and does not report contention for a transaction that never got
    // far enough to contend.
    expect(warn).not.toHaveBeenCalled();
  });
});
