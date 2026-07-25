import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Server-rendered link (not client state) so the cursor lives in the URL —
 * reloading, sharing the link, or the back button all preserve position.
 */
export function LoadMore({
  currentParams,
  nextCursor,
}: {
  currentParams: Record<string, string | undefined>;
  nextCursor: string;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(currentParams)) {
    if (value) params.set(key, value);
  }
  params.set("cursor", nextCursor);

  return (
    <div className="flex justify-center pt-4">
      <Button variant="outline" render={<Link href={`/?${params.toString()}`} />}>
        Load more
      </Button>
    </div>
  );
}
