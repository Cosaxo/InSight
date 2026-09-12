// The sweep's plan — that it reads every step form, and that it refuses
// rather than shrinks.
//
// Two of these pin defects that were live in the first draft of
// verify-plan.mjs, which is why they are the first two cases: the
// extractor matched `- run:` only and silently missed the `- name:` +
// `run:` form (both `npm audit` steps in ci.yml are written that way, so
// two real checks were invisible), and the classifier's unknown case
// returned a skip rather than a failure, which would have made a new CI
// step disappear from the sweep with nothing going red. Those are the same
// class of defect the whole script exists to close, so they are held here
// rather than trusted.
//
// The live cases at the bottom are the ones that matter over time: the
// real workflows must classify completely, and every gate the plan means
// to run must exist in package.json. A workflow that grows a step form
// nobody taught this module fails there, at the moment it is added.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractSteps, classify, buildPlan } from "./verify-plan.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wf = (f) => readFileSync(join(root, ".github/workflows", f), "utf8");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

describe("extractSteps", () => {
  it("reads the `- name:` + `run:` form, not only `- run:`", () => {
    // Exactly ci.yml's audit job shape. Matching `- run:` alone returned
    // one step here and dropped the labelled one.
    const src = [
      "jobs:",
      "  audit:",
      "    steps:",
      "      - run: npm ci",
      "      - name: Audit app dependencies (runtime only)",
      "        run: npm audit --omit=dev --audit-level=high",
    ].join("\n");
    expect(extractSteps(src).map((s) => s.command)).toEqual([
      "npm ci",
      "npm audit --omit=dev --audit-level=high",
    ]);
  });

  it("ignores full-line YAML comments", () => {
    // These workflows explain themselves in comments, so the steps most
    // likely to be described are the ones a raw match gets wrong — the
    // same reasoning gate-placement.mjs carries.
    const src = [
      "      # - run: npm run check:retired",
      "      - run: npm run check:globals",
      "      #- run: npm run check:alsoretired",
    ].join("\n");
    expect(extractSteps(src).map((s) => s.command)).toEqual(["npm run check:globals"]);
  });

  it("keeps a `run: |` block as ONE step carrying its body", () => {
    // Line-by-line would classify `if`, `echo` and `git` as three steps
    // and could class one of them as a gate.
    const src = [
      "      - name: Report sync drift",
      "        run: |",
      "          if ! git diff --quiet -- android ios; then",
      '            echo "::warning::drift"',
      "          fi",
      "      - run: npm run check:globals",
    ].join("\n");
    const steps = extractSteps(src);
    expect(steps).toHaveLength(2);
    expect(steps[0].block).toBe(true);
    expect(steps[0].command).toContain("if ! git diff");
    expect(steps[0].command).toContain("fi");
    expect(steps[1].command).toBe("npm run check:globals");
  });

  it("does not swallow a step that follows a block at the same indent", () => {
    const src = [
      "      - run: |",
      "          echo one",
      "      - run: npm run lint",
    ].join("\n");
    expect(extractSteps(src).map((s) => s.command)).toEqual(["echo one", "npm run lint"]);
  });

  it("carries the step's own env:", () => {
    // ci.yml's build step. Dropping this env runs a DEMO build, and
    // check:bundle then refuses to grade it — a red that is about the
    // runner rather than the tree, which is how a gate loses its meaning.
    const src = [
      "      - run: npm run build",
      "        env:",
      "          VITE_SENTRY_DSN: https://ci@example.invalid/0",
      '          VITE_V2_LIVE: "true"',
      "      - run: npm run check:bundle",
    ].join("\n");
    const steps = extractSteps(src);
    expect(steps[0].env).toEqual({
      VITE_SENTRY_DSN: "https://ci@example.invalid/0",
      VITE_V2_LIVE: "true",   // quotes stripped — a shell env value is a string
    });
    // and the env block is not mistaken for the end of the step list
    expect(steps[1].command).toBe("npm run check:bundle");
    expect(steps[1].env).toEqual({});
  });

  it("carries working-directory:", () => {
    const src = [
      "      - run: ./gradlew assembleDebug",
      "        working-directory: android",
    ].join("\n");
    expect(extractSteps(src)[0].cwd).toBe("android");
  });
});

