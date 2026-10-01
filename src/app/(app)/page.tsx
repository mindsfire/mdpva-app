import Link from "next/link";
import {
  ContactIcon,
  WalletIcon,
  HeartHandshakeIcon,
  PlusIcon,
  ArrowRightIcon,
  CheckIcon,
} from "lucide-react";

import { hasRole, requireRole } from "@/lib/rbac";
import { getDashboardStats, type DashboardStats } from "@/lib/dashboard-query";
import { getOnboardingProgress } from "@/lib/onboarding/progress-query";
import { Button } from "@/components/ui/button";
import { MdpvaLogo } from "@/components/brand/mdpva-logo";
import { OnboardingProgressCard } from "@/components/applications/progress-card";
import { CountUp } from "@/components/count-up";
import { MemberAvatar } from "@/components/members/member-avatar";
import { ProfessionLabel } from "@/components/members/member-badges";
import { PageBreadcrumb } from "@/components/app-shell/page-breadcrumb";
import { fullName } from "@/lib/member-name";
import { PROFESSION_LABELS } from "@/lib/profession";
import { cn } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function StatTile({
  label,
  value,
  hint,
  href,
  icon: Icon,
  className,
}: {
  label: string;
  value: number;
  hint?: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(className, "group flex flex-col gap-3 rounded-lg border border-mdpva-border bg-mdpva-white p-4 transition-colors hover:border-mdpva-accent/40 sm:p-5 dark:border-border dark:bg-card dark:hover:border-mdpva-gold/40")}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        <Icon className="size-4 text-mdpva-accent/70 dark:text-mdpva-gold/70" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-serif text-3xl leading-none font-medium tabular-nums sm:text-4xl">
          <CountUp value={value} />
        </span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
    </Link>
  );
}

const PANEL =
  "rounded-lg border border-mdpva-border bg-mdpva-white p-4 sm:p-5 dark:border-border dark:bg-card";
const PANEL_TITLE =
  "text-sm font-medium tracking-wide text-muted-foreground uppercase";

/**
 * One labelled bar in a dashboard panel. Linked to the directory list the
 * number counts, unless that list would be empty.
 */
function BarRow({
  label,
  value,
  fraction,
  href,
  muted = false,
  index = 0,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Bar fill, 0–1. */
  fraction: number;
  href: string | null;
  /** For the "nothing recorded" bucket, so it doesn't read as a category. */
  muted?: boolean;
  /** Position in its panel, to stagger the bars' grow-in top to bottom. */
  index?: number;
}) {
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className={cn(muted && "text-muted-foreground")}>{label}</span>
        <span className="font-medium tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-mdpva-border-tile dark:bg-muted">
        <div
          className={cn(
            "h-full animate-bar-grow rounded-full motion-reduce:animate-none",
            muted
              ? "bg-muted-foreground/35"
              : "bg-mdpva-accent dark:bg-mdpva-gold",
          )}
          style={{
            width: `${Math.min(1, Math.max(0, fraction)) * 100}%`,
            animationDelay: `${index * 70}ms`,
          }}
        />
      </div>
    </>
  );
  return (
    <li>
      {href ? (
        <Link
          href={href}
          className="-mx-2 flex flex-col gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-mdpva-border-tile/50 dark:hover:bg-muted/50"
        >
          {body}
        </Link>
      ) : (
        <div className="flex flex-col gap-1.5 py-1">{body}</div>
      )}
    </li>
  );
}

/**
 * Details the office needs on file for every member, most-missing first.
 * The `href`s are the directory filters that list exactly the members counted.
 */
function completenessRows(missing: DashboardStats["missing"]) {
  return [
    { key: "photo", label: "Photo", count: missing.photo, href: "/members?missing=photo" },
    { key: "phone", label: "Phone", count: missing.phone, href: "/members?missing=phone" },
    { key: "dob", label: "Date of birth", count: missing.dob, href: "/members?missing=dob" },
    { key: "profession", label: "Profession", count: missing.profession, href: "/members?profession=none" },
    { key: "nominee", label: "Nominee", count: missing.nominee, href: "/members?missing=nominee" },
    { key: "city", label: "City", count: missing.city, href: "/members?missing=city" },
  ].sort((a, b) => b.count - a.count);
}

const pctFmt = new Intl.NumberFormat("en-IN", {
  style: "percent",
  maximumFractionDigits: 0,
});

