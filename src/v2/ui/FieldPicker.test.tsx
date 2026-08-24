// @vitest-environment jsdom
//
// The app's own menu for a closed vocabulary (D275), and the four things
// that make it worth replacing a `<select>` with 200 lines of component.
//
//   1. IT IS NOT A `<select>`. That is the whole report — on iOS a select
//      opens the platform's menu, in the platform's type, over an app that
//      is neither. A regression here is invisible to tsc, eslint and every
//      gate in the tree, and looks fine in a jsdom snapshot, so it is
//      asserted on the DOM directly.
//   2. THE CAPTION NAMES THE CONTROL AND THE VALUE IS THE VALUE. A
//      `<label>` wrapped round a `<button>` takes the accessible name off
//      the answer — the defect the a11y pass found around CityPicker, and
//      the one every one of these seven fields would have acquired.
//   3. IT CLOSES EVERY WAY A SHEET CLOSES. Escape, the scrim, the ✕, and
//      Android's back — the last through the same layer stack the spec
//      layer's sheets register on, because a back press that quits the app
//      from an open menu reads as a crash.
//   4. IT OPENS WHERE YOU ARE. The year list is eighty rows; a menu that
//      opens at the top of it makes you scroll to what you already
//      answered.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import FieldPicker from "./FieldPicker";
import { backLayerCount, closeTopBackLayer, resetBackLayers } from "../data/backLayers";

afterEach(() => { cleanup(); resetBackLayers(); });

const OPTS = ["Woman", "Man", "Non-binary", "Prefer not to say"];

function mount(value = "", onChange = vi.fn()) {
  const out = render(
    <FieldPicker title="Gender" value={value} onChange={onChange}
      options={OPTS} placeholder="—" />,
  );
  return { ...out, onChange };
}

const open = () => fireEvent.click(screen.getByLabelText("Gender"));
// The dismiss runs on the same animation as every other sheet in the app,
// so the rows outlive the tap that chose one.
const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 260)); }); };

describe("what it is made of", () => {
  it("renders no native select at all", () => {
    const { container } = mount();
    open();
    expect(container.querySelector("select")).toBeNull();
    expect(document.querySelectorAll("option")).toHaveLength(0);
    expect(screen.getAllByRole("option").length).toBe(OPTS.length + 1);
  });

  it("wears the app's own sheet, not a menu of its own", () => {
    // The classes are the stylesheet's: ground, radius, shadow, entry
    // animation, reduced-motion handling and focus ring all come from
    // there. A hand-rolled panel here would drift from every other sheet
    // the first time one of them changed.
    mount();
    open();
    expect(document.querySelector(".wf-scrim")).toBeTruthy();
    expect(document.querySelector(".wf-sheet")).toBeTruthy();
    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
  });
});

describe("the name and the value", () => {
  it("is named by its caption and reads back its answer", () => {
    mount("Man");
    const btn = screen.getByLabelText("Gender");
    // The caption is the NAME; the button's own text is the value. Both,
    // which is what a <label> around a <button> cannot do — there the name
    // wins and the answer is never announced.
    expect(btn.textContent).toContain("Man");
    expect(btn.getAttribute("role")).toBe("combobox");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("says the placeholder while nothing is chosen", () => {
    mount("");
    expect(screen.getByLabelText("Gender").textContent).toContain("—");
  });

  it("marks exactly one row, and it is the answer", () => {
    mount("Non-binary");
    open();
    const on = screen.getAllByRole("option").filter((o) => o.getAttribute("aria-selected") === "true");
    expect(on).toHaveLength(1);
    expect(on[0].textContent).toBe("Non-binary");
  });

  it("marks the empty row when there is no answer", () => {
    // Otherwise an unanswered field opens a list with nothing selected,
    // and "nothing chosen" is a state the reader has to infer.
    mount("");
    open();
    expect(screen.getByRole("option", { name: "No answer" }).getAttribute("aria-selected")).toBe("true");
  });
});

describe("choosing", () => {
  it("hands back the option and closes", async () => {
    const { onChange } = mount();
    open();
    fireEvent.click(screen.getByRole("option", { name: "Man" }));
    expect(onChange).toHaveBeenCalledWith("Man");
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("hands back an empty string for the empty row", async () => {
    // The `<select>`'s empty option, kept: every field this control is used
    // for is optional, so taking an answer back out has to be reachable.
    const { onChange } = mount("Man");
    open();
    fireEvent.click(screen.getByRole("option", { name: "No answer" }));
    expect(onChange).toHaveBeenCalledWith("");
    await settle();
  });

  it("changes nothing when it is dismissed", async () => {
    const { onChange } = mount("Man");
    open();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await settle();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("every way out of it", () => {
  it("closes on Escape", async () => {
    // The handler also stops the key from travelling — one press closes
    // the menu and not the overlay behind it. That half is not asserted
    // here: React dispatches from the root container, so a test listener
    // sees the native event whatever the synthetic one did.
    mount();
    open();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on the scrim, and not on a tap inside the sheet", async () => {
    mount();
    open();
    fireEvent.click(screen.getByRole("listbox"));
    await settle();
    expect(screen.queryByRole("dialog")).toBeTruthy();

    fireEvent.click(document.querySelector(".wf-scrim") as HTMLElement);
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("registers one back layer while it is up, and drops it after", async () => {
    // Android's back peels the menu instead of quitting the app.
    mount();
    expect(backLayerCount()).toBe(0);
    open();
    expect(backLayerCount()).toBe(1);
    expect(closeTopBackLayer()).toBe(true);
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(backLayerCount()).toBe(0);
  });
});

describe("the keyboard", () => {
  it("opens on the chosen row", () => {
    // The year list is eighty rows long. Opening it at the top means
    // scrolling to an answer that is already given.
    mount("Prefer not to say");
    open();
    expect(document.activeElement?.textContent).toBe("Prefer not to say");
  });

  it("walks the rows with the arrows, and wraps", () => {
    mount("");
    open();
    // On the focused ROW, which is where a real key press lands: the
    // handler sits on the rows because they are the only interactive,
    // focusable thing in the sheet (see the component's note).
    const key = (k: string) => fireEvent.keyDown(document.activeElement as HTMLElement, { key: k });
    key("ArrowDown");
    expect(document.activeElement?.textContent).toBe("Woman");
    key("End");
    expect(document.activeElement?.textContent).toBe("Prefer not to say");
    key("ArrowDown");
    expect(document.activeElement?.textContent).toBe("No answer");
    key("ArrowUp");
    expect(document.activeElement?.textContent).toBe("Prefer not to say");
  });

  it("hands focus back to the field it came from", async () => {
    mount();
    const btn = screen.getByLabelText("Gender");
    open();
    fireEvent.click(screen.getByRole("option", { name: "Woman" }));
    await settle();
    // Without this the unmount drops focus on <body> and a keyboard user is
    // returned to the top of the form after every answer. `useDialog`'s own
    // restore does not cover it: it hands focus back to whatever was ACTIVE
    // when the sheet opened, and Safari does not focus a <button> on click
    // — which is exactly the case here, and exactly what jsdom reproduces.
    expect(document.activeElement).toBe(btn);
  });
});
