import Link from "next/link";
import {
  ContactIcon,
  UserCheckIcon,
  AlertCircleIcon,
  HeartHandshakeIcon,
  PlusIcon,
  ArrowRightIcon,
} from "lucide-react";

import { hasRole, requireRole } from "@/lib/rbac";
import { getDashboardStats } from "@/lib/dashboard-query";
import { getOnboardingProgress } from "@/lib/onboarding/progress-query";
import { Button } from "@/components/ui/button";
import { MdpvaLogo } from "@/components/brand/mdpva-logo";
import { OnboardingProgressCard } from "@/components/applications/progress-card";
import { MemberAvatar } from "@/components/members/member-avatar";
import { ProfessionLabel } from "@/components/members/member-badges";
import { PageBreadcrumb } from "@/components/app-shell/page-breadcrumb";
import { fullName } from "@/lib/member-name";

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
}: {
  label: string;
  value: number;
  hint?: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-lg border border-mdpva-border bg-mdpva-white p-4 transition-colors hover:border-mdpva-accent/40 sm:p-5 dark:border-border dark:bg-card dark:hover:border-mdpva-gold/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        <Icon className="size-4 text-mdpva-accent/70 dark:text-mdpva-gold/70" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-serif text-3xl leading-none font-medium tabular-nums sm:text-4xl">
          {value.toLocaleString("en-IN")}
        </span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
    </Link>
  );
}

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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatTile
          label="Total members"
          value={stats.total}
          href="/members"
          icon={ContactIcon}
        />
        <StatTile
          label="Active"
          value={stats.active}
          href="/members?status=active"
          icon={UserCheckIcon}
        />
        <StatTile
          label={`Fees due ${year}`}
          value={stats.feesDue}
          hint="active members"
          href="/members?feesDue=true&status=active"
          icon={AlertCircleIcon}
        />
        <StatTile
          label="Death fund covered"
          value={stats.deathFundCovered}
          href="/members?deathFund=true"
          icon={HeartHandshakeIcon}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="rounded-lg border border-mdpva-border bg-mdpva-white p-4 sm:p-5 lg:col-span-2 dark:border-border dark:bg-card">
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            By profession
          </h2>
          <ul className="mt-4 flex flex-col gap-4">
            {stats.professions.map((p) => (
              <li key={p.profession} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <ProfessionLabel profession={p.profession} />
                  <span className="font-medium tabular-nums">{p.count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-mdpva-border-tile dark:bg-muted">
                  <div
                    className="h-full rounded-full bg-mdpva-accent dark:bg-mdpva-gold"
                    style={{ width: `${(p.count / professionMax) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-mdpva-border bg-mdpva-white lg:col-span-3 dark:border-border dark:bg-card">
          <div className="flex items-center justify-between gap-2 p-4 pb-0 sm:p-5 sm:pb-0">
            <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
              Recently added
            </h2>
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
                      lastName={m.lastName}
                      photoKey={m.photoKey}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {fullName(m.firstName, m.lastName)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.legacyId ?? m.memberId} · <ProfessionLabel profession={m.profession} />
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
