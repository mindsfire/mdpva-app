import { cn } from "@/lib/utils";
import type { Role } from "@/lib/rbac";

const ROLE_STYLES: Record<Role, string> = {
  admin: "bg-mdpva-gold/25 text-mdpva-accent dark:text-mdpva-gold",
  editor: "bg-[#e8efe2] text-[#3d5a2c] dark:bg-[#2a3322] dark:text-[#b7d1a3]",
  viewer: "bg-[#ececE8] text-[#787770] dark:bg-[#232219] dark:text-[#a8a698]",
};

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium",
        ROLE_STYLES[role],
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

export function StatusBadge({ status }: { status: "active" | "disabled" }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        status === "active"
          ? "bg-[#e8efe2] text-[#3d5a2c] dark:bg-[#2a3322] dark:text-[#b7d1a3]"
          : "bg-[#f3e5df] text-[#a03d2e] dark:bg-[#3a2620] dark:text-[#e6a894]",
      )}
    >
      {status}
    </span>
  );
}
