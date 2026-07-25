"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRoundIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { setUserRole, setUserStatus, type UserRow } from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Role } from "@/lib/rbac";
import { ResetPasswordDialog } from "@/components/users/reset-password-dialog";
import { RoleBadge, StatusBadge } from "@/components/users/role-badge";
import { UserFormDialog } from "@/components/users/user-form-dialog";

const ROLES: Role[] = ["viewer", "editor", "admin"];

export function UsersView({
  rows,
  currentUserId,
}: {
  rows: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [resetTarget, setResetTarget] = React.useState<UserRow | null>(null);

  async function handleRoleChange(row: UserRow, role: Role) {
    if (role === row.role) return;
    setPendingId(row.id);
    try {
      const result = await setUserRole(row.id, role);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${row.email} is now ${role}.`);
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function handleStatusToggle(row: UserRow) {
    const nextStatus = row.status === "active" ? "disabled" : "active";
    setPendingId(row.id);
    try {
      const result = await setUserStatus(row.id, nextStatus);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        nextStatus === "active" ? `${row.email} enabled.` : `${row.email} disabled.`,
      );
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <UserFormDialog
          trigger={
            <Button size="sm">
              <PlusIcon />
              Add user
            </Button>
          }
        />
      </div>

      <div className="hidden rounded-lg border border-mdpva-border dark:border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-foreground">
                  {row.name ?? "—"}
                  {row.id === currentUserId ? (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      (you)
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.email}
                </TableCell>
                <TableCell>
                  <RoleBadge role={row.role} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell>
                  <UserRowMenu
                    row={row}
                    disabled={pendingId === row.id}
                    onRoleChange={handleRoleChange}
                    onStatusToggle={handleStatusToggle}
                    onResetPassword={setResetTarget}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2.5 md:hidden">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-mdpva-border p-3 dark:border-border"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate font-medium text-foreground">
                {row.name ?? "—"}
                {row.id === currentUserId ? (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    (you)
                  </span>
                ) : null}
              </span>
              <span className="truncate text-sm text-muted-foreground">
                {row.email}
              </span>
              <div className="flex items-center gap-1.5">
                <RoleBadge role={row.role} />
                <StatusBadge status={row.status} />
              </div>
            </div>
            <UserRowMenu
              row={row}
              disabled={pendingId === row.id}
              onRoleChange={handleRoleChange}
              onStatusToggle={handleStatusToggle}
              onResetPassword={setResetTarget}
            />
          </div>
        ))}
      </div>

      {resetTarget ? (
        <ResetPasswordDialog
          userId={resetTarget.id}
          email={resetTarget.email}
          open={!!resetTarget}
          onOpenChange={(open) => {
            if (!open) setResetTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}

function UserRowMenu({
  row,
  disabled,
  onRoleChange,
  onStatusToggle,
  onResetPassword,
}: {
  row: UserRow;
  disabled: boolean;
  onRoleChange: (row: UserRow, role: Role) => void;
  onStatusToggle: (row: UserRow) => void;
  onResetPassword: (row: UserRow) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={`Actions for ${row.email}`}
          />
        }
      >
        <MoreHorizontalIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onResetPassword(row)}>
          <KeyRoundIcon className="size-4" />
          Reset password
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Change role</DropdownMenuLabel>
          {ROLES.map((role) => (
            <DropdownMenuItem
              key={role}
              disabled={role === row.role}
              onClick={() => onRoleChange(row, role)}
            >
              {role === "admin" ? "Admin" : role === "editor" ? "Editor" : "Viewer"}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant={row.status === "active" ? "destructive" : "default"}
          onClick={() => onStatusToggle(row)}
        >
          {row.status === "active" ? "Disable user" : "Enable user"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
