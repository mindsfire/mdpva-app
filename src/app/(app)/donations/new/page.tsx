import { notFound } from "next/navigation";

import { PageBreadcrumb } from "@/components/app-shell/page-breadcrumb";
import { DonationForm } from "@/components/donations/donation-form";
import { hasRole, requireRole } from "@/lib/rbac";

export default async function NewDonationPage() {
  const sessionUser = await requireRole("viewer");
  if (!hasRole(sessionUser.role, "admin")) notFound();

  return (
    <div className="flex flex-col gap-5">
      <PageBreadcrumb
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Donations", href: "/donations" },
          { label: "Add" },
        ]}
      />
      <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
        Add donation
      </h1>
      <DonationForm />
    </div>
  );
}
