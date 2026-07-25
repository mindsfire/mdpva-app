"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "lucide-react";

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

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="relative w-full max-w-sm">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search members…"
        aria-label="Search members"
        className="pl-8"
      />
    </div>
  );
}
