"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { logout, useMe } from "@/features/auth";

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { error } = useMe();
  const unauthorized = error instanceof ApiError && error.status === 401;

  // Clear the stale cookie first, otherwise proxy.ts bounces /login back to /.
  useEffect(() => {
    if (!unauthorized) return;
    logout()
      .catch(() => {})
      .finally(() => router.replace("/login"));
  }, [unauthorized, router]);

  return unauthorized ? null : children;
}
