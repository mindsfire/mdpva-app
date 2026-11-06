import Link from "next/link";
import { notFound } from "next/navigation";
import { PlusIcon, UserIcon } from "lucide-react";

import { listDonations } from "@/app/actions/donations";
import { PageBreadcrumb } from "@/components/app-shell/page-breadcrumb";
import { PhotoImg } from "@/components/photo-img";
import { Button } from "@/components/ui/button";
import { formatRupees } from "@/lib/donations/validation";
import { formatDateIST } from "@/lib/format-date";
import { photoUrl } from "@/lib/photo-url";
import { hasRole, requireRole } from "@/lib/rbac";

export default async function DonationsPage() {
  const sessionUser = await requireRole("viewer");
  // Non-admins get a 404, not a redirect hint that this route exists.
  if (!hasRole(sessionUser.role, "admin")) notFound();

  const rows = await listDonations();
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageBreadcrumb
        items={[{ label: "Dashboard", href: "/" }, { label: "Donations" }]}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
            Donations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length === 0
              ? "Record a donation to create its share card."
              : `${formatRupees(total)} from ${rows.length} ${
                  rows.length === 1 ? "donation" : "donations"
                }`}
          </p>
        </div>
        <Button className="h-9" render={<Link href="/donations/new" />}>
          <PlusIcon />
          Add
        </Button>
      </div>

      {rows.length > 0 ? (
        <ul className="divide-y divide-mdpva-border rounded-lg border border-mdpva-border dark:divide-border dark:border-border">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/donations/${row.id}`}
                className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50 sm:px-4"
              >
                <PhotoImg
                  src={photoUrl(row.photoKey, row.updatedAt, { thumb: true }) ?? undefined}
                  alt=""
                  className="size-11 shrink-0 rounded-md object-cover"
                  fallback={
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted">
                      <UserIcon className="size-5 text-muted-foreground" />
                    </span>
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {row.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[row.businessName, formatDateIST(row.createdAt)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                  {formatRupees(row.amount)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
