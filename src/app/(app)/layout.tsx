import Link from "next/link";
import { Suspense } from "react";

import { auth } from "@/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProfileMenu } from "@/components/app-shell/profile-menu";
import { SearchInput } from "@/components/members/search-input";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const name = session?.user?.name ?? session?.user?.email ?? "Member";

  return (
    <div className="flex min-h-full flex-col bg-mdpva-paper text-mdpva-ink dark:bg-background dark:text-foreground">
      <header className="sticky top-0 z-40 border-b border-mdpva-border bg-mdpva-paper/95 backdrop-blur supports-backdrop-filter:bg-mdpva-paper/80 dark:border-border dark:bg-background/95 dark:supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="shrink-0 font-serif text-lg font-medium tracking-tight text-mdpva-ink dark:text-foreground"
          >
            MDPVA
          </Link>
          <div className="hidden flex-1 sm:block">
            <Suspense fallback={null}>
              <SearchInput />
            </Suspense>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <ProfileMenu name={name} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
