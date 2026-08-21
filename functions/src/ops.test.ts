// The two uid allowlists, EXECUTED.
//
// WHY THIS EXISTS. `assertOperator` and `assertModerator` are the control
// that stands in for App Check on seven callables (check-appcheck.mjs's
// EXEMPT list) — seedContentV2, which rewrites the whole question bank,
// revealDuelsNowV2, fetchSuggestionsV2, reviewSuggestionV2, and the three
// moderation instruments. Between them they are the entire difference
// between those functions and an open endpoint.
//
// Until this file, no test imported either of them. The only greps outside
// functions/src were COMMENTS in the e2e suites and the scripts, describing
// what the gate does. And every runner sets FUNCTIONS_EMULATOR=true — the
// e2e suites explicitly note that the asserters admit any signed-in caller
// there — so the only arm that had ever run in this repo was the emulator
// bypass. The production branch, the one that actually protects anything,
// had never executed.
//
// So each case below deletes FUNCTIONS_EMULATOR first. That is the whole
// point of the file: what runs in production is the arm nothing else here
// can reach.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertOperator, seedAdmins } from "./ops";
import { assertModerator } from "./moderation";
import type { CallableRequest } from "firebase-functions/v2/https";

// Only `auth.uid` is read; the rest of CallableRequest is irrelevant here
// and building it would be inventing a shape the asserters never touch.
const as = (uid: string | null): CallableRequest =>
  ({ auth: uid ? { uid } : undefined }) as CallableRequest;

const ENV = ["FUNCTIONS_EMULATOR", "SEED_ADMIN_UIDS", "MOD_UIDS"] as const;
let held: Record<string, string | undefined>;

beforeEach(() => {
  held = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  // Production, not the emulator. Every other suite in this repo runs with
  // this set, which is exactly why these branches were never covered.
  delete process.env.FUNCTIONS_EMULATOR;
});

afterEach(() => {
  for (const k of ENV) {
    if (held[k] === undefined) delete process.env[k];
    else process.env[k] = held[k];
  }
});

const codeOf = (fn: () => void): string => {
  try {
    fn();
  } catch (err) {
    return (err as { code?: string }).code ?? "no-code";
  }
  return "did-not-throw";
};

describe.each([
  ["assertOperator", assertOperator, "SEED_ADMIN_UIDS"],
  ["assertModerator", assertModerator, "MOD_UIDS"],
] as const)("%s", (_name, assert, envVar) => {
  it("refuses an unauthenticated caller", () => {
    process.env[envVar] = "u_admin";
    expect(codeOf(() => assert(as(null)))).toBe("unauthenticated");
  });

  it("refuses a signed-in caller who is not on the list", () => {
    process.env[envVar] = "u_admin";
    expect(codeOf(() => assert(as("u_stranger")))).toBe("permission-denied");
  });

  it("admits a caller who is on the list", () => {
    process.env[envVar] = "u_admin";
    expect(() => assert(as("u_admin"))).not.toThrow();
  });

  it("fails CLOSED when the allowlist is unset or empty", () => {
    // The direction that matters. An unset variable is the ordinary state of
    // a fresh deploy, and a gate that read it as "no restriction" would open
    // every exempt callable on exactly the deploy that forgot to set it.
    delete process.env[envVar];
    expect(codeOf(() => assert(as("u_admin")))).toBe("permission-denied");
    process.env[envVar] = "";
    expect(codeOf(() => assert(as("u_admin")))).toBe("permission-denied");
    process.env[envVar] = "  ,  ,";
    expect(codeOf(() => assert(as("u_admin")))).toBe("permission-denied");
  });

  it("reads the list at CALL time, not at module load", () => {
    // The functions runtime sets these from deploy config, and this module
    // is imported once per instance. A value captured at load would mean
    // rotating an allowlist needs a redeploy to take effect — and, worse,
    // that a uid REMOVED from the list keeps working until one happens.
    process.env[envVar] = "u_first";
    expect(() => assert(as("u_first"))).not.toThrow();
    process.env[envVar] = "u_second";
    expect(codeOf(() => assert(as("u_first")))).toBe("permission-denied");
    expect(() => assert(as("u_second"))).not.toThrow();
  });

  it("matches a whole uid, not a prefix of one", () => {
    // `includes` on the SPLIT list rather than on the raw string. On the raw
    // string "u_admin" would admit anyone whose uid contains it, and
    // Firebase uids are 28 characters of client-visible text.
    process.env[envVar] = "u_admin";
    expect(codeOf(() => assert(as("u_admin_evil")))).toBe("permission-denied");
    expect(codeOf(() => assert(as("_admin")))).toBe("permission-denied");
  });

  it("tolerates the spacing a hand-edited deploy variable arrives with", () => {
    process.env[envVar] = " u_one , u_two ";
    expect(() => assert(as("u_one"))).not.toThrow();
    expect(() => assert(as("u_two"))).not.toThrow();
  });

  it("admits anyone under the emulator, which is what the e2e leans on", () => {
    // Recorded, not merely tolerated: the three e2e suites drive these
    // callables as ordinary signed-in accounts and say so in their headers.
    // If this bypass is ever narrowed, those suites are what breaks, and
    // this case is where to read why they were allowed to.
    process.env.FUNCTIONS_EMULATOR = "true";
    delete process.env[envVar];
    expect(() => assert(as("u_anyone"))).not.toThrow();
    // …but an unauthenticated caller is still refused, even there.
    expect(codeOf(() => assert(as(null)))).toBe("unauthenticated");
  });
});

describe("the two allowlists are separate instruments", () => {
  it("an operator is not thereby a moderator, and vice versa", () => {
    // The claim moderation.ts makes in prose — "least privilege cuts both
    // ways: an operator uid is not thereby a moderator, and a leaked
    // moderator credential cannot seed content or trigger reveals" — and
    // the reason the two lists are different variables at all. Reading the
    // same variable would satisfy every case above and break this one.
    process.env.SEED_ADMIN_UIDS = "u_op";
    process.env.MOD_UIDS = "u_mod";
    expect(() => assertOperator(as("u_op"))).not.toThrow();
    expect(codeOf(() => assertModerator(as("u_op")))).toBe("permission-denied");
    expect(() => assertModerator(as("u_mod"))).not.toThrow();
    expect(codeOf(() => assertOperator(as("u_mod")))).toBe("permission-denied");
  });

  it("seedAdmins parses the operator list the way the gate consumes it", () => {
    process.env.SEED_ADMIN_UIDS = " a , b ,, c ";
    expect(seedAdmins()).toEqual(["a", "b", "c"]);
    delete process.env.SEED_ADMIN_UIDS;
    expect(seedAdmins()).toEqual([]);
  });
});
