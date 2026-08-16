// @vitest-environment jsdom
//
// NearLiveBody is the Mirror's Near stop since D111: the Right-now radius
// counter (D84), and since D150 the constellation around it. The card's
// cases moved here verbatim from LiveCohortBody.test.tsx when the stop
// split — the claims are the card's, not the host's, and the host changed.
//
// The presence pitch's honesty cases stay word-for-word, because the cell
// this card fronts is one of the three denies D98 kept.
//
// What D150 adds is the frame around them, and the line it draws. The stop
// is a field again — the prototype's shape, a count above a crowd — but
// nothing in that crowd is named and no node opens. The cases at the
// bottom hold both halves: that the field is THERE (the old body's "a
// count is all this stop will ever draw" was a decision about the whole
// screen taken from a fact about one cell), and that it names nobody.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LIVE = vi.hoisted(() => ({
  enabled: true,
  subscribe: () => () => {},
  myCity: "" as string,
  // The similarity fold behind the field. Empty by default so the counter
  // cases render the field's empty arm rather than a constellation they
  // say nothing about; the field's own cases fill it.
  loadSimilarity: vi.fn(async () => {}),
  similarityLoading: () => false as boolean,
  kindredLoading: () => false as boolean,
  kindredPeople: () => [] as unknown[],
  myTestResults: () => ({}) as Record<string, unknown>,
  near: {
    supported: () => true as boolean,
    on: () => false as boolean,
    count: () => null as number | null,
    tooFew: () => false as boolean,
    updatedAt: () => 0 as number,
    lastError: () => null as string | null,
    enable: vi.fn(async () => ({ ok: true } as { ok: boolean; reason?: string })),
    disable: vi.fn(async () => {}),
    refresh: () => {},
  },
}));
vi.mock("../data/live", () => ({ default: LIVE }));

const { default: NearLiveBody } = await import("./NearLiveBody");

beforeEach(() => {
  LIVE.near.supported = () => true;
  LIVE.near.on = () => false;
  LIVE.near.count = () => null;
  LIVE.near.tooFew = () => false;
  LIVE.near.lastError = () => null;
  LIVE.near.updatedAt = () => 0;
  LIVE.near.refresh = () => {};
  LIVE.myCity = "";
  LIVE.kindredPeople = () => [];
  LIVE.similarityLoading = () => false;
  LIVE.kindredLoading = () => false;
});

// The field is lazily imported (it rides the similarity chunk), so every
// case below reaches it through findBy*, which retries while the chunk
// resolves. `act` alone is not enough: the first render in the file is the
// one that pays for the import.
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// The control is a switch in the corner since D160, not a Turn on / Turn
// off button in a card. Queried by ROLE rather than by its label text: the
// whole point of the change is that the control has no words on it, so a
// text query would be asserting the thing that was removed.
const nearSwitch = () => screen.getByRole("switch") as HTMLButtonElement;

describe("NearLiveBody · the stop is presence, not place (D111)", () => {
  it("renders the counter with no city anywhere in sight", () => {
    render(<NearLiveBody />);
    expect(screen.getByText(/Around you/i)).toBeTruthy();
    expect(nearSwitch()).toBeTruthy();
    expect(nearSwitch().getAttribute("aria-checked")).toBe("false");
    // No city ask, no city name — the stop that needs one is City.
    expect(screen.queryByText(/needs your city/i)).toBeNull();
    expect(screen.queryByText(/Choose your city/i)).toBeNull();
  });

  it("points at the City stop for answers and kindred", () => {
    // The stop shed the city cohort at D111; a user who came here for it
    // must leave with a direction, not a shrug.
    render(<NearLiveBody />);
    expect(screen.getByText("City", { selector: "strong" })).toBeTruthy();
    expect(screen.getByText(/one to the right/i)).toBeTruthy();
  });

  it("says where the cohort went even on a device with no location", () => {
    // supported() false drops the card entirely (nothing to pitch), and
    // the pointer is then the whole body — it must not vanish with it.
    LIVE.near.supported = () => false;
    render(<NearLiveBody />);
    // No switch to offer — but the stop keeps its name and its pointer.
    // Said twice now: once where the figure would be, once in the closing
    // line, and getAllBy is the honest query for that rather than a
    // narrowing that would pass if either disappeared.
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.getAllByText(/can.t share a location/i).length).toBeGreaterThan(0);
    expect(screen.getByText("City", { selector: "strong" })).toBeTruthy();
  });
});

