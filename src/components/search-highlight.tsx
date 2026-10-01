"use client";

import { useSearchParams } from "next/navigation";

import { splitHighlight } from "@/lib/highlight";

/**
 * `text` with the current search (`?q=`) marked like a highlighter pen.
 * Reads the query from the URL itself, so tables don't have to thread it
 * through every row.
 */
export function SearchHighlight({ text }: { text: string }) {
  const query = useSearchParams().get("q") ?? "";
  const parts = splitHighlight(text, query);
  if (parts.length === 1 && !parts[0]!.match) return text;

  return parts.map((part, i) =>
    part.match ? (
      <mark
        key={i}
        className="rounded-[2px] bg-yellow-200 text-inherit dark:bg-yellow-400/35"
      >
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}
