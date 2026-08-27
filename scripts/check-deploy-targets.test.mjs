// check-deploy-targets.test.mjs — pins the firestore deploy-form arm and
// the --force split scanner.
//
// Both arms guard failures that are silent by construction. The form arm
// is FIRESTORE-REGION.md's ask, delivered late: D165 made firebase.json's
// `firestore` key the multi-database ARRAY, under which the sub-target
// spelling `--only "firestore:rules,…"` is firebase-tools#10447's exit-0,
// "Deploy complete!", nothing-deployed shape — and the workflow carried
// exactly that spelling for twelve days after the migration, saved only
// by the lockfile happening to hold a fixed firebase-tools. The fixtures
// below pin the shape that was live wrong, not a hypothetical.
//
// The --force scanner's regex moved from `firestore:` to `\bfirestore\b`
// when the deploy form did — tightening the form must not loosen that
// arm — so the bare-form-under---force case is pinned here too.
import { describe, it, expect } from "vitest";
import {
  workflowSteps,
  forcedFirestoreSteps,
  firestoreFormProblems,
} from "./check-deploy-targets.mjs";

const MULTI_DB = [{ database: "insight", rules: "firestore.rules", indexes: "firestore.indexes.json" }];
const SINGLE_DB = { rules: "firestore.rules", indexes: "firestore.indexes.json" };

const wf = (rulesOnly, { force = false } = {}) => `
jobs:
  deploy:
    steps:
      # The prose above the split names --force and a firestore target on
      # purpose: a scanner that reads its own explanation as the thing it
      # forbids is worse than no scanner.
      - name: Deploy rules + indexes
        run: >
          npx firebase deploy --project x --non-interactive${force ? " --force" : ""}
          --only "${rulesOnly}"
      - name: Deploy functions
        run: >
          npx firebase deploy --project x --non-interactive --force
          --only "functions:deleteAccount,functions:seedContentV2"
`;

describe("firestoreFormProblems", () => {
  it("flags the sub-target form under the multi-database config — the shape that was live", () => {
    const problems = firestoreFormProblems(wf("firestore:rules,firestore:indexes"), MULTI_DB);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/firestore:rules, firestore:indexes/);
    expect(problems[0]).toMatch(/multi-database/);
  });

  it("accepts the bare product form under the multi-database config", () => {
    expect(firestoreFormProblems(wf("firestore"), MULTI_DB)).toEqual([]);
  });

  it("accepts the sub-target form under the single-database object config", () => {
    // The spelling was correct for the whole one-database era; the arm
    // binds to the config, not to a fashion.
    expect(firestoreFormProblems(wf("firestore:rules,firestore:indexes"), SINGLE_DB)).toEqual([]);
  });

  it("refuses vacuity: a workflow with no firestore deploy step is a problem, not a pass", () => {
    const none = `
jobs:
  deploy:
    steps:
      - name: Deploy functions
        run: >
          npx firebase deploy --project x --force --only "functions:deleteAccount"
`;
    const problems = firestoreFormProblems(none, MULTI_DB);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/no step deploys a firestore target/);
  });
});

describe("forcedFirestoreSteps", () => {
  it("catches the sub-target form under --force", () => {
    expect(forcedFirestoreSteps(workflowSteps(wf("firestore:rules", { force: true })))).toHaveLength(1);
  });

  it("catches the bare form under --force — the regex kept up with the form change", () => {
    expect(forcedFirestoreSteps(workflowSteps(wf("firestore", { force: true })))).toHaveLength(1);
  });

  it("passes the split: firestore without --force, --force on functions only", () => {
    expect(forcedFirestoreSteps(workflowSteps(wf("firestore")))).toEqual([]);
  });

  it("does not read comment lines as deploy steps", () => {
    const commented = `
      # npx firebase deploy --force --only "firestore"
      - name: Deploy functions
        run: npx firebase deploy --force --only "functions:x"
`;
    expect(forcedFirestoreSteps(workflowSteps(commented))).toEqual([]);
  });
});
