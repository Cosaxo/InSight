// @vitest-environment jsdom
// The app's own menu, where a native <select> used to hand the list to the
// OS (the owner, 2026-09-12: "these default menus dont fit the app we should
// make our own").
//
// WHY A PANEL THIS SMALL GETS A SUITE, beyond check:panel-suites asking for
// one: the thing it REPLACED was the platform's, and the platform's was
// correct for free. A <select> gives keyboard walking, type-ahead, a value
// that is announced apart from its name, and an Escape that does not also
// dismiss whatever is behind it — none of which any other gate here can see.
// tsc, eslint and check:globals are all green on a menu that commits the
// wrong row, announces itself by its value so no test can find it twice, or
// closes the profile overlay behind it on one Escape press.
//
// Three of the cases below pin decisions rather than behaviour, and each
// names the decision it holds:
//   · the name is the FIELD's, not the value's (OptionMenu header, (1));
//   · the placeholder is not a row unless the caller asks (header (2), and
//     GeneralPanel's blank-anchors guard is what rests on it);
//   · Escape is swallowed, so one press does not close the menu AND the
//     dialog around it.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import OptionMenu, { type OptionMenuProps } from "./OptionMenu";
import { closeTopBackLayer } from "../data/backLayers";
// @ts-expect-error TS7016 — untyped spec module
import { useDialog } from "../spec/primitives.jsx";
import type React from "react";

const OPTS = ["Woman", "Man", "Non-binary", "Prefer not to say"];

const onChange = vi.fn();
beforeEach(() => { cleanup(); onChange.mockClear(); });

const draw = (props: Partial<OptionMenuProps> = {}) =>
  render(
    <OptionMenu label="Gender" value="" onChange={onChange} options={OPTS}
      placeholder="—" {...props} />,
  );

const trigger = () => screen.getByRole("combobox", { name: "Gender" });
const open = () => { fireEvent.click(trigger()); return screen.getByRole("listbox", { name: "Gender" }); };
const rows = () => screen.getAllByRole("option");
// The ticked row carries a "✓" span beside its label.
const rowText = (el: HTMLElement) => (el.textContent || "").replace("✓", "");
// The back stack is module state, so this both drives the press and asserts
// the stack is clean around it — a layer left behind is a back press that
// does nothing visible.
const back = (): boolean => { let r = false; act(() => { r = closeTopBackLayer(); }); return r; };

describe("collapsed", () => {
  it("is one control that says what it holds, with no list in the DOM", () => {
    draw({ value: "Man" });
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(trigger().getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger().textContent).toBe("Man");
    // The rows cost nothing until they are asked for — the reason this can
    // sit on a hundred-row Year field without the profile paying for it.
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryAllByRole("option")).toEqual([]);
  });

  it("shows the placeholder, not a value, when the field is empty", () => {
    draw();
    expect(trigger().textContent).toBe("—");
  });

  it("names itself by the FIELD and never by the value (header (1))", () => {
    // A name that folded the value in would rename the control on every
    // edit: "Gender" could not be found twice running by a test, by a
    // voice-control user saying it, or by anyone re-reading the screen.
    const { rerender } = draw();
    rerender(<OptionMenu label="Gender" value="Man" onChange={onChange} options={OPTS} placeholder="—" />);
    expect(screen.getByRole("combobox", { name: "Gender" }).textContent).toBe("Man");
  });
});

