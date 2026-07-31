"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface MemberDrawerNav {
  activeId: string | null;
  /** True while the next member's data is being fetched. */
  isPending: boolean;
  open: (id: string) => void;
  close: () => void;
  next: () => void;
  prev: () => void;
}

const Context = React.createContext<MemberDrawerNav | null>(null);

export function useMemberDrawerNav(): MemberDrawerNav {
  const context = React.useContext(Context);
  if (!context) {
    throw new Error(
      "useMemberDrawerNav must be used within MemberDrawerNavProvider",
    );
  }
  return context;
}

/**
 * Owns which member the drawer is showing.
 *
 * Selection lives in the URL (`?member=<id>`) so deep links and browser
 * back/forward keep working, but navigation runs inside a transition scoped to
 * the drawer — unlike `DirectoryTransitionProvider`, which dims the entire
 * results area. Dimming the list on every arrow-key step would defeat the
 * point of keeping it visible.
 */
export function MemberDrawerNavProvider({
  ids,
  activeId,
  children,
}: {
  /** Member ids in the order the current page renders them. */
  ids: string[];
  activeId: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const go = React.useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set("member", id);
      else params.delete("member");
      const query = params.toString();
      startTransition(() => {
        router.push(query ? `${pathname}?${query}` : pathname);
      });
    },
    [pathname, router, searchParams],
  );

  const step = React.useCallback(
    (delta: number) => {
      if (!activeId) return;
      const index = ids.indexOf(activeId);
      if (index === -1) return;
      const target = ids[index + delta];
      // Deliberately does not paginate: stepping past the last row on a page
      // would change the list under the user without them asking.
      if (target) go(target);
    },
    [activeId, go, ids],
  );

  const value = React.useMemo<MemberDrawerNav>(
    () => ({
      activeId,
      isPending,
      open: (id: string) => go(id),
      close: () => go(null),
      next: () => step(1),
      prev: () => step(-1),
    }),
    [activeId, go, isPending, step],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/**
 * Keyboard control for the drawer. Rendered only when the drawer is open.
 *
 * Ignores events originating in a text field or with a modifier held, so
 * typing in the search box and native shortcuts are unaffected.
 */
export function MemberDrawerKeys() {
  const { next, prev, close } = useMemberDrawerNav();

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        prev();
      } else if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, next, prev]);

  return null;
}
