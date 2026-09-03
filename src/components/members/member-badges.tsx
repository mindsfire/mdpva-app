import { cn } from "@/lib/utils";
import { isFeesPaid } from "@/lib/fees";
import type { MemberRow } from "@/lib/members-query";

const STATUS_STYLES: Record<MemberRow["status"], string> = {
  active:
    "bg-[#e8efe2] text-[#3d5a2c] dark:bg-[#2a3322] dark:text-[#b7d1a3]",
  inactive:
    "bg-[#ececE8] text-[#787770] dark:bg-[#232219] dark:text-[#a8a698]",
  suspended:
    "bg-[#f3e5df] text-[#a03d2e] dark:bg-[#3a2620] dark:text-[#e6a894]",
};

export function StatusBadge({ status }: { status: MemberRow["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        STATUS_STYLES[status],
      )}
    >
      {status}
    </span>
  );
}

export function FeesBadge({
  feesPaidUpto,
}: {
  feesPaidUpto: number | null;
}) {
  const paid = isFeesPaid(feesPaidUpto);
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium",
        paid
          ? "bg-[#e8efe2] text-[#3d5a2c] dark:bg-[#2a3322] dark:text-[#b7d1a3]"
          : "bg-[#f3e0da] text-[#a03d2e] dark:bg-[#3a231d] dark:text-[#e6a894]",
      )}
    >
      {paid ? `Paid ${feesPaidUpto}` : "Due"}
    </span>
  );
}

export function DeathFundBadge({ covered }: { covered: boolean }) {
  if (!covered) return null;
  return (
    <span className="inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full bg-mdpva-gold/25 px-2 py-0.5 text-xs font-medium text-mdpva-accent dark:text-mdpva-gold">
      Death Fund
    </span>
  );
}

export function ProfessionLabel({
  profession,
}: {
  profession: MemberRow["profession"];
}) {
  if (!profession) return <span className="text-muted-foreground">—</span>;
  const labels: Record<NonNullable<MemberRow["profession"]>, string> = {
    photographer: "Photographer",
    videographer: "Videographer",
    photo_and_video: "Photo & Video",
    drone_operator: "Drone Operator",
  };
  return <span>{labels[profession]}</span>;
}

/**
 * Members with no surname fall back to the first two letters of their given
 * name, so the avatar never renders a lone letter (see `optionalPersonName`).
 *
 * `lastName` is nullable in the database: many Kannada names have no
 * separable surname. Calling `.charAt` on that null threw, and because every
 * member row renders an avatar it took out the dashboard and the directory
 * through the error boundary.
 */
function initials(firstName: string, lastName: string | null): string {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  const pair = last ? first.charAt(0) + last.charAt(0) : first.slice(0, 2);
  return pair.toUpperCase();
}

export { initials };
