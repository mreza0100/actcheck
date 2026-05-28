import { describe, expect, it } from "vitest";
import { alphaLabel, formatAlphaList } from "../src/formatter.js";

describe("formatAlphaList", () => {
  it("renders the EU drafting style with semicolons and a trailing period", () => {
    expect(formatAlphaList(["first item", "second item", "final item"])).toBe(
      "(a) first item; (b) second item; (c) final item.",
    );
  });

  it("strips trailing punctuation from each item before composing", () => {
    expect(formatAlphaList(["first.", "second;", "third,"])).toBe(
      "(a) first; (b) second; (c) third.",
    );
  });

  it("returns the empty string for an empty list", () => {
    expect(formatAlphaList([])).toBe("");
  });

  it("renders a single item as '(a) X.'", () => {
    expect(formatAlphaList(["only"])).toBe("(a) only.");
  });

  it("supports newline-separated paragraph style", () => {
    expect(formatAlphaList(["x", "y"], { separator: "\n" })).toBe(
      "(a) x;\n(b) y.",
    );
  });
});

describe("alphaLabel", () => {
  it("maps 0–25 to a–z", () => {
    expect(alphaLabel(0)).toBe("a");
    expect(alphaLabel(25)).toBe("z");
  });

  it("doubles letters past z", () => {
    expect(alphaLabel(26)).toBe("aa");
    expect(alphaLabel(27)).toBe("bb");
    expect(alphaLabel(51)).toBe("zz");
  });

  it("triples past zz", () => {
    expect(alphaLabel(52)).toBe("aaa");
  });

  it("throws on negative indices", () => {
    expect(() => alphaLabel(-1)).toThrow();
  });
});
