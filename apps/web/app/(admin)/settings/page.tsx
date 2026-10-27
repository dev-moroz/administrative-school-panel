"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/features/auth";
import { getAvailableSections } from "@/features/settings";

export default function SettingsPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const firstHref = me ? getAvailableSections(me.permissions)[0]?.href : undefined;

  useEffect(() => {
    if (firstHref) router.replace(firstHref);
  }, [firstHref, router]);

  return null;
}
