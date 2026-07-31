// @vitest-environment jsdom
//
// PickSearch is the input side of catalog questions (D14/D15). What it emits
// is an `entity` — an integer catalogue key that the answer document carries
// in place of optionIdx, and that `onV2AnswerCreated` validates against the
// question's own domain. An id outside that domain's key space never
// aggregates: the write succeeds, rules accept it, and the answer simply
// vanishes from the canon with nothing logged on the client.
//
// So the properties worth executing are the ones about identity and honesty:
//   - the id handed up is the catalogue's own key, not the row's position in
//     a filtered result list;
//   - each domain searches ITS OWN store, because DOMAINS is a lookup by
//     string and an unknown key silently falls back to pokemon — which
//     would offer a Pokédex under a films prompt;
//   - "not listed" is a real answer, distinct from picking nothing, because
//     a curated top list is not a census and pretending otherwise puts every
//     unlisted favourite into the nearest listed one.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// Each store is mocked with rows whose ids are deliberately NOT their index,
// so "emits the catalogue key" and "emits the row position" are
// distinguishable — with 0,1,2 ids they would be the same assertion.
const stores = vi.hoisted(() => ({
  pokedex: [
    { dex: 25, name: "Pikachu" },
    { dex: 143, name: "Snorlax" },
  ],
  films: [
    { key: 47703, name: "Seven Samurai" },
    { key: 8452, name: "Stalker" },
  ],
  artists: [
    { key: 1299, name: "Nina Simone" },
  ],
}));

const catalogStore = (rows: () => Array<{ key: number; name: string }>) => ({
  load: async () => rows(),
  peek: () => rows(),
  search: (es: Array<{ key: number; name: string }>, q: string, max: number) =>
    es.filter((e) => e.name.toLowerCase().includes(q.toLowerCase())).slice(0, max),
});

vi.mock("../data/pokedex", () => ({
  default: {
    load: async () => stores.pokedex,
    peek: () => stores.pokedex,
    search: (ss: Array<{ dex: number; name: string }>, q: string, max: number) =>
      ss.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())).slice(0, max),
  },
}));
vi.mock("../data/catalogs", () => ({
  FILMS: catalogStore(() => stores.films),
  ARTISTS: catalogStore(() => stores.artists),
}));

const { default: PickSearch } = await import("./PickSearch");

function mount(domain: string) {
  const onPick = vi.fn();
  const onNotListed = vi.fn();
  render(<PickSearch domain={domain} accent="var(--ink)" onPick={onPick} onNotListed={onNotListed} />);
  // Collapsed until opened, same shape as CityPicker.
  fireEvent.click(screen.getAllByRole("button")[0]);
  return { onPick, onNotListed };
}
const type = (q: string) => fireEvent.change(screen.getByRole("combobox"), { target: { value: q } });
const choose = async (re: RegExp) => {
  await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(0));
  const opt = screen.getAllByRole("option").find((o) => re.test(o.textContent || ""));
  expect(opt, `no result matched ${re}`).toBeTruthy();
  fireEvent.pointerDown(opt!);
};

afterEach(cleanup);

describe("PickSearch · it emits the catalogue key, not the row position", () => {
  it("hands up the dex number for a Pokédex pick", async () => {
    const { onPick } = mount("pokemon");
    type("Snorlax");
    await choose(/Snorlax/);
    // 143, not 1 — the second row of the result list.
    expect(onPick).toHaveBeenCalledWith(143);
  });

  it("hands up the QID key for a films pick", async () => {
    const { onPick } = mount("films");
    type("Stalker");
    await choose(/Stalker/);
    expect(onPick).toHaveBeenCalledWith(8452);
  });

  it("never emits 0, which is reserved for 'not listed'", async () => {
    // D14: `entity` is an integer catalogue key with 0 = "Not listed". A
    // picked row emitting 0 would file a real choice as a non-answer.
    const { onPick } = mount("pokemon");
    type("Pikachu");
    await choose(/Pikachu/);
    expect(onPick.mock.calls[0][0]).not.toBe(0);
    expect(Number.isInteger(onPick.mock.calls[0][0])).toBe(true);
  });
});

describe("PickSearch · each domain searches its own catalogue", () => {
  it("offers films for the films domain and no Pokémon", async () => {
    mount("films");
    type("a");
    await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(0));
    const text = screen.getAllByRole("option").map((o) => o.textContent).join(" ");
    expect(text).toMatch(/Seven Samurai|Stalker/);
    expect(text).not.toMatch(/Pikachu|Snorlax/);
  });

  it("offers artists for the artists domain", async () => {
    mount("artists");
    type("Nina");
    await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(0));
    expect(screen.getAllByRole("option")[0].textContent).toMatch(/Nina Simone/);
  });

  it("falls back to pokemon for an unknown domain rather than rendering empty", () => {
    // DOMAINS is a string lookup with `|| DOMAINS.pokemon`. The fallback is
    // deliberate — a bank question with a typo'd domain still renders
    // something usable — but it is worth pinning, because the same line is
    // why a MISSING domain silently offers the wrong catalogue.
    mount("nonsense");
    expect(screen.getByRole("combobox").getAttribute("placeholder")).toMatch(/Pokédex/i);
  });
});

describe("PickSearch · 'not listed' is a real answer", () => {
  it("reports it separately from picking a row", () => {
    const { onPick, onNotListed } = mount("films");
    const notListed = screen.getAllByRole("button").find((b) => /not listed/i.test(b.textContent || ""));
    expect(notListed, "the not-listed control is missing").toBeTruthy();
    fireEvent.pointerDown(notListed!);
    expect(onNotListed).toHaveBeenCalledTimes(1);
    // Not routed through onPick with a sentinel — the card decides what 0
    // means, and conflating the two here would hide the distinction.
    expect(onPick).not.toHaveBeenCalled();
  });

  it("says the list is curated when a film search misses", async () => {
    // The honest miss. A curated top list that says "no match" full stop
    // reads as "your favourite does not exist".
    mount("films");
    type("zzzzz");
    expect(await screen.findByText(/curated top list, not everything ever made/i)).toBeTruthy();
  });

  it("says the opposite for the Pokédex, which IS complete", async () => {
    // Every species is in there, so "check the spelling" is the useful
    // advice and "curated" would be wrong.
    mount("pokemon");
    type("zzzzz");
    expect(await screen.findByText(/every species is in here/i)).toBeTruthy();
  });
});