describe("choosing", () => {
  it("opens the list, marks the current row, and commits the one tapped", () => {
    draw({ value: "Man" });
    const list = open();
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(trigger().getAttribute("aria-controls")).toBe(list.id);
    expect(rows().map(rowText)).toEqual(OPTS);
    expect(rows().filter((r) => r.getAttribute("aria-selected") === "true").map(rowText)).toEqual(["Man"]);

    fireEvent.click(rows()[2]);
    expect(onChange).toHaveBeenCalledWith("Non-binary");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("commits the VALUE of a {value,label} row, not its label", () => {
    // The patterns tab's topic filter: the rows read "Everyday" and the
    // state is "everyday". A menu that handed back what it printed would
    // type-check and file every answer under a topic that does not exist.
    draw({ options: [{ value: "all", label: "All topics" }, { value: "food", label: "Food & drink" }], value: "all" });
    open();
    fireEvent.click(rows()[1]);
    expect(onChange).toHaveBeenCalledWith("food");
  });

  it("does not offer the placeholder as a row (header (2))", () => {
    // GeneralPanel's blank-anchors guard states, as its reason, that a
    // Basics field "offers no path back to it". That guard is what stops a
    // mount race writing an all-empty anchor map over a real account, so
    // this default is load-bearing and not a nicety.
    draw();
    open();
    expect(rows().map(rowText)).toEqual(OPTS);
  });

  it("…and does when the caller asks, committing empty", () => {
    draw({ clearable: true, value: "Man" });
    open();
    expect(rowText(rows()[0])).toBe("—");
    fireEvent.click(rows()[0]);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("greys no row on a tap-opened menu — the tick is what says chosen", () => {
    // The platform menu ticked its own `disabled` placeholder, which is what
    // "Level…" was doing in the owner's screenshot. A first row on a grey
    // ground is the same claim in the app's own vocabulary, so the highlight
    // belongs to the keyboard: `aria-activedescendant` still names the row
    // Enter would take, because a reader needs that either way.
    draw();
    const list = open();
    expect(rows().filter((r) => r.className.includes("is-hi"))).toEqual([]);
    expect(list.getAttribute("aria-activedescendant")).toBe(rows()[0].id);
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(rows().filter((r) => r.className.includes("is-hi")).map(rowText)).toEqual(["Man"]);
    // …and handing the row back to the pointer takes it away again
    fireEvent.pointerEnter(rows()[3]);
    expect(rows().filter((r) => r.className.includes("is-hi"))).toEqual([]);
  });

  it("closes on a backdrop tap without choosing anything", () => {
    draw();
    open();
    const layer = document.querySelector(".om-layer");
    expect(layer).toBeTruthy();
    fireEvent.click(layer!);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes on the Android back press rather than the overlay behind it", () => {
    // Without the layer, back fell through the menu to the shell's handler
    // and peeled the profile overlay out from under it.
    draw();
    expect(back()).toBe(false);
    open();
    expect(back()).toBe(true);
    expect(screen.queryByRole("listbox")).toBeNull();
    // …and the layer left with it, so the next press reaches the shell.
    expect(back()).toBe(false);
  });
});

describe("the keyboard, which the <select> gave for free", () => {
  const active = (list: HTMLElement) =>
    document.getElementById(list.getAttribute("aria-activedescendant") || "");

  it("opens on an arrow and lands on the current value", () => {
    draw({ value: "Non-binary" });
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    const list = screen.getByRole("listbox", { name: "Gender" });
    expect(rowText(active(list)!)).toBe("Non-binary");
  });

  it("walks with the arrows, wraps, and commits on Enter", () => {
    draw({ value: "Woman" });
    const list = open();
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(rowText(active(list)!)).toBe("Man");
    fireEvent.keyDown(list, { key: "ArrowUp" });
    fireEvent.keyDown(list, { key: "ArrowUp" });
    // wrapped past the top to the last row
    expect(rowText(active(list)!)).toBe("Prefer not to say");
    fireEvent.keyDown(list, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("Prefer not to say");
  });

  it("jumps on a typed letter — the Year field is a hundred rows", () => {
    draw({ value: "Woman" });
    const list = open();
    fireEvent.keyDown(list, { key: "n" });
    expect(rowText(active(list)!)).toBe("Non-binary");
    // a second letter inside the window narrows rather than walking
    fireEvent.keyDown(list, { key: "o" });
    expect(rowText(active(list)!)).toBe("Non-binary");
  });

  it("Home and End reach the ends", () => {
    draw();
    const list = open();
    fireEvent.keyDown(list, { key: "End" });
    expect(rowText(active(list)!)).toBe("Prefer not to say");
    fireEvent.keyDown(list, { key: "Home" });
    expect(rowText(active(list)!)).toBe("Woman");
  });

  it("Escape closes the menu and STOPS THERE", () => {
    // The enclosing overlay is a dialog whose own Escape closes it
    // (primitives.jsx useDialog). One press must not do both, or dismissing
    // a menu throws away the whole profile edit behind it. CityPicker's
    // list already holds this line; this is the same one.
    const onEsc = vi.fn();
    // The REAL dialog, not a stand-in with an onKeyDown: useDialog's handler
    // is a React synthetic one on the overlay root, and this menu renders
    // through a PORTAL — so the thing under test is that React propagates
    // the keypress up the component tree (which it does, portal or not) and
    // that stopPropagation is what stops it there.
    const Dlg = ({ children }: { children: React.ReactNode }) => {
      const dlg = useDialog(onEsc, "Profile");
      return <div className="overlay" {...dlg}>{children}</div>;
    };
    render(
      <Dlg>
        <OptionMenu label="Gender" value="" onChange={onChange} options={OPTS} placeholder="—" />
      </Dlg>,
    );
    const list = open();
    fireEvent.keyDown(list, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(onEsc).not.toHaveBeenCalled();
    // and focus comes back to the control that opened it
    expect(document.activeElement).toBe(trigger());
  });
});
