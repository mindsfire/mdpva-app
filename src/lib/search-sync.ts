/**
 * Reconciles the search box's local draft with the `q` in the URL.
 *
 * The box is the source of truth while the user types; the URL catches up
 * on a debounce. But `q` can also change from *outside* (Clear all, back
 * button, a link carrying its own `q`), and then the box must adopt it.
 *
 * Remounting the input on every `q` change — e.g. `key={q}` — does that,
 * but destroys the focused DOM node and drops the caret mid-typing.
 *
 * The decision hinges on whether the URL *changed*, not on whether it
 * differs from the draft: mid-typing they always differ (the debounce
 * hasn't fired yet), so a value comparison alone would wipe the draft on
 * every keystroke.
 */
export function reconcileSearchValue({
  urlQuery,
  prevUrlQuery,
  lastPushed,
  draft,
}: {
  /** `q` currently in the URL. */
  urlQuery: string;
  /** `q` as of the previous render. */
  prevUrlQuery: string;
  /** The value this component last wrote to the URL (null before any write). */
  lastPushed: string | null;
  /** What the user has typed locally. */
  draft: string;
}): { value: string; changed: boolean } {
  // URL didn't move — the user is mid-typing. Never touch the draft.
  if (urlQuery === prevUrlQuery) {
    return { value: draft, changed: false };
  }
  // URL moved because our own debounce landed. The draft may already have
  // moved further while the navigation was in flight; keep it.
  if (urlQuery === lastPushed) {
    return { value: draft, changed: false };
  }
  // Moved from somewhere else — adopt it.
  return { value: urlQuery, changed: true };
}
