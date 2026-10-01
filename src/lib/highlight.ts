export interface HighlightPart {
  text: string;
  match: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Splits `text` around every case-insensitive occurrence of `query`, so the
 * matched parts can be marked. Mirrors the server search, which matches the
 * whole trimmed query as one substring (`ilike '%q%'`).
 *
 * Splitting with a capture group (rather than lower-casing and slicing by
 * index) keeps the original casing and stays correct for characters whose
 * lower-case form has a different length.
 */
export function splitHighlight(text: string, query: string): HighlightPart[] {
  const q = query.trim();
  if (!q || !text) return [{ text, match: false }];

  return text
    .split(new RegExp(`(${escapeRegExp(q)})`, "giu"))
    .map((part, i) => ({ text: part, match: i % 2 === 1 }))
    .filter((part) => part.text !== "");
}