describe("the Right now card (D84 — moved with the stop)", () => {
  it("pitches honestly while off: a count, never who, kilometre-sized", () => {
    render(<NearLiveBody />);
    const text = document.body.textContent || "";
    expect(text).toMatch(/a count, never\s+who/i);
    expect(text).toMatch(/kilometre-sized grid square/i);
    // No 500 m claim anywhere: the coarse permission cannot measure it,
    // and the copy must not promise a radius the sensor cannot hold.
    expect(text).not.toMatch(/500\s?m/i);
  });

  it("says just-you at zero, counts people above it, and 'a few' when floored", () => {
    LIVE.near.on = () => true;
    LIVE.near.count = () => 0;
    render(<NearLiveBody />);
    expect(screen.getByText(/Just you right now/i)).toBeTruthy();
    cleanup();

    LIVE.near.count = () => 3;
    render(<NearLiveBody />);
    // Since D160 the count is the header's FIGURE with its unit beside it,
    // not one sentence — so this asserts the two halves rather than a
    // string that no longer exists in one element.
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText(/within a couple of kilometres/i)).toBeTruthy();
    expect(screen.getByText(/a count, never who/i)).toBeTruthy();
    cleanup();

    // The restored-floor era (D81 revert): the server answers tooFew for
    // 1-4 and the card says so without a number.
    LIVE.near.count = () => null;
    LIVE.near.tooFew = () => true;
    render(<NearLiveBody />);
    expect(screen.getByText(/A few people are around you/i)).toBeTruthy();
  });

  it("turn-on runs enable and a refusal lands as a sentence, not a dead card", async () => {
    LIVE.near.enable = vi.fn(async () => ({ ok: false, reason: "denied" }));
    render(<NearLiveBody />);
    fireEvent.click(nearSwitch());
    expect(LIVE.near.enable).toHaveBeenCalled();
    expect(await screen.findByText(/Near stays off until you allow location/i)).toBeTruthy();
  });

  it("turn-off calls disable — the doc-delete promise rides on it", async () => {
    LIVE.near.on = () => true;
    LIVE.near.count = () => 2;
    LIVE.near.disable = vi.fn(async () => {});
    render(<NearLiveBody />);
    expect(nearSwitch().getAttribute("aria-checked")).toBe("true");
    fireEvent.click(nearSwitch());
    expect(LIVE.near.disable).toHaveBeenCalled();
  });
});

// ── the stall (reported from a device: "Near seems to never connect") ──
//
// The switch goes on, the first beat fails, and every beat after it is four
// minutes apart — so the card sat on "Counting…" for the rest of the
// session. The store had the reason the whole time (LIVE.near.lastError(),
// set on every failed beat) and the card read it NOWHERE: the only consumer
// of that member in the tree was this file's mock. These cases pin that the
// reason reaches the screen and that there is a way out of it that does not
// involve restarting the app.
describe("a beat that fails says so, and offers a way out", () => {
  it("a permission revoked mid-run replaces 'Counting…' with the reason", () => {
    LIVE.near.on = () => true;
    LIVE.near.count = () => null;
    LIVE.near.lastError = () => "denied";
    render(<NearLiveBody />);
    expect(screen.queryByText(/Counting/i), "the card is still counting a count that failed").toBeNull();
    expect(screen.getByText(/switched off for InSight/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Try again/i })).toBeTruthy();
  });

  it("keeps a count that arrived earlier and dates it, rather than dropping it", () => {
    // A failed beat does not invalidate the last good one — it makes it
    // old. Blanking the number would throw away the only true thing on the
    // card; showing it undated would claim it is current.
    LIVE.near.on = () => true;
    LIVE.near.count = () => 4;
    LIVE.near.updatedAt = () => Date.now() - 9 * 60_000;
    LIVE.near.lastError = () => "timeout";
    render(<NearLiveBody />);
    // The figure survives the failed beat (D160 moved it into the header,
    // where it was already going to be) — what changes is that it is now
    // dated underneath rather than presented as current.
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText(/9 min ago/i)).toBeTruthy();
  });

  it("Try again runs another beat", async () => {
    LIVE.near.on = () => true;
    LIVE.near.lastError = () => "unavailable";
    LIVE.near.refresh = vi.fn(() => {});
    render(<NearLiveBody />);
    fireEvent.click(screen.getByRole("button", { name: /Try again/i }));
    expect(LIVE.near.refresh).toHaveBeenCalled();
  });

  it("says nothing about a failure while the counter is off", () => {
    // lastError outlives a turn-off only if stopPresence missed it; either
    // way an error read off a switched-off counter is last session's, and
    // the card must not put it under a pitch that has not been accepted.
    LIVE.near.on = () => false;
    LIVE.near.lastError = () => "denied";
    render(<NearLiveBody />);
    expect(screen.queryByText(/switched off for InSight/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Try again/i })).toBeNull();
  });
});

