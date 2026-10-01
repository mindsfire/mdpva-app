import { describe, expect, it } from "vitest";

import { splitHighlight } from "./highlight";

describe("splitHighlight", () => {
  it("marks a case-insensitive match, keeping the original casing", () => {
    expect(splitHighlight("Sandesh", "san")).toEqual([
      { text: "San", match: true },
      { text: "desh", match: false },
    ]);
  });

  it("marks every occurrence", () => {
    expect(splitHighlight("Santhosh Sandesh", "san")).toEqual([
      { text: "San", match: true },
      { text: "thosh ", match: false },
      { text: "San", match: true },
      { text: "desh", match: false },
    ]);
  });

  it("marks digits inside a longer value", () => {
    expect(splitHighlight("•••• •••• 1029", "1029")).toEqual([
      { text: "•••• •••• ", match: false },
      { text: "1029", match: true },
    ]);
  });

  it("returns the text unmarked when there's no query or no match", () => {
    expect(splitHighlight("Sandesh", "")).toEqual([
      { text: "Sandesh", match: false },
    ]);
    expect(splitHighlight("Sandesh", "   ")).toEqual([
      { text: "Sandesh", match: false },
    ]);
    expect(splitHighlight("Sandesh", "xyz")).toEqual([
      { text: "Sandesh", match: false },
    ]);
  });

  it("trims the query, like the server search", () => {
    expect(splitHighlight("Sandesh", "  san ")).toEqual([
      { text: "San", match: true },
      { text: "desh", match: false },
    ]);
  });

  it("treats regex characters in the query literally", () => {
    expect(splitHighlight("A+B (x)", "+b (")).toEqual([
      { text: "A", match: false },
      { text: "+B (", match: true },
      { text: "x)", match: false },
    ]);
    expect(splitHighlight("abc", ".")).toEqual([{ text: "abc", match: false }]);
  });
});
