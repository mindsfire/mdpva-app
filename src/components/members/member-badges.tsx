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
  professionOther,
}: {
  profession: MemberRow["profession"];
  professionOther?: MemberRow["professionOther"];
}) {
  if (!profession) return <span className="text-muted-foreground">—</span>;
  if (profession === "other") {
    return <span>{professionOther || "Other"}</span>;
  }
  const labels: Record<
    Exclude<NonNullable<MemberRow["profession"]>, "other">,
    string
  > = {
    photographer: "Photographer",
    videographer: "Videographer",
    photo_and_video: "Photo & Video",
    drone_operator: "Drone Operator",
  };
  return <span>{labels[profession]}</span>;
}

/**
 * Initials from the first and last words of the full name ("Kavya Bhat" ->
 * "KB"). A single-word name falls back to its first two letters so the avatar
 * never renders a lone letter. Tolerates empty/null input: every member row
 * renders an avatar, so a throw here would take out the dashboard and the
 * directory through the error boundary.
 */
function initials(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const pair =
    words.length > 1
      ? words[0]!.charAt(0) + words[words.length - 1]!.charAt(0)
      : words[0]!.slice(0, 2);
  return pair.toUpperCase();
}

export { initials };
