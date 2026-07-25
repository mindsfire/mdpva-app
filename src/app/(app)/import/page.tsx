import { notFound } from "next/navigation";

import { hasRole, requireRole } from "@/lib/rbac";
import { ImportView } from "@/components/import/import-view";

export default async function ImportPage() {
  const sessionUser = await requireRole("viewer");

  // Non-admins get a 404, not a redirect hint that this route exists.
  if (!hasRole(sessionUser.role, "admin")) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
          Import / Export
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bulk-load members from a CSV, or download the directory.
        </p>
      </div>
      <ImportView />
    </div>
  );
}
