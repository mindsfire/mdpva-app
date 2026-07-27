"use client";

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Date input for birth dates.
 *
 * A native `<input type="date">` is the wrong control here: it opens on the
 * current month, so a member born in 1965 faces ~700 taps of "previous month",
 * and its rendering is wildly inconsistent across the older Android devices
 * this form targets. The calendar below puts **month and year dropdowns in its
 * header** — reaching 1965 is two taps — and the text field still accepts
 * typing for members who find that faster.
 *
 * Display is `DD-MM-YYYY` (the Indian convention); `value`/`onChange` speak ISO
 * `YYYY-MM-DD`, which is what the `date` column stores.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Birth dates outside this range are typos, not data. */
export const MIN_AGE = 18;
export const MAX_AGE = 100;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

/**
 * Parses `DD-MM-YYYY` (also accepting `/` and `.` separators, which people use
 * interchangeably) into ISO, or null. Rejects dates that don't exist —
 * `31-02-1980` round-trips to 2 March in a naive `new Date`, so the components
 * are compared back explicitly.
 */
export function displayToIso(input: string): string | null {
  const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(input.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  return toIso(d);
}

export function isPlausibleBirthDate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = new Date();
  if (d > now) return false;
  const age = (now.getTime() - d.getTime()) / (365.2425 * 24 * 3600 * 1000);
  return age >= MIN_AGE && age <= MAX_AGE;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function DateField({
  value,
  onChange,
  id,
  placeholder = "DD-MM-YYYY",
  className,
}: {
  /** ISO `YYYY-MM-DD`, or "" when unset. */
  value: string;
  onChange: (iso: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = React.useState(() =>
    value ? isoToDisplay(value) : "",
  );
  const [open, setOpen] = React.useState(false);

  // Adopt an externally-changed value (draft restore, reset) without fighting
  // the user mid-type: only when the committed value actually moved.
  const [prevValue, setPrevValue] = React.useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setText(value ? isoToDisplay(value) : "");
  }

  const today = new Date();
  const selected = value ? new Date(`${value}T00:00:00`) : null;
  const [viewYear, setViewYear] = React.useState(
    selected?.getFullYear() ?? today.getFullYear() - 40,
  );
  const [viewMonth, setViewMonth] = React.useState(selected?.getMonth() ?? 0);

  // Memoized on the year number rather than the Date object — a fresh Date
  // every render would invalidate the memo every render.
  const currentYear = today.getFullYear();
  const years = React.useMemo(() => {
    const newest = currentYear - MIN_AGE;
    return Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => newest - i);
  }, [currentYear]);

  function commitText(next: string) {
    setText(next);
    const iso = displayToIso(next);
    if (iso) {
      onChange(iso);
      const d = new Date(`${iso}T00:00:00`);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    } else if (next.trim() === "") {
      onChange("");
    }
  }

  function pick(day: number) {
    const iso = toIso(new Date(viewYear, viewMonth, day));
    onChange(iso);
    setText(isoToDisplay(iso));
    setOpen(false);
  }

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const total = daysInMonth(viewYear, viewMonth);

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        value={text}
        onChange={(e) => commitText(e.target.value)}
        placeholder={placeholder}
        inputMode="numeric"
        autoComplete="off"
        className="pr-10"
      />
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Open calendar"
              className="absolute top-1/2 right-1 -translate-y-1/2"
            />
          }
        >
          <CalendarIcon className="size-4" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="end" sideOffset={6}>
            <Popover.Popup className="z-50 w-[286px] rounded-xl bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none">
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Previous month"
                  onClick={() => {
                    setViewMonth((m) => (m === 0 ? 11 : m - 1));
                    if (viewMonth === 0) setViewYear((y) => y - 1);
                  }}
                >
                  <ChevronLeftIcon className="size-4" />
                </Button>

                <select
                  aria-label="Month"
                  value={viewMonth}
                  onChange={(e) => setViewMonth(Number(e.target.value))}
                  className="flex-1 cursor-pointer rounded-md bg-muted/50 px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i}>
                      {m}
                    </option>
                  ))}
                </select>

                {/* The reason this component exists: jumping to 1965 directly. */}
                <select
                  aria-label="Year"
                  value={viewYear}
                  onChange={(e) => setViewYear(Number(e.target.value))}
                  className="w-[76px] cursor-pointer rounded-md bg-muted/50 px-2 py-1 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Next month"
                  onClick={() => {
                    setViewMonth((m) => (m === 11 ? 0 : m + 1));
                    if (viewMonth === 11) setViewYear((y) => y + 1);
                  }}
                >
                  <ChevronRightIcon className="size-4" />
                </Button>
              </div>

              <div className="mt-2.5 grid grid-cols-7 gap-0.5 text-center">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <span
                    key={`${d}-${i}`}
                    className="py-1 text-[11px] font-medium text-muted-foreground"
                  >
                    {d}
                  </span>
                ))}
                {Array.from({ length: firstWeekday }, (_, i) => (
                  <span key={`pad-${i}`} />
                ))}
                {Array.from({ length: total }, (_, i) => i + 1).map((day) => {
                  const isSel =
                    selected != null &&
                    selected.getFullYear() === viewYear &&
                    selected.getMonth() === viewMonth &&
                    selected.getDate() === day;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => pick(day)}
                      className={cn(
                        "cursor-pointer rounded-md py-1.5 text-[13px] tabular-nums transition-colors",
                        isSel
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
