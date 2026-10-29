"use client";

import { useTranslations } from "next-intl";
import { SectionNav } from "@/components/section-nav";
import { getAvailableSections } from "../model/sections";

export function SettingsNav({ permissions }: { permissions: string[] }) {
  const t = useTranslations("Settings");
  const sections = getAvailableSections(permissions).map((s) => ({ key: s.key, href: s.href, label: t(s.key) }));
  return <SectionNav sections={sections} />;
}
