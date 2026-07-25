"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 bg-mdpva-paper px-4 py-16 text-center text-mdpva-ink dark:bg-background dark:text-foreground">
      <p className="font-serif text-6xl font-medium tracking-tight text-destructive">
        Oops
      </p>
      <h1 className="font-serif text-2xl font-medium tracking-tight">
        Something went wrong
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        An unexpected error occurred. You can try again, or head back to the
        directory.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Button variant="outline" onClick={() => reset()}>
          Try again
        </Button>
        <Button render={<Link href="/" />}>Back to directory</Button>
      </div>
    </div>
  );
}
