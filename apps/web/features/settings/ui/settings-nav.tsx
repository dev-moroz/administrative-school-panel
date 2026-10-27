"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { getAvailableSections } from "../model/sections";

export function SettingsNav({ permissions }: { permissions: string[] }) {
  const t = useTranslations("Settings");
  const pathname = usePathname();
  const sections = getAvailableSections(permissions);

  return (
    <nav className="w-[8.4rem] shrink-0 border-r bg-sidebar p-4">
      <ul className="flex flex-col gap-1">
        {sections.map((section) => {
          const active = pathname === section.href || pathname.startsWith(`${section.href}/`);
          return (
            <li key={section.key}>
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                )}
              >
                {t(section.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
