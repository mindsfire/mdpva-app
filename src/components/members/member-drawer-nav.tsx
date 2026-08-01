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
        // `scroll: false` is essential, not cosmetic: the default scrolls to
        // the top of the document on every push, so opening or stepping to a
        // member at row 100 threw you back to row 1 and you had to scroll all
        // the way down again to reach its neighbour.
        router.push(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
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
 *
 * Arrow navigation is scoped to the directory region via `regionRef`
 * (the table + drawer container): outside that region — e.g. focus on
 * `body` after clicking elsewhere on the page — arrows must scroll the
 * page normally rather than stepping the drawer. Escape closes regardless
 * of focus location, since it never competes with scrolling.
 */
export function MemberDrawerKeys({
  regionRef,
}: {
  regionRef?: React.RefObject<HTMLElement | null>;
}) {
  const { next, prev, close } = useMemberDrawerNav();

  // `next`/`prev`/`close` are recreated whenever the provider's `value` memo
  // recomputes (which happens on every `isPending` flip during navigation).
  // Keep the latest handlers in a ref and register the listener once with a
  // stable dependency array, so an arrow-key press doesn't detach/reattach
  // the global keydown listener on every navigation.
  const handlersRef = React.useRef({ next, prev, close });
  React.useEffect(() => {
    handlersRef.current = { next, prev, close };
  }, [next, prev, close]);

  // regionRef is captured via a ref-to-the-ref so the listener effect below
  // can stay mounted once (stable deps) while still reading the latest ref.
  const regionRefRef = React.useRef(regionRef);
  React.useEffect(() => {
    regionRefRef.current = regionRef;
  }, [regionRef]);

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

      if (event.key === "Escape") {
        event.preventDefault();
        handlersRef.current.close();
        return;
      }

      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

      // Arrow navigation only acts when focus is inside the directory
      // region (the table or the drawer). Outside it, arrows must scroll
      // the page normally — no preventDefault.
      const region = regionRefRef.current?.current;
      if (region && !region.contains(target)) return;

      if (event.key === "ArrowDown") {
        // Ignore OS key-repeat: each step triggers a server fetch, and
        // holding the key down would spray requests at the database.
        if (event.repeat) return;
        event.preventDefault();
        handlersRef.current.next();
      } else {
        if (event.repeat) return;
        event.preventDefault();
        handlersRef.current.prev();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
