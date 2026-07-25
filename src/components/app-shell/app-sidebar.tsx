"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon,
  ContactIcon,
  UsersIcon,
  ArrowDownUpIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { SidebarResizer } from "@/components/app-shell/sidebar-resizer";

const mainNav = [
  { title: "Dashboard", href: "/", icon: LayoutDashboardIcon },
  { title: "Members", href: "/members", icon: ContactIcon },
];

const adminNav = [
  { title: "Users", href: "/users", icon: UsersIcon },
  { title: "Import / Export", href: "/import", icon: ArrowDownUpIcon },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppSidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const renderItem = (item: { title: string; href: string; icon: React.ComponentType }) => (
    <SidebarMenuItem key={item.href}>
      <SidebarMenuButton
        isActive={isActive(pathname, item.href)}
        tooltip={item.title}
        render={<Link href={item.href} onClick={() => setOpenMobile(false)} />}
      >
        <item.icon />
        <span>{item.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/"
          onClick={() => setOpenMobile(false)}
          className="flex h-10 items-center gap-2 rounded-md px-2"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-mdpva-gold font-serif text-[11px] font-semibold text-mdpva-accent dark:text-mdpva-gold">
            M
          </span>
          <span className="truncate font-serif text-lg font-medium tracking-tight group-data-[collapsible=icon]:hidden">
            MDPVA
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{mainNav.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin ? (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{adminNav.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter>
        <p className="px-2 pb-1 text-[11px] leading-snug text-muted-foreground group-data-[collapsible=icon]:hidden">
          Members portal · 2025–27 term
        </p>
      </SidebarFooter>

      <SidebarResizer />
    </Sidebar>
  );
}
