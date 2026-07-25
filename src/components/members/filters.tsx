"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChipOption {
  label: string;
  param: string;
  value: string;
}

const STATUS_OPTIONS: ChipOption[] = [
  { label: "Active", param: "status", value: "active" },
  { label: "Inactive", param: "status", value: "inactive" },
  { label: "Suspended", param: "status", value: "suspended" },
];

const PROFESSION_OPTIONS: ChipOption[] = [
  { label: "Photographer", param: "profession", value: "photographer" },
  { label: "Videographer", param: "profession", value: "videographer" },
  { label: "Photo & Video", param: "profession", value: "both" },
];

const TOGGLE_OPTIONS: ChipOption[] = [
  { label: "Fees due", param: "feesDue", value: "true" },
  { label: "Death fund", param: "deathFund", value: "true" },
];

const SORT_OPTIONS: { label: string; value: string }[] = [
  { label: "Name", value: "name" },
  { label: "Fees", value: "fees" },
  { label: "Status", value: "status" },
];

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 shrink-0 items-center justify-center rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors",
        active
          ? "border-mdpva-accent bg-mdpva-accent text-mdpva-cream dark:bg-mdpva-gold dark:text-mdpva-ink"
          : "border-mdpva-border bg-transparent text-mdpva-body hover:bg-muted dark:border-border dark:text-foreground",
      )}
    >
      {label}
    </button>
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
    params.delete("cursor");
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggle(option: ChipOption) {
    const current = searchParams.get(option.param);
    setParam(option.param, current === option.value ? null : option.value);
  }

  const hasActiveFilters =
    Boolean(searchParams.get("q")) ||
    Boolean(searchParams.get("status")) ||
    Boolean(searchParams.get("profession")) ||
    Boolean(searchParams.get("feesDue")) ||
    Boolean(searchParams.get("deathFund"));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {[...STATUS_OPTIONS, ...PROFESSION_OPTIONS, ...TOGGLE_OPTIONS].map(
          (option) => (
            <Chip
              key={`${option.param}-${option.value}`}
              label={option.label}
              active={searchParams.get(option.param) === option.value}
              onClick={() => toggle(option)}
            />
          ),
        )}
        {hasActiveFilters ? (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => router.push(pathname)}
          >
            Clear filters
          </Button>
        ) : null}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Sort by</span>
        {SORT_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            active={(searchParams.get("sort") ?? "name") === option.value}
            onClick={() => setParam("sort", option.value)}
          />
        ))}
      </div>
    </div>
  );
}