// ── the stop is a field again (D150) ─────────────────────────────────
describe("NearLiveBody · the constellation, with nobody named", () => {
  // The KindredPerson shape the similarity fold hands back. Named on
  // purpose: the point of these cases is that a name IS available here and
  // the field still does not draw one.
  const person = (uid: string, match: number) => ({
    uid, name: `Name ${uid}`, city: "Oslo, NO", results: null,
    like: { shared: 4, same: 3, pct: match },
  });

  it("draws the field, not only a counter", async () => {
    // The claim the old body made — "a count is the only thing this stop
    // will ever draw" — was a decision about the whole screen taken from a
    // fact about the presence cell. The people of your city are real, the
    // app already ranks them one stop over, and drawing them anonymously
    // claims nothing about who is standing near you.
    LIVE.myCity = "Oslo, NO";
    LIVE.kindredPeople = () => [person("a", 80), person("b", 60)];
    render(<NearLiveBody />);
    expect(await screen.findByText(/closer to you = more alike/i)).toBeTruthy();
    expect(screen.getByRole("group", { name: /closer to the centre is more like you/i })).toBeTruthy();
  });

  it("names nobody, and offers nothing to open", async () => {
    // The deny, drawn. Near cannot tell you who is around you, so its
    // field is the SHAPE of a crowd — no names, no initials, and no node
    // you could tap a person out of. A field you can open is a directory.
    LIVE.myCity = "Oslo, NO";
    LIVE.kindredPeople = () => [person("a", 80), person("b", 60)];
    const { container } = render(<NearLiveBody />);
    expect(await screen.findByText(/nobody is named here/i)).toBeTruthy();
    expect(screen.queryByText(/Name a/)).toBeNull();
    expect(screen.queryByText(/Name b/)).toBeNull();
    // The one interactive control on the stop is the permission toggle.
    // Every node in the field is inert.
    expect(container.querySelectorAll("svg [role='button']")).toHaveLength(0);
    expect(container.querySelectorAll("svg text")).toHaveLength(1); // "you"
  });

  it("draws the ring even with nobody in it (D160)", async () => {
    // Reported from a device: the constellation is the Mirror's whole
    // grammar, and every field REPLACED itself with a paragraph the moment
    // it had nobody to place — so a new account met a sentence where the
    // drawing goes, on every stop, until strangers turned up. It reads as a
    // screen that was never built rather than one that is empty, and it
    // hides the grammar from exactly the reader who has not learned it.
    //
    // "You, and nobody placed around you yet" is a TRUE picture, node for
    // node, so nothing here is fabricated — the rings are the scale, and
    // the empty ring is the honest state of the data.
    LIVE.myCity = "Oslo, NO";
    LIVE.kindredPeople = () => [];
    const { container } = render(<NearLiveBody />);
    expect(await screen.findByRole("group", { name: /closer to the centre is more like you/i })).toBeTruthy();
    // You at the centre, and nobody else — one text node in the whole svg.
    expect(container.querySelectorAll("svg text")).toHaveLength(1);
    // …and the explanation still follows it rather than replacing it.
    expect(screen.getByText(/Nobody from Oslo yet/i)).toBeTruthy();
  });

  it("draws the ring before a city is set, too", async () => {
    // The other empty arm, and the one a brand-new account hits first.
    LIVE.myCity = "";
    LIVE.kindredPeople = () => [];
    const { container } = render(<NearLiveBody />);
    expect(await screen.findByRole("group", { name: /closer to the centre is more like you/i })).toBeTruthy();
    expect(container.querySelectorAll("svg text")).toHaveLength(1);
    expect(screen.getByText(/Set your city/i)).toBeTruthy();
  });

  it("keeps the two numbers attached to what each counts", async () => {
    // The D112 honesty rule, and the whole reason this stop can carry a
    // field at all: the figure counts phones near you right now, the ring
    // counts people in your city. One caption spanning both is how a
    // screen starts claiming it knows who is standing next to you.
    LIVE.myCity = "Oslo, NO";
    LIVE.near.on = () => true;
    LIVE.near.count = () => 2847;
    LIVE.kindredPeople = () => [person("a", 80)];
    render(<NearLiveBody />);
    expect(await screen.findByText(/1 person in Oslo/)).toBeTruthy();
    expect(screen.getByText("2,847")).toBeTruthy();
    expect(screen.getByText(/within a couple of kilometres · Oslo/)).toBeTruthy();
  });

  it("asks for a city rather than drawing an empty ring", async () => {
    LIVE.kindredPeople = () => [person("a", 80)];
    render(<NearLiveBody />);
    expect(await screen.findByText(/Set your city/i)).toBeTruthy();
  });

  it("separates 'still working it out' from 'nobody yet'", async () => {
    LIVE.myCity = "Oslo, NO";
    LIVE.similarityLoading = () => true;
    render(<NearLiveBody />);
    expect(await screen.findByText(/working out who around you/i)).toBeTruthy();

    cleanup();
    LIVE.similarityLoading = () => false;
    render(<NearLiveBody />);
    expect(await screen.findByText(/Nobody from Oslo yet/i)).toBeTruthy();
  });
});


