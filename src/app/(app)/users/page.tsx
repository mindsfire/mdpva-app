import { notFound } from "next/navigation";

import { hasRole, requireRole } from "@/lib/rbac";
import { listUsers } from "@/app/actions/users";
import { UsersView } from "@/components/users/users-view";

export default async function UsersPage() {
  const sessionUser = await requireRole("viewer");

  // Non-admins get a 404, not a redirect hint that this route exists.
  if (!hasRole(sessionUser.role, "admin")) {
    notFound();
  }

  const rows = await listUsers();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
          Users
        </h1>
      </div>
      <UsersView rows={rows} currentUserId={sessionUser.id} />
    </div>
  );
}