describe("classify", () => {
  it("names the prerequisite rather than just skipping", () => {
    expect(classify("npm run test:rules").kind).toBe("emulator");
    expect(classify("npm run test:e2e:all").need).toMatch(/Java 21/);
    expect(classify("./gradlew assembleDebug --no-daemon").kind).toBe("native");
    expect(classify("npx cap sync android").kind).toBe("native");
    expect(classify("npm ci --prefix functions").kind).toBe("setup");
    expect(classify("npm audit --omit=dev --audit-level=high").kind).toBe("network");
  });

  it("calls the ordinary gates gates, in both prefix forms", () => {
    expect(classify("npm run check:globals").kind).toBe("gate");
    expect(classify("npm run test:unit").kind).toBe("gate");
    expect(classify("npm run build --prefix functions").kind).toBe("gate");
    expect(classify("npm run test --prefix functions").kind).toBe("gate");
  });

  it("returns null for a command it has not been taught", () => {
    // The load-bearing case. A skip here would mean a new CI step leaves
    // the sweep silently; null is what makes verify.mjs exit 1 and name it.
    expect(classify("bundle exec fastlane beta")).toBeNull();
    expect(classify("python3 scripts/whatever.py")).toBeNull();
  });

  it("does not mistake an emulator suite for a plain gate", () => {
    // `test:e2e` shares a prefix with nothing else, but `test:rules:baseline`
    // WRITES a baseline — it must never be picked up as a runnable gate.
    expect(classify("npm run test:rules:baseline").kind).toBe("emulator");
  });
});

describe("buildPlan", () => {
  it("dedupes a command wired into two workflows, first occurrence winning", () => {
    // Five gates are deliberately on both ci.yml and backend-checks.yml so
    // that what guards a PR guards production. The sweep runs them once.
    const plan = buildPlan([
      ["ci.yml", "      - run: npm run check:anchors\n      - run: npm run lint\n"],
      ["backend-checks.yml", "      - run: npm run check:anchors\n"],
    ]);
    expect(plan.gate.map((r) => r.command)).toEqual(["npm run check:anchors", "npm run lint"]);
    expect(plan.gate[0].file).toBe("ci.yml");
  });

  it("collects unknowns instead of dropping them", () => {
    const plan = buildPlan([["ci.yml", "      - run: rustc --version\n"]]);
    expect(plan.gate).toHaveLength(0);
    expect(plan.unknown).toEqual([{ file: "ci.yml", command: "rustc --version" }]);
  });
});

describe("the real workflows", () => {
  const sources = [["ci.yml", wf("ci.yml")], ["backend-checks.yml", wf("backend-checks.yml")]];
  const plan = buildPlan(sources);

  it("classify completely — no step the sweep would silently skip", () => {
    expect(plan.unknown, `teach classify() about: ${plan.unknown.map((u) => u.command).join(" | ")}`)
      .toEqual([]);
  });

  it("names only npm scripts that exist", () => {
    const missing = plan.gate
      .map((r) => r.command.replace(/^npm run /, "").replace(/ --prefix \w+$/, ""))
      .filter((s) => !pkg.scripts[s] && s !== "test" && s !== "build");
    expect(missing).toEqual([]);
  });

  it("covers the lint job's gates, test:scripts included", () => {
    // test:scripts is the runner that hides in the lint job — CLAUDE.md §2
    // names it as having shipped breakage three times. If the sweep ever
    // stops covering it, this is the line that says so.
    const cmds = plan.gate.map((r) => r.command);
    expect(cmds).toContain("npm run test:scripts");
    expect(cmds).toContain("npm run lint");
    expect(cmds).toContain("npm run test:unit");
    expect(cmds).toContain("npm run test --prefix functions");
  });

  it("reads the real build step's shipping-bundle env", () => {
    // The live version of the unit case above: if ci.yml's build step ever
    // changes which variables it sets, the sweep picks that up rather than
    // building something check:bundle will not grade.
    const build = plan.gate.find((r) => r.command === "npm run build");
    expect(build.env.VITE_V2_LIVE).toBe("true");
    expect(build.env.VITE_SENTRY_DSN).toBeTruthy();
  });

  it("defers the emulator and native steps rather than running them", () => {
    const deferred = plan.deferred.map((r) => r.command);
    expect(deferred).toContain("npm run test:rules");
    expect(deferred).toContain("npm run test:e2e:all");
    expect(plan.gate.map((r) => r.command)).not.toContain("npm run test:rules");
  });
});
