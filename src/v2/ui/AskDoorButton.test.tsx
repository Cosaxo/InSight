// @vitest-environment jsdom
// AskDoorButton.test.tsx — the hop out of the app (D473). The platform
// rule that decides whether this renders at all is data/askDoor.test.ts's;
// the mounted-App proof for both platforms is test/ask-door-platform's.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AskDoorButton from "./AskDoorButton";
import { SITE_ORIGIN } from "../data/siteOrigin";

const ASK_URL = `${SITE_ORIGIN}/ask`;

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("the door's button", () => {
  it("wears the door's own name and the peer control class", () => {
    render(<AskDoorButton />);
    const b = screen.getByRole("button", { name: "Ask a question" });
    expect(b.className).toContain("icon-btn");
  });

  it("opens the web ask page in the system browser, with no opener and no referrer", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<AskDoorButton />);
    fireEvent.click(screen.getByRole("button", { name: "Ask a question" }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(ASK_URL, "_blank", "noopener,noreferrer");
    expect(ASK_URL.startsWith("https://"), "the address must be absolute — it leaves the app").toBe(true);
  });
});
