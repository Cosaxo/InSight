// @vitest-environment jsdom
//
// The two motion hooks of the 2026-09-12 pass (VISION-2026-09-12 §4, §5.1),
// executed on a minimal host rather than described:
//
//   · useSubSwipe — a horizontal swipe on an overlay body steps its
//     sub-tabs, a vertical one does not, a swipe that starts on something
//     that owns its own horizontal motion is ignored, and the ends do not
//     wrap. The panel slides 34px and fades before the tab changes.
//   · useLeaveHold — the last element stays mounted for the hold and the
//     host is told it is leaving; a reopen within the hold cancels it.
//
// The profile is where the first ships (profile-overlay.jsx) and app-shell
// is where the second does; mounting the whole App to drive a touch
// sequence would test the harness's touch support more than the hook.
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useLeaveHold } from "../spec/primitives.jsx";
import { useSubSwipe } from "../spec/sub-swipe.js";

afterEach(() => { cleanup(); vi.useRealTimers(); });

const IDS = ["general", "big5", "politics"];
function Host({ onSub }) {
  const [sub, setSub] = React.useState("big5");
  const bodyRef = React.useRef(null);
  const panelRef = React.useRef(null);
  useSubSwipe(bodyRef, panelRef, IDS, sub, (id) => { setSub(id); onSub(id); });
  return (
    <div ref={bodyRef} data-testid="body">
      <div className="subnav"><button>{sub}</button></div>
      <div ref={panelRef} data-testid="panel">{sub}</div>
    </div>
  );
}
const touch = (el, type, x, y) => fireEvent[type](el, { touches: [{ clientX: x, clientY: y }], changedTouches: [{ clientX: x, clientY: y }] });
function swipe(el, from, to) {
  touch(el, "touchStart", from[0], from[1]);
  touch(el, "touchMove", from[0] + (to[0] - from[0]) / 2, from[1] + (to[1] - from[1]) / 2);
  touch(el, "touchMove", to[0], to[1]);
  touch(el, "touchEnd", to[0], to[1]);
}

describe("useSubSwipe — the profile's sub-tabs under a thumb", () => {
  it("a left swipe steps forward, a right swipe back, after the panel has slid", () => {
    vi.useFakeTimers();
    const onSub = vi.fn();
    render(<Host onSub={onSub} />);
    const body = screen.getByTestId("body");
    const panel = screen.getByTestId("panel");
    swipe(body, [200, 100], [100, 104]);
    // the slide first — the panel is on its way out before the tab changes
    expect(panel.style.transform).toBe("translateX(-34px)");
    expect(panel.style.opacity).toBe("0");
    expect(onSub).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(160); });
    expect(onSub).toHaveBeenLastCalledWith("politics");
    swipe(body, [100, 100], [220, 96]);
    act(() => { vi.advanceTimersByTime(160); });
    expect(onSub).toHaveBeenLastCalledWith("big5");
  });

  it("a vertical drag, a short one, and one from a scroller do nothing", () => {
    vi.useFakeTimers();
    const onSub = vi.fn();
    render(<Host onSub={onSub} />);
    const body = screen.getByTestId("body");
    swipe(body, [200, 100], [190, 260]);           // vertical: a scroll
    swipe(body, [200, 100], [160, 100]);           // 40px: under the 66px step
    swipe(screen.getByRole("button"), [200, 100], [60, 100]); // inside .subnav, which owns x
    act(() => { vi.advanceTimersByTime(300); });
    expect(onSub).not.toHaveBeenCalled();
    // …and the panel springs back rather than staying half-slid
    expect(screen.getByTestId("panel").style.transform).toBe("translateX(0)");
  });

  it("does not wrap past the last tab", () => {
    vi.useFakeTimers();
    const onSub = vi.fn();
    render(<Host onSub={onSub} />);
    const body = screen.getByTestId("body");
    swipe(body, [200, 100], [100, 100]);
    act(() => { vi.advanceTimersByTime(160); });
    expect(onSub).toHaveBeenLastCalledWith("politics");
    swipe(body, [200, 100], [100, 100]);
    act(() => { vi.advanceTimersByTime(300); });
    expect(onSub).toHaveBeenCalledTimes(1);
  });
});

describe("useLeaveHold — an overlay leaves the way it came", () => {
  function Shell({ open }) {
    const hold = useLeaveHold(open, 200, open);
    const shown = hold.state;
    return (
      <div className={"ov-host" + (hold.leaving ? " is-leaving" : "")}>
        {shown ? <div key={"ov-" + shown} role="dialog" aria-label={shown}>{shown}</div> : null}
      </div>
    );
  }
  it("keeps the closed overlay mounted for the hold, marked leaving, then lets go", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Shell open="profile" />);
    expect(screen.getByRole("dialog", { name: "profile" })).toBeTruthy();
    expect(document.querySelector(".is-leaving")).toBeNull();
    rerender(<Shell open={null} />);
    expect(screen.getByRole("dialog", { name: "profile" }), "the overlay was cut, not held").toBeTruthy();
    expect(document.querySelector(".ov-host.is-leaving")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(210); });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector(".is-leaving")).toBeNull();
  });

  it("a reopen inside the hold cancels the leave; a different overlay replaces without one", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Shell open="profile" />);
    rerender(<Shell open={null} />);
    expect(document.querySelector(".is-leaving")).toBeTruthy();
    rerender(<Shell open="profile" />);
    expect(document.querySelector(".is-leaving")).toBeNull();
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.getByRole("dialog", { name: "profile" })).toBeTruthy();
    rerender(<Shell open="search" />);
    expect(screen.getByRole("dialog", { name: "search" })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "profile" })).toBeNull();
    expect(document.querySelector(".is-leaving")).toBeNull();
  });
});
