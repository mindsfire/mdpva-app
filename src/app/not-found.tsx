import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 bg-mdpva-paper px-4 py-16 text-center text-mdpva-ink dark:bg-background dark:text-foreground">
      <p className="font-serif text-6xl font-medium tracking-tight text-mdpva-accent dark:text-mdpva-gold">
        404
      </p>
      <h1 className="font-serif text-2xl font-medium tracking-tight">
        Page not found
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist, or you don&apos;t
        have access to it.
      </p>
      <Button render={<Link href="/" />} className="mt-2">
        Back to directory
      </Button>
    </div>
  );
}
