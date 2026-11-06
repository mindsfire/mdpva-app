import { notFound } from "next/navigation";

import { getDonation } from "@/app/actions/donations";
import { PageBreadcrumb } from "@/components/app-shell/page-breadcrumb";
import { DonationForm } from "@/components/donations/donation-form";
import { photoUrl } from "@/lib/photo-url";
import { hasRole, requireRole } from "@/lib/rbac";

export default async function EditDonationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessionUser = await requireRole("viewer");
  if (!hasRole(sessionUser.role, "admin")) notFound();

  const { id } = await params;
  const donation = await getDonation(id);
  if (!donation) notFound();

  return (
    <div className="flex flex-col gap-5">
      <PageBreadcrumb
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Donations", href: "/donations" },
          { label: donation.name, href: `/donations/${id}` },
          { label: "Edit" },
        ]}
      />
      <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
        Edit donation
      </h1>
      <DonationForm
        donation={{
          id,
          name: donation.name,
          businessName: donation.businessName,
          amount: donation.amount,
          photoSrc: photoUrl(donation.photoKey, donation.updatedAt) ?? "",
        }}
      />
    </div>
  );
}
