// The suite's locale is pinned, and this is what says so when it is not.
//
// WHY IT EXISTS. Four assertions in this tree are facts about ICU's resolved
// locale rather than about the code:
//
//   ui/NearLiveBody.test.tsx        getByText("2,847")   — `n.toLocaleString()`
//   ui/LiveBreakdownPanel.test.tsx  chip(/^Norway · 20/) — `countryName("NO")`
//   ui/LiveSimilarityField.test.tsx two more on "Norway"
//
// Under de-DE those read 2.847 and Norwegen; under fr-FR, 2 847 (with a
// narrow no-break space) and Norvège. Reproduced, not reasoned about:
// `LC_ALL=de_DE.UTF-8` against those three files failed exactly four cases.
//
// NOT A PRODUCT BUG, which is the reason the fix is here rather than there.
// data/places.ts resolves region names through `Intl.DisplayNames` on
// purpose — "245 country names would be another 4 KB and would need
// translating, and Intl.DisplayNames already has them in the user's own
// language" — so following the device locale is the behaviour, and a test
// asserting on it needs a known device.
//
// CI passed only because ubuntu-latest leaves LANG unset and ICU falls back
// to en-US. That is an accident of the runner image, so `test:unit`,
// `test:scripts` and `test:coverage` now set LC_ALL themselves.
//
// AND WHY A WHOLE FILE FOR ONE ASSERTION. Without it the pin failing looks
// like four product bugs in three unrelated panels, one of which is titled
// "a country chip is not an ISO code" — so the reader debugs the resolution
// path rather than their shell. This turns that into one failure that names
// the cause. It is the cheapest half of the fix and the half that pays.
import { describe, expect, it } from "vitest";

describe("the suite's locale is pinned", () => {
  it("resolves to en-US, or the assertions on formatted output are lying", () => {
    expect(
      Intl.NumberFormat().resolvedOptions().locale,
      "run the suite through `npm run test:unit`, not a bare `vitest run` — "
      + "the npm script is what sets LC_ALL, and four assertions in src/v2/ui "
      + "are facts about the resolved locale. See the header of this file.",
    ).toBe("en-US");
  });

  // The two formatters those assertions actually go through, pinned at the
  // shape they are asserted at. A platform whose ICU is built without full
  // region data returns the code — which would fail LiveBreakdownPanel's
  // case with "expected NO to match /^Norway/" and send the reader to the
  // panel. Named here instead.
  it("has the region and grouping data those assertions read", () => {
    expect(new Intl.DisplayNames(undefined, { type: "region" }).of("NO")).toBe("Norway");
    expect((2847).toLocaleString()).toBe("2,847");
  });
});
