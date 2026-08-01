import { Suspense } from "react";
import { cookies } from "next/headers";

import { auth } from "@/auth";
import { hasRole } from "@/lib/rbac";
import { ProfileMenu } from "@/components/app-shell/profile-menu";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import {
  parseSidebarWidthCookie,
  SIDEBAR_STATE_COOKIE,
  SIDEBAR_WIDTH_COOKIE,
} from "@/lib/sidebar-prefs";
import { SearchInput } from "@/components/members/search-input";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const name = session?.user?.name ?? session?.user?.email ?? "Member";
  const isAdmin = session?.user ? hasRole(session.user.role, "admin") : false;

  // Read both sidebar preferences server-side so the first paint already has
  // the user's width and open/collapsed state — no flash, no layout shift.
  const cookieStore = await cookies();
  const storedWidth = parseSidebarWidthCookie(
    cookieStore.get(SIDEBAR_WIDTH_COOKIE)?.value,
  );
  const defaultOpen = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value !== "false";

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        storedWidth
          ? ({ "--sidebar-width": storedWidth } as React.CSSProperties)
          : undefined
      }
    >
      <AppSidebar isAdmin={isAdmin} />
      {/* `min-w-0` is load-bearing: SidebarInset is a flex item of the body
          row, so its default `min-width: auto` resolves to its min-content
          width. Once the members drawer docks beside the table, that
          min-content exceeds the space left by the sidebar, the inset refuses
          to shrink, and the whole document scrolls horizontally — which also
          re-parents the table's sticky columns to the viewport, sliding them
          over the sidebar. */}
      <SidebarInset className="min-w-0 bg-mdpva-paper text-mdpva-ink dark:bg-background dark:text-foreground">
        <header className="sticky top-0 z-40 border-b border-mdpva-border bg-mdpva-paper/95 backdrop-blur supports-backdrop-filter:bg-mdpva-paper/80 dark:border-border dark:bg-background/95 dark:supports-backdrop-filter:bg-background/80">
          <div className="flex items-center gap-2 px-4 py-3 sm:px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-1 h-4!" />
            <div className="hidden flex-1 sm:block">
              <Suspense fallback={null}>
                <SearchInput />
              </Suspense>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <ProfileMenu name={name} isAdmin={isAdmin} />
            </div>
          </div>
        </header>
        {/* Full width by default: the app is an internal tool used on wide
            monitors, and a fixed cap left a third of a 2560px screen empty.
            Pages that need a reading measure (forms, prose) set their own
            max-width on the content that needs it, rather than the shell
            deciding for every route — so a new route is wide automatically
            and only narrows deliberately. */}
        <main className="w-full flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
