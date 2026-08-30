// The generated number words, held to the table they replaced.
//
// check-figures.mjs kept 30 hand-written entries (1-12 and 114-136, with
// 115-119 simply missing) and used them to write the sentence it tells you
// to paste into a doc. Replacing a hand table with a generator is only
// safe if the generator says exactly what the table said — otherwise this
// commit would churn every sentence those numbers appear in, which is the
// documentation error the whole gate exists to prevent.
//
// So the old table is reproduced here verbatim as the fixture, and every
// entry is asserted identical. It is not a copy that has to be maintained:
// it is a snapshot of what was true before the change, and it never needs
// to grow again.
import { describe, expect, it } from "vitest";
import { numberWord, word } from "./number-words.mjs";

const OLD_TABLE = {
  1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six",
  7: "seven", 8: "eight", 9: "nine", 10: "ten", 11: "eleven", 12: "twelve",
  114: "a hundred and fourteen", 120: "a hundred and twenty",
  121: "a hundred and twenty-one", 122: "a hundred and twenty-two",
  123: "a hundred and twenty-three", 124: "a hundred and twenty-four",
  125: "a hundred and twenty-five", 126: "a hundred and twenty-six",
  127: "a hundred and twenty-seven", 128: "a hundred and twenty-eight",
  129: "a hundred and twenty-nine", 130: "a hundred and thirty",
  131: "a hundred and thirty-one", 132: "a hundred and thirty-two",
  133: "a hundred and thirty-three", 134: "a hundred and thirty-four",
  135: "a hundred and thirty-five", 136: "a hundred and thirty-six",
};

describe("numberWord", () => {
  it("says exactly what the hand table said, for all 30 of its entries", () => {
    const wrong = [];
    for (const [n, want] of Object.entries(OLD_TABLE)) {
      const got = numberWord(Number(n));
      if (got !== want) wrong.push(`${n}: got ${JSON.stringify(got)}, table said ${JSON.stringify(want)}`);
    }
    expect(wrong, "the generator disagrees with the table it replaced — every "
      + "committed sentence quoting one of these would churn").toEqual([]);
    expect(Object.keys(OLD_TABLE)).toHaveLength(30);
  });

  it("fills the gap the table had", () => {
    // 115-119 were simply absent, so any figure landing there fell through
    // to digits with nothing saying why.
    expect(numberWord(115)).toBe("a hundred and fifteen");
    expect(numberWord(117)).toBe("a hundred and seventeen");
    expect(numberWord(119)).toBe("a hundred and nineteen");
  });

  it("keeps going past the table's ceiling — the case that was three farm runs away", () => {
    // The daily bank was at 130 and promotes two per run. 137 was where the
    // gate would have started suggesting a fix that fails the gate.
    expect(numberWord(137)).toBe("a hundred and thirty-seven");
    expect(numberWord(140)).toBe("a hundred and forty");
    expect(numberWord(199)).toBe("a hundred and ninety-nine");
    // …and past a hundred, where "a hundred" has to become "two hundred".
    expect(numberWord(200)).toBe("two hundred");
    expect(numberWord(240)).toBe("two hundred and forty");
    expect(numberWord(999)).toBe("nine hundred and ninety-nine");
  });

  it("every value it claims to cover is letters only, which is what the patterns match", () => {
    // The actual defect: check-figures' MIRROR.md pattern accepts `[a-z- ]`
    // and nothing else, so a suggestion containing a digit can never match
    // the sentence it asks you to write.
    for (let n = 0; n <= 999; n++) {
      expect(numberWord(n), `numberWord(${n})`).toMatch(/^[a-z- ]+$/);
    }
  });

  it("refuses what it cannot spell rather than inventing", () => {
    expect(numberWord(1000)).toBeNull();
    expect(numberWord(-1)).toBeNull();
    expect(numberWord(1.5)).toBeNull();
    expect(numberWord(NaN)).toBeNull();
  });

  it("word() falls back to digits exactly where numberWord refuses", () => {
    expect(word(130)).toBe("a hundred and thirty");
    expect(word(1000)).toBe("1000");
    // Zero is a word, not a fallback — `word` must not treat a falsy-ish
    // result as a miss.
    expect(word(0)).toBe("zero");
  });
});
