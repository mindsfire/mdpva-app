"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

interface DirectoryTransition {
  isPending: boolean;
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

  const navigate = React.useCallback(
    (href: string) => {
      startTransition(() => {
        router.push(href);
      });
    },
    [router],
  );

  const value = React.useMemo(
    () => ({ isPending, navigate }),
    [isPending, navigate],
  );

  return (
    <DirectoryTransitionContext.Provider value={value}>
      {children}
    </DirectoryTransitionContext.Provider>
  );
}

/**
 * Dims the (server-rendered) results while a navigation is in flight and
 * floats a spinner over them. Kept as a wrapper so the rows themselves stay
 * server components.
 */
export function DirectoryResults({ children }: { children: React.ReactNode }) {
  const { isPending } = useDirectoryTransition();

  return (
    <div className="relative" aria-busy={isPending}>
      {isPending ? (
        // Sticky, and placed *before* the rows: the controls that trigger
        // this sit at the bottom of a long list, so a pill anchored to the
        // top of the container would be scrolled out of sight exactly when
        // it matters. Sticking from the top of the container keeps it in
        // view for the whole list. `h-0` keeps it out of the layout so
        // nothing shifts when it appears, and staying in flow (rather than
        // `fixed`) centres it on the content column instead of the
        // viewport, which the sidebar would skew.
        <div className="pointer-events-none sticky top-20 z-50 flex h-0 justify-center">
          <span className="flex items-center gap-2 rounded-full border border-mdpva-border bg-mdpva-white px-3 py-1.5 text-sm text-muted-foreground shadow-md dark:border-border dark:bg-card">
            <Loader2Icon className="size-3.5 animate-spin" />
            Loading…
          </span>
        </div>
      ) : null}
      <div
        className={cn(
          "transition-opacity duration-150",
          isPending && "pointer-events-none opacity-40",
        )}
      >
        {children}
      </div>
    </div>
  );
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