export default async function DashboardPage() {
  const sessionUser = await requireRole("viewer");
  const stats = await getDashboardStats();
  const year = new Date().getFullYear();
  const isEditor = hasRole(sessionUser.role, "editor");
  const isAdmin = hasRole(sessionUser.role, "admin");
  // Admin-only: the progress card is a staff coordination tool, not member data.
  const progress = isAdmin ? await getOnboardingProgress() : null;
  const professionMax = Math.max(1, ...stats.professions.map((p) => p.count));

  return (
    <div className="flex flex-col gap-6">
      <PageBreadcrumb items={[{ label: "Dashboard" }]} />
      {isAdmin && progress ? <OnboardingProgressCard progress={progress} /> : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <MdpvaLogo size={52} className="hidden sm:block" priority />
          <div>
            <h1 className="font-serif text-2xl font-medium tracking-tight">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Association members at a glance.
            </p>
          </div>
        </div>
        {isEditor ? (
          <Button render={<Link href="/members/new" />} size="sm">
            <PlusIcon />
            Add member
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
        <StatTile
          label="Total members"
          value={stats.total}
          hint={
            stats.notActive > 0
              ? `${stats.notActive.toLocaleString("en-IN")} not active`
              : "all active"
          }
          href="/members"
          icon={ContactIcon}
          className="col-span-2 sm:col-span-1"
        />
        <StatTile
          label={`Fees paid ${year}`}
          value={stats.feesPaid}
          // Until the office records fees, "N due" would just repeat the total.
          hint={
            stats.feesPaid === 0
              ? "none recorded yet"
              : `${stats.feesDue.toLocaleString("en-IN")} still due`
          }
          href="/members?feesDue=true&status=active"
          icon={WalletIcon}
        />
        <StatTile
          label="Death fund"
          value={stats.deathFundCovered}
          hint={
            stats.total > 0
              ? `${pctFmt.format(stats.deathFundCovered / stats.total)} covered`
              : undefined
          }
          href="/members?deathFund=true"
          icon={HeartHandshakeIcon}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className={PANEL}>
          <h2 className={PANEL_TITLE}>By profession</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {stats.professions.map((p, i) => (
              <BarRow
                key={p.profession}
                index={i}
                label={
                  p.profession === "none"
                    ? "Not set"
                    : PROFESSION_LABELS[p.profession]
                }
                value={<CountUp value={p.count} />}
                fraction={p.count / professionMax}
                href={
                  p.count > 0 ? `/members?profession=${p.profession}` : null
                }
                muted={p.profession === "none"}
              />
            ))}
          </ul>
        </section>

        <section className={PANEL}>
          <h2 className={PANEL_TITLE}>Profile completeness</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Members missing each detail.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {completenessRows(stats.missing).map((row, i) => (
              <BarRow
                key={row.key}
                index={i}
                label={row.label}
                value={
                  row.count === 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                      <CheckIcon className="size-3.5" />
                      Complete
                    </span>
                  ) : (
                    <>
                      <CountUp value={row.count} /> missing
                    </>
                  )
                }
                fraction={
                  stats.total > 0 ? (stats.total - row.count) / stats.total : 0
                }
                href={row.count > 0 ? row.href : null}
              />
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-mdpva-border bg-mdpva-white dark:border-border dark:bg-card">
          <div className="flex items-center justify-between gap-2 p-4 pb-0 sm:p-5 sm:pb-0">
            <h2 className={PANEL_TITLE}>Recently added</h2>
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/members?sort=newest" />}
              className="text-mdpva-accent dark:text-mdpva-gold"
            >
              View all
              <ArrowRightIcon />
            </Button>
          </div>
          {stats.recent.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground sm:p-5">
              No members yet — add the first one.
            </p>
          ) : (
            <ul className="divide-y divide-mdpva-border p-2 dark:divide-border">
              {stats.recent.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/members?member=${m.id}`}
                    className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-mdpva-border-tile/50 dark:hover:bg-muted/50"
                  >
                    <MemberAvatar
                      firstName={m.firstName}
                      photoKey={m.photoKey}
                      updatedAt={m.updatedAt}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {fullName(m.firstName)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.legacyId ?? m.memberId} · <ProfessionLabel
                          profession={m.profession}
                          professionOther={m.professionOther}
                        />
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {dateFmt.format(m.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
