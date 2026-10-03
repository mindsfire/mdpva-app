/**
 * The address is one field now. `address_line2` survives in the schema only
 * for values written before that (ledger imports, older applications), so
 * anywhere those are shown or re-edited they're folded into a single line
 * rather than dropped.
 */
export function joinAddressLines(
  line1: string | null | undefined,
  line2: string | null | undefined,
): string {
  return [line1, line2]
    .map((s) => s?.trim() ?? "")
    .filter(Boolean)
    .join(", ");
}
