"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { bulkSoftDeleteMembers } from "@/app/actions/members";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MembersSelectionContextValue {
  selected: Set<string>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  clear: () => void;
}

const MembersSelectionContext =
  React.createContext<MembersSelectionContextValue | null>(null);

export function useMembersSelection(): MembersSelectionContextValue | null {
  return React.useContext(MembersSelectionContext);
}

/**
 * Selection state lives here rather than in the directory page (a server
 * component) — checkboxes and the delete toolbar need client interactivity,
 * but this stays out of `MemberTable`/`MemberCard` so those keep working
 * unselectably (e.g. mobile view) when no provider wraps them.
 */
export function MembersSelectionProvider({
  isAdmin,
  ids,
  children,
}: {
  isAdmin: boolean;
  ids: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  // Selection is a snapshot of one page's rows — drop anything that
  // scrolled out of the current result set (filter/page change). Adjusted
  // during render (not an effect) per the documented "you might not need
  // an effect" pattern: derive from a change in props, no external system
  // involved.
  const idSet = React.useMemo(() => new Set(ids), [ids]);
  const [prevIdSet, setPrevIdSet] = React.useState(idSet);
  if (idSet !== prevIdSet) {
    setPrevIdSet(idSet);
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => idSet.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }

  const toggle = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clear = React.useCallback(() => setSelected(new Set()), []);

  const value = React.useMemo<MembersSelectionContextValue>(
    () => ({
      selected,
      isSelected: (id: string) => selected.has(id),
      toggle,
      clear,
    }),
    [selected, toggle, clear],
  );

  async function handleDelete() {
    setPending(true);
    try {
      const result = await bulkSoftDeleteMembers([...selected]);
      if (result.ok) {
        toast.success(
          result.deletedCount === 1
            ? "1 member deleted."
            : `${result.deletedCount} members deleted.`,
        );
        clear();
        setConfirmOpen(false);
        router.refresh();
      } else {
        toast.error("Couldn't delete the selected members.");
      }
    } finally {
      setPending(false);
    }
  }

  if (!isAdmin) {
    return <>{children}</>;
  }

  return (
    <MembersSelectionContext.Provider value={value}>
      {children}
      {selected.size > 0 ? (
        <div className="sticky bottom-4 z-20 flex items-center justify-between gap-3 rounded-lg border border-mdpva-border bg-popover px-4 py-2.5 shadow-md ring-1 ring-foreground/10 dark:border-border">
          <span className="text-sm text-foreground">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clear}>
              Clear
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2Icon />
              Delete selected
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selected.size} members?</DialogTitle>
            <DialogDescription>
              This removes them from the directory. This can&apos;t be undone
              from here.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={pending}
            >
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MembersSelectionContext.Provider>
  );
}