// ── the rule the whole Near stop rests on ────────────────────────────
//
// A source guard rather than a render assertion, on purpose: what has to
// hold is a property of how the field is CONSTRUCTED, and the two ways to
// break it both still render something plausible. The precedent is
// LiveCohortBody.test.tsx's floor-literal check — same shape, same reason.
//
// If the room reading (NEXT-FUNCTIONALITY §10) is ever built, this is the
// case it has to keep passing.
describe("NearField · a node is a radius, never a place and never a join key", () => {
  const src = () => readFileSync(
    resolve(__dirname, "../../..", "src/v2/ui/LiveSimilarityField.tsx"), "utf8",
  );
  const nearField = () => {
    const s = src();
    const i = s.indexOf("function NearField");
    expect(i, "NearField was renamed — this guard is now watching nothing").toBeGreaterThan(-1);
    // To the next top-level function: the guard must not read its neighbours.
    const j = s.indexOf("\nfunction ", i + 1);
    return s.slice(i, j > -1 ? j : undefined);
  };

  it("draws Near anonymously and gives its nodes no label", () => {
    const f = nearField();
    expect(f, "Near stopped drawing anonymous nodes").toMatch(/kind="anon"/);
    // The empty label is the join-key defence: everything a node could
    // carry (type, age band, trade, answers) is world-readable under D98
    // and none of it is sensitive alone — but together they identify a
    // named public account, and then the node has said where that person
    // is standing. A radius alone gives nothing to join on.
    expect(f, "a Near node grew a label — that is a join key").toMatch(/label:\s*""/);
  });

  it("places nodes by likeness and never by a coordinate", () => {
    const f = nearField();
    // `match` is the radius. A coordinate reaching this canvas would turn
    // an anonymous field into a map of where strangers are standing, which
    // is what v2_presence's `allow read: if false` exists to prevent.
    expect(f, "Near stopped placing nodes by match").toMatch(/match:/);
    expect(f, "a coordinate reached the Near field")
      .not.toMatch(/\b(lat|lon|lng|latitude|longitude|coord|cell)\b/i);
  });

  it("says nobody is named, in the copy a reader actually sees", () => {
    expect(nearField()).toMatch(/Nobody is named here/i);
  });
});
