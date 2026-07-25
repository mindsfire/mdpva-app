"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { reconcileSearchValue } from "@/lib/search-sync";

const DEBOUNCE_MS = 300;

/**
 * Debounced (300ms) search box that writes `q` to the URL.
 *
 * Deliberately NOT keyed on `q`: a changing key remounts the input, which
 * destroys the focused DOM node and drops the caret every time the debounce
 * fires. External `q` changes are adopted during render instead — see
 * `reconcileSearchValue`.
 */
export function SearchInput() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlQuery = searchParams.get("q") ?? "";
  const [draft, setDraft] = React.useState(urlQuery);
  // State, not refs: these are read during render, and refs are not safe to
  // read there (React may render without committing).
  const [prevUrlQuery, setPrevUrlQuery] = React.useState(urlQuery);
  const [lastPushed, setLastPushed] = React.useState<string | null>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Adjust state during render (React's documented alternative to a
  // sync-ing effect): re-renders immediately without a paint in between.
  const { value, changed } = reconcileSearchValue({
    urlQuery,
    prevUrlQuery,
    lastPushed,
    draft,
  });
  if (urlQuery !== prevUrlQuery) {
    setPrevUrlQuery(urlQuery);
  }
  if (changed) {
    setDraft(value);
  }

  function commit(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set("q", next);
    } else {
      params.delete("q");
    }
    // A new query means a new result set — go back to the first page
    // rather than stranding the user on page 3 of something else.
    params.delete("page");
    setLastPushed(next);

    // Searching from any other page (dashboard, users, profile) jumps to
    // the directory; on the directory itself it narrows in place,
    // preserving active filters.
    if (pathname !== "/members") {
      const query = params.toString();
      router.push(query ? `/members?${query}` : "/members");
      return;
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  function handleChange(next: string) {
    setDraft(next);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => commit(next), DEBOUNCE_MS);
  }

  function clear() {
    // Cancel any in-flight debounce, or it would re-apply the old query
    // moments after we clear it.
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setDraft("");
    commit("");
    // Keep the caret in the box so the user can immediately retype.
    inputRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && value) {
      event.preventDefault();
      clear();
    }
  }

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="relative w-full max-w-sm">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search members…"
        aria-label="Search members"
        className={value ? "pr-8 pl-8" : "pl-8"}
      />
      {value ? (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          title="Clear search (Esc)"
          className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
