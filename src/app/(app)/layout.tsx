import Link from "next/link";
import { Suspense } from "react";
import { UsersIcon } from "lucide-react";

import { auth } from "@/auth";
import { hasRole } from "@/lib/rbac";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProfileMenu } from "@/components/app-shell/profile-menu";
import { SearchInput } from "@/components/members/search-input";
import { Button } from "@/components/ui/button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const name = session?.user?.name ?? session?.user?.email ?? "Member";
  const isAdmin = session?.user ? hasRole(session.user.role, "admin") : false;

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
            {isAdmin ? (
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/users" />}
                className="hidden sm:inline-flex"
              >
                <UsersIcon />
                Users
              </Button>
            ) : null}
            <ThemeToggle />
            <ProfileMenu name={name} isAdmin={isAdmin} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
