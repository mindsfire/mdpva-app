import Link from "next/link";

import {
  applicationCounts,
  listApplications,
} from "@/app/actions/applications";
import { QueueTable } from "@/components/applications/queue-table";
import { PageBreadcrumb } from "@/components/app-shell/page-breadcrumb";
import { cn } from "@/lib/utils";

type Status = "pending" | "approved" | "rejected";

const TABS: { key: Status; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = typeof params.status === "string" ? params.status : "pending";
  const status: Status = TABS.some((t) => t.key === raw)
    ? (raw as Status)
    : "pending";

  const [rows, counts] = await Promise.all([
    listApplications(status),
    applicationCounts(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageBreadcrumb
        items={[{ label: "Dashboard", href: "/" }, { label: "Applications" }]}
      />

      <div>
        <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
          Member applications
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Details members submitted about themselves. Nothing reaches the
          directory until it&apos;s approved here.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/applications?status=${tab.key}`}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
              status === tab.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {tab.label}
            <span className="text-xs tabular-nums opacity-80">
              {counts[tab.key]}
            </span>
          </Link>
        ))}
      </div>

      {/* Bulk approve only makes sense on the pending tab. */}
      <QueueTable rows={rows} selectable={status === "pending"} />
    </div>
  );
}
