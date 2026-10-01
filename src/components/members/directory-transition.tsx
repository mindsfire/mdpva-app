"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  MemberCardsSkeleton,
  MemberTableSkeleton,
} from "@/components/app-shell/page-skeletons";
import { useMembersSelection } from "@/components/members/selection";
import { rowsOnPage } from "@/lib/members-params";

interface DirectoryTransition {
  isPending: boolean;
  /** Where the in-flight navigation is going; meaningful only while pending. */
  pendingHref: string | null;
  /** Navigate inside a transition so the caller can render pending UI. */
  navigate: (href: string) => void;
}

const DirectoryTransitionContext =
  React.createContext<DirectoryTransition | null>(null);

export function useDirectoryTransition(): DirectoryTransition {
  const context = React.useContext(DirectoryTransitionContext);
  if (!context) {
    throw new Error(
      "useDirectoryTransition must be used within DirectoryTransitionProvider",
    );
  }
  return context;
}

/**
 * Shares one `useTransition` between the directory's navigation controls
 * (pagination, rows-per-page) and the results area, so changing a page or
 * the row count can visibly show that work is in flight. Without this the
 * swap is instant-but-silent and reads as "nothing happened".
 */
export function DirectoryTransitionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);

  const navigate = React.useCallback(
    (href: string) => {
      setPendingHref(href);
      startTransition(() => {
        router.push(href);
      });
    },
    [router],
  );

  const value = React.useMemo(
    () => ({ isPending, pendingHref, navigate }),
    [isPending, pendingHref, navigate],
  );

  return (
    <DirectoryTransitionContext.Provider value={value}>
      {children}
    </DirectoryTransitionContext.Provider>
  );
}

/**
 * Swaps the (server-rendered) results for a skeleton while a navigation is in
 * flight. Kept as a wrapper so the rows themselves stay server components.
 *
 * A skeleton rather than a spinner over dimmed rows: paging is a *replacement*
 * of the list, and leaving the old page faintly readable underneath invites
 * you to keep reading rows that are about to vanish. The same skeletons the
 * route's loading.tsx uses, so a first load and a page change look alike.
 */
export function DirectoryResults({
  children,
  total,
}: {
  children: React.ReactNode;
  /** Matching members, to size the skeleton for the page being opened. */
  total: number;
}) {
  const { isPending, pendingHref } = useDirectoryTransition();
  // Only admins get the checkbox column, so only their skeleton draws it.
  const selectable = useMembersSelection() !== null;

  if (isPending) {
    // Exact for page, page-size and sort changes. A filter change alters the
    // total, which isn't known until it loads, so that's a best estimate.
    const rows = pendingHref ? rowsOnPage(pendingHref, total) : 10;
    return (
      <div aria-busy>
        <MemberTableSkeleton rows={rows} selectable={selectable} />
        <MemberCardsSkeleton rows={rows} selectable={selectable} />
      </div>
    );
  }

  return <div>{children}</div>;
}

/**
 * Anchor that navigates through the shared transition on a plain click,
 * while leaving modifier-clicks (new tab, new window) to the browser.
 */
export function TransitionLink({
  href,
  children,
  className,
  onClick,
  ...props
}: {
  href: string;
  // Optional: base-ui's `render` prop clones this element and supplies the
  // children itself, so callers pass `<TransitionLink href=… />` bare.
  children?: React.ReactNode;
  className?: string;
} & Omit<React.ComponentProps<"a">, "href">) {
  const { navigate } = useDirectoryTransition();

  return (
    <a
      href={href}
      className={className}
      {...props}
      // Declared after the spread so a wrapper's injected onClick can't
      // replace it — the incoming handler is chained explicitly instead.
      // (When it was spread last, clicks fell through to a native
      // navigation and the transition never ran.)
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        ) {
          return;
        }
        event.preventDefault();
        navigate(href);
      }}
    >
      {children}
    </a>
  );
}
