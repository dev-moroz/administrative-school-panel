import { CalendarDays, CreditCard, Users, type LucideIcon } from "lucide-react";

export type NavItem = {
  labelKey: "students" | "lessons" | "payments";
  href: string;
  icon: LucideIcon;
  permission: string;
};

export const NAV_ITEMS: NavItem[] = [
  { labelKey: "students", href: "/students", icon: Users, permission: "students.read.all" },
  { labelKey: "lessons", href: "/lessons", icon: CalendarDays, permission: "lessons.read" },
  { labelKey: "payments", href: "/payments", icon: CreditCard, permission: "payments.read" },
];
