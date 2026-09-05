// @vitest-environment jsdom
// The share control of a sponsored question's results page (D374): it
// copies the /q/{qid} address and says so — nothing else, and nothing
// counted.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SponsorShare } from "./SponsorShare";

afterEach(cleanup);

describe("the results page's address (D374)", () => {
  it("copies the /q/{qid} link and says so", () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<SponsorShare qid="paidq-abc" />);
    const b = screen.getByRole("button", { name: /results page/i });
    expect(b.textContent).toBe("share results");
    fireEvent.click(b);
    expect(writeText).toHaveBeenCalledWith("https://prvfire33.web.app/q/paidq-abc");
    expect(b.textContent).toBe("link copied ✓");
  });
});
