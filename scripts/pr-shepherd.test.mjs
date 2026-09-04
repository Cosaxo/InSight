// pr-shepherd.test.mjs — the shepherd Action's decision, case by case.
//
// The lane merges on the owner's behalf, so the cases that matter most are
// the ones where it must REFUSE. Every refusal below is a way the label could
// have been spent on something the owner did not mean, and each is here
// because the alternative is a merge nobody reviews.

import { describe, it, expect } from "vitest";
import { verdict, runLogLine, shouldLog, LABEL, OPT_OUT } from "./pr-shepherd-lib.mjs";

const green = [
  { name: "lint", status: "completed", conclusion: "success" },
  { name: "unit-tests", status: "completed", conclusion: "success" },
];
const pr = (over = {}) => ({
  number: 1, draft: false, labels: [LABEL], mergeable: true, mergeable_state: "clean",
  head: { sha: "abcdef1234567890" }, ...over,
});

describe("what it merges", () => {
  it("merges a labelled PR that is green and mergeable", () => {
    const v = verdict(pr(), green);
    expect(v.action).toBe("merge");
    expect(v.why).toMatch(/2 checks green on abcdef12/);
  });

  it("counts neutral and skipped as green — a skipped job is not a red one", () => {
    const v = verdict(pr(), [...green, { name: "ios", status: "completed", conclusion: "skipped" }]);
    expect(v.action).toBe("merge");
  });
});

describe("what it will not touch", () => {
  it("says nothing about an unlabelled PR — the label is the whole scope", () => {
    expect(verdict(pr({ labels: [] }), green)).toEqual({ action: "skip", why: "not labelled" });
  });

  it("honours no-shepherd even with the merge label on", () => {
    expect(verdict(pr({ labels: [LABEL, OPT_OUT] }), green).action).toBe("skip");
  });

  it("leaves a draft alone", () => {
    expect(verdict(pr({ draft: true }), green).action).toBe("skip");
  });
});

describe("what it refuses, and reports", () => {
  // THE ONE THAT WOULD MERGE UNEXAMINED. every() on an empty array is true,
  // so a PR whose CI never started reads as "nothing failed" to the obvious
  // implementation. Zero checks is not green.
  it("refuses a PR with NO checks rather than reading empty as passing", () => {
    const v = verdict(pr(), []);
    expect(v.action).toBe("report");
    expect(v.why).toMatch(/zero checks is not green/);
  });

  it("refuses when a check is still running, and names it", () => {
    const v = verdict(pr(), [...green, { name: "simulator-build", status: "in_progress", conclusion: null }]);
    expect(v.action).toBe("report");
    expect(v.why).toMatch(/simulator-build/);
  });

  it("refuses on a red check, and names it with its conclusion", () => {
    const v = verdict(pr(), [...green, { name: "backend / e2e", status: "completed", conclusion: "failure" }]);
    expect(v.action).toBe("report");
    expect(v.why).toMatch(/backend \/ e2e \(failure\)/);
  });

  // null means "still computing", which is not false. Reading it as false
  // reports a conflict that does not exist and would strand the PR.
  it("treats mergeable:null as not-yet, not as a conflict", () => {
    const v = verdict(pr({ mergeable: null, mergeable_state: "unknown" }), green);
    expect(v.action).toBe("report");
    expect(v.why).toMatch(/has not finished computing/);
  });

  it("refuses a conflict and says whose job it is", () => {
    const v = verdict(pr({ mergeable: false, mergeable_state: "dirty" }), green);
    expect(v.action).toBe("report");
    expect(v.why).toMatch(/session's to resolve/);
  });

  it("refuses a blocked head even with every check green", () => {
    const v = verdict(pr({ mergeable_state: "blocked" }), green).action;
    expect(v).toBe("report");
  });
});

describe("the run log", () => {
  // A lane that writes only when it acts cannot be told from one that is
  // dead — which is the whole reason this program has a run log at all.
  it("writes a line even when there was nothing to do", () => {
    const s = runLogLine({ when: "2026-09-03 20:55 UTC", skipped: 9 });
    expect(s).toMatch(/nothing labelled/);
    expect(s).toMatch(/9 open PR\(s\)/);
  });

  it("names what it merged and what it would not, with the reason", () => {
    const s = runLogLine({
      when: "x", merged: [{ number: 383, sha: "abb54572aa01" }],
      reported: [{ number: 341, why: "not mergeable (dirty)" }], skipped: 4,
    });
    expect(s).toMatch(/#383/);
    expect(s).toMatch(/abb54572/);
    expect(s).toMatch(/#341/);
    expect(s).toMatch(/not mergeable \(dirty\)/);
  });
});

describe("when it speaks", () => {
  // The schedule is the heartbeat and always writes. The check_suite trigger
  // is what makes a green PR merge in minutes rather than in three hours, but
  // it fires dozens of times a day — an idle line for each would bury the run
  // log in its own noise, which is the 2026-09-02 failure one layer up.
  it("a scheduled run writes even with nothing to say", () => {
    expect(shouldLog({ event: "schedule" })).toBe(true);
  });

  it("a check_suite wake with nothing to say stays silent", () => {
    expect(shouldLog({ event: "check_suite" })).toBe(false);
  });

  it("…but speaks the moment it merged or refused something", () => {
    expect(shouldLog({ event: "check_suite", merged: [{ number: 1, sha: "a" }] })).toBe(true);
    expect(shouldLog({ event: "pull_request_target", reported: [{ number: 2, why: "red" }] })).toBe(true);
  });
});
