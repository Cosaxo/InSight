// @vitest-environment jsdom
// TEMPORARY PROBE — delete after running.
import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { installLive } from "./live-fixture";
import { buildS } from "../data/deck";
import fs from "node:fs";
const P = "/tmp/claude-0/-home-user-InSight/65c38bb8-fd18-538c-9a9a-ac88dcd9d874/scratchpad/probe.txt";
const OUT = (...a) => fs.appendFileSync(P, a.join(" ") + "\n");

vi.setConfig({ testTimeout: 20000 });
let App, live, errorSpy;

function seedQuestions() {
  const src = fs.readFileSync("functions/src/v2content.ts", "utf8");
  const start = src.indexOf("export const V2_QUESTIONS");
  const b = src.indexOf("= [", start) + 2;
  let d = 0, i = b, inStr = false, esc = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === "[") d++; else if (c === "]") { d--; if (d === 0) break; }
  }
  return JSON.parse(src.slice(b, i + 1));
}

beforeAll(async () => {
  const specIndex = await import("../spec-index.js");
  await specIndex.loadWorldFeed();
  App = globalThis.App;
});
afterEach(() => { cleanup(); errorSpy?.mockRestore(); live?.restore(); live = undefined; });

function mount(deck, tag) {
  live = installLive();
  live.LIVE.deck = () => deck;
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  render(<App />);
  const kicker = document.querySelector(".kicker");
  const dot = kicker && kicker.parentElement.querySelector("span[aria-hidden]");
  OUT(`[${tag}] kicker=${JSON.stringify(kicker && kicker.textContent)} dot=${JSON.stringify(dot && dot.style.background)}`);
  const opt = [...document.querySelectorAll("button")].map((b) => b.style.background).filter((b) => b && b.includes("oklch")).slice(0, 3);
  OUT(`[${tag}] first option backgrounds: ${JSON.stringify(opt)}`);
  fireEvent.click(screen.getAllByRole("button", { name: /About this question/i })[0]);
  const rows = [...document.querySelectorAll(".wf-sheet-body span")].map((s) => s.textContent);
  OUT(`[${tag}] about rows: ${JSON.stringify(rows)}`);
}

describe("probe", () => {
  it("REAL seeded daily (production vocabulary)", () => {
    const qs = seedQuestions().filter((q) => q.surface === "daily");
    const real = qs.slice(0, 3).map((q, i) =>
      buildS({ ...q }, i, { agg: { total: 11, counts: [7, 4] }, mine: undefined, pending: false }, new Date()));
    OUT(`real S[0]: ${JSON.stringify({ id: real[0].id, cat: real[0].cat, branch: real[0].branch, sub: real[0].sub, dayLabel: real[0].dayLabel })}`);
    mount(real, "REAL SEED");
  });

  it("CONTROL: same question with cat forced to a WORLD_TOPICS id (the fixture's shape)", () => {
    const qs = seedQuestions().filter((q) => q.surface === "daily");
    const ctl = qs.slice(0, 3).map((q, i) =>
      buildS({ ...q, topic: "sport" }, i, { agg: { total: 11, counts: [7, 4] }, mine: undefined, pending: false }, new Date()));
    mount(ctl, "CONTROL cat=sport");
  });
});
