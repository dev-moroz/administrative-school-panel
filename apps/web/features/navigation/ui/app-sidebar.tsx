"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleUser, LogOut, Settings as SettingsIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { logout, meQueryKey, useMe } from "@/features/auth";
import { getProfileSections } from "@/features/profile/model/sections";
import { getAvailableSections } from "@/features/settings";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { NAV_ITEMS } from "../model/nav-items";

export function AppSidebar() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useMe();

  const { mutate: signOut, isPending } = useMutation({
    mutationFn: logout,
    onSettled: () => {
      queryClient.removeQueries({ queryKey: meQueryKey });
      router.replace("/login");
    },
  });

  const items = me
    ? NAV_ITEMS.filter((item) => me.permissions.includes(item.permission))
    : [];
  const showProfile = me ? getProfileSections(me).length > 0 : false;
  const showSettings = me ? getAvailableSections(me.permissions).length > 0 : false;

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {!me &&
                NAV_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <div className="flex h-12 items-center gap-2 px-2">
                      <Skeleton className="size-5" />
                      <Skeleton className="h-4 flex-1" />
                    </div>
                  </SidebarMenuItem>
                ))}
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    size="lg"
                    className="text-base [&_svg]:size-5"
                    isActive={pathname.startsWith(item.href)}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{t(item.labelKey)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {showProfile && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild size="lg" className="text-base [&_svg]:size-5" isActive={pathname.startsWith("/profile")}>
                <Link href="/profile">
                  <CircleUser />
                  <span>{t("profile")}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {showSettings && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                size="lg"
                className="text-base [&_svg]:size-5"
                isActive={pathname.startsWith("/settings")}
              >
                <Link href="/settings">
                  <SettingsIcon />
                  <span>{t("settings")}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator className="my-2" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="text-base [&_svg]:size-5"
              disabled={isPending}
              onClick={() => signOut()}
            >
              <LogOut />
              <span>{t("logout")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
