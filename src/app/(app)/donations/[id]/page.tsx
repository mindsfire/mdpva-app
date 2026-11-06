import Link from "next/link";
import { notFound } from "next/navigation";
import { PencilIcon } from "lucide-react";

import { getDonation } from "@/app/actions/donations";
import { PageBreadcrumb } from "@/components/app-shell/page-breadcrumb";
import { DeleteDonationButton } from "@/components/donations/delete-donation-button";
import { DonationCard } from "@/components/donations/donation-card";
import { Button } from "@/components/ui/button";
import { formatRupees } from "@/lib/donations/validation";
import { formatDateIST } from "@/lib/format-date";
import { hasRole, requireRole } from "@/lib/rbac";

export default async function DonationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessionUser = await requireRole("viewer");
  if (!hasRole(sessionUser.role, "admin")) notFound();

  const { id } = await params;
  const donation = await getDonation(id);
  if (!donation) notFound();

  const version = donation.updatedAt.getTime();

  return (
    <div className="flex flex-col gap-5">
      <PageBreadcrumb
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Donations", href: "/donations" },
          { label: donation.name },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <DonationCard
          name={donation.name}
          businessName={donation.businessName}
          amount={donation.amount}
          photoUrl={`/api/donations/${id}/photo?v=${version}`}
        />
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
              {donation.name}
            </h1>
            {donation.businessName ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {donation.businessName}
              </p>
            ) : null}
            <p className="mt-3 text-lg font-medium tabular-nums text-foreground">
              {formatRupees(donation.amount)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Added {formatDateIST(donation.createdAt)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-10 flex-1"
              render={<Link href={`/donations/${id}/edit`} />}
            >
              <PencilIcon />
              Edit
            </Button>
            <DeleteDonationButton id={id} name={donation.name} />
          </div>
        </div>
      </div>
    </div>
  );
}
