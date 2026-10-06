/**
 * Shared IST date formatting.
 *
 * Server components render in the server's time zone (UTC on Vercel), not
 * India's. Without an explicit `timeZone`, a submission made between 00:00
 * and 05:30 IST shows the previous day everywhere it's displayed. Every call
 * site that shows a submission or review timestamp should go through one of
 * these two helpers instead of building its own `Intl.DateTimeFormat`.
 */

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});

/**
 * A stored `date` (ISO `YYYY-MM-DD`) as `DD-MM-YYYY` — the Indian convention,
 * and what members type into the onboarding form's date field. Used for birth
 * dates everywhere they're shown, so the form, the review screen, the member
 * record and the PDF all read the same way. Anything that isn't a clean ISO
 * date is returned unchanged rather than guessed at.
 */
export function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

/** e.g. "26 Sept 2026" */
export function formatDateIST(date: Date): string {
  return dateFmt.format(date);
}

/** e.g. "26 Sept 2026, 1:30 am IST" */
export function formatDateTimeIST(date: Date): string {
  // Intl renders "am"/"pm" lowercase and "GMT+5:30" isn't as readable as
  // "IST", so build the string from parts instead of the formatted output.
  const parts = dateTimeFmt.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const day = get("day");
  const month = get("month");
  const year = get("year");
  const hour = get("hour");
  const minute = get("minute");
  const dayPeriod = get("dayPeriod").toLowerCase();

  return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod} IST`;
}
