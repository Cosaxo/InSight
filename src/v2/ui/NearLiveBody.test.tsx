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
  // D181: the field draws the ROOM now, so it reaches for the roster and
  // the cross-user scores that place it — the same batched fetch the
  // People tab uses.
  loadNames: async () => {},
  scoresFor: (uid: string) => (uid ? null : null) as Record<string, Record<string, number>> | null,
  near: {
    supported: () => true as boolean,
    on: () => false as boolean,
    // D174's three states. The mock defaults to the timed one because
    // that is what enable() lands on, so a case that only flips `on`
    // gets the shape a real opt-in produces.
    mode: () => "session" as "off" | "session" | "always",
    until: () => Date.now() + 90 * 60_000,
    count: () => null as number | null,
    // D176's room mix — null by default, which is the quiet-street case.
    mix: () => null as { top: string[]; n: number; capped?: boolean } | null,
    tooFew: () => false as boolean,
    updatedAt: () => 0 as number,
    lastError: () => null as string | null,
    enable: vi.fn(async () => ({ ok: true } as { ok: boolean; reason?: string })),
    disable: vi.fn(async () => {}),
    refresh: () => {},
    // D177's room. The tab BODIES are lazy and have their own file; what
    // this fixture has to carry is enough for the row to mount.
    room: () => null as { people: Array<{ uid: string; type?: string }>;
      qs: Record<string, Record<string, number>> } | null,
    roomLoading: () => false as boolean,
    loadRoom: async () => {},
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
  LIVE.near.room = () => null;
  LIVE.near.roomLoading = () => false;
  LIVE.myTestResults = () => ({});
  LIVE.scoresFor = () => null;
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

// A room of two, both scored, so the field has somebody to place. Since
// D181 the field draws the ROOM rather than the city, so what makes a node
// is a presence roster entry plus a cross-user test score — not a kindred
// row.
//
// AT FILE SCOPE since D184, because two describes need it: the field's own
// block, and the constellation block it was declared in. The copy this
// fixture makes visible (namelessness, the basis) moved back onto the
// field, and a claim asserted from two angles should not be asserted
// against two fixtures.
const roomOfTwo = () => {
  LIVE.near.on = () => true;
  LIVE.near.room = () => ({ people: [{ uid: "a" }, { uid: "b" }], qs: {} });
  // Three axes on BOTH sides: scoreMatch refuses under three shared, so a
  // one-dim fixture would silently render the "nobody has taken it" arm and
  // the case would pass for the wrong reason.
  LIVE.myTestResults = () => ({
    big5: { dims: [{ id: "o", value: 60 }, { id: "c", value: 55 }, { id: "e", value: 45 }] },
  });
  LIVE.scoresFor = (uid: string) => ({
    a: { big5: { o: 62, c: 50, e: 40 } },
    b: { big5: { o: 20, c: 80, e: 70 } },
  }[uid] || null);
};

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

  it("puts nothing at all under the tab row", () => {
    // WHAT THIS REPLACES (D184): two tests that pinned "your whole city is
    // one stop right" — the stop's closing line, which lived UNDER the tab
    // row. It was there because D111 shed the city cohort and D172 cut the
    // explanation down to a pointer; what finally removed it is that the
    // ruler at the top of this stop already draws Near and City side by
    // side, one apart, and a paragraph below a tab row reads as a caption
    // for the tabs.
    //
    // So this asserts the SHAPE rather than any sentence: the row is the
    // last thing in the body. A future caption slipped in beneath it fails
    // here even if it says something else entirely.
    LIVE.near.on = () => true;
    const { container } = render(<NearLiveBody />);
    const body = container.querySelector(".fade-in") as HTMLElement;
    const row = body.querySelector("[role='tablist']");
    expect(row).toBeTruthy();
    // The row's own wrapper is the last child while every tab is closed;
    // with one open, the panel it opened is (and nothing else can be).
    expect(body.lastElementChild!.contains(row!)).toBe(true);
  });

  it("keeps its own words on a device with no location", () => {
    // supported() false drops the switch entirely (nothing to offer), and
    // the stop must still say why rather than showing a bare field.
    LIVE.near.supported = () => false;
    render(<NearLiveBody />);
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.getAllByText(/can.t share a location/i).length).toBeGreaterThan(0);
  });
});

