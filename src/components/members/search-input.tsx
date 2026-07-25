"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 300;

function SearchInputField({ initialQ }: { initialQ: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = React.useState(initialQ);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(next: string) {
    setValue(next);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      // Searching from any other page (dashboard, users, profile) jumps to
      // the directory with a fresh query; on the directory itself it
      // narrows in place, preserving active filters.
      if (pathname !== "/members") {
        router.push(next ? `/members?q=${encodeURIComponent(next)}` : "/members");
        return;
      }
      const params = new URLSearchParams(searchParams.toString());
      if (next) {
        params.set("q", next);
      } else {
        params.delete("q");
      }
      params.delete("cursor");
      router.replace(`${pathname}?${params.toString()}`);
    }, DEBOUNCE_MS);
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
        placeholder="Search name, phone, member ID…"
        aria-label="Search members"
        className="pl-8"
      />
    </div>
  );
}

/**
 * Debounced (300ms) search box that writes `q` to the URL via
 * `router.replace`. Keyed on the current `q` value so external changes to
 * it (e.g. "Clear filters") reset the field's local draft state instead of
 * fighting with it.
 */
export function SearchInput() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  return <SearchInputField key={q} initialQ={q} />;
}
