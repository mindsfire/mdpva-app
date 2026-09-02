"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpDownIcon,
  CheckIcon,
  ListFilterIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface FilterOption {
  label: string;
  param: string;
  value: string;
}

const STATUS_OPTIONS: FilterOption[] = [
  { label: "Active", param: "status", value: "active" },
  { label: "Inactive", param: "status", value: "inactive" },
  { label: "Suspended", param: "status", value: "suspended" },
];

const PROFESSION_OPTIONS: FilterOption[] = [
  { label: "Photographer", param: "profession", value: "photographer" },
  { label: "Videographer", param: "profession", value: "videographer" },
  { label: "Photo & Video", param: "profession", value: "both" },
  { label: "Drone Operator", param: "profession", value: "drone_operator" },
];

const TOGGLE_OPTIONS: FilterOption[] = [
  { label: "Fees due", param: "feesDue", value: "true" },
  { label: "Death fund covered", param: "deathFund", value: "true" },
];

// Kept in step with the sortable column headers in MemberTable: clicking a
// header sets the same `?sort=` values, so the menu always shows what the
// table is actually sorted by.
const SORT_OPTIONS = [
  { label: "Name A–Z", value: "name" },
  { label: "Name Z–A", value: "name_desc" },
  { label: "Membership No. ↑", value: "membership" },
  { label: "Membership No. ↓", value: "membership_desc" },
  { label: "Newest first", value: "newest" },
] as const;

const ALL_OPTIONS = [
  ...STATUS_OPTIONS,
  ...PROFESSION_OPTIONS,
  ...TOGGLE_OPTIONS,
];

/** Row inside the filters menu; a tick marks the applied option. */
function MenuOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <DropdownMenuItem onClick={onClick} className="cursor-pointer gap-2">
      <CheckIcon
        className={cn("size-3.5", active ? "opacity-100" : "opacity-0")}
      />
      {label}
    </DropdownMenuItem>
  );
}

export function MemberFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(param: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null) {
      params.delete(param);
    } else {
      params.set(param, value);
    }
    // Any filter/sort change invalidates the current page position.
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggle(option: FilterOption) {
    const current = searchParams.get(option.param);
    setParam(option.param, current === option.value ? null : option.value);
  }

  const applied = ALL_OPTIONS.filter(
    (option) => searchParams.get(option.param) === option.value,
  );
  const activeSort =
    SORT_OPTIONS.find((o) => o.value === searchParams.get("sort")) ??
    SORT_OPTIONS[0];

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    for (const option of ALL_OPTIONS) params.delete(option.param);
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" className="cursor-pointer">
              <ListFilterIcon />
              Filters
              {applied.length > 0 ? (
                <span className="ml-1 flex size-4.5 items-center justify-center rounded-full bg-mdpva-accent text-[10px] font-semibold text-mdpva-cream tabular-nums dark:bg-mdpva-gold dark:text-mdpva-ink">
                  {applied.length}
                </span>
              ) : null}
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="min-w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Status</DropdownMenuLabel>
          </DropdownMenuGroup>
          {STATUS_OPTIONS.map((option) => (
            <MenuOption
              key={option.value}
              label={option.label}
              active={searchParams.get(option.param) === option.value}
              onClick={() => toggle(option)}
            />
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Profession</DropdownMenuLabel>
          </DropdownMenuGroup>
          {PROFESSION_OPTIONS.map((option) => (
            <MenuOption
              key={option.value}
              label={option.label}
              active={searchParams.get(option.param) === option.value}
              onClick={() => toggle(option)}
            />
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Association</DropdownMenuLabel>
          </DropdownMenuGroup>
          {TOGGLE_OPTIONS.map((option) => (
            <MenuOption
              key={option.param}
              label={option.label}
              active={searchParams.get(option.param) === option.value}
              onClick={() => toggle(option)}
            />
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Applied filters stay visible outside the menu so the current view is
          self-explanatory without opening anything. */}
      {applied.map((option) => (
        <button
          key={`${option.param}-${option.value}`}
          type="button"
          onClick={() => toggle(option)}
          className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-mdpva-accent bg-mdpva-accent/10 pr-1.5 pl-3 text-xs font-medium text-mdpva-accent transition-colors hover:bg-mdpva-accent/20 dark:border-mdpva-gold/60 dark:bg-mdpva-gold/10 dark:text-mdpva-gold dark:hover:bg-mdpva-gold/20"
        >
          {option.label}
          <XIcon className="size-3.5" />
          <span className="sr-only">Remove filter</span>
        </button>
      ))}

      {applied.length > 0 ? (
        <Button
          variant="ghost"
          size="xs"
          onClick={clearAll}
          className="cursor-pointer"
        >
          Clear all
        </Button>
      ) : null}

      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="cursor-pointer">
                <ArrowUpDownIcon />
                {activeSort.label}
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            {SORT_OPTIONS.map((option) => (
              <MenuOption
                key={option.value}
                label={option.label}
                active={activeSort.value === option.value}
                onClick={() => setParam("sort", option.value)}
              />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
