"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { KeyRoundIcon, LogOutIcon, UserIcon, UsersIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ProfileMenu({
  name,
  isAdmin = false,
}: {
  name: string;
  isAdmin?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon" aria-label="Account menu">
            <UserIcon className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{name}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {isAdmin ? (
          <DropdownMenuItem render={<Link href="/users" />} className="sm:hidden">
            <UsersIcon className="size-4" />
            Users
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem render={<Link href="/change-password" />}>
          <KeyRoundIcon className="size-4" />
          Change password
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOutIcon className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