describe("the Right now card (D84 — moved with the stop)", () => {
  it("pitches honestly while off: who is here, the square, mutuality, the linger", () => {
    render(<NearLiveBody />);
    const text = document.body.textContent || "";
    // "A COUNT, NEVER WHO" WAS ASSERTED HERE UNTIL D177, and the case is
    // more interesting for having had to change: that promise was the
    // stop's whole pitch, and the People tab made it false. A test that
    // pinned the old words would have been the thing arguing to keep a
    // false sentence on screen, so what it pins now is the pair of claims
    // that replaced it — what you get, and that it runs both ways.
    expect(text).not.toMatch(/a count, never\s+who/i);
    expect(text).toMatch(/mutual, never a place/i);
    // The SIZE of the square, and it has to track the grid. It said
    // "kilometre-sized" until D175 moved the grid to 0.002° (~200 m) —
    // which was only allowed to happen because the fix became precise in
    // the same commit. A copy line naming a radius the sensor cannot hold
    // is the failure this case exists to catch, in either direction.
    expect(text).toMatch(/200-metre grid square/i);
    expect(text).not.toMatch(/kilometre-sized/i);
    // The LINGER, which is a disclosure and not a detail: D174 made a
    // position outlive the app by up to three hours, and this sentence
    // said "goes stale within minutes" for one commit before anyone
    // noticed. What a user is agreeing to includes how long it lasts.
    expect(text).toMatch(/three hours/i);
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
    // The unit moved at D175 with the grid (0.01° → 0.002°): nine cells
    // span ~600 m, not ~3.3 km, so "a couple of kilometres" was an
    // overstatement of the count's reach by five times. Asserted as the
    // FIGURE it names rather than as prose, so the next grid change fails
    // here instead of shipping a unit that flatters the number.
    expect(screen.getByText(/within a few hundred metres/i)).toBeTruthy();
    // The line under the figure, which said "a count, never who" until the
    // People tab made that untrue (D177). Mutuality is what it says
    // instead, and it is the claim the server actually enforces — the
    // callable refuses anyone without a live position of their own.
    expect(screen.getByText(/They see you too/i)).toBeTruthy();
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
    expect(screen.getByText(/is off for InSight/i)).toBeTruthy();
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
  // the field still does not draw one. The fixture itself (`roomOfTwo`) is
  // at file scope — the field's own describe needs it too since D184.

  it("draws the field, not only a counter", async () => {
    // The claim the old body made — "a count is the only thing this stop
    // will ever draw" — was a decision about the whole screen taken from a
    // fact about the presence cell. The people around you are real, the
    // app can rank them by likeness, and drawing them anonymously claims
    // nothing about WHERE any of them is standing.
    roomOfTwo();
    render(<NearLiveBody />);
    expect(await screen.findByText(/closer = more alike/i)).toBeTruthy();
    expect(screen.getByRole("group", { name: /closer to the centre is more like you/i })).toBeTruthy();
  });

  it("names nobody, and offers nothing to open", async () => {
    // The deny, drawn. The FIELD cannot tell you who is around you — its
    // nodes are the shape of a crowd, with no names, no initials and no
    // node you could tap a person out of. Since D177 the People tab does
    // name them, which is a different surface with a different control;
    // what this pins is that the two never merge.
    roomOfTwo();
    const { container } = render(<NearLiveBody />);
    // The CLAIM, not the sentence (docs/COPY.md §4.1): it has now been
    // worded three ways and moved twice — field caption, stop closing
    // line, field caption again (D183, D184) — and every rewording said
    // the same thing about the same nodes.
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
    LIVE.near.on = () => true;
    LIVE.near.room = () => ({ people: [], qs: {} });
    const { container } = render(<NearLiveBody />);
    expect(await screen.findByRole("group", { name: /closer to the centre is more like you/i })).toBeTruthy();
    // You at the centre, and nobody else — one text node in the whole svg.
    expect(container.querySelectorAll("svg text")).toHaveLength(1);
    // …and the explanation still follows it rather than replacing it.
    expect(screen.getByText(/Nobody else has Near on/i)).toBeTruthy();
  });

  // THE SEAM THIS FIELD USED TO HAVE, and the case that keeps it shut
  // (D181). From D150 until D177 the field drew the people of your CITY —
  // right at the time, because Near had a count and nothing else true to
  // show. D177 gave the stop its own population, and the city fold stayed:
  // so a stop called Near said "Nobody from Oslo yet" above a People tab
  // listing somebody else entirely. Reported from a device, and it is
  // D170's finding one stop over — a stop naming one population and
  // drawing another.
  it("never names a city, at any of its states", async () => {
    for (const setup of [
      () => { LIVE.near.on = () => false; },
      () => { LIVE.near.on = () => true; LIVE.near.room = () => ({ people: [], qs: {} }); },
      () => {
        LIVE.near.on = () => true;
        LIVE.near.room = () => ({ people: [{ uid: "a" }], qs: {} });
      },
    ]) {
      cleanup();
      LIVE.near.room = () => null;
      setup();
      render(<NearLiveBody />);
      await screen.findByRole("group", { name: /closer to the centre is more like you/i });
      // Oslo is the fixture's city everywhere else in this file, so it is
      // the string that would appear if the city fold came back.
      expect(document.body.textContent || "", "Near's field named a city again")
        .not.toMatch(/Oslo|from your city|the city answers/i);
    }
  });

  it("says turn it on before it says nobody is here", async () => {
    // Two different empty states, and conflating them would tell somebody
    // with the switch off that the room is empty — a claim about other
    // people made from a fact about their own settings.
    LIVE.near.on = () => false;
    render(<NearLiveBody />);
    expect(await screen.findByText(/Turn it on and people draw in here/i)).toBeTruthy();
    expect(screen.queryByText(/Nobody else has Near on/i)).toBeNull();
  });

  it("keeps the two numbers attached to what each counts", async () => {
    // The D112 honesty rule. The figure counts phones near you right now;
    // the ring counts the ones this device can PLACE, which since D181 is
    // a subset of the same room rather than a different crowd. One caption
    // spanning both is how a screen starts claiming more than it measured.
    LIVE.myCity = "Oslo, NO";
    LIVE.near.on = () => true;
    LIVE.near.count = () => 2847;
    LIVE.near.room = () => ({ people: [{ uid: "a" }, { uid: "b" }], qs: {} });
    LIVE.myTestResults = () => ({
      big5: { dims: [{ id: "o", value: 60 }, { id: "c", value: 55 }, { id: "e", value: 45 }] },
    });
    LIVE.scoresFor = (uid: string) => (uid === "a" ? { big5: { o: 62, c: 50, e: 40 } } : null);
    render(<NearLiveBody />);
    // One of the two placed, and the caption says so rather than implying
    // the field drew the room.
    expect(await screen.findByText(/1 of 2 here/)).toBeTruthy();
    expect(screen.getByText(/the rest have not taken it/)).toBeTruthy();
    expect(screen.getByText("2,847")).toBeTruthy();
    expect(screen.getByText(/within a few hundred metres · Oslo/)).toBeTruthy();
  });

  it("separates 'still working it out' from 'nobody yet'", async () => {
    LIVE.near.on = () => true;
    LIVE.near.roomLoading = () => true;
    render(<NearLiveBody />);
    expect(await screen.findByText(/^Matching…$/)).toBeTruthy();

    cleanup();
    LIVE.near.roomLoading = () => false;
    LIVE.near.room = () => ({ people: [], qs: {} });
    render(<NearLiveBody />);
    expect(await screen.findByText(/Nobody else has Near on/i)).toBeTruthy();
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
    // COMMENTS STRIPPED FIRST (D181). The risk this guards is a coordinate
    // reaching the canvas, which is a property of the CODE — and the
    // unstripped scan fired on the word "cell" inside a comment explaining
    // the per-cell room cache. A source guard that trips on prose is one
    // people learn to reword around, which is how it stops being read.
    const f = nearField()
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    // `match` is the radius. A coordinate reaching this canvas would turn
    // an anonymous field into a map of where strangers are standing, which
    // is what v2_presence's `allow read: if false` exists to prevent.
    expect(f, "Near stopped placing nodes by match").toMatch(/match:/);
    expect(f, "a coordinate reached the Near field")
      .not.toMatch(/\b(lat|lon|lng|latitude|longitude|coord|cell)\b/i);
  });

  it("says nobody is named, in the copy a reader actually sees", async () => {
    // Read off the render rather than out of NearField's source (D183) —
    // a source slice passes on a string the component never reaches.
    //
    // WITH A ROOM DRAWN (D184). The promise sat in the stop's closing line
    // from D183 until that line was deleted for sitting under the tab row;
    // it is back on the field, so this renders the state the field draws
    // nodes in. The empty arms make no claim about namelessness because
    // they place nobody to be nameless — what they say instead ("Turn it
    // on and people draw in here — by likeness, never by position") is
    // pinned two tests up.
    roomOfTwo();
    render(<NearLiveBody />);
    expect(await screen.findByText(/nobody is named here/i)).toBeTruthy();
    // And the half that made D183 prefer the closing line: where the names
    // ARE. Dropping it would leave a limit with no way out of it.
    expect(screen.getByText("People", { selector: "strong" })).toBeTruthy();
  });
});


// ── the room's reading (D176) ────────────────────────────────────────
describe("NearPresence · the room", () => {
  beforeEach(() => {
    LIVE.near.on = () => true;
    LIVE.near.count = () => 24;
  });

  it("names the types in order and says what the reading rests on", () => {
    LIVE.near.mix = () => ({ top: ["Host", "Explorer"], n: 11 });
    render(<NearLiveBody />);
    const text = document.body.textContent || "";
    expect(text).toMatch(/Mostly\s*Host and Explorer/);
    // The basis is the TYPED count (11), not the headline count (24):
    // plenty of people nearby have never taken the test, and a reading
    // must not borrow a population it did not measure.
    expect(text).toMatch(/11 typed/);
    expect(text).not.toMatch(/24 typed/);
  });

  it("prints no share, ever", () => {
    LIVE.near.mix = () => ({ top: ["Host", "Explorer", "Planner"], n: 30 });
    render(<NearLiveBody />);
    // A percentage moves visibly when one person walks in — that is the
    // differencing attack, and the ranked words exist to avoid it. If a
    // share ever appears beside these names, this case is the alarm.
    const room = [...document.querySelectorAll("div")]
      .map((d) => d.textContent || "").filter((t) => /^Mostly/.test(t)).pop() || "";
    expect(room).toBeTruthy();
    expect(room).not.toMatch(/\d+\s?%/);
  });

  it("says nothing at all below the floor", () => {
    // The callable returns null under ROOM_MIN_TYPED, and the card's job
    // is to stay quiet rather than to explain the floor — an empty street
    // owes the reader no arithmetic.
    LIVE.near.mix = () => null;
    render(<NearLiveBody />);
    expect(document.body.textContent || "").not.toMatch(/Mostly/);
  });

  // The countdown reads a CLOCK, and the clock is the reason this needs a
  // case at all. `Date.now()` during render is impure — the React Compiler
  // bails out of any component that does it, which costs the memoisation on
  // the whole card and reports as one eslint line rather than as anything
  // visible. It shipped that way at D174 and was caught by `npm run lint`,
  // not by a test. So the deadline now arrives as a prop sampled on the
  // beat, and this pins the two ends of that: a real remaining time is
  // rendered, and a not-yet-sampled clock renders the MODE instead of
  // arithmetic on epoch zero.
  it("shows the session's remaining time without reading the clock in render", async () => {
    LIVE.near.mode = () => "session";
    LIVE.near.until = () => Date.now() + 90 * 60_000;
    render(<NearLiveBody />);
    // Coarse by design (the beat is four minutes), so 90 minutes reads as
    // "2h" — what matters is that it is a duration and not an epoch.
    const chip = await screen.findByRole("button", { name: /Visible for .* more/i });
    expect(chip.textContent).toMatch(/^\d+[hm]$/);
    // The unsampled-clock frame would print this, six digits of hours from
    // subtracting nothing from an epoch. If it ever appears, the prop is
    // being fed a raw deadline again.
    expect(chip.textContent).not.toMatch(/\d{5}/);
  });

  it("marks a capped basis, because past the cap n is a floor not a size", () => {
    // The server samples at most ROOM_SAMPLE_CAP presence docs, so at a
    // festival `n` is "at least this many", and printing it bare would
    // report sixty of three thousand as the room. Same repair D102 made to
    // the who-voted sheet, which says "the latest 200 of N" when it binds.
    LIVE.near.mix = () => ({ top: ["Host"], n: 60, capped: true });
    render(<NearLiveBody />);
    expect(document.body.textContent || "").toMatch(/60\+\s*typed/);
  });

  it("does not mark an exact basis", () => {
    LIVE.near.mix = () => ({ top: ["Host"], n: 11, capped: false });
    render(<NearLiveBody />);
    const text = document.body.textContent || "";
    expect(text).toMatch(/11 typed/);
    expect(text).not.toMatch(/11\+/);
  });
});


// ── the room's tab row (D177) ────────────────────────────────────────
describe("NearPresence · the row only exists when there is a room", () => {
  it("offers Answers, People and Compare once the counter is on", async () => {
    LIVE.near.on = () => true;
    LIVE.near.count = () => 12;
    render(<NearLiveBody />);
    const row = await screen.findByRole("tablist");
    expect([...row.querySelectorAll("[role=tab]")].map((t) => t.textContent))
      .toEqual(["Answers", "People", "Compare"]);
  });

  it("offers no tabs at all with the counter off", () => {
    // There is no room to have tabs about — presence is what produces the
    // cohort, so a row here would be three doors onto an empty fold. A
    // stop that draws its navigation and then refuses to use it reads as
    // broken rather than as unused.
    LIVE.near.on = () => false;
    render(<NearLiveBody />);
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  // EXPLORE AND SCORES ARE ABSENT ON PURPOSE, and the absence is worth a
  // case because the obvious "improvement" is to reach for lensesFor()
  // and get five. Explore cuts a population by an anchor and needs `by`
  // breakdowns the room has none of; Scores wants the archive's ordinal
  // questions and the room is folded over today's deck. Both would draw
  // an empty state forever.
  it("does not offer the two lenses the room has no data for", async () => {
    LIVE.near.on = () => true;
    LIVE.near.count = () => 12;
    render(<NearLiveBody />);
    await screen.findByRole("tablist");
    expect(screen.queryByText("Explore")).toBeNull();
    expect(screen.queryByText("Scores")).toBeNull();
  });
});
