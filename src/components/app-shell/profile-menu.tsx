"use client";

import * as React from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import {
  KeyRoundIcon,
  LaptopIcon,
  LogOutIcon,
  MoonIcon,
  SunIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";

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
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: LaptopIcon },
] as const;

/**
 * Icon-only light/dark/system switch. Lives inside the account menu rather
 * than as its own header button — theme is a set-once preference, not
 * something worth permanent header real estate.
 */
function ThemeIcons() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount flag; next-themes has no value until hydration
    setMounted(true);
  }, []);

  return (
    <div className="flex items-center gap-1 px-2 py-1.5">
      <span className="flex-1 text-xs text-muted-foreground">Theme</span>
      {THEMES.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            aria-label={label}
            title={label}
            aria-pressed={active}
            onClick={() => setTheme(value)}
            className={cn(
              "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              active && "bg-accent text-foreground",
            )}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}

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
      <DropdownMenuContent align="end" className="min-w-56">
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
        <ThemeIcons />
        <DropdownMenuSeparator />
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
