"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SectionNav } from "@/components/section-nav";
import { useMe } from "@/features/auth";
import { getProfileSections } from "@/features/profile/model/sections";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Profile");
  const router = useRouter();
  const { data: me } = useMe();

  const sections = me ? getProfileSections(me) : null;
  const noSections = sections?.length === 0;

  useEffect(() => {
    if (noSections) router.replace("/students");
  }, [noSections, router]);

  // While the session loads, SessionGuard's overlay covers the children.
  if (!sections) return <>{children}</>;
  if (noSections) return null;

  return (
    <div className="-m-4 flex flex-1">
      <SectionNav sections={sections.map((s) => ({ ...s, label: t(s.key) }))} />
      <div className="flex min-w-0 flex-1 flex-col p-4">{children}</div>
    </div>
  );
}
