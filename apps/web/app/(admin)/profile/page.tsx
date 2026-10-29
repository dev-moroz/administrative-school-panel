"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/features/auth";
import { getProfileSections } from "@/features/profile/model/sections";

export default function ProfilePage() {
  const router = useRouter();
  const { data: me } = useMe();
  const first = me ? getProfileSections(me)[0]?.href : undefined;

  useEffect(() => {
    if (first) router.replace(first);
  }, [first, router]);

  return null;
}
